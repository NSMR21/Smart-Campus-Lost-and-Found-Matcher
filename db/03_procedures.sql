-- =====================================================================
--  03_procedures.sql  -  Stored procedures
--  Every procedure that changes several rows runs inside a TRANSACTION
--  with an EXIT HANDLER that rolls back and re-raises the error.
-- =====================================================================
USE campus_lostfound;

DROP PROCEDURE IF EXISTS sp_register_student;
DROP PROCEDURE IF EXISTS sp_match_candidates_for_lost;
DROP PROCEDURE IF EXISTS sp_match_candidates_for_found;
DROP PROCEDURE IF EXISTS sp_upsert_match;
DROP PROCEDURE IF EXISTS sp_refresh_all_rule_matches;
DROP PROCEDURE IF EXISTS sp_flag_strong_match;
DROP PROCEDURE IF EXISTS sp_submit_claim;
DROP PROCEDURE IF EXISTS sp_withdraw_claim;
DROP PROCEDURE IF EXISTS sp_verify_claim;
DROP PROCEDURE IF EXISTS sp_record_return;
DROP PROCEDURE IF EXISTS sp_apply_handover;
DROP PROCEDURE IF EXISTS sp_change_user_role;
DROP PROCEDURE IF EXISTS sp_dispose_unclaimed;
DROP PROCEDURE IF EXISTS sp_remind_stale_reports;

DELIMITER $$

-- ---------------------------------------------------------------------
-- Registers a student: one row in users + one row in student_profiles.
-- Both inserts succeed together or not at all (atomicity).
-- ---------------------------------------------------------------------
CREATE PROCEDURE sp_register_student(
  IN  p_full_name     VARCHAR(80),
  IN  p_email         VARCHAR(120),
  IN  p_phone         CHAR(10),
  IN  p_password_hash CHAR(60),
  IN  p_srn           CHAR(13),
  IN  p_dept_id       TINYINT UNSIGNED,
  IN  p_year          TINYINT UNSIGNED,
  OUT p_user_id       INT UNSIGNED)
BEGIN
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;
    INSERT INTO users (full_name, email, phone, password_hash, role_id)
    VALUES (TRIM(p_full_name), LOWER(TRIM(p_email)), NULLIF(TRIM(p_phone), ''), p_password_hash,
            (SELECT role_id FROM roles WHERE role_name = 'STUDENT'));
    SET p_user_id = LAST_INSERT_ID();

    INSERT INTO student_profiles (user_id, srn, dept_id, year_of_study)
    VALUES (p_user_id, UPPER(TRIM(p_srn)), p_dept_id, p_year);

    INSERT INTO notifications (user_id, notif_type, message, link)
    VALUES (p_user_id, 'SYSTEM', 'Welcome! Report a lost item or browse found items to get started.', '/dashboard');
  COMMIT;
END$$

-- ---------------------------------------------------------------------
-- Candidate found items for a lost report, ranked by the rule score.
-- (The web app merges this list with the vector-database neighbours.)
-- ---------------------------------------------------------------------
CREATE PROCEDURE sp_match_candidates_for_lost(IN p_lost_id INT UNSIGNED, IN p_limit INT)
BEGIN
  SELECT f.found_id, fn_rule_match_score(p_lost_id, f.found_id) AS rule_score
  FROM found_items f
  JOIN lost_items l ON l.lost_id = p_lost_id
  WHERE f.status IN ('AVAILABLE', 'CLAIM_PENDING')
    AND f.found_date BETWEEN l.lost_date - INTERVAL 1 DAY AND l.lost_date + INTERVAL 60 DAY
    AND f.finder_id <> l.owner_id
  HAVING rule_score >= 0.30
  ORDER BY rule_score DESC
  LIMIT p_limit;
END$$

-- Candidate lost reports for a newly found item.
CREATE PROCEDURE sp_match_candidates_for_found(IN p_found_id INT UNSIGNED, IN p_limit INT)
BEGIN
  SELECT l.lost_id, fn_rule_match_score(l.lost_id, p_found_id) AS rule_score
  FROM lost_items l
  JOIN found_items f ON f.found_id = p_found_id
  WHERE l.status IN ('OPEN', 'MATCHED')
    AND l.lost_date BETWEEN f.found_date - INTERVAL 60 DAY AND f.found_date + INTERVAL 1 DAY
    AND l.owner_id <> f.finder_id
  HAVING rule_score >= 0.30
  ORDER BY rule_score DESC
  LIMIT p_limit;
