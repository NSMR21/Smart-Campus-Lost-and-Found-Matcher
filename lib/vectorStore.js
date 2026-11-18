// Vector database layer (LanceDB, embedded - stored as files under LANCEDB_DIR).
//
// One table "item_vectors" holds a document per lost / found report:
//   id ("lost-12" / "found-7"), metadata columns used for filtering, and the
//   384-d embedding of the item's text. MySQL stays the source of truth; this
//   store is the semantic index used for matching and natural-language search.
//
// CRUD exposed here:  create table + indexes | upsert | vector search (Read)
//                     | update metadata (Update) | delete (Delete)
import path from 'node:path';
import * as lancedb from '@lancedb/lancedb';
import { Schema, Field, Utf8, Int32, Float32, FixedSizeList } from 'apache-arrow';
import { EMBEDDING_DIM } from './embeddings.js';

export const TABLE_NAME = 'item_vectors';
export const KINDS = ['lost', 'found'];
export const STATUSES = ['OPEN', 'MATCHED', 'RECOVERED', 'CLOSED',
  'AVAILABLE', 'CLAIM_PENDING', 'CLAIM_APPROVED', 'RETURNED', 'DISPOSED'];
const VECTOR_INDEX_MIN_ROWS = 256;   // IVF-PQ needs enough rows to train; below this LanceDB does exact (flat) search

export const ITEM_SCHEMA = new Schema([
  new Field('id', new Utf8(), false),
  new Field('item_id', new Int32(), false),
  new Field('kind', new Utf8(), false),
  new Field('user_id', new Int32(), false),            // owner (lost) or finder (found)
  new Field('title', new Utf8(), false),
  new Field('content', new Utf8(), false),             // the text that was embedded
  new Field('category_id', new Int32(), false),
  new Field('location_id', new Int32(), false),
  new Field('status', new Utf8(), false),
  new Field('event_date', new Utf8(), false),          // lost_date / found_date as YYYY-MM-DD
  new Field('model', new Utf8(), false),               // embedding model that produced the vector
  new Field('updated_at', new Utf8(), false),
  new Field('vector', new FixedSizeList(EMBEDDING_DIM, new Field('item', new Float32(), true)), false),
]);

const METADATA_COLUMNS = ITEM_SCHEMA.fields.map((f) => f.name).filter((n) => n !== 'vector');

const cache = globalThis.__lfVector ?? (globalThis.__lfVector = { db: null, table: null });

export function vectorId(kind, itemId) {
  if (!KINDS.includes(kind)) throw new Error(`Invalid kind ${kind}`);
  const id = Number(itemId);
  if (!Number.isInteger(id) || id <= 0) throw new Error(`Invalid item id ${itemId}`);
  return `${kind}-${id}`;
}

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function connect() {
  const dir = path.resolve(process.cwd(), process.env.LANCEDB_DIR ?? './data/lancedb');
  cache.db ??= await lancedb.connect(dir);
  return cache.db;
}

/** Opens the table, creating it (empty, with the schema above) on first use. */
export async function getTable() {
  if (cache.table) return cache.table;
  const db = await connect();
  const names = await db.tableNames();
  cache.table = names.includes(TABLE_NAME)
    ? await db.openTable(TABLE_NAME)
    : await db.createEmptyTable(TABLE_NAME, ITEM_SCHEMA, { mode: 'create' });
  return cache.table;
}

/** Drops and recreates the table (used by a full re-sync). */
export async function recreateTable() {
  const db = await connect();
  if ((await db.tableNames()).includes(TABLE_NAME)) await db.dropTable(TABLE_NAME);
  cache.table = await db.createEmptyTable(TABLE_NAME, ITEM_SCHEMA, { mode: 'create' });
  return cache.table;
}

/** Scalar indexes for the filter columns + an ANN vector index once there is enough data. */
export async function ensureIndexes() {
  const table = await getTable();
  const existing = new Set((await table.listIndices()).flatMap((ix) => ix.columns));
  const created = [];
  const scalar = { id: lancedb.Index.btree(), kind: lancedb.Index.bitmap(), status: lancedb.Index.bitmap(),
    category_id: lancedb.Index.btree() };
  for (const [column, config] of Object.entries(scalar)) {
    if (!existing.has(column)) {
      await table.createIndex(column, { config });
      created.push(column);
    }
  }
  const rows = await table.countRows();
  if (!existing.has('vector') && rows >= VECTOR_INDEX_MIN_ROWS) {
    await table.createIndex('vector', {
      config: lancedb.Index.ivfPq({ distanceType: 'cosine', numPartitions: Math.max(2, Math.floor(Math.sqrt(rows))) }),
    });
    created.push('vector');
  }
  return created;
}

function toRow(doc) {
  return {
    id: vectorId(doc.kind, doc.item_id),
    item_id: Number(doc.item_id),
    kind: doc.kind,
    user_id: Number(doc.user_id),
    title: doc.title,
    content: doc.content,
    category_id: Number(doc.category_id),
    location_id: Number(doc.location_id),
    status: doc.status,
    event_date: String(doc.event_date).slice(0, 10),
    model: doc.model,
    updated_at: new Date().toISOString(),
    vector: Array.from(doc.vector),
  };
}

