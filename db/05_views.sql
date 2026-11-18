-- =====================================================================
--  05_views.sql  -  Views
--  * hide sensitive columns per role (vw_found_items_public has no hidden_marks)
--  * pre-joined read models used by the web app
--  * reporting / analytics views (aggregates, CTEs, window functions)
-- =====================================================================
USE campus_lostfound;

-- Category hierarchy flattened with a RECURSIVE CTE: depth, full path and root category
CREATE OR REPLACE VIEW vw_category_tree AS
WITH RECURSIVE tree AS (
  SELECT category_id, category_name, parent_category_id, is_high_value,
         0 AS depth,
         CAST(category_name AS CHAR(300)) AS full_path,
         category_id AS root_id
  FROM categories
  WHERE parent_category_id IS NULL
  UNION ALL
  SELECT c.category_id, c.category_name, c.parent_category_id, c.is_high_value,
         t.depth + 1,
         CONCAT(t.full_path, ' > ', c.category_name),
         t.root_id
  FROM categories c
  JOIN tree t ON c.parent_category_id = t.category_id
)
SELECT category_id, category_name, parent_category_id, is_high_value, depth, full_path, root_id
FROM tree;

CREATE OR REPLACE VIEW vw_locations AS
SELECT l.location_id, l.location_name, l.floor_no, l.is_collection_point,
       b.building_id, b.building_name, b.zone,
       CONCAT(l.location_name, ', ', b.building_name) AS full_name
FROM locations l
JOIN buildings b ON b.building_id = l.building_id;

-- Lost reports with every lookup resolved and the best current match score
CREATE OR REPLACE VIEW vw_lost_items_detail AS
SELECT li.lost_id, li.title, li.description, li.color, li.brand, li.lost_date, li.status,
       li.created_at, li.updated_at,
       li.owner_id, u.full_name AS owner_name, u.email AS owner_email,
       li.category_id, ct.category_name, ct.full_path AS category_path, ct.root_id AS root_category_id,
       li.location_id, vl.location_name, vl.building_name, vl.zone,
       DATEDIFF(CURDATE(), li.lost_date) AS days_since_lost,
       (SELECT MAX(pm.total_score)
          FROM potential_matches pm
         WHERE pm.lost_id = li.lost_id AND pm.match_status <> 'DISMISSED') AS best_match_score
FROM lost_items li
JOIN users u             ON u.user_id = li.owner_id
JOIN vw_category_tree ct ON ct.category_id = li.category_id
JOIN vw_locations vl     ON vl.location_id = li.location_id;

-- STUDENT view of found items: no hidden identifying marks, no finder contact details
CREATE OR REPLACE VIEW vw_found_items_public AS
SELECT fi.found_id, fi.title, fi.description, fi.color, fi.brand, fi.found_date, fi.status,
       fi.created_at, fi.finder_id, u.full_name AS finder_name,
       fi.category_id, ct.category_name, ct.full_path AS category_path, ct.root_id AS root_category_id,
       ct.is_high_value,
       fi.location_id, vl.location_name, vl.building_name, vl.zone,
       fi.held_at_id, ha.full_name AS held_at,
       DATEDIFF(CURDATE(), fi.found_date) AS days_since_found
FROM found_items fi
JOIN users u             ON u.user_id = fi.finder_id
JOIN vw_category_tree ct ON ct.category_id = fi.category_id
JOIN vw_locations vl     ON vl.location_id = fi.location_id
JOIN vw_locations ha     ON ha.location_id = fi.held_at_id;

-- STAFF / ADMIN view: everything, including hidden marks, finder contact and claim counts
CREATE OR REPLACE VIEW vw_found_items_staff AS
SELECT p.*, fi.hidden_marks, u.email AS finder_email, u.phone AS finder_phone,
       (SELECT COUNT(*) FROM claims c WHERE c.found_id = fi.found_id) AS total_claims,
       (SELECT COUNT(*) FROM claims c WHERE c.found_id = fi.found_id AND c.claim_status = 'PENDING') AS pending_claims
FROM vw_found_items_public p
JOIN found_items fi ON fi.found_id = p.found_id
JOIN users u        ON u.user_id = fi.finder_id;

-- Claims with item, claimant, verification and return information (LEFT JOINs for optional parts)
CREATE OR REPLACE VIEW vw_claims_detail AS
SELECT c.claim_id, c.claim_status, c.claimed_at, c.proof_details,
       c.claimant_id, cu.full_name AS claimant_name, cu.email AS claimant_email, sp.srn AS claimant_srn,
       c.found_id, f.title AS found_title, f.description AS found_description, f.hidden_marks,
       f.status AS found_status, f.found_date, ct.category_name, ct.is_high_value,
       ha.full_name AS held_at,
       c.lost_id, l.title AS lost_title, l.description AS lost_description, l.lost_date,
       pm.rule_score, pm.semantic_score, pm.total_score,
       v.verification_id, v.decision, v.remarks AS verification_remarks, v.verified_at,
       v.verifier_id, vu.full_name AS verifier_name,
       r.return_id, r.handover_status, r.returned_at, r.id_proof_checked,
       r.handled_by, ru.full_name AS handled_by_name
FROM claims c
JOIN users cu                    ON cu.user_id = c.claimant_id
LEFT JOIN student_profiles sp    ON sp.user_id = c.claimant_id
JOIN found_items f               ON f.found_id = c.found_id
JOIN vw_category_tree ct         ON ct.category_id = f.category_id
JOIN vw_locations ha             ON ha.location_id = f.held_at_id
LEFT JOIN lost_items l           ON l.lost_id = c.lost_id
LEFT JOIN potential_matches pm   ON pm.lost_id = c.lost_id AND pm.found_id = c.found_id
LEFT JOIN verifications v        ON v.claim_id = c.claim_id
LEFT JOIN users vu               ON vu.user_id = v.verifier_id
LEFT JOIN item_returns r         ON r.claim_id = c.claim_id
LEFT JOIN users ru               ON ru.user_id = r.handled_by;

