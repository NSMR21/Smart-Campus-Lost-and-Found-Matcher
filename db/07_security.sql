-- =====================================================================
--  07_security.sql  -  Database-level access control (MySQL 8 roles)
--
--  Two layers of role based access control are used in this project:
--   1. Application RBAC stored in tables  roles / permissions / role_permissions
--      and checked by fn_has_permission() inside procedures and triggers.
--   2. Native MySQL roles below: each application role gets a matching
--      database role with only the privileges it needs (least privilege).
--
--  Run as root (or another account with CREATE USER / CREATE ROLE / GRANT OPTION).
-- =====================================================================
USE campus_lostfound;

DROP USER IF EXISTS 'lf_app'@'localhost', 'lf_student_demo'@'localhost', 'lf_staff_demo'@'localhost';
DROP ROLE IF EXISTS 'lf_student_role', 'lf_staff_role', 'lf_admin_role';

CREATE ROLE 'lf_student_role', 'lf_staff_role', 'lf_admin_role';

-- ---------------------------------------------------------------- STUDENT
-- read-only lookups and the public (sanitised) views
GRANT SELECT ON campus_lostfound.categories            TO 'lf_student_role';
GRANT SELECT ON campus_lostfound.buildings             TO 'lf_student_role';
GRANT SELECT ON campus_lostfound.locations             TO 'lf_student_role';
GRANT SELECT ON campus_lostfound.vw_category_tree      TO 'lf_student_role';
GRANT SELECT ON campus_lostfound.vw_locations          TO 'lf_student_role';
GRANT SELECT ON campus_lostfound.vw_found_items_public TO 'lf_student_role';
GRANT SELECT ON campus_lostfound.vw_lost_items_detail  TO 'lf_student_role';
-- column-level privilege: students can read found_items but NOT the hidden_marks column
GRANT SELECT (found_id, finder_id, category_id, location_id, held_at_id, title, description,
              color, brand, found_date, status, created_at)
      ON campus_lostfound.found_items TO 'lf_student_role';
-- report items
GRANT INSERT ON campus_lostfound.lost_items  TO 'lf_student_role';
GRANT INSERT ON campus_lostfound.found_items TO 'lf_student_role';
-- claims only through the stored procedures (which validate and lock)
GRANT EXECUTE ON PROCEDURE campus_lostfound.sp_submit_claim   TO 'lf_student_role';
GRANT EXECUTE ON PROCEDURE campus_lostfound.sp_withdraw_claim TO 'lf_student_role';

-- ---------------------------------------------------------------- STAFF  (inherits STUDENT)
GRANT 'lf_student_role' TO 'lf_staff_role';
GRANT SELECT ON campus_lostfound.* TO 'lf_staff_role';
GRANT UPDATE (status, held_at_id) ON campus_lostfound.found_items TO 'lf_staff_role';
GRANT EXECUTE ON PROCEDURE campus_lostfound.sp_verify_claim              TO 'lf_staff_role';
GRANT EXECUTE ON PROCEDURE campus_lostfound.sp_record_return             TO 'lf_staff_role';
GRANT EXECUTE ON PROCEDURE campus_lostfound.sp_upsert_match              TO 'lf_staff_role';
GRANT EXECUTE ON PROCEDURE campus_lostfound.sp_match_candidates_for_lost  TO 'lf_staff_role';
GRANT EXECUTE ON PROCEDURE campus_lostfound.sp_match_candidates_for_found TO 'lf_staff_role';
GRANT EXECUTE ON PROCEDURE campus_lostfound.sp_refresh_all_rule_matches  TO 'lf_staff_role';

-- ---------------------------------------------------------------- ADMIN  (inherits STAFF)
GRANT 'lf_staff_role' TO 'lf_admin_role';
GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON campus_lostfound.* TO 'lf_admin_role';

-- ---------------------------------------------------------------- accounts
-- Account used by the Next.js backend: DML + EXECUTE only (no DROP / ALTER / GRANT).
-- The web app enforces per-user permissions through fn_has_permission().
CREATE USER 'lf_app'@'localhost' IDENTIFIED BY 'LfApp@2026';
GRANT 'lf_admin_role' TO 'lf_app'@'localhost';
SET DEFAULT ROLE 'lf_admin_role' TO 'lf_app'@'localhost';

-- Demo accounts to show the database roles in MySQL Workbench during the viva:
--   SELECT hidden_marks FROM campus_lostfound.found_items;   -- denied for lf_student_demo
CREATE USER 'lf_student_demo'@'localhost' IDENTIFIED BY 'Student@2026' DEFAULT ROLE 'lf_student_role';
CREATE USER 'lf_staff_demo'@'localhost'   IDENTIFIED BY 'Staff@2026'   DEFAULT ROLE 'lf_staff_role';

FLUSH PRIVILEGES;

-- Inspect what each role can do:
--   SHOW GRANTS FOR 'lf_student_role';
--   SHOW GRANTS FOR 'lf_student_demo'@'localhost' USING 'lf_student_role';
