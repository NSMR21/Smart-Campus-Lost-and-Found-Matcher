// Read queries used by the pages (server components) and the GET API routes.
import { query, queryOne } from './db.js';
import { can } from './auth.js';
import { COLORS } from './constants.js';

// ---------------------------------------------------------------- lookups
export async function getMeta() {
  const [categories, locations, buildings, departments] = await Promise.all([
    query(`SELECT category_id, category_name, parent_category_id, depth, full_path, is_high_value
           FROM vw_category_tree ORDER BY full_path`),
    query(`SELECT location_id, location_name, floor_no, building_id, building_name, zone, full_name, is_collection_point
           FROM vw_locations ORDER BY building_name, location_name`),
    query('SELECT building_id, building_name, zone FROM buildings ORDER BY building_name'),
    query('SELECT dept_id, dept_code, dept_name FROM departments ORDER BY dept_name'),
  ]);
  return { categories, locations, buildings, departments, colors: COLORS };
}

// ---------------------------------------------------------------- search helpers
/** Turns free text into a FULLTEXT boolean-mode query: every word as a prefix match. */
function fulltextQuery(text) {
  const words = String(text).toLowerCase().split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter((w) => w.length >= 3);
  return words.length ? words.map((w) => `${w}*`).join(' ') : null;
}

// category filter includes every sub-category (recursive CTE inside IN (...))
const CATEGORY_SUBTREE = `(
  WITH RECURSIVE sub AS (
    SELECT category_id FROM categories WHERE category_id = ?
    UNION ALL
    SELECT c.category_id FROM categories c JOIN sub ON c.parent_category_id = sub.category_id
  ) SELECT category_id FROM sub)`;

