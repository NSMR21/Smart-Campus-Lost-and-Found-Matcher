// SQL Lab: shows and runs the annotated query blocks from db/queries/*.sql.
//   mode: read      -> run as is (only SELECT / WITH / EXPLAIN / SHOW allowed)
//   mode: rollback  -> run inside START TRANSACTION ... ROLLBACK, so DML and
//                      trigger demos never change the real data
//   mode: script    -> display only (contains CALLs / COMMIT; run in Workbench)
import fs from 'node:fs/promises';
import path from 'node:path';
import { getPool } from './db.js';
import { splitSqlStatements } from './sqlSplit.js';

const QUERY_DIR = path.join(process.cwd(), 'db', 'queries');
const HEADER = /^--\s*\[([A-Z0-9-]+)\]\s*(.+)$/;
const META = /^--\s*(concept|mode):\s*(.+)$/;
const READ_OK = /^(SELECT|WITH|EXPLAIN|SHOW|DESCRIBE|DESC)\b/i;
const ROLLBACK_OK = /^(SELECT|WITH|EXPLAIN|INSERT|UPDATE|DELETE|SET\s+@|SAVEPOINT|ROLLBACK\s+TO)\b/i;
const MAX_ROWS = 200;

function parseFile(file, text) {
  const lines = text.split(/\r?\n/);
  const title = lines.map((l) => l.replace(/^--\s*/, '').trim()).find((l) => l && !/^=+$/.test(l)) ?? file;
  const blocks = [];
  let current = null;
  for (const line of lines) {
    const header = HEADER.exec(line);
    if (header) {
      current = { id: header[1], title: header[2].trim(), concept: '', mode: 'script', lines: [] };
      blocks.push(current);
      continue;
    }
    if (!current) continue;
    const meta = META.exec(line);
    if (meta && current.lines.length === 0) {
      current[meta[1]] = meta[2].trim();
      continue;
    }
    current.lines.push(line);
  }
  return {
    file,
    title,
    blocks: blocks.map(({ lines: body, ...b }) => ({ ...b, sql: body.join('\n').replace(/\s*(--\s*=+\s*)?$/, '').trim() })),
  };
}

export async function loadQueryFiles() {
  const files = (await fs.readdir(QUERY_DIR)).filter((f) => f.endsWith('.sql')).sort();
  return Promise.all(files.map(async (file) => parseFile(file, await fs.readFile(path.join(QUERY_DIR, file), 'utf8'))));
}

function cell(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'bigint') return Number(value);
  if (Buffer.isBuffer(value)) return value.toString('utf8');
  if (value instanceof Date) return value.toISOString();
  return value;
}

export async function runBlock(id) {
  const block = (await loadQueryFiles()).flatMap((f) => f.blocks).find((b) => b.id === id);
  if (!block) return { error: `Unknown query ${id}` };
  if (block.mode === 'script') return { error: 'This block is a script (CALL / COMMIT): run it in MySQL Workbench.' };

  const statements = splitSqlStatements(block.sql);
  const allowed = block.mode === 'read' ? READ_OK : ROLLBACK_OK;
  const bad = statements.find((s) => !allowed.test(s));
  if (bad) return { error: `Statement not allowed in ${block.mode} mode: ${bad.slice(0, 60)}...` };

  const conn = await getPool().getConnection();
  const results = [];
  try {
    if (block.mode === 'rollback') await conn.query('START TRANSACTION');
    for (const sql of statements) {
      const started = performance.now();
      try {
        const [res, fields] = await conn.query(sql);
        const ms = Math.round((performance.now() - started) * 10) / 10;
        if (Array.isArray(res)) {
          const columns = fields?.map((f) => f.name) ?? Object.keys(res[0] ?? {});
          results.push({ sql, columns, rows: res.slice(0, MAX_ROWS).map((r) => columns.map((c) => cell(r[c]))), rowCount: res.length, ms });
        } else {
          results.push({ sql, affectedRows: res.affectedRows, insertId: res.insertId || null, ms });
        }
      } catch (err) {
        results.push({ sql, error: `${err.code ?? 'ERROR'} (${err.errno ?? '-'}): ${err.sqlMessage ?? err.message}` });
        break;
      }
    }
  } finally {
    if (block.mode === 'rollback') await conn.query('ROLLBACK').catch(() => {});
    await conn.query('SET @app_user_id = NULL').catch(() => {});
    conn.release();
  }
  return { id: block.id, mode: block.mode, rolledBack: block.mode === 'rollback', results };
}
