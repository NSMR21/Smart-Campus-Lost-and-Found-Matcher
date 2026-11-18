-- =====================================================================
--  Aggregate queries for reports and analytics
-- =====================================================================
USE campus_lostfound;

-- [A-1] Status summary of lost and found reports
-- concept: GROUP BY + UNION ALL of two aggregates
-- mode: read
SELECT 'lost' AS report_type, status, COUNT(*) AS reports FROM lost_items GROUP BY status
UNION ALL
SELECT 'found', status, COUNT(*) FROM found_items GROUP BY status
ORDER BY report_type, reports DESC;

-- [A-2] Found items per zone and building with sub-totals
-- concept: GROUP BY ... WITH ROLLUP and GROUPING()
-- mode: read
SELECT IF(GROUPING(b.zone), 'ALL ZONES', b.zone) AS zone,
       IF(GROUPING(b.building_name), '-- subtotal --', b.building_name) AS building,
       COUNT(*) AS found_items
FROM found_items f
JOIN locations l ON l.location_id = f.location_id
JOIN buildings b ON b.building_id = l.building_id
GROUP BY b.zone, b.building_name WITH ROLLUP;

-- [A-3] Categories with at least three reports in total
-- concept: HAVING filters groups after aggregation
-- mode: read
SELECT c.category_name,
       SUM(src = 'lost') AS lost, SUM(src = 'found') AS found, COUNT(*) AS total
FROM (SELECT category_id, 'lost' AS src FROM lost_items
      UNION ALL
      SELECT category_id, 'found' FROM found_items) AS r
JOIN categories c ON c.category_id = r.category_id
GROUP BY c.category_id, c.category_name
HAVING COUNT(*) >= 3
ORDER BY total DESC;

-- [A-4] How quickly the desk verifies claims
-- concept: AVG / MIN / MAX with TIMESTAMPDIFF
-- mode: read
SELECT v.decision, COUNT(*) AS decisions,
       ROUND(AVG(TIMESTAMPDIFF(HOUR, c.claimed_at, v.verified_at)), 1) AS avg_hours,
       MIN(TIMESTAMPDIFF(HOUR, c.claimed_at, v.verified_at))           AS fastest_hours,
       MAX(TIMESTAMPDIFF(HOUR, c.claimed_at, v.verified_at))           AS slowest_hours
FROM verifications v JOIN claims c ON c.claim_id = v.claim_id
GROUP BY v.decision;

-- [A-5] Lost reports per department and year of study
-- concept: GROUP BY two columns over a 3-table join
-- mode: read
SELECT d.dept_code, sp.year_of_study, COUNT(l.lost_id) AS lost_reports
FROM student_profiles sp
JOIN departments d     ON d.dept_id = sp.dept_id
LEFT JOIN lost_items l ON l.owner_id = sp.user_id
GROUP BY d.dept_code, sp.year_of_study
ORDER BY lost_reports DESC, d.dept_code;

-- [A-6] Colours of found items with the item names in each group
-- concept: GROUP_CONCAT
-- mode: read
SELECT color, COUNT(*) AS items, GROUP_CONCAT(title ORDER BY title SEPARATOR ', ') AS titles
FROM found_items
GROUP BY color
ORDER BY items DESC;

-- [A-7] Found-item status per building as a pivot table
-- concept: conditional aggregation (SUM(condition)) to pivot rows into columns
-- mode: read
SELECT b.building_name,
       SUM(f.status = 'AVAILABLE')      AS available,
       SUM(f.status = 'CLAIM_PENDING')  AS claim_pending,
       SUM(f.status = 'CLAIM_APPROVED') AS approved,
       SUM(f.status = 'RETURNED')       AS returned,
       SUM(f.status = 'DISPOSED')       AS disposed
FROM found_items f
JOIN locations l ON l.location_id = f.location_id
JOIN buildings b ON b.building_id = l.building_id
GROUP BY b.building_id, b.building_name
ORDER BY b.building_name;