function buildFilters(kind, f, session) {
  const where = [];
  const params = [];
  const table = kind === 'lost' ? 'lost_items' : 'found_items';
  const idCol = kind === 'lost' ? 'lost_id' : 'found_id';
  const dateCol = kind === 'lost' ? 'lost_date' : 'found_date';

  if (f.q) {
    const ft = fulltextQuery(f.q);
    if (ft) {
      where.push(`v.${idCol} IN (SELECT ${idCol} FROM ${table} WHERE MATCH(title, description) AGAINST (? IN BOOLEAN MODE))`);
      params.push(ft);
    } else {
      where.push('(v.title LIKE ? OR v.description LIKE ?)');
      params.push(`%${f.q}%`, `%${f.q}%`);
    }
  }
  if (Number(f.category) > 0) {
    where.push(`v.category_id IN ${CATEGORY_SUBTREE}`);
    params.push(Number(f.category));
  }
  if (Number(f.building) > 0) {
    where.push('v.location_id IN (SELECT location_id FROM locations WHERE building_id = ?)');
    params.push(Number(f.building));
  }
  if (f.status) {
    where.push('v.status = ?');
    params.push(f.status);
  } else if (!f.mine) {
    // by default hide closed cases
    where.push(kind === 'lost' ? "v.status IN ('OPEN', 'MATCHED')" : "v.status IN ('AVAILABLE', 'CLAIM_PENDING', 'CLAIM_APPROVED')");
  }
  if (f.from) { where.push(`v.${dateCol} >= ?`); params.push(f.from); }
  if (f.to) { where.push(`v.${dateCol} <= ?`); params.push(f.to); }
  if (f.mine && session) {
    where.push(kind === 'lost' ? 'v.owner_id = ?' : 'v.finder_id = ?');
    params.push(session.userId);
  }
  return { where: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

// ---------------------------------------------------------------- lost / found
export async function listLost(filters, session) {
  const { where, params } = buildFilters('lost', filters, session);
  return query(`SELECT v.* FROM vw_lost_items_detail v ${where}
                ORDER BY v.lost_date DESC, v.lost_id DESC LIMIT 100`, params);
}

export async function listFound(filters, session) {
  const { where, params } = buildFilters('found', filters, session);
  return query(`SELECT v.* FROM vw_found_items_public v ${where}
                ORDER BY v.found_date DESC, v.found_id DESC LIMIT 100`, params);
}

export async function getLost(id) {
  return queryOne('SELECT * FROM vw_lost_items_detail WHERE lost_id = ?', [id]);
}

/** Students get the public view; staff get hidden marks and finder contact. */
export async function getFound(id, session) {
  const view = can(session, 'VIEW_HIDDEN_DETAILS') ? 'vw_found_items_staff' : 'vw_found_items_public';
  return queryOne(`SELECT * FROM ${view} WHERE found_id = ?`, [id]);
}

export async function getMatchesForLost(lostId) {
  return query(`SELECT * FROM vw_match_suggestions
                WHERE lost_id = ? AND match_status <> 'DISMISSED'
                ORDER BY total_score DESC LIMIT 10`, [lostId]);
}

export async function getMatchesForFound(foundId) {
  return query(`SELECT ms.*, u.full_name AS owner_name
                FROM vw_match_suggestions ms JOIN users u ON u.user_id = ms.owner_id
                WHERE ms.found_id = ? AND ms.match_status <> 'DISMISSED'
                ORDER BY ms.total_score DESC LIMIT 10`, [foundId]);
}

export async function getOpenLostReports(userId) {
  return query(`SELECT lost_id, title FROM lost_items
                WHERE owner_id = ? AND status IN ('OPEN', 'MATCHED') ORDER BY lost_date DESC`, [userId]);
}

// ---------------------------------------------------------------- claims
const CLAIM_ORDER = "FIELD(claim_status, 'PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN'), claimed_at DESC";

export async function listClaims({ mine, status }, session) {
  const where = [];
  const params = [];
  if (mine || !can(session, 'CLAIM_VERIFY')) { where.push('claimant_id = ?'); params.push(session.userId); }
  if (status === 'HANDOVER') where.push("claim_status = 'APPROVED' AND return_id IS NULL");
  else if (status) { where.push('claim_status = ?'); params.push(status); }
  return query(`SELECT claim_id, claim_status, claimed_at, claimant_id, claimant_name, claimant_srn,
                       found_id, found_title, found_status, category_name, is_high_value, held_at,
                       lost_id, lost_title, total_score, decision, verifier_name, verified_at,
                       return_id, returned_at
                FROM vw_claims_detail
                ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
                ORDER BY ${CLAIM_ORDER} LIMIT 200`, params);
}

export async function getClaim(id) {
  return queryOne('SELECT * FROM vw_claims_detail WHERE claim_id = ?', [id]);
}

export async function getClaimsForFound(foundId) {
  return query(`SELECT claim_id, claim_status, claimed_at, claimant_id, claimant_name, claimant_srn, total_score
                FROM vw_claims_detail WHERE found_id = ? ORDER BY ${CLAIM_ORDER}`, [foundId]);
}

export async function getMyClaimFor(foundId, userId) {
  return queryOne('SELECT claim_id, claim_status FROM claims WHERE found_id = ? AND claimant_id = ?', [foundId, userId]);
}

// ---------------------------------------------------------------- dashboards & reports
export async function getKpis() {
  return queryOne('SELECT * FROM vw_dashboard_kpis');
}

export async function getStudentDashboard(userId) {
  const [lost, suggestions, claims, recentFound, counts] = await Promise.all([
    query(`SELECT lost_id, title, status, lost_date, category_name, building_name, best_match_score
           FROM vw_lost_items_detail WHERE owner_id = ?
           ORDER BY FIELD(status, 'MATCHED', 'OPEN', 'RECOVERED', 'CLOSED'), lost_date DESC LIMIT 6`, [userId]),
    query(`SELECT ms.* FROM vw_match_suggestions ms
           WHERE ms.owner_id = ? AND ms.rank_for_lost <= 3 AND ms.match_status = 'SUGGESTED' AND ms.total_score >= 0.45
             AND ms.lost_status IN ('OPEN', 'MATCHED') AND ms.found_status IN ('AVAILABLE', 'CLAIM_PENDING')
             -- hide reports whose owner already has a claim in progress for them
             AND NOT EXISTS (SELECT 1 FROM claims c
                             WHERE c.lost_id = ms.lost_id AND c.claim_status IN ('PENDING', 'APPROVED'))
           ORDER BY ms.total_score DESC LIMIT 5`, [userId]),
    query(`SELECT claim_id, claim_status, found_title, held_at, claimed_at, return_id
           FROM vw_claims_detail WHERE claimant_id = ? ORDER BY claimed_at DESC LIMIT 5`, [userId]),
    query(`SELECT found_id, title, category_name, building_name, found_date, status
           FROM vw_found_items_public
           WHERE status IN ('AVAILABLE', 'CLAIM_PENDING') AND found_date >= CURDATE() - INTERVAL 7 DAY
           ORDER BY found_date DESC LIMIT 6`),
    queryOne(`SELECT
                (SELECT COUNT(*) FROM lost_items  WHERE owner_id  = ?) AS my_lost,
                (SELECT COUNT(*) FROM found_items WHERE finder_id = ?) AS my_found,
                (SELECT COUNT(*) FROM found_items WHERE finder_id = ? AND status = 'RETURNED') AS my_returned,
                (SELECT COUNT(*) FROM claims WHERE claimant_id = ? AND claim_status = 'PENDING') AS my_pending_claims`,
      [userId, userId, userId, userId]),
  ]);
  return { lost, suggestions, claims, recentFound, counts };
}

export async function getStaffDashboard() {
  const [kpis, pending, handover, recentFound] = await Promise.all([
    getKpis(),
    query(`SELECT claim_id, claimant_name, claimant_srn, found_title, claimed_at, total_score
           FROM vw_claims_detail WHERE claim_status = 'PENDING' ORDER BY claimed_at LIMIT 6`),
    query(`SELECT claim_id, claimant_name, found_title, held_at, verified_at, is_high_value
           FROM vw_claims_detail WHERE claim_status = 'APPROVED' AND return_id IS NULL ORDER BY verified_at LIMIT 6`),
    query(`SELECT found_id, title, category_name, held_at, found_date, status
           FROM vw_found_items_public ORDER BY created_at DESC LIMIT 6`),
  ]);
  return { kpis, pending, handover, recentFound };
}

export async function getReports() {
  const [kpis, categories, hotspots, monthly, finders, scoreBuckets, claimOutcomes, ageing] = await Promise.all([
    getKpis(),
    query('SELECT * FROM vw_category_stats ORDER BY lost_count + found_count DESC'),
    query('SELECT * FROM vw_location_hotspots ORDER BY total_reports DESC'),
    // recursive CTE generates the last six months so that empty months still appear
    query(`WITH RECURSIVE months AS (
             SELECT CAST(DATE_FORMAT(CURDATE() - INTERVAL 5 MONTH, '%Y-%m-01') AS DATE) AS month_start
             UNION ALL
             SELECT month_start + INTERVAL 1 MONTH FROM months
             WHERE month_start < CAST(DATE_FORMAT(CURDATE(), '%Y-%m-01') AS DATE)
           )
           SELECT DATE_FORMAT(m.month_start, '%b %Y') AS month,
                  (SELECT COUNT(*) FROM lost_items
                    WHERE lost_date >= m.month_start AND lost_date < m.month_start + INTERVAL 1 MONTH)   AS lost,
                  (SELECT COUNT(*) FROM found_items
                    WHERE found_date >= m.month_start AND found_date < m.month_start + INTERVAL 1 MONTH) AS found,
                  (SELECT COUNT(*) FROM item_returns
                    WHERE returned_at >= m.month_start AND returned_at < m.month_start + INTERVAL 1 MONTH) AS returned
           FROM months m ORDER BY m.month_start`),
    // window function: rank finders by items returned to owners
    query(`SELECT u.full_name, COUNT(*) AS items_found, SUM(f.status = 'RETURNED') AS returned_to_owner,
                  RANK() OVER (ORDER BY SUM(f.status = 'RETURNED') DESC, COUNT(*) DESC) AS finder_rank
           FROM found_items f JOIN users u ON u.user_id = f.finder_id
           GROUP BY u.user_id, u.full_name
           ORDER BY finder_rank, u.full_name LIMIT 8`),
    query(`SELECT CASE
                    WHEN total_score >= 0.75 THEN '0.75 - 1.00'
                    WHEN total_score >= 0.55 THEN '0.55 - 0.75'
                    WHEN total_score >= 0.45 THEN '0.45 - 0.55'
                    ELSE '0.35 - 0.45' END AS bucket,
                  COUNT(*) AS pairs,
                  SUM(match_status = 'CONFIRMED') AS confirmed,
                  SUM(match_status <> 'CONFIRMED') AS unconfirmed
           FROM potential_matches GROUP BY bucket ORDER BY bucket DESC`),
    query(`SELECT claim_status, COUNT(*) AS claims FROM claims GROUP BY claim_status ORDER BY claims DESC`),
    query(`SELECT CASE
                    WHEN days_since_found <= 7  THEN '0-7 days'
                    WHEN days_since_found <= 30 THEN '8-30 days'
                    WHEN days_since_found <= 60 THEN '31-60 days'
                    ELSE 'over 60 days' END AS age_bucket,
                  COUNT(*) AS items
           FROM vw_found_items_public WHERE status IN ('AVAILABLE', 'CLAIM_PENDING')
           GROUP BY age_bucket ORDER BY MIN(days_since_found)`),
  ]);
  return { kpis, categories, hotspots, monthly, finders, scoreBuckets, claimOutcomes, ageing };
}

// ---------------------------------------------------------------- notifications
export async function getNotifications(userId, limit = 50) {
  return query(`SELECT notification_id, notif_type, message, link, is_read, created_at
                FROM notifications WHERE user_id = ? ORDER BY created_at DESC, notification_id DESC LIMIT ?`,
  [userId, limit]);
}

export async function getUnreadCount(userId) {
  const row = await queryOne('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND NOT is_read', [userId]);
  return row?.n ?? 0;
}

// ---------------------------------------------------------------- admin
export async function listUsers() {
  return query(`SELECT u.user_id, u.full_name, u.email, u.phone, u.is_active, u.created_at, u.last_login_at,
                       r.role_name, sp.srn, d.dept_code, st.designation,
                       (SELECT COUNT(*) FROM lost_items  l WHERE l.owner_id  = u.user_id) AS lost_reports,
                       (SELECT COUNT(*) FROM found_items f WHERE f.finder_id = u.user_id) AS found_reports
                FROM users u
                JOIN roles r                  ON r.role_id = u.role_id
                LEFT JOIN student_profiles sp ON sp.user_id = u.user_id
                LEFT JOIN departments d       ON d.dept_id = sp.dept_id
                LEFT JOIN staff_profiles st   ON st.user_id = u.user_id
                ORDER BY r.role_id DESC, u.full_name`);
}

export async function getRbacMatrix() {
  const [roles, permissions, grants] = await Promise.all([
    query('SELECT role_id, role_name, description FROM roles ORDER BY role_id'),
    query('SELECT permission_id, permission_code, description FROM permissions ORDER BY permission_id'),
    query('SELECT role_id, permission_id FROM role_permissions'),
  ]);
  return { roles, permissions, grants: grants.map((g) => `${g.role_id}:${g.permission_id}`) };
}

export async function getAuditLog({ table, limit = 150 }) {
  const params = [];
  let where = '';
  if (table) { where = 'WHERE a.table_name = ?'; params.push(table); }
  params.push(limit);
  return query(`SELECT a.*, u.full_name AS changed_by_name
                FROM audit_log a LEFT JOIN users u ON u.user_id = a.changed_by
                ${where} ORDER BY a.log_id DESC LIMIT ?`, params);
}