END$$

-- ---------------------------------------------------------------------
-- Stores / refreshes one lost<->found pair.
-- rule_score is always recomputed in SQL; semantic_score comes from the vector DB.
-- New pairs are stored only when total_score >= p_min_total.
-- ---------------------------------------------------------------------
CREATE PROCEDURE sp_upsert_match(
  IN p_lost_id   INT UNSIGNED,
  IN p_found_id  INT UNSIGNED,
  IN p_semantic  DECIMAL(5,4),
  IN p_min_total DECIMAL(5,4))
BEGIN
  DECLARE v_rule DECIMAL(5,4);
  DECLARE v_sem  DECIMAL(5,4) DEFAULT LEAST(GREATEST(COALESCE(p_semantic, 0), 0), 1);

  SET v_rule = fn_rule_match_score(p_lost_id, p_found_id);

  IF EXISTS (SELECT 1 FROM potential_matches WHERE lost_id = p_lost_id AND found_id = p_found_id) THEN
    UPDATE potential_matches
       SET rule_score = v_rule, semantic_score = v_sem
     WHERE lost_id = p_lost_id AND found_id = p_found_id;
  ELSEIF ROUND(0.6 * v_rule + 0.4 * v_sem, 4) >= p_min_total THEN
    INSERT INTO potential_matches (lost_id, found_id, rule_score, semantic_score)
    VALUES (p_lost_id, p_found_id, v_rule, v_sem);
  END IF;
END$$

-- ---------------------------------------------------------------------
-- Pure-SQL matching for every open lost report (set based INSERT ... SELECT).
-- Works even without the vector database (semantic_score = 0).
-- ---------------------------------------------------------------------
CREATE PROCEDURE sp_refresh_all_rule_matches(IN p_min_total DECIMAL(5,4))
BEGIN
  DECLARE v_affected INT;

  -- Candidates go to a temporary table first: the potential_matches trigger may
  -- update lost_items, which MySQL forbids while the same INSERT is reading lost_items.
  DROP TEMPORARY TABLE IF EXISTS tmp_rule_candidates;
  CREATE TEMPORARY TABLE tmp_rule_candidates AS
    SELECT l.lost_id, f.found_id, fn_rule_match_score(l.lost_id, f.found_id) AS rule_score
    FROM lost_items l
    JOIN found_items f
      ON f.found_date BETWEEN l.lost_date - INTERVAL 1 DAY AND l.lost_date + INTERVAL 60 DAY
     AND f.finder_id <> l.owner_id
    WHERE l.status IN ('OPEN', 'MATCHED')
      AND f.status IN ('AVAILABLE', 'CLAIM_PENDING');

  INSERT INTO potential_matches (lost_id, found_id, rule_score, semantic_score)
  SELECT c.lost_id, c.found_id, c.rule_score, 0
  FROM tmp_rule_candidates c
  WHERE 0.6 * c.rule_score >= p_min_total
  ON DUPLICATE KEY UPDATE rule_score = c.rule_score;
  SET v_affected = ROW_COUNT();

  DROP TEMPORARY TABLE tmp_rule_candidates;
  SELECT v_affected AS affected_rows;
END$$

-- Called by the potential_matches triggers when a pair crosses the "strong match" threshold.
CREATE PROCEDURE sp_flag_strong_match(IN p_lost_id INT UNSIGNED, IN p_found_id INT UNSIGNED, IN p_score DECIMAL(5,4))
BEGIN
  DECLARE v_owner INT UNSIGNED;
  DECLARE v_lost_title, v_found_title VARCHAR(100);

  SELECT owner_id, title INTO v_owner, v_lost_title FROM lost_items WHERE lost_id = p_lost_id;
  SELECT title INTO v_found_title FROM found_items WHERE found_id = p_found_id;

  UPDATE lost_items SET status = 'MATCHED' WHERE lost_id = p_lost_id AND status = 'OPEN';

  INSERT INTO notifications (user_id, notif_type, message, link)
  VALUES (v_owner, 'MATCH',
          LEFT(CONCAT('Possible match for "', v_lost_title, '": found item "', v_found_title, '" (',
                      ROUND(p_score * 100), '% match).'), 255),
          CONCAT('/lost/', p_lost_id));
