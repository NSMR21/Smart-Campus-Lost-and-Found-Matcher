-- =====================================================================
--  DML operations: INSERT / UPDATE / DELETE, upserts and constraint checks
--  Format used by the SQL Lab page:
--    -- [ID] title          starts a query block
--    -- concept: ...        what the block demonstrates
--    -- mode: read          safe SELECT, executed directly
--    -- mode: rollback      executed inside a transaction that is ROLLED BACK
--    -- mode: script        shown only (run it in MySQL Workbench / mysql CLI)
-- =====================================================================
USE campus_lostfound;

-- [DML-1] Insert a lost report (single-row INSERT)
-- concept: INSERT with column list; AFTER INSERT trigger writes the audit log
-- mode: rollback
INSERT INTO lost_items (owner_id, category_id, location_id, title, description, color, brand, lost_date)
VALUES (4, 23, 13, 'Black Puma backpack', 'Black Puma backpack with a broken zip and a blue bottle inside.',
        'black', 'Puma', CURDATE());
SELECT lost_id, title, status, created_at FROM lost_items WHERE lost_id = LAST_INSERT_ID();
SELECT table_name, record_id, action, new_value, changed_by FROM audit_log ORDER BY log_id DESC LIMIT 1;

-- [DML-2] Insert several found items at once (multi-row INSERT)
-- concept: multi-row INSERT; BEFORE INSERT trigger lower-cases colour and checks the collection point
-- mode: rollback
INSERT INTO found_items (finder_id, category_id, location_id, held_at_id, title, description, color, brand, found_date)
VALUES (9,  7,  6,  23, 'Calculator in exam hall', 'Grey Casio calculator found on bench 4 after the exam.', 'GREY', 'Casio', CURDATE()),
       (11, 21, 13, 23, 'Blue umbrella',           'Small blue umbrella left at the food court entrance.',   'Blue', NULL,    CURDATE());
SELECT found_id, title, color, status FROM found_items ORDER BY found_id DESC LIMIT 2;

-- [DML-3] Notify owners of open electronics reports (INSERT ... SELECT)
-- concept: INSERT ... SELECT with a JOIN on the recursive category view
-- mode: rollback
INSERT INTO notifications (user_id, notif_type, message, link)
SELECT DISTINCT l.owner_id, 'SYSTEM', 'Electronics collection drive at the Lost & Found desk this Friday.', '/found'
FROM lost_items l
JOIN vw_category_tree ct ON ct.category_id = l.category_id
WHERE ct.root_id = 1 AND l.status IN ('OPEN', 'MATCHED');
SELECT ROW_COUNT() AS notifications_created;

-- [DML-4] Move a found item to another collection point (single-row UPDATE)
-- concept: UPDATE with WHERE on the primary key
-- mode: rollback
UPDATE found_items SET held_at_id = 25 WHERE found_id = 7;
SELECT found_id, title, held_at_id, updated_at FROM found_items WHERE found_id = 7;

-- [DML-5] Close stale lost reports that never got a match (UPDATE with JOIN)
-- concept: multi-table UPDATE using LEFT JOIN ... IS NULL (anti-join)
-- mode: rollback
UPDATE lost_items l
LEFT JOIN potential_matches pm ON pm.lost_id = l.lost_id AND pm.match_status <> 'DISMISSED'
SET l.status = 'CLOSED'
WHERE l.status = 'OPEN'
  AND l.lost_date < CURDATE() - INTERVAL 30 DAY
  AND pm.match_id IS NULL;
SELECT lost_id, title, lost_date, status FROM lost_items WHERE status = 'CLOSED' ORDER BY updated_at DESC LIMIT 5;

-- [DML-6] Re-classify colours with CASE (UPDATE with expression)
-- concept: UPDATE ... SET col = CASE ... END
-- mode: rollback
UPDATE found_items
SET color = CASE WHEN color IN ('silver', 'grey') THEN 'grey' ELSE color END
WHERE status = 'AVAILABLE';
SELECT color, COUNT(*) AS items FROM found_items WHERE status = 'AVAILABLE' GROUP BY color ORDER BY items DESC;

-- [DML-7] Remove old read notifications (DELETE with condition)
-- concept: DELETE with a date predicate
-- mode: rollback
DELETE FROM notifications WHERE is_read = TRUE AND created_at < NOW() - INTERVAL 30 DAY;
SELECT ROW_COUNT() AS deleted_rows, (SELECT COUNT(*) FROM notifications) AS remaining;

-- [DML-8] Delete dismissed suggestions of finished cases (DELETE with subquery)
-- concept: DELETE ... WHERE col IN (subquery)
-- mode: rollback
DELETE FROM potential_matches
WHERE match_status = 'DISMISSED'
  AND lost_id IN (SELECT lost_id FROM lost_items WHERE status IN ('RECOVERED', 'CLOSED'));
SELECT match_status, COUNT(*) AS pairs FROM potential_matches GROUP BY match_status;

-- [DML-9] Upsert a match pair (INSERT ... ON DUPLICATE KEY UPDATE)
-- concept: upsert on the UNIQUE (lost_id, found_id) key; total_score is a generated column
-- mode: rollback
INSERT INTO potential_matches (lost_id, found_id, rule_score, semantic_score)
VALUES (7, 7, 1.0000, 0.9000)
ON DUPLICATE KEY UPDATE semantic_score = 0.9000;
SELECT lost_id, found_id, rule_score, semantic_score, total_score FROM potential_matches WHERE lost_id = 7 AND found_id = 7;

-- [CON-1] CHECK constraint rejects an invalid email
-- concept: CHECK (REGEXP_LIKE(email, ...)) - the INSERT fails with error 3819
-- mode: rollback
INSERT INTO users (full_name, email, password_hash, role_id)
VALUES ('Test User', 'not-an-email', REPEAT('x', 60), 1);

-- [CON-2] UNIQUE constraint rejects a duplicate SRN
-- concept: UNIQUE (srn) on student_profiles
-- mode: rollback
INSERT INTO student_profiles (user_id, srn, dept_id, year_of_study) VALUES (1, 'PES1UG24AM170', 1, 3);

-- [CON-3] FOREIGN KEY rejects an unknown category
-- concept: referential integrity (category 999 does not exist)
-- mode: rollback
INSERT INTO lost_items (owner_id, category_id, location_id, title, description, lost_date)
VALUES (4, 999, 1, 'Mystery item', 'An item in a category that does not exist.', CURDATE());

-- [CON-4] Trigger rejects a lost date in the future
-- concept: BEFORE INSERT trigger with SIGNAL SQLSTATE '45000'
-- mode: rollback
INSERT INTO lost_items (owner_id, category_id, location_id, title, description, lost_date)
VALUES (4, 2, 1, 'Future phone', 'This phone will be lost next week apparently.', CURDATE() + INTERVAL 7 DAY);
