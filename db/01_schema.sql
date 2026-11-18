-- =====================================================================
--  Smart Campus Lost & Found Management and Matching System
--  01_schema.sql  -  DDL: database, tables, keys, constraints, indexes
--  Target: MySQL 8.0.16+ (CHECK constraints are enforced from 8.0.16)
-- =====================================================================

DROP DATABASE IF EXISTS campus_lostfound;
CREATE DATABASE campus_lostfound
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;
USE campus_lostfound;

-- ---------------------------------------------------------------------
-- 1. Role based access control (RBAC) - stored in the database
--    roles  M:N  permissions   (resolved by role_permissions)
-- ---------------------------------------------------------------------
CREATE TABLE roles (
  role_id      TINYINT UNSIGNED NOT NULL,
  role_name    VARCHAR(20)      NOT NULL,
  description  VARCHAR(200)     NOT NULL,
  CONSTRAINT pk_roles PRIMARY KEY (role_id),
  CONSTRAINT uq_roles_name UNIQUE (role_name),
  CONSTRAINT chk_roles_name CHECK (role_name IN ('STUDENT', 'STAFF', 'ADMIN'))
);

CREATE TABLE permissions (
  permission_id   SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  permission_code VARCHAR(40)       NOT NULL,
  description     VARCHAR(200)      NOT NULL,
  CONSTRAINT pk_permissions PRIMARY KEY (permission_id),
  CONSTRAINT uq_permissions_code UNIQUE (permission_code),
  CONSTRAINT chk_permissions_code CHECK (REGEXP_LIKE(permission_code, '^[A-Z_]+$', 'c'))
);

