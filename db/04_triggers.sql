-- =====================================================================
--  04_triggers.sql  -  Triggers
--  BEFORE triggers  : validation / normalisation of incoming rows
--  AFTER triggers   : automatic status changes, notifications, audit trail
--  @app_user_id     : session variable set by the web app = logged-in user
-- =====================================================================
USE campus_lostfound;

DROP TRIGGER IF EXISTS trg_users_before_insert;
DROP TRIGGER IF EXISTS trg_student_profiles_before_insert;
DROP TRIGGER IF EXISTS trg_lost_items_before_insert;
DROP TRIGGER IF EXISTS trg_lost_items_before_update;
DROP TRIGGER IF EXISTS trg_lost_items_after_insert;
DROP TRIGGER IF EXISTS trg_lost_items_after_update;
DROP TRIGGER IF EXISTS trg_lost_items_after_delete;
DROP TRIGGER IF EXISTS trg_found_items_before_insert;
DROP TRIGGER IF EXISTS trg_found_items_before_update;
DROP TRIGGER IF EXISTS trg_found_items_after_insert;
DROP TRIGGER IF EXISTS trg_found_items_after_update;
DROP TRIGGER IF EXISTS trg_found_items_after_delete;
DROP TRIGGER IF EXISTS trg_matches_after_insert;
DROP TRIGGER IF EXISTS trg_matches_after_update;
DROP TRIGGER IF EXISTS trg_claims_before_insert;
DROP TRIGGER IF EXISTS trg_claims_after_insert;
DROP TRIGGER IF EXISTS trg_claims_after_update;
DROP TRIGGER IF EXISTS trg_verifications_before_insert;
DROP TRIGGER IF EXISTS trg_verifications_after_insert;
DROP TRIGGER IF EXISTS trg_item_returns_before_insert;
DROP TRIGGER IF EXISTS trg_item_returns_after_insert;
DROP TRIGGER IF EXISTS trg_item_returns_after_update;

DELIMITER $$

-- ------------------------------------------------------------ users
CREATE TRIGGER trg_users_before_insert
BEFORE INSERT ON users
FOR EACH ROW
BEGIN
  SET NEW.email = LOWER(TRIM(NEW.email));
  SET NEW.full_name = TRIM(NEW.full_name);
END$$

CREATE TRIGGER trg_student_profiles_before_insert
BEFORE INSERT ON student_profiles
FOR EACH ROW
BEGIN
  SET NEW.srn = UPPER(TRIM(NEW.srn));
END$$

-- ------------------------------------------------------------ lost_items
CREATE TRIGGER trg_lost_items_before_insert
BEFORE INSERT ON lost_items
FOR EACH ROW
BEGIN
  IF NEW.lost_date > CURDATE() THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Lost date cannot be in the future';
  END IF;
  IF NEW.lost_date < CURDATE() - INTERVAL 1 YEAR THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Lost date cannot be more than one year ago';
  END IF;
  SET NEW.title = TRIM(NEW.title);
  SET NEW.color = LOWER(NEW.color);
  SET NEW.brand = NULLIF(TRIM(NEW.brand), '');
END$$

CREATE TRIGGER trg_lost_items_before_update
BEFORE UPDATE ON lost_items
FOR EACH ROW
BEGIN
  IF NEW.lost_date > CURDATE() THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Lost date cannot be in the future';
  END IF;
  IF OLD.status = 'RECOVERED' AND NEW.status <> 'RECOVERED' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A recovered report cannot be reopened';
  END IF;
  SET NEW.brand = NULLIF(TRIM(NEW.brand), '');
END$$

CREATE TRIGGER trg_lost_items_after_insert
AFTER INSERT ON lost_items
FOR EACH ROW
BEGIN
  INSERT INTO audit_log (table_name, record_id, action, new_value, changed_by)
  VALUES ('lost_items', NEW.lost_id, 'INSERT', NEW.status, COALESCE(@app_user_id, NEW.owner_id));
END$$