END$$

-- ---------------------------------------------------------------------
-- Claim submission with row locking (SELECT ... FOR UPDATE) so the item's
-- status cannot change between the check and the insert.
-- ---------------------------------------------------------------------
CREATE PROCEDURE sp_submit_claim(
  IN  p_found_id    INT UNSIGNED,
  IN  p_claimant_id INT UNSIGNED,
  IN  p_lost_id     INT UNSIGNED,
  IN  p_proof       TEXT,
  OUT p_claim_id    INT UNSIGNED)
BEGIN
  DECLARE v_status VARCHAR(14);
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  IF NOT fn_has_permission(p_claimant_id, 'CLAIM_SUBMIT') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Permission denied: CLAIM_SUBMIT';
  END IF;

  START TRANSACTION;
    SELECT status INTO v_status FROM found_items WHERE found_id = p_found_id FOR UPDATE;
    IF v_status IS NULL THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Found item does not exist';
    END IF;
    IF v_status NOT IN ('AVAILABLE', 'CLAIM_PENDING') THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'This item is no longer open for claims';
    END IF;

    INSERT INTO claims (found_id, claimant_id, lost_id, proof_details)
    VALUES (p_found_id, p_claimant_id, p_lost_id, TRIM(p_proof));
    SET p_claim_id = LAST_INSERT_ID();
  COMMIT;
END$$

CREATE PROCEDURE sp_withdraw_claim(IN p_claim_id INT UNSIGNED, IN p_user_id INT UNSIGNED)
BEGIN
  DECLARE v_claimant INT UNSIGNED;
  DECLARE v_status VARCHAR(10);
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;
    SELECT claimant_id, claim_status INTO v_claimant, v_status
    FROM claims WHERE claim_id = p_claim_id FOR UPDATE;
    IF v_claimant IS NULL OR v_claimant <> p_user_id THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'You can only withdraw your own claim';
    END IF;
    IF v_status <> 'PENDING' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only pending claims can be withdrawn';
    END IF;
    UPDATE claims SET claim_status = 'WITHDRAWN' WHERE claim_id = p_claim_id;
  COMMIT;
END$$

-- ---------------------------------------------------------------------
-- Verification of a claim by STAFF/ADMIN.
-- Locks the claim and the item, validates the state, then inserts the decision.
-- Triggers on verifications/claims cascade the status changes and notifications.
-- ---------------------------------------------------------------------
CREATE PROCEDURE sp_verify_claim(
  IN p_claim_id    INT UNSIGNED,
  IN p_verifier_id INT UNSIGNED,
  IN p_decision    VARCHAR(10),
  IN p_remarks     VARCHAR(255))
BEGIN
  DECLARE v_status   VARCHAR(10);
  DECLARE v_found_id INT UNSIGNED;
  DECLARE v_claimant INT UNSIGNED;
  DECLARE v_item_status VARCHAR(14);
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  IF NOT fn_has_permission(p_verifier_id, 'CLAIM_VERIFY') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Permission denied: CLAIM_VERIFY';
  END IF;
  IF p_decision NOT IN ('APPROVED', 'REJECTED') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Decision must be APPROVED or REJECTED';
  END IF;

  START TRANSACTION;
    SELECT claim_status, found_id, claimant_id INTO v_status, v_found_id, v_claimant
    FROM claims WHERE claim_id = p_claim_id FOR UPDATE;

    IF v_status IS NULL THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Claim does not exist';
    END IF;
    IF v_status <> 'PENDING' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'This claim has already been decided';
    END IF;
    IF v_claimant = p_verifier_id THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'You cannot verify your own claim';
    END IF;

    -- lock the item so two staff members cannot approve two claims for it concurrently
    SELECT status INTO v_item_status FROM found_items WHERE found_id = v_found_id FOR UPDATE;
    IF p_decision = 'APPROVED' AND v_item_status NOT IN ('AVAILABLE', 'CLAIM_PENDING') THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Another claim for this item is already approved or the item is closed';
    END IF;

    INSERT INTO verifications (claim_id, verifier_id, decision, remarks)
    VALUES (p_claim_id, p_verifier_id, p_decision, NULLIF(TRIM(p_remarks), ''));
  COMMIT;