CREATE TABLE role_permissions (
  role_id       TINYINT UNSIGNED  NOT NULL,
  permission_id SMALLINT UNSIGNED NOT NULL,
  granted_at    DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_role_permissions PRIMARY KEY (role_id, permission_id),
  CONSTRAINT fk_rp_role FOREIGN KEY (role_id)
    REFERENCES roles (role_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_rp_permission FOREIGN KEY (permission_id)
    REFERENCES permissions (permission_id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- ---------------------------------------------------------------------
-- 2. Users  (generalisation)  ->  student_profiles / staff_profiles  (specialisation, 1:1)
-- ---------------------------------------------------------------------
CREATE TABLE departments (
  dept_id    TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  dept_code  VARCHAR(10)      NOT NULL,
  dept_name  VARCHAR(80)      NOT NULL,
  CONSTRAINT pk_departments PRIMARY KEY (dept_id),
  CONSTRAINT uq_departments_code UNIQUE (dept_code),
  CONSTRAINT uq_departments_name UNIQUE (dept_name)
);

CREATE TABLE users (
  user_id        INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  full_name      VARCHAR(80)      NOT NULL,
  email          VARCHAR(120)     NOT NULL,
  phone          CHAR(10)         NULL,
  password_hash  CHAR(60)         NOT NULL,              -- bcrypt hash, never the plain password
  role_id        TINYINT UNSIGNED NOT NULL DEFAULT 1,    -- 1 = STUDENT
  is_active      BOOLEAN          NOT NULL DEFAULT TRUE,
  created_at     DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at  DATETIME         NULL,
  CONSTRAINT pk_users PRIMARY KEY (user_id),
  CONSTRAINT uq_users_email UNIQUE (email),
  CONSTRAINT fk_users_role FOREIGN KEY (role_id)
    REFERENCES roles (role_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_users_name  CHECK (CHAR_LENGTH(TRIM(full_name)) >= 2),
  CONSTRAINT chk_users_email CHECK (REGEXP_LIKE(email, '^[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}$', 'c')),
  CONSTRAINT chk_users_phone CHECK (phone IS NULL OR REGEXP_LIKE(phone, '^[6-9][0-9]{9}$'))
);

CREATE TABLE student_profiles (
  user_id        INT UNSIGNED     NOT NULL,
  srn            CHAR(13)         NOT NULL,              -- e.g. PES1UG24AM170
  dept_id        TINYINT UNSIGNED NOT NULL,
  year_of_study  TINYINT UNSIGNED NOT NULL,
  CONSTRAINT pk_student_profiles PRIMARY KEY (user_id),
  CONSTRAINT uq_student_srn UNIQUE (srn),
  CONSTRAINT fk_student_user FOREIGN KEY (user_id)
    REFERENCES users (user_id) ON DELETE CASCADE,
  CONSTRAINT fk_student_dept FOREIGN KEY (dept_id)
    REFERENCES departments (dept_id) ON DELETE RESTRICT,
  CONSTRAINT chk_student_srn  CHECK (REGEXP_LIKE(srn, '^PES[12](UG|PG)[0-9]{2}[A-Z]{2}[0-9]{3}$', 'c')),
  CONSTRAINT chk_student_year CHECK (year_of_study BETWEEN 1 AND 4)
);

CREATE TABLE staff_profiles (
  user_id        INT UNSIGNED NOT NULL,
  employee_code  VARCHAR(12)  NOT NULL,
  designation    VARCHAR(60)  NOT NULL,
  CONSTRAINT pk_staff_profiles PRIMARY KEY (user_id),
  CONSTRAINT uq_staff_code UNIQUE (employee_code),
  CONSTRAINT fk_staff_user FOREIGN KEY (user_id)
    REFERENCES users (user_id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------
-- 3. Master data: categories (self-referencing hierarchy) and campus locations
-- ---------------------------------------------------------------------
CREATE TABLE categories (
  category_id         SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  category_name       VARCHAR(50)       NOT NULL,
  parent_category_id  SMALLINT UNSIGNED NULL,            -- NULL = top level category
  is_high_value       BOOLEAN           NOT NULL DEFAULT FALSE,  -- ID proof mandatory at hand-over
  CONSTRAINT pk_categories PRIMARY KEY (category_id),
  CONSTRAINT uq_categories_name UNIQUE (category_name),
  CONSTRAINT fk_categories_parent FOREIGN KEY (parent_category_id)
    REFERENCES categories (category_id) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE buildings (
  building_id    TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  building_name  VARCHAR(60)      NOT NULL,
  zone           VARCHAR(12)      NOT NULL,
  CONSTRAINT pk_buildings PRIMARY KEY (building_id),
  CONSTRAINT uq_buildings_name UNIQUE (building_name),
  CONSTRAINT chk_buildings_zone CHECK (zone IN ('ACADEMIC', 'HOSTEL', 'SPORTS', 'AMENITIES', 'ADMIN'))
);

CREATE TABLE locations (
  location_id          SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  building_id          TINYINT UNSIGNED  NOT NULL,
  location_name        VARCHAR(60)       NOT NULL,
  floor_no             TINYINT           NULL,
  is_collection_point  BOOLEAN           NOT NULL DEFAULT FALSE,  -- lost & found desk that stores items
  CONSTRAINT pk_locations PRIMARY KEY (location_id),
  CONSTRAINT uq_locations_name UNIQUE (building_id, location_name),
  CONSTRAINT fk_locations_building FOREIGN KEY (building_id)
    REFERENCES buildings (building_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_locations_floor CHECK (floor_no IS NULL OR floor_no BETWEEN -2 AND 15)
);

-- ---------------------------------------------------------------------
-- 4. Lost and found reports
-- ---------------------------------------------------------------------
CREATE TABLE lost_items (
  lost_id      INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  owner_id     INT UNSIGNED      NOT NULL,
  category_id  SMALLINT UNSIGNED NOT NULL,
  location_id  SMALLINT UNSIGNED NOT NULL,               -- last seen location
  title        VARCHAR(100)      NOT NULL,
  description  TEXT              NOT NULL,
  color        VARCHAR(12)       NOT NULL DEFAULT 'other',
  brand        VARCHAR(40)       NULL,
  lost_date    DATE              NOT NULL,
  status       VARCHAR(10)       NOT NULL DEFAULT 'OPEN',
  created_at   DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT pk_lost_items PRIMARY KEY (lost_id),
  CONSTRAINT fk_lost_owner FOREIGN KEY (owner_id)
    REFERENCES users (user_id) ON DELETE CASCADE,
  CONSTRAINT fk_lost_category FOREIGN KEY (category_id)
    REFERENCES categories (category_id) ON DELETE RESTRICT,
  CONSTRAINT fk_lost_location FOREIGN KEY (location_id)
    REFERENCES locations (location_id) ON DELETE RESTRICT,
  CONSTRAINT chk_lost_status CHECK (status IN ('OPEN', 'MATCHED', 'RECOVERED', 'CLOSED')),
  CONSTRAINT chk_lost_color  CHECK (color IN ('black', 'white', 'grey', 'silver', 'red', 'blue', 'green', 'yellow',
                                              'orange', 'pink', 'purple', 'brown', 'gold', 'multicolor', 'other')),
  CONSTRAINT chk_lost_title  CHECK (CHAR_LENGTH(TRIM(title)) >= 3),
  CONSTRAINT chk_lost_desc   CHECK (CHAR_LENGTH(TRIM(description)) >= 10)
);

CREATE TABLE found_items (
  found_id      INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  finder_id     INT UNSIGNED      NOT NULL,
  category_id   SMALLINT UNSIGNED NOT NULL,
  location_id   SMALLINT UNSIGNED NOT NULL,              -- where it was found
  held_at_id    SMALLINT UNSIGNED NOT NULL,              -- collection point where it is kept now
  title         VARCHAR(100)      NOT NULL,
  description   TEXT              NOT NULL,
  color         VARCHAR(12)       NOT NULL DEFAULT 'other',
  brand         VARCHAR(40)       NULL,
  hidden_marks  VARCHAR(255)      NULL,                  -- secret identifying details: visible to STAFF/ADMIN only
  found_date    DATE              NOT NULL,
  status        VARCHAR(14)       NOT NULL DEFAULT 'AVAILABLE',
  created_at    DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT pk_found_items PRIMARY KEY (found_id),
  CONSTRAINT fk_found_finder FOREIGN KEY (finder_id)
    REFERENCES users (user_id) ON DELETE RESTRICT,
  CONSTRAINT fk_found_category FOREIGN KEY (category_id)
    REFERENCES categories (category_id) ON DELETE RESTRICT,
  CONSTRAINT fk_found_location FOREIGN KEY (location_id)
    REFERENCES locations (location_id) ON DELETE RESTRICT,
  CONSTRAINT fk_found_held_at FOREIGN KEY (held_at_id)
    REFERENCES locations (location_id) ON DELETE RESTRICT,
  CONSTRAINT chk_found_status CHECK (status IN ('AVAILABLE', 'CLAIM_PENDING', 'CLAIM_APPROVED', 'RETURNED', 'DISPOSED')),
  CONSTRAINT chk_found_color  CHECK (color IN ('black', 'white', 'grey', 'silver', 'red', 'blue', 'green', 'yellow',
                                               'orange', 'pink', 'purple', 'brown', 'gold', 'multicolor', 'other')),
  CONSTRAINT chk_found_title  CHECK (CHAR_LENGTH(TRIM(title)) >= 3),
  CONSTRAINT chk_found_desc   CHECK (CHAR_LENGTH(TRIM(description)) >= 10)
);

-- ---------------------------------------------------------------------
-- 5. Matching:  lost_items  M:N  found_items   (relationship with attributes)
-- ---------------------------------------------------------------------
CREATE TABLE potential_matches (
  match_id        INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  lost_id         INT UNSIGNED  NOT NULL,
  found_id        INT UNSIGNED  NOT NULL,
  rule_score      DECIMAL(5,4)  NOT NULL,                -- category/location/date/colour/brand (SQL function)
  semantic_score  DECIMAL(5,4)  NOT NULL DEFAULT 0,      -- description similarity (vector database)
  total_score     DECIMAL(5,4)  AS (ROUND(0.6 * rule_score + 0.4 * semantic_score, 4)) STORED,
  match_status    VARCHAR(10)   NOT NULL DEFAULT 'SUGGESTED',
  matched_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_potential_matches PRIMARY KEY (match_id),
  CONSTRAINT uq_match_pair UNIQUE (lost_id, found_id),
  CONSTRAINT fk_match_lost FOREIGN KEY (lost_id)
    REFERENCES lost_items (lost_id) ON DELETE CASCADE,
  CONSTRAINT fk_match_found FOREIGN KEY (found_id)
    REFERENCES found_items (found_id) ON DELETE CASCADE,
  CONSTRAINT chk_match_rule     CHECK (rule_score BETWEEN 0 AND 1),
  CONSTRAINT chk_match_semantic CHECK (semantic_score BETWEEN 0 AND 1),
  CONSTRAINT chk_match_status   CHECK (match_status IN ('SUGGESTED', 'CONFIRMED', 'DISMISSED'))
);

-- ---------------------------------------------------------------------
-- 6. Claim -> Verification (1:1) -> Return (1:1)
-- ---------------------------------------------------------------------
CREATE TABLE claims (
  claim_id       INT UNSIGNED NOT NULL AUTO_INCREMENT,
  found_id       INT UNSIGNED NOT NULL,
  claimant_id    INT UNSIGNED NOT NULL,
  lost_id        INT UNSIGNED NULL,                      -- claimant's own lost report (optional)
  proof_details  TEXT         NOT NULL,                  -- details only the real owner would know
  claim_status   VARCHAR(10)  NOT NULL DEFAULT 'PENDING',
  claimed_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_claims PRIMARY KEY (claim_id),
  CONSTRAINT uq_claim_once UNIQUE (found_id, claimant_id),   -- one claim per student per item
  CONSTRAINT fk_claim_found FOREIGN KEY (found_id)
    REFERENCES found_items (found_id) ON DELETE CASCADE,
  CONSTRAINT fk_claim_claimant FOREIGN KEY (claimant_id)
    REFERENCES users (user_id) ON DELETE RESTRICT,
  CONSTRAINT fk_claim_lost FOREIGN KEY (lost_id)
    REFERENCES lost_items (lost_id) ON DELETE SET NULL,
  CONSTRAINT chk_claim_status CHECK (claim_status IN ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN')),
  CONSTRAINT chk_claim_proof  CHECK (CHAR_LENGTH(TRIM(proof_details)) >= 15)
);

CREATE TABLE verifications (
  verification_id  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  claim_id         INT UNSIGNED NOT NULL,
  verifier_id      INT UNSIGNED NOT NULL,
  decision         VARCHAR(10)  NOT NULL,
  remarks          VARCHAR(255) NULL,
  verified_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_verifications PRIMARY KEY (verification_id),
  CONSTRAINT uq_verification_claim UNIQUE (claim_id),     -- exactly one decision per claim
  CONSTRAINT fk_verification_claim FOREIGN KEY (claim_id)
    REFERENCES claims (claim_id) ON DELETE CASCADE,
  CONSTRAINT fk_verification_verifier FOREIGN KEY (verifier_id)
    REFERENCES users (user_id) ON DELETE RESTRICT,
  CONSTRAINT chk_verification_decision CHECK (decision IN ('APPROVED', 'REJECTED'))
);

-- found_id / claimant are NOT repeated here: they are functionally determined by claim_id
-- (keeping them would introduce redundancy and update anomalies).
CREATE TABLE item_returns (
  return_id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  claim_id          INT UNSIGNED NOT NULL,
  handled_by        INT UNSIGNED NOT NULL,
  id_proof_checked  BOOLEAN      NOT NULL DEFAULT FALSE,
  handover_status   VARCHAR(12)  NOT NULL DEFAULT 'HANDED_OVER',
  returned_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  remarks           VARCHAR(255) NULL,
  CONSTRAINT pk_item_returns PRIMARY KEY (return_id),
  CONSTRAINT uq_return_claim UNIQUE (claim_id),
  CONSTRAINT fk_return_claim FOREIGN KEY (claim_id)
    REFERENCES claims (claim_id) ON DELETE RESTRICT,
  CONSTRAINT fk_return_staff FOREIGN KEY (handled_by)
    REFERENCES users (user_id) ON DELETE RESTRICT,
  CONSTRAINT chk_return_status CHECK (handover_status IN ('SCHEDULED', 'HANDED_OVER', 'CANCELLED'))
);

-- ---------------------------------------------------------------------
-- 7. Notifications and audit trail (both written by triggers)
-- ---------------------------------------------------------------------
CREATE TABLE notifications (
  notification_id  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id          INT UNSIGNED NOT NULL,
  notif_type       VARCHAR(12)  NOT NULL,
  message          VARCHAR(255) NOT NULL,
  link             VARCHAR(100) NULL,
  is_read          BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_notifications PRIMARY KEY (notification_id),
  CONSTRAINT fk_notification_user FOREIGN KEY (user_id)
    REFERENCES users (user_id) ON DELETE CASCADE,
  CONSTRAINT chk_notification_type CHECK (notif_type IN ('MATCH', 'CLAIM', 'VERIFICATION', 'RETURN', 'SYSTEM'))
);

CREATE TABLE audit_log (
  log_id      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  table_name  VARCHAR(30)     NOT NULL,
  record_id   INT UNSIGNED    NOT NULL,
  action      VARCHAR(10)     NOT NULL,
  old_value   VARCHAR(40)     NULL,
  new_value   VARCHAR(40)     NULL,
  changed_by  INT UNSIGNED    NULL,                      -- app user, taken from session variable @app_user_id
  changed_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_audit_log PRIMARY KEY (log_id),
  CONSTRAINT chk_audit_action CHECK (action IN ('INSERT', 'UPDATE', 'DELETE'))
);

-- ---------------------------------------------------------------------
-- 8. Secondary indexes for the most frequent searches
--    (category / location / status / date filters, joins on foreign keys, keyword search)
-- ---------------------------------------------------------------------
CREATE INDEX idx_lost_category_status  ON lost_items (category_id, status);
CREATE INDEX idx_lost_location         ON lost_items (location_id);
CREATE INDEX idx_lost_date             ON lost_items (lost_date);
CREATE INDEX idx_lost_owner_status     ON lost_items (owner_id, status);
CREATE FULLTEXT INDEX ftx_lost_text    ON lost_items (title, description);

CREATE INDEX idx_found_category_status ON found_items (category_id, status);
CREATE INDEX idx_found_location        ON found_items (location_id);
CREATE INDEX idx_found_date            ON found_items (found_date);
CREATE INDEX idx_found_status_date     ON found_items (status, found_date);
CREATE FULLTEXT INDEX ftx_found_text   ON found_items (title, description);

CREATE INDEX idx_match_found           ON potential_matches (found_id);
CREATE INDEX idx_match_score           ON potential_matches (total_score DESC);
CREATE INDEX idx_claim_status          ON claims (claim_status, claimed_at);
CREATE INDEX idx_claim_claimant        ON claims (claimant_id);
CREATE INDEX idx_notification_user     ON notifications (user_id, is_read, created_at);
CREATE INDEX idx_audit_record          ON audit_log (table_name, record_id);
CREATE INDEX idx_audit_time            ON audit_log (changed_at);