CREATE TRIGGER trg_lost_items_after_update
AFTER UPDATE ON lost_items
FOR EACH ROW
BEGIN
  IF NOT (OLD.status <=> NEW.status) THEN
    INSERT INTO audit_log (table_name, record_id, action, old_value, new_value, changed_by)
    VALUES ('lost_items', NEW.lost_id, 'UPDATE', OLD.status, NEW.status, @app_user_id);
  END IF;
END$$

CREATE TRIGGER trg_lost_items_after_delete
AFTER DELETE ON lost_items
FOR EACH ROW
BEGIN
  INSERT INTO audit_log (table_name, record_id, action, old_value, changed_by)
  VALUES ('lost_items', OLD.lost_id, 'DELETE', OLD.status, @app_user_id);
END$$

-- ------------------------------------------------------------ found_items
CREATE TRIGGER trg_found_items_before_insert
BEFORE INSERT ON found_items
FOR EACH ROW
BEGIN
  IF NEW.found_date > CURDATE() THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Found date cannot be in the future';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM locations WHERE location_id = NEW.held_at_id AND is_collection_point) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Found items must be held at a designated collection point';
  END IF;
  SET NEW.title = TRIM(NEW.title);
  SET NEW.color = LOWER(NEW.color);
  SET NEW.brand = NULLIF(TRIM(NEW.brand), '');
  SET NEW.hidden_marks = NULLIF(TRIM(NEW.hidden_marks), '');
END$$

CREATE TRIGGER trg_found_items_before_update
BEFORE UPDATE ON found_items
FOR EACH ROW
BEGIN
  IF NEW.found_date > CURDATE() THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Found date cannot be in the future';
  END IF;
  IF OLD.status IN ('RETURNED', 'DISPOSED') AND NEW.status <> OLD.status THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Returned or disposed items are closed and cannot change status';
  END IF;
  IF NEW.held_at_id <> OLD.held_at_id
     AND NOT EXISTS (SELECT 1 FROM locations WHERE location_id = NEW.held_at_id AND is_collection_point) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Found items must be held at a designated collection point';
  END IF;
  SET NEW.brand = NULLIF(TRIM(NEW.brand), '');
END$$

CREATE TRIGGER trg_found_items_after_insert
AFTER INSERT ON found_items
FOR EACH ROW
BEGIN
  INSERT INTO audit_log (table_name, record_id, action, new_value, changed_by)
  VALUES ('found_items', NEW.found_id, 'INSERT', NEW.status, COALESCE(@app_user_id, NEW.finder_id));
END$$

CREATE TRIGGER trg_found_items_after_update
AFTER UPDATE ON found_items
FOR EACH ROW
BEGIN
  IF NOT (OLD.status <=> NEW.status) THEN
    INSERT INTO audit_log (table_name, record_id, action, old_value, new_value, changed_by)
    VALUES ('found_items', NEW.found_id, 'UPDATE', OLD.status, NEW.status, @app_user_id);
  END IF;
END$$

CREATE TRIGGER trg_found_items_after_delete
AFTER DELETE ON found_items
FOR EACH ROW
BEGIN
  INSERT INTO audit_log (table_name, record_id, action, old_value, changed_by)
  VALUES ('found_items', OLD.found_id, 'DELETE', OLD.status, @app_user_id);
END$$

-- ------------------------------------------------------------ potential_matches
-- A pair whose total score reaches 0.55 is a "strong match":
-- the lost report becomes MATCHED and its owner gets a notification.
CREATE TRIGGER trg_matches_after_insert
AFTER INSERT ON potential_matches
FOR EACH ROW
BEGIN
  IF NEW.total_score >= 0.55 AND NEW.match_status = 'SUGGESTED' THEN
    CALL sp_flag_strong_match(NEW.lost_id, NEW.found_id, NEW.total_score);
  END IF;
END$$