END$$

-- ---------------------------------------------------------------------
-- Hand-over of an item to the verified owner.
-- ---------------------------------------------------------------------
CREATE PROCEDURE sp_record_return(
  IN  p_claim_id         INT UNSIGNED,
  IN  p_staff_id         INT UNSIGNED,
  IN  p_id_proof_checked BOOLEAN,
  IN  p_remarks          VARCHAR(255),
  OUT p_return_id        INT UNSIGNED)
BEGIN
  DECLARE v_status   VARCHAR(10);
  DECLARE v_found_id INT UNSIGNED;
  DECLARE v_item_status VARCHAR(14);
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  IF NOT fn_has_permission(p_staff_id, 'RETURN_RECORD') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Permission denied: RETURN_RECORD';
  END IF;

  START TRANSACTION;
    SELECT claim_status, found_id INTO v_status, v_found_id
    FROM claims WHERE claim_id = p_claim_id FOR UPDATE;
    IF v_status IS NULL OR v_status <> 'APPROVED' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only an approved claim can be handed over';
    END IF;

    SELECT status INTO v_item_status FROM found_items WHERE found_id = v_found_id FOR UPDATE;
    IF v_item_status <> 'CLAIM_APPROVED' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Item is not waiting for hand-over';
    END IF;

    INSERT INTO item_returns (claim_id, handled_by, id_proof_checked, handover_status, remarks)
    VALUES (p_claim_id, p_staff_id, COALESCE(p_id_proof_checked, FALSE), 'HANDED_OVER', NULLIF(TRIM(p_remarks), ''));
    SET p_return_id = LAST_INSERT_ID();
  COMMIT;
END$$

-- Status changes after a successful hand-over (called from the item_returns triggers).
CREATE PROCEDURE sp_apply_handover(IN p_claim_id INT UNSIGNED)
BEGIN
  DECLARE v_found_id, v_lost_id, v_claimant, v_finder INT UNSIGNED;
  DECLARE v_title VARCHAR(100);

  SELECT c.found_id, c.lost_id, c.claimant_id, f.finder_id, f.title
    INTO v_found_id, v_lost_id, v_claimant, v_finder, v_title
  FROM claims c JOIN found_items f ON f.found_id = c.found_id
  WHERE c.claim_id = p_claim_id;

  UPDATE found_items SET status = 'RETURNED' WHERE found_id = v_found_id;

  -- claim not linked to a lost report: use the owner's best-matching report, if any
  IF v_lost_id IS NULL THEN
    SELECT pm.lost_id INTO v_lost_id
    FROM potential_matches pm
    JOIN lost_items l ON l.lost_id = pm.lost_id
    WHERE pm.found_id = v_found_id AND l.owner_id = v_claimant
    ORDER BY pm.total_score DESC
    LIMIT 1;
  END IF;

  IF v_lost_id IS NOT NULL THEN
    UPDATE lost_items SET status = 'RECOVERED'
    WHERE lost_id = v_lost_id AND status IN ('OPEN', 'MATCHED');
    UPDATE potential_matches SET match_status = 'CONFIRMED'
    WHERE lost_id = v_lost_id AND found_id = v_found_id;
  END IF;
  -- the case is closed: other suggestions for this item / this report are no longer relevant
  UPDATE potential_matches SET match_status = 'DISMISSED'
  WHERE match_status = 'SUGGESTED' AND (found_id = v_found_id OR lost_id = v_lost_id);

  INSERT INTO notifications (user_id, notif_type, message, link) VALUES
    (v_claimant, 'RETURN', LEFT(CONCAT('"', v_title, '" has been handed over to you. Case closed.'), 255),
     CONCAT('/claims/', p_claim_id)),
    (v_finder, 'RETURN', LEFT(CONCAT('Thank you! The "', v_title, '" you found is back with its owner.'), 255),
     CONCAT('/found/', v_found_id));
END$$

