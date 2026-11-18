// Keeps the vector database in step with MySQL (MySQL is the source of truth).
import { query } from './db.js';
import { embedTexts, itemText } from './embeddings.js';
import { upsertDocuments, updateDocument, deleteDocument, recreateTable, ensureIndexes } from './vectorStore.js';

const ITEM_SQL = {
  lost: `SELECT 'lost' AS kind, lost_id AS item_id, owner_id AS user_id, title, description, category_id,
                location_id, status, lost_date AS event_date
         FROM lost_items`,
  found: `SELECT 'found' AS kind, found_id AS item_id, finder_id AS user_id, title, description, category_id,
                 location_id, status, found_date AS event_date
          FROM found_items`,
};

async function embedItems(items) {
  const docs = [];
  for (let i = 0; i < items.length; i += 32) {
    const batch = items.slice(i, i + 32);
    const { model, vectors } = await embedTexts(batch.map(itemText));
    batch.forEach((item, j) => docs.push({ ...item, content: itemText(item), model, vector: vectors[j] }));
  }
  return docs;
}

/** Re-embed one report after it was created or edited. Returns the stored document. */
export async function syncItem(kind, itemId) {
  const where = kind === 'lost' ? 'lost_id = ?' : 'found_id = ?';
  const items = await query(`${ITEM_SQL[kind]} WHERE ${where}`, [itemId]);
  if (!items.length) return null;
  const [doc] = await embedItems(items);
  await upsertDocuments([doc]);
  return doc;
}

/** Copy a status change from MySQL to the vector document (no re-embedding needed). */
export async function syncStatus(kind, itemId) {
  const where = kind === 'lost' ? 'lost_id = ?' : 'found_id = ?';
  const [row] = await query(`SELECT status FROM ${kind}_items WHERE ${where}`, [itemId]);
  if (row) await updateDocument(kind, itemId, { status: row.status });
}

/** Status of several items may change in one transaction (claims, returns). */
export async function syncStatusesForClaim(claimId) {
  const [row] = await query('SELECT found_id, lost_id FROM claims WHERE claim_id = ?', [claimId]);
  if (!row) return;
  await syncStatus('found', row.found_id);
  const lost = await query(
    `SELECT lost_id FROM lost_items WHERE owner_id = (SELECT claimant_id FROM claims WHERE claim_id = ?)`, [claimId]);
  for (const { lost_id } of lost) await syncStatus('lost', lost_id);
}

export async function removeItem(kind, itemId) {
  await deleteDocument(kind, itemId);
}

/** Full rebuild: drop the table and embed every lost and found report. */
export async function syncAll({ log = () => {} } = {}) {
  const items = [...await query(ITEM_SQL.lost), ...await query(ITEM_SQL.found)];
  log(`Embedding ${items.length} reports...`);
  const docs = await embedItems(items);
  await recreateTable();
  await upsertDocuments(docs);
  const indexes = await ensureIndexes();
  return { documents: docs.length, model: docs[0]?.model ?? null, indexes };
}
