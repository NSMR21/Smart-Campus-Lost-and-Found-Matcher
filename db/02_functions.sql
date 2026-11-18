-- =====================================================================
--  02_functions.sql  -  Stored functions
--  Run with the mysql client / MySQL Workbench (uses DELIMITER).
-- =====================================================================
USE campus_lostfound;

DROP FUNCTION IF EXISTS fn_has_permission;
DROP FUNCTION IF EXISTS fn_category_root;
DROP FUNCTION IF EXISTS fn_category_relation_score;
DROP FUNCTION IF EXISTS fn_rule_match_score;
DROP FUNCTION IF EXISTS fn_recovery_rate;

DELIMITER $$

-- ---------------------------------------------------------------------
-- RBAC check done INSIDE the database.
-- TRUE when the user is active and their role holds the permission.
-- Used by the stored procedures and by every protected API route.
-- ---------------------------------------------------------------------
CREATE FUNCTION fn_has_permission(p_user_id INT UNSIGNED, p_permission_code VARCHAR(40))
RETURNS BOOLEAN
READS SQL DATA
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM users u
    JOIN role_permissions rp ON rp.role_id = u.role_id
    JOIN permissions p       ON p.permission_id = rp.permission_id
    WHERE u.user_id = p_user_id
      AND u.is_active = TRUE
      AND p.permission_code = p_permission_code
  );
END$$

-- ---------------------------------------------------------------------
-- Walks up the self-referencing category hierarchy (WHILE loop)
-- and returns the top-level ancestor, e.g. 'iPhone' -> 'Electronics'.
-- ---------------------------------------------------------------------
CREATE FUNCTION fn_category_root(p_category_id SMALLINT UNSIGNED)
RETURNS SMALLINT UNSIGNED
READS SQL DATA
BEGIN
  DECLARE v_current SMALLINT UNSIGNED DEFAULT p_category_id;
  DECLARE v_parent  SMALLINT UNSIGNED;
  DECLARE v_guard   INT DEFAULT 0;              -- protects against accidental cycles

  SELECT parent_category_id INTO v_parent FROM categories WHERE category_id = v_current;
  WHILE v_parent IS NOT NULL AND v_guard < 20 DO
    SET v_current = v_parent;
    SET v_parent  = NULL;
    SELECT parent_category_id INTO v_parent FROM categories WHERE category_id = v_current;
    SET v_guard = v_guard + 1;
  END WHILE;
  RETURN v_current;
END$$

-- ---------------------------------------------------------------------
-- How closely two categories are related:
--   same category 1.0 | parent/child 0.6 | siblings 0.3 | same root 0.15 | unrelated 0
-- ---------------------------------------------------------------------
CREATE FUNCTION fn_category_relation_score(p_cat_a SMALLINT UNSIGNED, p_cat_b SMALLINT UNSIGNED)
RETURNS DECIMAL(3,2)
READS SQL DATA
BEGIN
  DECLARE v_parent_a SMALLINT UNSIGNED;
  DECLARE v_parent_b SMALLINT UNSIGNED;

  IF p_cat_a = p_cat_b THEN
    RETURN 1.00;
  END IF;

  SELECT parent_category_id INTO v_parent_a FROM categories WHERE category_id = p_cat_a;
  SELECT parent_category_id INTO v_parent_b FROM categories WHERE category_id = p_cat_b;

  IF v_parent_a = p_cat_b OR v_parent_b = p_cat_a THEN
    RETURN 0.60;
  ELSEIF v_parent_a = v_parent_b THEN
    RETURN 0.30;
  ELSEIF fn_category_root(p_cat_a) = fn_category_root(p_cat_b) THEN
    RETURN 0.15;
  END IF;
  RETURN 0.00;
END$$