-- ---------------------------------------------------------------------
-- ADMIN: change a user's role (RBAC administration).
-- Prevents the system from losing its last active administrator.
-- ---------------------------------------------------------------------
CREATE PROCEDURE sp_change_user_role(IN p_admin_id INT UNSIGNED, IN p_user_id INT UNSIGNED, IN p_role_name VARCHAR(20))
BEGIN
  DECLARE v_new_role TINYINT UNSIGNED;
  DECLARE v_current  VARCHAR(20);
  DECLARE v_admins   INT;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  IF NOT fn_has_permission(p_admin_id, 'USER_MANAGE') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Permission denied: USER_MANAGE';
  END IF;
  SELECT role_id INTO v_new_role FROM roles WHERE role_name = p_role_name;
  IF v_new_role IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Unknown role';
  END IF;

  START TRANSACTION;
    SELECT r.role_name INTO v_current
    FROM users u JOIN roles r ON r.role_id = u.role_id
    WHERE u.user_id = p_user_id FOR UPDATE;
    IF v_current IS NULL THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'User does not exist';
    END IF;

    SELECT COUNT(*) INTO v_admins
    FROM users u JOIN roles r ON r.role_id = u.role_id
    WHERE r.role_name = 'ADMIN' AND u.is_active;
    IF v_current = 'ADMIN' AND p_role_name <> 'ADMIN' AND v_admins <= 1 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Cannot remove the last active administrator';
    END IF;

    UPDATE users SET role_id = v_new_role WHERE user_id = p_user_id;
    INSERT INTO notifications (user_id, notif_type, message, link)
    VALUES (p_user_id, 'SYSTEM', CONCAT('Your role was changed from ', v_current, ' to ', p_role_name, '.'), '/dashboard');
    INSERT INTO audit_log (table_name, record_id, action, old_value, new_value, changed_by)
    VALUES ('users', p_user_id, 'UPDATE', v_current, p_role_name, p_admin_id);
  COMMIT;
END$$

-- ---------------------------------------------------------------------
-- ADMIN: items unclaimed for more than p_days are donated / disposed.
-- ---------------------------------------------------------------------
CREATE PROCEDURE sp_dispose_unclaimed(IN p_admin_id INT UNSIGNED, IN p_days INT, OUT p_count INT)
BEGIN
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  IF NOT fn_has_permission(p_admin_id, 'ITEM_DISPOSE') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Permission denied: ITEM_DISPOSE';
  END IF;
  IF p_days < 30 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Items must be kept for at least 30 days';
  END IF;

  START TRANSACTION;
    UPDATE found_items
       SET status = 'DISPOSED'
     WHERE status = 'AVAILABLE'
       AND found_date < CURDATE() - INTERVAL p_days DAY;
    SET p_count = ROW_COUNT();
  COMMIT;
END$$

-- ---------------------------------------------------------------------
-- CURSOR example: remind owners of lost reports that are still OPEN after
-- p_days days and have no suggested match yet.
-- ---------------------------------------------------------------------
CREATE PROCEDURE sp_remind_stale_reports(IN p_days INT, OUT p_reminded INT)
BEGIN
  DECLARE v_done     BOOLEAN DEFAULT FALSE;
  DECLARE v_lost_id  INT UNSIGNED;
  DECLARE v_owner_id INT UNSIGNED;
  DECLARE v_title    VARCHAR(100);

  DECLARE cur_stale CURSOR FOR
    SELECT l.lost_id, l.owner_id, l.title
    FROM lost_items l
    WHERE l.status = 'OPEN'
      AND l.lost_date <= CURDATE() - INTERVAL p_days DAY
      AND NOT EXISTS (SELECT 1 FROM potential_matches pm
                      WHERE pm.lost_id = l.lost_id AND pm.match_status <> 'DISMISSED');
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = TRUE;

  SET p_reminded = 0;
  OPEN cur_stale;
  read_loop: LOOP
    FETCH cur_stale INTO v_lost_id, v_owner_id, v_title;
    IF v_done THEN
      LEAVE read_loop;
    END IF;
    INSERT INTO notifications (user_id, notif_type, message, link)
    VALUES (v_owner_id, 'SYSTEM',
            LEFT(CONCAT('Still looking for "', v_title, '"? Add more details or check the Found Items list.'), 255),
            CONCAT('/lost/', v_lost_id));
    SET p_reminded = p_reminded + 1;
  END LOOP;
  CLOSE cur_stale;
END$$

DELIMITER ;