CREATE TRIGGER trg_matches_after_update
AFTER UPDATE ON potential_matches
FOR EACH ROW
BEGIN
  IF NEW.match_status = 'SUGGESTED' AND NEW.total_score >= 0.55 AND OLD.total_score < 0.55 THEN
    CALL sp_flag_strong_match(NEW.lost_id, NEW.found_id, NEW.total_score);
  END IF;
END$$

-- ------------------------------------------------------------ claims
CREATE TRIGGER trg_claims_before_insert
BEFORE INSERT ON claims
FOR EACH ROW
BEGIN
  DECLARE v_finder INT UNSIGNED;
  DECLARE v_status VARCHAR(14);
  DECLARE v_owner  INT UNSIGNED;

  SELECT finder_id, status INTO v_finder, v_status FROM found_items WHERE found_id = NEW.found_id;
  IF v_finder = NEW.claimant_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'You cannot claim an item that you reported as found';
  END IF;
  IF v_status NOT IN ('AVAILABLE', 'CLAIM_PENDING') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'This item is no longer open for claims';
  END IF;
  IF NEW.lost_id IS NOT NULL THEN
    SELECT owner_id INTO v_owner FROM lost_items WHERE lost_id = NEW.lost_id;
    IF v_owner IS NULL OR v_owner <> NEW.claimant_id THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'The linked lost report must belong to the claimant';
    END IF;
  END IF;
  SET NEW.claim_status = 'PENDING';
END$$

CREATE TRIGGER trg_claims_after_insert
AFTER INSERT ON claims
FOR EACH ROW
BEGIN
  UPDATE found_items SET status = 'CLAIM_PENDING'
  WHERE found_id = NEW.found_id AND status = 'AVAILABLE';

  -- notify every active user whose role can verify claims (RBAC lookup inside the trigger)
  INSERT INTO notifications (user_id, notif_type, message, link)
  SELECT u.user_id, 'CLAIM', CONCAT('New claim #', NEW.claim_id, ' is waiting for verification.'),
         CONCAT('/claims/', NEW.claim_id)
  FROM users u
  WHERE fn_has_permission(u.user_id, 'CLAIM_VERIFY');

  INSERT INTO audit_log (table_name, record_id, action, new_value, changed_by)
  VALUES ('claims', NEW.claim_id, 'INSERT', NEW.claim_status, COALESCE(@app_user_id, NEW.claimant_id));
END$$

CREATE TRIGGER trg_claims_after_update
AFTER UPDATE ON claims
FOR EACH ROW
BEGIN
  DECLARE v_open_claims INT DEFAULT 0;
  DECLARE v_title   VARCHAR(100);
  DECLARE v_held_at VARCHAR(130);

  IF NOT (OLD.claim_status <=> NEW.claim_status) THEN
    SELECT f.title, CONCAT(l.location_name, ', ', b.building_name) INTO v_title, v_held_at
    FROM found_items f
    JOIN locations l ON l.location_id = f.held_at_id
    JOIN buildings b ON b.building_id = l.building_id
    WHERE f.found_id = NEW.found_id;

    IF NEW.claim_status = 'APPROVED' THEN
      UPDATE found_items SET status = 'CLAIM_APPROVED' WHERE found_id = NEW.found_id;
      IF NEW.lost_id IS NOT NULL THEN
        UPDATE lost_items SET status = 'MATCHED' WHERE lost_id = NEW.lost_id AND status = 'OPEN';
      END IF;
      INSERT INTO notifications (user_id, notif_type, message, link)
      VALUES (NEW.claimant_id, 'VERIFICATION',
              LEFT(CONCAT('Your claim for "', v_title, '" was approved. Collect it at ', v_held_at,
                          ' with your ID card.'), 255),
              CONCAT('/claims/', NEW.claim_id));

    ELSEIF NEW.claim_status IN ('REJECTED', 'WITHDRAWN') THEN
      -- reading the triggering table is allowed (only modifying it is not)
      SELECT COUNT(*) INTO v_open_claims
      FROM claims
      WHERE found_id = NEW.found_id AND claim_status IN ('PENDING', 'APPROVED');
      IF v_open_claims = 0 THEN
        UPDATE found_items SET status = 'AVAILABLE'
        WHERE found_id = NEW.found_id AND status IN ('CLAIM_PENDING', 'CLAIM_APPROVED');
      END IF;
      IF NEW.claim_status = 'REJECTED' THEN
        INSERT INTO notifications (user_id, notif_type, message, link)
        VALUES (NEW.claimant_id, 'VERIFICATION',
                LEFT(CONCAT('Your claim for "', v_title, '" was not approved.'), 255),
                CONCAT('/claims/', NEW.claim_id));
      END IF;
    END IF;

    INSERT INTO audit_log (table_name, record_id, action, old_value, new_value, changed_by)
    VALUES ('claims', NEW.claim_id, 'UPDATE', OLD.claim_status, NEW.claim_status, @app_user_id);
  END IF;
