// Creates the campus_lostfound database from the files in db/ (in order),
// loads the sample data and creates the MySQL roles and the app account.
//
//   npm run db:setup                 -> asks for the MySQL root password
//   MYSQL_ADMIN_PASSWORD=... npm run db:setup   (non-interactive)
//
// The root password is only used for this one connection and is never stored.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { splitSqlStatements } from '../lib/sqlSplit.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dbDir = path.join(root, 'db');
const envLocal = path.join(root, '.env.local');

const SQL_FILES = [
  '01_schema.sql',
  '02_functions.sql',
  '03_procedures.sql',
  '04_triggers.sql',
  '05_views.sql',
  '06_seed.sql',
  '07_security.sql',
];

function ensureEnvLocal() {
  if (fs.existsSync(envLocal)) return;
  const example = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
  const secret = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(envLocal, example.replace(/^AUTH_SECRET=.*$/m, `AUTH_SECRET=${secret}`));
  console.log('Created .env.local from .env.example (with a random AUTH_SECRET).');
}

function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      rl._writeToOutput = (text) => {
        if (text.includes(question)) rl.output.write(text);
        else if (text === '\r\n' || text === '\n') rl.output.write(text);
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write('\n');
      resolve(answer);
    });
  });
}

async function main() {
  ensureEnvLocal();
  process.loadEnvFile(envLocal);

  const host = process.env.DB_HOST || '127.0.0.1';
  const port = Number(process.env.MYSQL_ADMIN_PORT || process.env.DB_PORT || 3306);
  const user = process.env.MYSQL_ADMIN_USER || 'root';
  let password = process.env.MYSQL_ADMIN_PASSWORD;
  if (password === undefined) {
    password = await ask(`MySQL password for ${user}@${host}:${port}: `, { hidden: true });
  }

  const conn = await mysql.createConnection({ host, port, user, password, dateStrings: true });
  console.log(`Connected to MySQL ${host}:${port} as ${user}.`);

  const appPassword = process.env.DB_PASSWORD || 'LfApp@2026';
  for (const file of SQL_FILES) {
    let sql = fs.readFileSync(path.join(dbDir, file), 'utf8');
    if (file === '07_security.sql') {
      sql = sql.replace("IDENTIFIED BY 'LfApp@2026'", `IDENTIFIED BY ${mysql.escape(appPassword)}`);
    }
    const statements = splitSqlStatements(sql);
    process.stdout.write(`  ${file.padEnd(20)} ${String(statements.length).padStart(3)} statements ... `);
    for (const statement of statements) {
      try {
        await conn.query(statement);
      } catch (err) {
        console.log('FAILED');
        console.error(`\n${err.code ?? ''} ${err.sqlMessage ?? err.message}\nStatement:\n${statement.slice(0, 600)}\n`);
        await conn.end();
        process.exit(1);
      }
    }
    console.log('ok');
  }

  const [[counts]] = await conn.query(`
    SELECT (SELECT COUNT(*) FROM campus_lostfound.users)             AS users,
           (SELECT COUNT(*) FROM campus_lostfound.lost_items)        AS lost_items,
           (SELECT COUNT(*) FROM campus_lostfound.found_items)       AS found_items,
           (SELECT COUNT(*) FROM campus_lostfound.potential_matches) AS matches,
           (SELECT COUNT(*) FROM campus_lostfound.claims)            AS claims,
           (SELECT COUNT(*) FROM campus_lostfound.item_returns)      AS returns_done`);
  console.log('\nDatabase ready:', counts);
  console.log('Next: npm run vector:sync   (builds the vector database and semantic matches)');
  await conn.end();
}

main().catch((err) => {
  console.error(err.sqlMessage ?? err.message);
  process.exit(1);
});
