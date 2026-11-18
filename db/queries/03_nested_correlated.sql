-- =====================================================================
--  Nested and correlated sub-queries
-- =====================================================================
USE campus_lostfound;

-- [N-1] Students who lost something in a building where a phone was found
-- concept: nested sub-queries with IN (three levels)
-- mode: read
SELECT DISTINCT u.full_name, u.email
FROM users u
WHERE u.user_id IN (
  SELECT l.owner_id FROM lost_items l
  WHERE l.location_id IN (
    SELECT loc.location_id FROM locations loc
    WHERE loc.building_id IN (
      SELECT fl.building_id
      FROM found_items f JOIN locations fl ON fl.location_id = f.location_id
      WHERE f.category_id = 2)));

-- [N-2] Found items older than a week that nobody has claimed
-- concept: NOT EXISTS (correlated)
-- mode: read
SELECT f.found_id, f.title, f.found_date, DATEDIFF(CURDATE(), f.found_date) AS days_waiting
FROM found_items f
WHERE f.status = 'AVAILABLE'
  AND f.found_date < CURDATE() - INTERVAL 7 DAY
  AND NOT EXISTS (SELECT 1 FROM claims c WHERE c.found_id = f.found_id)
ORDER BY days_waiting DESC;

-- [N-3] Best match for every open lost report
-- concept: correlated sub-query in WHERE (score = the MAX for the same lost_id)
-- mode: read
SELECT l.lost_id, l.title AS lost_item, f.title AS best_found_item, pm.total_score
FROM lost_items l
JOIN potential_matches pm ON pm.lost_id = l.lost_id
JOIN found_items f        ON f.found_id = pm.found_id
WHERE l.status IN ('OPEN', 'MATCHED')
  AND pm.total_score = (SELECT MAX(pm2.total_score)
                        FROM potential_matches pm2
                        WHERE pm2.lost_id = l.lost_id AND pm2.match_status <> 'DISMISSED')
ORDER BY pm.total_score DESC;

-- [N-4] Activity summary per student
-- concept: correlated scalar sub-queries in the SELECT list
-- mode: read
SELECT u.full_name,
       (SELECT COUNT(*) FROM lost_items l  WHERE l.owner_id = u.user_id)  AS lost_reports,
       (SELECT COUNT(*) FROM found_items f WHERE f.finder_id = u.user_id) AS found_reports,
       (SELECT COUNT(*) FROM claims c      WHERE c.claimant_id = u.user_id) AS claims
FROM users u
WHERE u.role_id = (SELECT role_id FROM roles WHERE role_name = 'STUDENT')
ORDER BY found_reports DESC, lost_reports DESC;

-- [N-5] Claimants whose claims were ALL approved
-- concept: comparison with ALL (correlated) + EXISTS
-- mode: read
SELECT u.full_name, (SELECT COUNT(*) FROM claims c WHERE c.claimant_id = u.user_id) AS claims
FROM users u
WHERE EXISTS (SELECT 1 FROM claims c WHERE c.claimant_id = u.user_id)
  AND 'APPROVED' = ALL (SELECT c.claim_status FROM claims c WHERE c.claimant_id = u.user_id);

-- [N-6] Found items reported after ANY recovered loss in the same category
-- concept: comparison with ANY (correlated)
-- mode: read
SELECT f.found_id, f.title, f.found_date
FROM found_items f
WHERE f.status = 'AVAILABLE'
  AND f.found_date > ANY (SELECT l.lost_date FROM lost_items l
                          WHERE l.category_id = f.category_id AND l.status = 'RECOVERED');

-- [N-7] Students who lose more often than the average student
-- concept: sub-query inside HAVING
-- mode: read
SELECT u.full_name, COUNT(*) AS lost_reports
FROM lost_items l JOIN users u ON u.user_id = l.owner_id
GROUP BY u.user_id, u.full_name
HAVING COUNT(*) > (SELECT AVG(n) FROM (SELECT COUNT(*) AS n FROM lost_items GROUP BY owner_id) AS per_owner)
ORDER BY lost_reports DESC;

-- [N-8] Average days to return per top-level category
-- concept: derived table (sub-query in FROM)
-- mode: read
SELECT t.root_category, COUNT(*) AS returned_items, ROUND(AVG(t.days), 1) AS avg_days
FROM (
  SELECT ct_root.category_name AS root_category, DATEDIFF(r.returned_at, f.found_date) AS days
  FROM item_returns r
  JOIN claims c              ON c.claim_id = r.claim_id
  JOIN found_items f         ON f.found_id = c.found_id
  JOIN vw_category_tree ct   ON ct.category_id = f.category_id
  JOIN categories ct_root    ON ct_root.category_id = ct.root_id
) AS t
GROUP BY t.root_category
ORDER BY avg_days;

-- [N-9] Good Samaritans: students who both found an item and lost one
-- concept: two EXISTS conditions on different tables
-- mode: read
SELECT u.full_name
FROM users u
WHERE EXISTS (SELECT 1 FROM found_items f WHERE f.finder_id = u.user_id)
  AND EXISTS (SELECT 1 FROM lost_items l WHERE l.owner_id = u.user_id)
ORDER BY u.full_name;

-- [N-10] Suspicious claimants: a rejected claim AND another claim still pending
-- concept: correlated EXISTS used for fraud detection
-- mode: read
SELECT u.full_name, u.email,
       (SELECT COUNT(*) FROM claims c WHERE c.claimant_id = u.user_id AND c.claim_status = 'REJECTED') AS rejected,
       (SELECT COUNT(*) FROM claims c WHERE c.claimant_id = u.user_id AND c.claim_status = 'PENDING')  AS pending
FROM users u
WHERE EXISTS (SELECT 1 FROM claims c WHERE c.claimant_id = u.user_id AND c.claim_status = 'REJECTED')
  AND EXISTS (SELECT 1 FROM claims c WHERE c.claimant_id = u.user_id AND c.claim_status = 'PENDING');
