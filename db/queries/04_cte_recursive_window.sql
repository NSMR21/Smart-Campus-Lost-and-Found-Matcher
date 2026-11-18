-- =====================================================================
--  Common Table Expressions (recursive and non-recursive) and window functions
-- =====================================================================
USE campus_lostfound;

-- [C-1] The whole category tree with depth and full path
-- concept: RECURSIVE CTE over a self-referencing table (top-down)
-- mode: read
WITH RECURSIVE tree AS (
  SELECT category_id, category_name, 0 AS depth, CAST(category_name AS CHAR(300)) AS path
  FROM categories WHERE parent_category_id IS NULL
  UNION ALL
  SELECT c.category_id, c.category_name, t.depth + 1, CONCAT(t.path, ' > ', c.category_name)
  FROM categories c JOIN tree t ON c.parent_category_id = t.category_id
)
SELECT CONCAT(REPEAT('    ', depth), category_name) AS category, depth, path
FROM tree ORDER BY path;

-- [C-2] All ancestors of "Wireless Earbuds"
-- concept: RECURSIVE CTE walking bottom-up (child -> parent -> root)
-- mode: read
WITH RECURSIVE ancestors AS (
  SELECT category_id, category_name, parent_category_id, 0 AS level
  FROM categories WHERE category_name = 'Wireless Earbuds'
  UNION ALL
  SELECT p.category_id, p.category_name, p.parent_category_id, a.level + 1
  FROM categories p JOIN ancestors a ON p.category_id = a.parent_category_id
)
SELECT level, category_name FROM ancestors ORDER BY level;

-- [C-3] Lost reports per category including all sub-categories (roll-up of the tree)
-- concept: RECURSIVE CTE producing (ancestor, descendant) pairs, then GROUP BY
-- mode: read
WITH RECURSIVE closure AS (
  SELECT category_id AS ancestor_id, category_id AS descendant_id FROM categories
  UNION ALL
  SELECT cl.ancestor_id, c.category_id
  FROM closure cl JOIN categories c ON c.parent_category_id = cl.descendant_id
)
SELECT a.category_name, COUNT(l.lost_id) AS lost_in_subtree
FROM closure cl
JOIN categories a      ON a.category_id = cl.ancestor_id
LEFT JOIN lost_items l ON l.category_id = cl.descendant_id
GROUP BY a.category_id, a.category_name
HAVING lost_in_subtree > 0
ORDER BY lost_in_subtree DESC;

-- [C-4] Daily lost / found counts for the last 14 days, including empty days
-- concept: RECURSIVE CTE as a date generator + LEFT JOIN to aggregated CTEs
-- mode: read
WITH RECURSIVE days AS (
  SELECT CURDATE() - INTERVAL 13 DAY AS day
  UNION ALL
  SELECT day + INTERVAL 1 DAY FROM days WHERE day < CURDATE()
),
lost AS (SELECT lost_date AS day, COUNT(*) AS n FROM lost_items GROUP BY lost_date),
found AS (SELECT found_date AS day, COUNT(*) AS n FROM found_items GROUP BY found_date)
SELECT d.day, COALESCE(lost.n, 0) AS lost, COALESCE(found.n, 0) AS found
FROM days d
LEFT JOIN lost  ON lost.day = d.day
LEFT JOIN found ON found.day = d.day
ORDER BY d.day;

-- [C-5] Claim funnel: submitted -> decided -> approved -> returned
-- concept: several non-recursive CTEs combined in one SELECT
-- mode: read
WITH submitted AS (SELECT COUNT(*) AS n FROM claims),
     decided   AS (SELECT COUNT(*) AS n FROM verifications),
     approved  AS (SELECT COUNT(*) AS n FROM verifications WHERE decision = 'APPROVED'),
     returned  AS (SELECT COUNT(*) AS n FROM item_returns WHERE handover_status = 'HANDED_OVER')
SELECT submitted.n AS submitted, decided.n AS decided, approved.n AS approved, returned.n AS returned,
       ROUND(100 * returned.n / NULLIF(submitted.n, 0), 1) AS success_pct
FROM submitted, decided, approved, returned;

-- [C-6] Top 3 suggestions for each open lost report
-- concept: window function ROW_NUMBER() OVER (PARTITION BY ... ORDER BY ...)
-- mode: read
SELECT * FROM (
  SELECT pm.lost_id, l.title AS lost_item, f.title AS found_item, pm.total_score,
         ROW_NUMBER() OVER (PARTITION BY pm.lost_id ORDER BY pm.total_score DESC) AS rank_no
  FROM potential_matches pm
  JOIN lost_items l  ON l.lost_id = pm.lost_id
  JOIN found_items f ON f.found_id = pm.found_id
  WHERE l.status IN ('OPEN', 'MATCHED') AND pm.match_status = 'SUGGESTED'
) ranked
WHERE rank_no <= 3
ORDER BY lost_id, rank_no;

-- [C-7] Cumulative number of items returned, month by month
-- concept: running total with SUM() OVER (ORDER BY ...)
-- mode: read
SELECT month, returned, SUM(returned) OVER (ORDER BY month) AS cumulative_returned
FROM (
  SELECT DATE_FORMAT(returned_at, '%Y-%m') AS month, COUNT(*) AS returned
  FROM item_returns GROUP BY DATE_FORMAT(returned_at, '%Y-%m')
) monthly
ORDER BY month;

-- [C-8] Gap between consecutive found reports in the same building
-- concept: LAG() over a partition
-- mode: read
SELECT b.building_name, f.title, f.found_date,
       LAG(f.found_date) OVER (PARTITION BY b.building_id ORDER BY f.found_date) AS previous_found,
       DATEDIFF(f.found_date, LAG(f.found_date) OVER (PARTITION BY b.building_id ORDER BY f.found_date)) AS gap_days
FROM found_items f
JOIN locations l ON l.location_id = f.location_id
JOIN buildings b ON b.building_id = l.building_id
ORDER BY b.building_name, f.found_date;

-- [C-9] Buildings ranked by lost reports, split into quartiles
-- concept: DENSE_RANK() and NTILE() window functions
-- mode: read
SELECT b.building_name, COUNT(li.lost_id) AS lost_reports,
       DENSE_RANK() OVER (ORDER BY COUNT(li.lost_id) DESC) AS dense_rank_no,
       NTILE(4) OVER (ORDER BY COUNT(li.lost_id) DESC)     AS quartile
FROM buildings b
JOIN locations l        ON l.building_id = b.building_id
LEFT JOIN lost_items li ON li.location_id = l.location_id
GROUP BY b.building_id, b.building_name
ORDER BY lost_reports DESC;