END$$

-- ------------------------------------------------------------ verifications
-- RBAC is enforced here too, so even a direct INSERT that bypasses the
-- stored procedure cannot record a decision by an unauthorised user.
CREATE TRIGGER trg_verifications_before_insert
BEFORE INSERT ON verifications
FOR EACH ROW
BEGIN
  IF NOT fn_has_permission(NEW.verifier_id, 'CLAIM_VERIFY') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Verifier does not have the CLAIM_VERIFY permission';
  END IF;
  IF (SELECT claim_status FROM claims WHERE claim_id = NEW.claim_id) <> 'PENDING' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only pending claims can be verified';
  END IF;
END$$

-- The decision is copied to the claim; approving one claim auto-rejects the
-- other pending claims for the same item (claims cannot be modified from a
-- claims trigger, so this is done here).
CREATE TRIGGER trg_verifications_after_insert
AFTER INSERT ON verifications
FOR EACH ROW
BEGIN
  DECLARE v_found_id INT UNSIGNED;

  UPDATE claims SET claim_status = NEW.decision WHERE claim_id = NEW.claim_id;

  IF NEW.decision = 'APPROVED' THEN
    SELECT found_id INTO v_found_id FROM claims WHERE claim_id = NEW.claim_id;
    UPDATE claims SET claim_status = 'REJECTED'
    WHERE found_id = v_found_id AND claim_id <> NEW.claim_id AND claim_status = 'PENDING';
  END IF;
END$$

-- ------------------------------------------------------------ item_returns
CREATE TRIGGER trg_item_returns_before_insert
BEFORE INSERT ON item_returns
FOR EACH ROW
BEGIN
  DECLARE v_status VARCHAR(10);
  DECLARE v_high_value BOOLEAN DEFAULT FALSE;

  SELECT c.claim_status, cat.is_high_value INTO v_status, v_high_value
  FROM claims c
  JOIN found_items f  ON f.found_id = c.found_id
  JOIN categories cat ON cat.category_id = f.category_id
  WHERE c.claim_id = NEW.claim_id;

  IF v_status IS NULL OR v_status <> 'APPROVED' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only an approved claim can be handed over';
  END IF;
  IF v_high_value AND NEW.handover_status = 'HANDED_OVER' AND NOT NEW.id_proof_checked THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'ID proof must be checked before handing over a high-value item';
  END IF;
  IF NOT fn_has_permission(NEW.handled_by, 'RETURN_RECORD') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Staff member does not have the RETURN_RECORD permission';
  END IF;
END$$

CREATE TRIGGER trg_item_returns_after_insert
AFTER INSERT ON item_returns
FOR EACH ROW
BEGIN
  IF NEW.handover_status = 'HANDED_OVER' THEN
    CALL sp_apply_handover(NEW.claim_id);
  END IF;
END$$

CREATE TRIGGER trg_item_returns_after_update
AFTER UPDATE ON item_returns
FOR EACH ROW
BEGIN
  IF OLD.handover_status <> 'HANDED_OVER' AND NEW.handover_status = 'HANDED_OVER' THEN
    CALL sp_apply_handover(NEW.claim_id);
  END IF;
END$$

DELIMITER ;
