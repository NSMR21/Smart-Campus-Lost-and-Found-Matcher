// Builds the vector database from MySQL and computes semantic match scores.
//   npm run vector:sync
import fs from 'node:fs';
if (fs.existsSync('.env.local')) process.loadEnvFile('.env.local');

const { syncAll } = await import('../lib/itemSync.js');
const { runMatchingForAll } = await import('../lib/matching.js');
const { stats } = await import('../lib/vectorStore.js');
const { getPool } = await import('../lib/db.js');

const started = Date.now();
const log = (msg) => console.log(`  ${msg}`);

console.log('1/3 Embedding lost & found reports into LanceDB');
const result = await syncAll({ log });
log(`${result.documents} documents written with model ${result.model}`);
log(`indexes created: ${result.indexes.join(', ') || 'none (already present)'}`);

console.log('2/3 Hybrid matching (SQL rule score + vector similarity)');
await runMatchingForAll({ log });

console.log('3/3 Vector table summary');
console.log(await stats());
console.log(`Done in ${((Date.now() - started) / 1000).toFixed(1)}s`);
await getPool().end();
