import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { handler, json, readJson, HttpError } from '@/lib/api';
import { getPool, callWithOut } from '@/lib/db';
import { createSessionToken, sessionCookieOptions, SESSION_COOKIE } from '@/lib/session';
import { text, id } from '@/lib/validate';

// POST /api/auth/register  - student self-registration (transaction in sp_register_student)
export const POST = handler(async (request) => {
  const body = await readJson(request);
  const fullName = text(body.full_name, 'Full name', { min: 2, max: 80 });
  const email = text(body.email, 'Email', { max: 120 }).toLowerCase();
  const phone = text(body.phone, 'Phone', { optional: true, max: 10 });
  const srn = text(body.srn, 'SRN', { min: 13, max: 13 }).toUpperCase();
  const deptId = id(body.dept_id, 'Department');
  const year = Number(body.year_of_study);
  const password = text(body.password, 'Password', { min: 8, max: 72 });
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new HttpError(400, 'Password must contain letters and numbers.');
  }

  const hash = await bcrypt.hash(password, 10);
  const conn = await getPool().getConnection();
  let userId;
  try {
    userId = await callWithOut(conn, 'sp_register_student', [fullName, email, phone, hash, srn, deptId, year]);
  } finally {
    conn.release();
  }

  const token = await createSessionToken({ user_id: userId, full_name: fullName, role_name: 'STUDENT' });
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions());
  return json({ ok: true, user_id: userId }, 201);
});
