// MySQL access layer (mysql2 connection pool). All SQL in the app is
// hand-written and parameterised with ? placeholders - no ORM.
import mysql from 'mysql2/promise';

export function getPool() {
  globalThis.__lfPool ??= mysql.createPool({
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? 'lf_app',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME ?? 'campus_lostfound',
    connectionLimit: 10,
    dateStrings: true,          // DATE / DATETIME come back as strings
    decimalNumbers: true,       // DECIMAL scores come back as numbers
  });
  return globalThis.__lfPool;
}

export async function query(sql, params = []) {
  const [rows] = await getPool().query(sql, params);
  return rows;
}

export async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] ?? null;
}

/**
 * Runs fn(conn) on a dedicated connection where the session variable
 * @app_user_id is the acting user - the audit triggers record it as changed_by.
 */
export async function withUser(userId, fn) {
  const conn = await getPool().getConnection();
  try {
    await conn.query('SET @app_user_id = ?', [userId]);
    return await fn(conn);
  } finally {
    try { await conn.query('SET @app_user_id = NULL'); } catch { /* connection is being discarded */ }
    conn.release();
  }
}

/** CALL a stored procedure and return the rows of its first result set (if any). */
export async function callProcedure(conn, name, args = []) {
  const [result] = await conn.query(`CALL ${name}(${args.map(() => '?').join(', ')})`, args);
  return Array.isArray(result) && Array.isArray(result[0]) ? result[0] : [];
}

/** CALL a stored procedure whose last parameter is an OUT parameter and return its value. */
export async function callWithOut(conn, name, args = []) {
  await conn.query(`CALL ${name}(${args.map(() => '?').join(', ')}, @out_value)`, args);
  const [[row]] = await conn.query('SELECT @out_value AS value');
  return row.value;
}

/** Turns MySQL errors (SIGNAL, constraint violations, ...) into messages for the UI. */
export function dbErrorMessage(err) {
  if (!err?.code) return null;
  if (err.sqlState === '45000') return err.sqlMessage;                 // raised by our SIGNAL statements
  switch (err.code) {
    case 'ER_DUP_ENTRY':
      if (err.sqlMessage.includes('uq_claim_once')) return 'You have already claimed this item.';
      if (err.sqlMessage.includes('uq_users_email')) return 'An account with this email already exists.';
      if (err.sqlMessage.includes('uq_student_srn')) return 'An account with this SRN already exists.';
      return 'This record already exists.';
    case 'ER_CHECK_CONSTRAINT_VIOLATED': {
      const name = /'([^']+)'/.exec(err.sqlMessage)?.[1] ?? '';
      return CHECK_MESSAGES[name] ?? `Invalid value (constraint ${name}).`;
    }
    case 'ER_NO_REFERENCED_ROW':          // short form, returned to accounts without table-level privileges
    case 'ER_NO_REFERENCED_ROW_2':
      return 'A referenced record (category, location, user...) does not exist.';
    case 'ER_ROW_IS_REFERENCED':
    case 'ER_ROW_IS_REFERENCED_2':
      return 'This record is still referenced by other records and cannot be deleted.';
    case 'ER_DATA_TOO_LONG':
      return 'One of the values is too long.';
    default:
      return null;
  }
}

const CHECK_MESSAGES = {
  chk_users_email: 'Please enter a valid email address.',
  chk_users_phone: 'Phone number must be a 10-digit Indian mobile number.',
  chk_users_name: 'Name is too short.',
  chk_student_srn: 'SRN must look like PES1UG24AM170.',
  chk_student_year: 'Year of study must be between 1 and 4.',
  chk_lost_title: 'Title must have at least 3 characters.',
  chk_found_title: 'Title must have at least 3 characters.',
  chk_lost_desc: 'Description must have at least 10 characters.',
  chk_found_desc: 'Description must have at least 10 characters.',
  chk_claim_proof: 'Please describe the item in more detail (at least 15 characters).',
};
