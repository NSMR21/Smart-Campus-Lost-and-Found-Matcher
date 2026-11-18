-- =====================================================================
--  JOIN queries
-- =====================================================================
USE campus_lostfound;

-- [J-1] Open lost reports with owner, category, location and building
-- concept: INNER JOIN across five tables
-- mode: read
SELECT l.lost_id, l.title, u.full_name AS owner, c.category_name, loc.location_name, b.building_name, l.lost_date, l.status
FROM lost_items l
INNER JOIN users u      ON u.user_id = l.owner_id
INNER JOIN categories c ON c.category_id = l.category_id
INNER JOIN locations loc ON loc.location_id = l.location_id
INNER JOIN buildings b  ON b.building_id = loc.building_id
WHERE l.status IN ('OPEN', 'MATCHED')
ORDER BY l.lost_date DESC;

-- [J-2] Every found item with its number of claims (including items with none)
-- concept: LEFT OUTER JOIN + GROUP BY keeps found items that have no claims
-- mode: read
SELECT f.found_id, f.title, f.status, COUNT(cl.claim_id) AS claims,
       SUM(cl.claim_status = 'PENDING') AS pending
FROM found_items f
LEFT JOIN claims cl ON cl.found_id = f.found_id
GROUP BY f.found_id, f.title, f.status
ORDER BY claims DESC, f.found_id;

-- [J-3] Number of lost reports in every category, including empty ones
-- concept: RIGHT OUTER JOIN (categories is the preserved side)
-- mode: read
SELECT c.category_name, COUNT(l.lost_id) AS lost_reports
FROM lost_items l
RIGHT JOIN categories c ON c.category_id = l.category_id
GROUP BY c.category_id, c.category_name
ORDER BY lost_reports DESC, c.category_name;

-- [J-4] Categories with their parent category
-- concept: SELF JOIN on the self-referencing foreign key
-- mode: read
SELECT child.category_name AS category, parent.category_name AS parent_category, child.is_high_value
FROM categories child
LEFT JOIN categories parent ON parent.category_id = child.parent_category_id
ORDER BY parent.category_name, child.category_name;

-- [J-5] Suggested matches with the names of both students involved
-- concept: M:N relationship (potential_matches) and the users table joined twice with aliases
-- mode: read
SELECT pm.total_score, l.title AS lost_item, owner.full_name AS owner,
       f.title AS found_item, finder.full_name AS finder, pm.match_status
FROM potential_matches pm
JOIN lost_items  l      ON l.lost_id = pm.lost_id
JOIN found_items f      ON f.found_id = pm.found_id
JOIN users       owner  ON owner.user_id = l.owner_id
JOIN users       finder ON finder.user_id = f.finder_id
WHERE pm.total_score >= 0.55
ORDER BY pm.total_score DESC;

-- [J-6] Full history of every returned item: finder, claimant, verifier, staff at hand-over
-- concept: one table (users) joined four times under different roles
-- mode: read
SELECT f.title, finder.full_name AS found_by, claimant.full_name AS returned_to,
       verifier.full_name AS verified_by, staff.full_name AS handed_over_by,
       DATEDIFF(r.returned_at, f.found_date) AS days_to_return
FROM item_returns r
JOIN claims c         ON c.claim_id = r.claim_id
JOIN found_items f    ON f.found_id = c.found_id
JOIN users finder     ON finder.user_id = f.finder_id
JOIN users claimant   ON claimant.user_id = c.claimant_id
JOIN verifications v  ON v.claim_id = c.claim_id
JOIN users verifier   ON verifier.user_id = v.verifier_id
JOIN users staff      ON staff.user_id = r.handled_by
ORDER BY r.returned_at DESC;

-- [J-7] Permissions of each role
-- concept: JOIN ... USING (common column names)
-- mode: read
SELECT r.role_name, p.permission_code
FROM roles r
JOIN role_permissions USING (role_id)
JOIN permissions p USING (permission_id)
ORDER BY r.role_id, p.permission_id;

-- [J-8] Role x permission matrix
-- concept: CROSS JOIN builds every combination, LEFT JOIN marks the granted ones
-- mode: read
SELECT p.permission_code,
       MAX(CASE WHEN r.role_name = 'STUDENT' THEN rp.role_id IS NOT NULL END) AS student,
       MAX(CASE WHEN r.role_name = 'STAFF'   THEN rp.role_id IS NOT NULL END) AS staff,
       MAX(CASE WHEN r.role_name = 'ADMIN'   THEN rp.role_id IS NOT NULL END) AS admin
FROM roles r
CROSS JOIN permissions p
LEFT JOIN role_permissions rp ON rp.role_id = r.role_id AND rp.permission_id = p.permission_id
GROUP BY p.permission_id, p.permission_code
ORDER BY p.permission_id;

-- [J-9] Unclaimed found items that no lost report matches
-- concept: anti-join (LEFT JOIN ... WHERE right side IS NULL)
-- mode: read
SELECT f.found_id, f.title, f.found_date, f.status
FROM found_items f
LEFT JOIN potential_matches pm ON pm.found_id = f.found_id AND pm.match_status <> 'DISMISSED'
WHERE pm.match_id IS NULL AND f.status = 'AVAILABLE'
ORDER BY f.found_date;