/** Create or replace documents (merge-insert on id). */
export async function upsertDocuments(docs) {
  if (!docs.length) return 0;
  const table = await getTable();
  await table.mergeInsert('id').whenMatchedUpdateAll().whenNotMatchedInsertAll().execute(docs.map(toRow));
  return docs.length;
}

/**
 * READ: nearest neighbours of a vector with metadata pre-filtering.
 * Returns documents with similarity = 1 - cosine distance.
 */
export async function vectorSearch(vector, { kind, statuses, model, minDate, maxDate, excludeUserId, limit = 10 } = {}) {
  const table = await getTable();
  const filters = [];
  if (kind) filters.push(`kind = ${sqlString(kind)}`);
  if (statuses?.length) filters.push(`status IN (${statuses.filter((s) => STATUSES.includes(s)).map(sqlString).join(', ')})`);
  if (model) filters.push(`model = ${sqlString(model)}`);
  if (minDate) filters.push(`event_date >= ${sqlString(minDate)}`);
  if (maxDate) filters.push(`event_date <= ${sqlString(maxDate)}`);
  if (excludeUserId) filters.push(`user_id <> ${Number(excludeUserId)}`);

  let query = table.vectorSearch(Array.from(vector)).distanceType('cosine').limit(limit)
    .select([...METADATA_COLUMNS, '_distance']);
  if (filters.length) query = query.where(filters.join(' AND '));
  const rows = await query.toArray();
  return rows.map((r) => ({ ...plain(r), similarity: Math.max(0, Math.min(1, 1 - r._distance)) }));
}

/** READ: stored vectors for the given ids, as { id: number[] }. */
export async function getVectors(ids) {
  if (!ids.length) return {};
  const table = await getTable();
  const rows = await table.query().where(`id IN (${ids.map(sqlString).join(', ')})`)
    .select(['id', 'model', 'vector']).toArray();
  return Object.fromEntries(rows.map((r) => [r.id, { model: r.model, vector: Array.from(r.vector) }]));
}

/** READ: browse documents (metadata only). */
export async function listDocuments({ kind, status, limit = 50 } = {}) {
  const table = await getTable();
  const filters = [];
  if (kind && KINDS.includes(kind)) filters.push(`kind = ${sqlString(kind)}`);
  if (status && STATUSES.includes(status)) filters.push(`status = ${sqlString(status)}`);
  let query = table.query().select(METADATA_COLUMNS).limit(limit);
  if (filters.length) query = query.where(filters.join(' AND '));
  const rows = (await query.toArray()).map(plain);
  return rows.sort((a, b) => b.event_date.localeCompare(a.event_date));
}

/** UPDATE: change metadata (e.g. status after a claim / return) without re-embedding. */
export async function updateDocument(kind, itemId, values) {
  const table = await getTable();
  const allowed = {};
  if (values.status !== undefined) {
    if (!STATUSES.includes(values.status)) throw new Error('Invalid status');
    allowed.status = values.status;
  }
  if (values.title !== undefined) allowed.title = String(values.title).slice(0, 100);
  allowed.updated_at = new Date().toISOString();
  const result = await table.update({ where: `id = ${sqlString(vectorId(kind, itemId))}`, values: allowed });
  return result?.rowsUpdated ?? null;
}

/** DELETE: remove a document. */
export async function deleteDocument(kind, itemId) {
  const table = await getTable();
  await table.delete(`id = ${sqlString(vectorId(kind, itemId))}`);
}

export async function stats() {
  const table = await getTable();
  const [total, lost, found, indices, version] = await Promise.all([
    table.countRows(),
    table.countRows("kind = 'lost'"),
    table.countRows("kind = 'found'"),
    table.listIndices(),
    table.version(),
  ]);
  const models = await table.query().select(['model']).toArray();
  const byModel = {};
  for (const { model } of models) byModel[model] = (byModel[model] ?? 0) + 1;
  return {
    table: TABLE_NAME,
    location: process.env.LANCEDB_DIR ?? './data/lancedb',
    dimension: EMBEDDING_DIM,
    total, lost, found, byModel, version,
    indices: indices.map((ix) => ({ name: ix.name, type: ix.indexType, columns: ix.columns })),
    vectorIndexNote: total < VECTOR_INDEX_MIN_ROWS
      ? `Exact (flat) cosine search: an IVF-PQ index is built automatically once the table has ${VECTOR_INDEX_MIN_ROWS}+ rows.`
      : 'IVF-PQ approximate nearest-neighbour index on the vector column.',
  };
}

function plain(row) {
  const out = {};
  for (const key of METADATA_COLUMNS) out[key] = typeof row[key] === 'bigint' ? Number(row[key]) : row[key];
  return out;
}