-- Match suggestions ranked per lost report with a WINDOW FUNCTION
CREATE OR REPLACE VIEW vw_match_suggestions AS
SELECT pm.match_id, pm.lost_id, pm.found_id, pm.rule_score, pm.semantic_score, pm.total_score,
       pm.match_status, pm.matched_at,
       l.owner_id, l.title AS lost_title, l.status AS lost_status,
       f.title AS found_title, f.description AS found_description, f.color AS found_color,
       f.found_date, f.status AS found_status,
       fc.category_name AS found_category, fl.full_name AS found_location, ha.full_name AS held_at,
       ROW_NUMBER() OVER (PARTITION BY pm.lost_id ORDER BY pm.total_score DESC) AS rank_for_lost,
       ROW_NUMBER() OVER (PARTITION BY pm.found_id ORDER BY pm.total_score DESC) AS rank_for_found
FROM potential_matches pm
JOIN lost_items l     ON l.lost_id = pm.lost_id
JOIN found_items f    ON f.found_id = pm.found_id
JOIN categories fc    ON fc.category_id = f.category_id
JOIN vw_locations fl  ON fl.location_id = f.location_id
JOIN vw_locations ha  ON ha.location_id = f.held_at_id;

-- RBAC: effective permissions of every user
CREATE OR REPLACE VIEW vw_user_permissions AS
SELECT u.user_id, u.full_name, u.email, u.is_active, r.role_name, p.permission_code
FROM users u
JOIN roles r             ON r.role_id = u.role_id
JOIN role_permissions rp ON rp.role_id = r.role_id
JOIN permissions p       ON p.permission_id = rp.permission_id;

-- ---------------------------------------------------------------- analytics
-- Per top-level category: reports, returns and recovery rate (CTEs + aggregates)
CREATE OR REPLACE VIEW vw_category_stats AS
WITH tree AS (
  SELECT category_id, root_id FROM vw_category_tree
),
lost AS (
  SELECT t.root_id, COUNT(*) AS lost_count,
         SUM(li.status = 'RECOVERED') AS recovered_count
  FROM lost_items li JOIN tree t ON t.category_id = li.category_id
  GROUP BY t.root_id
),
found AS (
  SELECT t.root_id, COUNT(*) AS found_count,
         SUM(fi.status = 'RETURNED') AS returned_count
  FROM found_items fi JOIN tree t ON t.category_id = fi.category_id
  GROUP BY t.root_id
)
SELECT c.category_id, c.category_name,
       COALESCE(lost.lost_count, 0)       AS lost_count,
       COALESCE(lost.recovered_count, 0)  AS recovered_count,
       COALESCE(found.found_count, 0)     AS found_count,
       COALESCE(found.returned_count, 0)  AS returned_count,
       ROUND(100 * COALESCE(found.returned_count, 0) / NULLIF(found.found_count, 0), 1) AS recovery_rate
FROM categories c
LEFT JOIN lost  ON lost.root_id  = c.category_id
LEFT JOIN found ON found.root_id = c.category_id
WHERE c.parent_category_id IS NULL;

-- Where things get lost / found most (per building)
CREATE OR REPLACE VIEW vw_location_hotspots AS
SELECT b.building_id, b.building_name, b.zone,
       COUNT(DISTINCT li.lost_id)  AS lost_count,
       COUNT(DISTINCT fi.found_id) AS found_count,
       COUNT(DISTINCT li.lost_id) + COUNT(DISTINCT fi.found_id) AS total_reports
FROM buildings b
JOIN locations l        ON l.building_id = b.building_id
LEFT JOIN lost_items li ON li.location_id = l.location_id
LEFT JOIN found_items fi ON fi.location_id = l.location_id
GROUP BY b.building_id, b.building_name, b.zone;

-- One-row KPI summary for dashboards
CREATE OR REPLACE VIEW vw_dashboard_kpis AS
SELECT
  (SELECT COUNT(*) FROM lost_items)                                              AS total_lost,
  (SELECT COUNT(*) FROM lost_items WHERE status IN ('OPEN', 'MATCHED'))          AS open_lost,
  (SELECT COUNT(*) FROM found_items)                                             AS total_found,
  (SELECT COUNT(*) FROM found_items WHERE status IN ('AVAILABLE', 'CLAIM_PENDING')) AS unclaimed_found,
  (SELECT COUNT(*) FROM claims WHERE claim_status = 'PENDING')                   AS pending_claims,
  (SELECT COUNT(*) FROM found_items WHERE status = 'CLAIM_APPROVED')             AS awaiting_handover,
  (SELECT COUNT(*) FROM item_returns WHERE handover_status = 'HANDED_OVER')      AS returned_items,
  (SELECT COUNT(*) FROM potential_matches
    WHERE match_status <> 'DISMISSED' AND total_score >= 0.55)                   AS strong_matches,
  (SELECT ROUND(AVG(DATEDIFF(r.returned_at, f.found_date)), 1)
     FROM item_returns r
     JOIN claims c      ON c.claim_id = r.claim_id
     JOIN found_items f ON f.found_id = c.found_id
    WHERE r.handover_status = 'HANDED_OVER')                                     AS avg_days_to_return,
  (SELECT ROUND(100 * SUM(status = 'RETURNED') / NULLIF(COUNT(*), 0), 1)
     FROM found_items)                                                           AS recovery_rate;
