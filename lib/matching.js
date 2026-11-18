// Hybrid matching engine
//   rule score      -> MySQL stored function fn_rule_match_score (category, location, date, colour, brand)
//   semantic score  -> cosine similarity of description embeddings from the vector database
//   total score     -> generated column in potential_matches: 0.6 * rule + 0.4 * semantic
import { getPool, callProcedure, query } from './db.js';
import { similarity } from './embeddings.js';
import { getVectors, vectorSearch, vectorId } from './vectorStore.js';
import { syncItem } from './itemSync.js';

export const MIN_TOTAL_SCORE = 0.35;      // pairs below this are not stored
const NEIGHBOURS = 15;
const OPEN_FOUND = ['AVAILABLE', 'CLAIM_PENDING'];
const OPEN_LOST = ['OPEN', 'MATCHED'];

function shiftDate(isoDate, days) {
  const d = new Date(`${String(isoDate).slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function vectorFor(kind, itemId) {
  const id = vectorId(kind, itemId);
  const stored = (await getVectors([id]))[id];
  if (stored) return stored;
  const doc = await syncItem(kind, itemId);
  return doc ? { model: doc.model, vector: doc.vector } : null;
}

/**
 * Finds and stores matches for one report.
 * kind = 'lost'  -> compare against open found items
 * kind = 'found' -> compare against open lost reports
 */
export async function runMatching(kind, itemId) {
  const other = kind === 'lost' ? 'found' : 'lost';
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [item] = await query(kind === 'lost'
      ? 'SELECT lost_id AS id, owner_id AS user_id, lost_date AS d, status FROM lost_items WHERE lost_id = ?'
      : 'SELECT found_id AS id, finder_id AS user_id, found_date AS d, status FROM found_items WHERE found_id = ?', [itemId]);
    if (!item) return { stored: 0, candidates: 0 };

    // 1. rule-based candidates from SQL
    const ruleRows = await callProcedure(conn,
      kind === 'lost' ? 'sp_match_candidates_for_lost' : 'sp_match_candidates_for_found', [itemId, 30]);
    const ruleIds = ruleRows.map((r) => (kind === 'lost' ? r.found_id : r.lost_id));

    // 2. semantic neighbours from the vector database (metadata-filtered ANN search)
    const semantic = new Map();
    let source = null;
    try {
      source = await vectorFor(kind, itemId);
    } catch (err) {
      console.warn(`[matching] vector database unavailable, using SQL rule score only: ${err.message}`);
    }
    if (source) {
      const neighbours = await vectorSearch(source.vector, {
        kind: other,
        statuses: kind === 'lost' ? OPEN_FOUND : OPEN_LOST,
        model: source.model,
        excludeUserId: item.user_id,
        // a found item cannot predate the loss (1 day tolerance), and vice versa
        ...(kind === 'lost' ? { minDate: shiftDate(item.d, -1) } : { maxDate: shiftDate(item.d, 1) }),
        limit: NEIGHBOURS,
      });
      for (const n of neighbours) semantic.set(n.item_id, n.similarity);

      // rule candidates that were not among the nearest neighbours: compare vectors directly
      const missing = ruleIds.filter((id) => !semantic.has(id));
      const vectors = await getVectors(missing.map((id) => vectorId(other, id)));
      for (const id of missing) {
        const v = vectors[vectorId(other, id)];
        semantic.set(id, v && v.model === source.model ? similarity(source.vector, v.vector) : 0);
      }
    }

    // 3. store every candidate pair; MySQL computes the rule score and the total
    const candidates = new Set([...ruleIds, ...semantic.keys()]);
    for (const otherId of candidates) {
      const [lostId, foundId] = kind === 'lost' ? [itemId, otherId] : [otherId, itemId];
      await conn.query('CALL sp_upsert_match(?, ?, ?, ?)',
        [lostId, foundId, (semantic.get(otherId) ?? 0).toFixed(4), MIN_TOTAL_SCORE]);
    }
    const [{ suggestions }] = await query(
      `SELECT COUNT(*) AS suggestions FROM potential_matches WHERE ${kind}_id = ? AND match_status <> 'DISMISSED'`,
      [itemId]);
    return { stored: suggestions, candidates: candidates.size };
  } finally {
    conn.release();
  }
}

/**
 * After a report is created or edited: (re-)embed it in the vector database and
 * run matching. MySQL already holds the report, so a vector failure is not fatal.
 */
export async function indexAndMatch(kind, itemId) {
  try {
    await syncItem(kind, itemId);
  } catch (err) {
    console.warn(`[vector] could not index ${kind}-${itemId}: ${err.message}`);
  }
  const { stored } = await runMatching(kind, itemId);
  return { matches: stored };
}

/** Recompute semantic scores of all stored pairs and match every open lost report. */
export async function runMatchingForAll({ log = () => {} } = {}) {
  const pairs = await query('SELECT lost_id, found_id FROM potential_matches');
  const ids = [...new Set(pairs.flatMap((p) => [vectorId('lost', p.lost_id), vectorId('found', p.found_id)]))];
  const vectors = await getVectors(ids);
  for (const p of pairs) {
    const a = vectors[vectorId('lost', p.lost_id)];
    const b = vectors[vectorId('found', p.found_id)];
    const sem = a && b && a.model === b.model ? similarity(a.vector, b.vector) : 0;
    await query('CALL sp_upsert_match(?, ?, ?, ?)', [p.lost_id, p.found_id, sem.toFixed(4), MIN_TOTAL_SCORE]);
  }
  log(`Re-scored ${pairs.length} existing pairs.`);

  const open = await query(`SELECT lost_id FROM lost_items WHERE status IN ('OPEN', 'MATCHED')`);
  let stored = 0;
  for (const { lost_id } of open) stored += (await runMatching('lost', lost_id)).stored;
  log(`Matched ${open.length} open lost reports (${stored} suggestions stored).`);
  return { rescored: pairs.length, openLost: open.length };
}
