// Automated database tests: constraints, triggers, functions, procedures, views and RBAC.
//   npm run db:test
// Non-destructive: DML tests run inside a transaction that is rolled back, and the
// procedure tests exercise their guard paths (which roll themselves back).
import fs from 'node:fs';
if (fs.existsSync('.env.local')) process.loadEnvFile('.env.local');
const { getPool } = await import('../lib/db.js');

const pool = getPool();
const conn = await pool.getConnection();
let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await conn.query('START TRANSACTION');
    await fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (err) {
    console.log(`  FAIL  ${name}\n        ${err.message}`);
    failed++;
  } finally {
    await conn.query('ROLLBACK');
    await conn.query('SET @app_user_id = NULL');
  }
}

async function one(sql, params = []) {
  const [rows] = await conn.query(sql, params);
  return rows[0];
}

/** Expects the statement to fail with an error whose code or message contains `expected`. */
async function rejects(sql, params, expected) {
  try {
    await conn.query(sql, params);
  } catch (err) {
    const text = `${err.code} ${err.sqlMessage}`;
    if (text.includes(expected)) return;
    throw new Error(`expected "${expected}" but got: ${text}`);
  }
  throw new Error(`expected the statement to fail with "${expected}"`);
}

function equal(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, got ${actual}`);
}

console.log('\nConstraints');
await test('CHECK rejects an invalid email', () =>
  rejects("INSERT INTO users (full_name, email, password_hash) VALUES ('X Y', 'bad-email', REPEAT('x', 60))", [], 'chk_users_email'));
await test('CHECK rejects an invalid SRN', () =>
  rejects("INSERT INTO student_profiles (user_id, srn, dept_id, year_of_study) VALUES (2, 'ABC123', 1, 2)", [], 'chk_student_srn'));
await test('CHECK rejects year_of_study = 5', () =>
  rejects("INSERT INTO student_profiles (user_id, srn, dept_id, year_of_study) VALUES (2, 'PES1UG24CS999', 1, 5)", [], 'chk_student_year'));
await test('CHECK rejects an unknown colour', () =>
  rejects(`INSERT INTO lost_items (owner_id, category_id, location_id, title, description, color, lost_date)
           VALUES (4, 2, 1, 'Phone', 'A phone with a long description', 'rainbow', CURDATE())`, [], 'chk_lost_color'));
await test('UNIQUE rejects a duplicate email', () =>
  rejects("INSERT INTO users (full_name, email, password_hash) VALUES ('Copy', 'admin@pes.edu', REPEAT('x', 60))", [], 'ER_DUP_ENTRY'));
await test('UNIQUE allows only one claim per student per item', () =>
  rejects("INSERT INTO claims (found_id, claimant_id, proof_details) VALUES (6, 5, 'second claim for the same wallet')", [], 'ER_DUP_ENTRY'));
await test('FOREIGN KEY rejects an unknown category', () =>
  rejects(`INSERT INTO lost_items (owner_id, category_id, location_id, title, description, lost_date)
           VALUES (4, 999, 1, 'Thing', 'Something in no category', CURDATE())`, [], 'ER_NO_REFERENCED_ROW'));
await test('FOREIGN KEY (RESTRICT) blocks deleting a category in use', () =>
  rejects('DELETE FROM categories WHERE category_id = 2', [], 'ER_ROW_IS_REFERENCED'));
await test('Generated column total_score = 0.6 rule + 0.4 semantic', async () => {
  await conn.query('UPDATE potential_matches SET rule_score = 0.5, semantic_score = 1 WHERE lost_id = 7 AND found_id = 7');
  equal(Number((await one('SELECT total_score FROM potential_matches WHERE lost_id = 7 AND found_id = 7')).total_score), 0.7, 'total');
});

console.log('\nTriggers');
await test('BEFORE INSERT rejects a future lost date', () =>
  rejects(`INSERT INTO lost_items (owner_id, category_id, location_id, title, description, lost_date)
           VALUES (4, 2, 1, 'Phone', 'Lost next week apparently', CURDATE() + INTERVAL 3 DAY)`, [], 'cannot be in the future'));
await test('BEFORE INSERT requires a collection point for found items', () =>
  rejects(`INSERT INTO found_items (finder_id, category_id, location_id, held_at_id, title, description, found_date)
           VALUES (4, 2, 1, 1, 'Phone', 'Found phone in the lobby', CURDATE())`, [], 'collection point'));
await test('BEFORE INSERT normalises colour and email', async () => {
  await conn.query(`INSERT INTO users (full_name, email, password_hash) VALUES ('Case Test', '  Mixed.Case@PES.edu ', REPEAT('x', 60))`);
  equal((await one('SELECT email FROM users WHERE user_id = LAST_INSERT_ID()')).email, 'mixed.case@pes.edu', 'email');
});
await test('Finder cannot claim their own found item', () =>
  rejects("INSERT INTO claims (found_id, claimant_id, proof_details) VALUES (7, 4, 'this is my own charger')", [], 'reported as found'));
await test('New claim sets the item to CLAIM_PENDING and notifies staff', async () => {
  const before = (await one('SELECT COUNT(*) AS n FROM notifications')).n;
  await conn.query("INSERT INTO claims (found_id, claimant_id, lost_id, proof_details) VALUES (7, 10, 7, 'HP charger with yellow tape')");
  equal((await one('SELECT status FROM found_items WHERE found_id = 7')).status, 'CLAIM_PENDING', 'item status');
  const staff = (await one("SELECT COUNT(*) AS n FROM users u WHERE fn_has_permission(u.user_id, 'CLAIM_VERIFY')")).n;
  equal((await one('SELECT COUNT(*) AS n FROM notifications')).n - before, staff, 'staff notifications');
});
await test('Approving a claim rejects competing claims (trigger cascade)', async () => {
  await conn.query("INSERT INTO verifications (claim_id, verifier_id, decision) VALUES (6, 3, 'APPROVED')");
  equal((await one('SELECT claim_status FROM claims WHERE claim_id = 6')).claim_status, 'APPROVED', 'claim 6');
  equal((await one('SELECT claim_status FROM claims WHERE claim_id = 7')).claim_status, 'REJECTED', 'claim 7');
  equal((await one('SELECT status FROM found_items WHERE found_id = 6')).status, 'CLAIM_APPROVED', 'item');
});
await test('Students cannot record a verification (RBAC inside a trigger)', () =>
  rejects("INSERT INTO verifications (claim_id, verifier_id, decision) VALUES (4, 5, 'APPROVED')", [], 'CLAIM_VERIFY'));
await test('High-value hand-over requires an ID check', () =>
  rejects('INSERT INTO item_returns (claim_id, handled_by, id_proof_checked) VALUES (3, 2, FALSE)', [], 'ID proof'));
await test('Hand-over closes the case (item RETURNED, report RECOVERED)', async () => {
  await conn.query('INSERT INTO item_returns (claim_id, handled_by, id_proof_checked) VALUES (3, 2, TRUE)');
  equal((await one('SELECT status FROM found_items WHERE found_id = 3')).status, 'RETURNED', 'item');
  equal((await one('SELECT status FROM lost_items WHERE lost_id = 3')).status, 'RECOVERED', 'report');
});
await test('Returned items cannot change status again', async () =>
  rejects("UPDATE found_items SET status = 'AVAILABLE' WHERE found_id = 1", [], 'cannot change status'));
await test('Audit trigger records the acting user from @app_user_id', async () => {
  await conn.query('SET @app_user_id = 1');
  await conn.query("UPDATE lost_items SET status = 'CLOSED' WHERE lost_id = 16");
  const row = await one("SELECT old_value, new_value, changed_by FROM audit_log WHERE table_name = 'lost_items' ORDER BY log_id DESC LIMIT 1");
  equal(`${row.old_value}>${row.new_value}@${row.changed_by}`, 'OPEN>CLOSED@1', 'audit row');
});

console.log('\nFunctions and views');
await test('fn_has_permission follows role_permissions', async () => {
  const r = await one("SELECT fn_has_permission(4, 'CLAIM_VERIFY') AS student, fn_has_permission(3, 'CLAIM_VERIFY') AS staff");
  equal(`${r.student}/${r.staff}`, '0/1', 'student/staff');
});
await test('fn_has_permission is false for deactivated users', async () => {
  await conn.query('UPDATE users SET is_active = FALSE WHERE user_id = 3');
  equal((await one("SELECT fn_has_permission(3, 'CLAIM_VERIFY') AS ok")).ok, 0, 'inactive staff');
});
await test('fn_category_root walks up the hierarchy', async () =>
  equal((await one('SELECT fn_category_root(5) AS root')).root, 1, 'root of Wireless Earbuds'));
await test('fn_rule_match_score = 1 for identical attributes, 0 when found before lost', async () => {
  const r = await one('SELECT fn_rule_match_score(7, 7) AS same, fn_rule_match_score(1, 19) AS impossible');
  equal(`${Number(r.same)}/${Number(r.impossible)}`, '1/0', 'scores');
});
await test('vw_found_items_public hides hidden_marks', async () => {
  const [, fields] = await conn.query('SELECT * FROM vw_found_items_public LIMIT 1');
  if (fields.some((f) => f.name === 'hidden_marks')) throw new Error('hidden_marks is exposed');
});
await test('vw_category_tree builds 3 levels with full paths', async () => {
  const r = await one("SELECT depth, full_path FROM vw_category_tree WHERE category_name = 'Wireless Earbuds'");
  equal(`${r.depth}|${r.full_path}`, '2|Electronics > Earphones & Headphones > Wireless Earbuds', 'path');
});

console.log('\nStored procedures (guard paths)');
await test('sp_verify_claim refuses a student', () =>
  rejects("CALL sp_verify_claim(4, 5, 'APPROVED', NULL)", [], 'Permission denied'));
await test('sp_verify_claim refuses an already decided claim', () =>
  rejects("CALL sp_verify_claim(1, 3, 'REJECTED', NULL)", [], 'already been decided'));
await test('sp_record_return refuses a pending claim', () =>
  rejects('CALL sp_record_return(4, 3, TRUE, NULL, @r)', [], 'approved claim'));
await test('sp_submit_claim refuses a returned item', () =>
  rejects("CALL sp_submit_claim(1, 10, NULL, 'this phone is mine for sure', @c)", [], 'no longer open'));
await test('sp_change_user_role keeps the last admin', () =>
  rejects("CALL sp_change_user_role(1, 1, 'STAFF')", [], 'last active administrator'));
await test('sp_dispose_unclaimed enforces the 30 day minimum', () =>
  rejects('CALL sp_dispose_unclaimed(1, 10, @n)', [], 'at least 30 days'));

console.log(`\n${passed} passed, ${failed} failed`);
conn.release();
await pool.end();
process.exit(failed ? 1 : 0);
