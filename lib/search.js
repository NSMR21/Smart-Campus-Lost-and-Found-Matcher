// Natural-language search over reports using the vector database,
// with fresh details joined from MySQL.
import { query } from './db.js';
import { embedText } from './embeddings.js';
import { vectorSearch } from './vectorStore.js';
import { listLost, listFound } from './data.js';

const VIEWS = { found: 'vw_found_items_public', lost: 'vw_lost_items_detail' };
const OPEN = { found: ['AVAILABLE', 'CLAIM_PENDING'], lost: ['OPEN', 'MATCHED'] };

export async function semanticSearch(text, kind = 'found', limit = 12) {
  const { model, vector } = await embedText(text);
  const hits = await vectorSearch(vector, { kind, statuses: OPEN[kind], model, limit });
  if (!hits.length) return { model, results: [] };

  const idCol = `${kind}_id`;
  const rows = await query(`SELECT * FROM ${VIEWS[kind]} WHERE ${idCol} IN (?)`, [hits.map((h) => h.item_id)]);
  const byId = new Map(rows.map((r) => [r[idCol], r]));
  const results = hits.filter((h) => byId.has(h.item_id))
    .map((h) => ({ ...byId.get(h.item_id), similarity: h.similarity }));
  return { model, results };
}

/** The same question answered by the MySQL FULLTEXT index, for comparison. */
export async function keywordSearch(text, kind, session) {
  return kind === 'found' ? listFound({ q: text }, session) : listLost({ q: text }, session);
}
