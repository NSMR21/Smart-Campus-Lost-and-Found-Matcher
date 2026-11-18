-- =====================================================================
--  Indexes and query plans, views, and database-level security
-- =====================================================================
USE campus_lostfound;

-- [I-1] Indexes on the lost_items table
-- concept: SHOW INDEX - primary key, foreign-key indexes, composite and FULLTEXT indexes
-- mode: read
SHOW INDEX FROM lost_items;

-- [I-2] Category + status filter uses the composite index
-- concept: EXPLAIN shows key = idx_found_category_status
-- mode: read
EXPLAIN SELECT found_id, title FROM found_items WHERE category_id = 2 AND status = 'AVAILABLE';

-- [I-3] Keyword search: FULLTEXT index vs LIKE (full table scan)
-- concept: EXPLAIN of MATCH ... AGAINST (type = fulltext) compared with LIKE '%...%' (type = ALL)
-- mode: read
EXPLAIN SELECT found_id, title FROM found_items
WHERE MATCH(title, description) AGAINST ('wallet* leather*' IN BOOLEAN MODE);
EXPLAIN SELECT found_id, title FROM found_items WHERE description LIKE '%wallet%';

-- [I-4] Keyword search with relevance ranking
-- concept: FULLTEXT natural-language relevance score
-- mode: read
SELECT found_id, title,
       ROUND(MATCH(title, description) AGAINST ('black phone cracked screen'), 3) AS relevance
FROM found_items
WHERE MATCH(title, description) AGAINST ('black phone cracked screen')
ORDER BY relevance DESC;

-- [I-5] Actual execution of a join with timings
-- concept: EXPLAIN ANALYZE (MySQL 8.0.18+) shows the iterator tree and real row counts
-- mode: read
EXPLAIN ANALYZE
SELECT l.title, COUNT(pm.match_id) AS suggestions
FROM lost_items l LEFT JOIN potential_matches pm ON pm.lost_id = l.lost_id
WHERE l.status = 'OPEN'
GROUP BY l.lost_id, l.title;

-- [V-1] What a student sees vs what staff see
-- concept: views hide sensitive columns (hidden_marks, finder contact)
-- mode: read
SELECT found_id, title, held_at, finder_name FROM vw_found_items_public WHERE found_id = 6;
SELECT found_id, title, held_at, finder_name, finder_email, hidden_marks, pending_claims
FROM vw_found_items_staff WHERE found_id = 6;

-- [V-2] Effective permissions per user (RBAC data in the database)
-- concept: view over users -> roles -> role_permissions -> permissions
-- mode: read
SELECT role_name, full_name, GROUP_CONCAT(permission_code ORDER BY permission_code SEPARATOR ', ') AS permissions
FROM vw_user_permissions
WHERE user_id IN (1, 3, 4)
GROUP BY user_id, role_name, full_name;

-- [V-3] Native MySQL roles and their privileges
-- concept: CREATE ROLE / GRANT / role hierarchy / column-level privileges (see db/07_security.sql)
-- mode: script
SHOW GRANTS FOR 'lf_student_role';
SHOW GRANTS FOR 'lf_staff_role';
SHOW GRANTS FOR 'lf_app'@'localhost' USING 'lf_admin_role';
-- log in as lf_student_demo and try:
SELECT hidden_marks FROM campus_lostfound.found_items;      -- ERROR 1143: SELECT command denied for column
SELECT title, status FROM campus_lostfound.found_items;     -- allowed (column-level grant)
DELETE FROM campus_lostfound.lost_items WHERE lost_id = 1;  -- ERROR 1142: DELETE command denied
