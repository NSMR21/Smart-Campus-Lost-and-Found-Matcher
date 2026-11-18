// Stand-alone walk-through of the vector database operations (for the viva).
// Uses a separate table "demo_items" so the application's data is not touched.
//   npm run vector:demo
import fs from 'node:fs';
import path from 'node:path';
if (fs.existsSync('.env.local')) process.loadEnvFile('.env.local');

const lancedb = await import('@lancedb/lancedb');
const { Schema, Field, Utf8, Int32, Float32, FixedSizeList } = await import('apache-arrow');
const { embedTexts, EMBEDDING_DIM } = await import('../lib/embeddings.js');

const dir = path.resolve(process.env.LANCEDB_DIR ?? './data/lancedb');
const db = await lancedb.connect(dir);
const show = (title, rows) => {
  console.log(`\n== ${title}`);
  console.table(rows.map(({ vector, ...rest }) => rest));
};

// ---------------------------------------------------------------- CREATE (database, table, index)
const schema = new Schema([
  new Field('id', new Int32(), false),
  new Field('kind', new Utf8(), false),
  new Field('text', new Utf8(), false),
  new Field('status', new Utf8(), false),
  new Field('vector', new FixedSizeList(EMBEDDING_DIM, new Field('item', new Float32(), true)), false),
]);
if ((await db.tableNames()).includes('demo_items')) await db.dropTable('demo_items');
const table = await db.createEmptyTable('demo_items', schema);
console.log(`Created table demo_items in ${dir} (vector column: ${EMBEDDING_DIM} x float32)`);

const texts = [
  ['found', 'Black OnePlus phone with a cracked screen guard found in the library'],
  ['found', 'Blue steel water bottle with Avengers stickers on the basketball court'],
  ['found', 'Casio scientific calculator left in the exam hall'],
  ['found', 'Grey Nike hoodie found in the auditorium green room'],
  ['lost', 'Lost my mobile, black colour, screen protector is broken'],
];
const { model, vectors } = await embedTexts(texts.map(([, t]) => t));
await table.add(texts.map(([kind, text], i) => ({ id: i + 1, kind, text, status: 'OPEN', vector: vectors[i] })));
await table.createIndex('kind', { config: lancedb.Index.bitmap() });
console.log(`Inserted ${texts.length} documents embedded with ${model}; created a bitmap index on "kind"`);

// ---------------------------------------------------------------- READ (similarity search + filter)
const query = 'lost my mobile, black colour, screen protector is broken';
const [qv] = (await embedTexts([query])).vectors;
const hits = await table.vectorSearch(qv).distanceType('cosine').where("kind = 'found'").limit(3).toArray();
show(`READ: nearest found items to "${query}"`,
  hits.map((h) => ({ id: h.id, text: h.text, similarity: (1 - h._distance).toFixed(3) })));

// ---------------------------------------------------------------- UPDATE (metadata and vector)
await table.update({ where: 'id = 1', values: { status: 'RETURNED' } });
const [newVector] = (await embedTexts(['Grey Nike hoodie size L with a pen in the pocket'])).vectors;
await table.update({ where: 'id = 4', values: { text: 'Grey Nike hoodie size L with a pen in the pocket', vector: newVector } });
show('UPDATE: status of id 1 and text + vector of id 4 changed',
  await table.query().where('id IN (1, 4)').select(['id', 'text', 'status']).toArray());

// ---------------------------------------------------------------- DELETE
await table.delete("status = 'RETURNED'");
console.log(`\n== DELETE: removed returned items, ${await table.countRows()} rows left (table version ${await table.version()})`);

await db.dropTable('demo_items');
console.log('Dropped demo_items. Done.');