-- ---------------------------------------------------------------------
-- Rule-based match score between a lost report and a found report (0..1).
--   category  0.35  (scaled by fn_category_relation_score)
--   location  0.25  same spot | 0.15 same building | 0.05 same zone
--   date      0.20  found within 1 day | 0.15 <=3 | 0.10 <=7 | 0.05 <=30
--   colour    0.15  same colour | 0.05 when one side is multicolor/other
--   brand     0.05  same brand
-- An item found more than 1 day BEFORE it was lost cannot be the same item -> 0.
-- The semantic (description) part is computed by the vector database.
-- ---------------------------------------------------------------------
CREATE FUNCTION fn_rule_match_score(p_lost_id INT UNSIGNED, p_found_id INT UNSIGNED)
RETURNS DECIMAL(5,4)
READS SQL DATA
BEGIN
  DECLARE v_score     DECIMAL(6,4) DEFAULT 0;
  DECLARE v_days      INT;
  DECLARE l_cat, f_cat SMALLINT UNSIGNED;
  DECLARE l_loc, f_loc SMALLINT UNSIGNED;
  DECLARE l_bld, f_bld TINYINT UNSIGNED;
  DECLARE l_zone, f_zone VARCHAR(12);
  DECLARE l_color, f_color VARCHAR(12);
  DECLARE l_brand, f_brand VARCHAR(40);
  DECLARE l_date, f_date DATE;

  SELECT li.category_id, li.location_id, lb.building_id, lb.zone, li.color, li.brand, li.lost_date
    INTO l_cat, l_loc, l_bld, l_zone, l_color, l_brand, l_date
  FROM lost_items li
  JOIN locations ll ON ll.location_id = li.location_id
  JOIN buildings lb ON lb.building_id = ll.building_id
  WHERE li.lost_id = p_lost_id;

  SELECT fi.category_id, fi.location_id, fb.building_id, fb.zone, fi.color, fi.brand, fi.found_date
    INTO f_cat, f_loc, f_bld, f_zone, f_color, f_brand, f_date
  FROM found_items fi
  JOIN locations fl ON fl.location_id = fi.location_id
  JOIN buildings fb ON fb.building_id = fl.building_id
  WHERE fi.found_id = p_found_id;

  IF l_cat IS NULL OR f_cat IS NULL THEN
    RETURN 0;                                   -- one of the reports does not exist
  END IF;

  SET v_days = DATEDIFF(f_date, l_date);
  IF v_days < -1 THEN
    RETURN 0;
  END IF;

  -- category
  SET v_score = v_score + 0.35 * fn_category_relation_score(l_cat, f_cat);

  -- location
  SET v_score = v_score + CASE
                  WHEN l_loc  = f_loc  THEN 0.25
                  WHEN l_bld  = f_bld  THEN 0.15
                  WHEN l_zone = f_zone THEN 0.05
                  ELSE 0 END;

  -- date proximity
  SET v_score = v_score + CASE
                  WHEN v_days <= 1  THEN 0.20
                  WHEN v_days <= 3  THEN 0.15
                  WHEN v_days <= 7  THEN 0.10
                  WHEN v_days <= 30 THEN 0.05
                  ELSE 0 END;

  -- colour
  SET v_score = v_score + CASE
                  WHEN l_color = f_color THEN 0.15
                  WHEN l_color IN ('multicolor', 'other') OR f_color IN ('multicolor', 'other') THEN 0.05
                  ELSE 0 END;

  -- brand
  IF l_brand IS NOT NULL AND f_brand IS NOT NULL AND LOWER(TRIM(l_brand)) = LOWER(TRIM(f_brand)) THEN
    SET v_score = v_score + 0.05;
  END IF;

  RETURN LEAST(v_score, 1);
END$$

-- ---------------------------------------------------------------------
-- % of found items in a category (including all sub-categories)
-- that were returned to their owners. Uses a recursive CTE inside a function.
-- ---------------------------------------------------------------------
CREATE FUNCTION fn_recovery_rate(p_category_id SMALLINT UNSIGNED)
RETURNS DECIMAL(5,2)
READS SQL DATA
BEGIN
  DECLARE v_total INT DEFAULT 0;
  DECLARE v_returned INT DEFAULT 0;

  WITH RECURSIVE subtree AS (
    SELECT category_id FROM categories WHERE category_id = p_category_id
    UNION ALL
    SELECT c.category_id FROM categories c JOIN subtree s ON c.parent_category_id = s.category_id
  )
  SELECT COUNT(*), COALESCE(SUM(fi.status = 'RETURNED'), 0)
    INTO v_total, v_returned
  FROM found_items fi
  WHERE fi.category_id IN (SELECT category_id FROM subtree);

  IF v_total = 0 THEN
    RETURN 0;
  END IF;
  RETURN ROUND(100 * v_returned / v_total, 2);
END$$

DELIMITER ;
