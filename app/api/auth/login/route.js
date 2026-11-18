import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { handler, json, readJson, HttpError } from '@/lib/api';
import { query, queryOne } from '@/lib/db';
import { createSessionToken, sessionCookieOptions, SESSION_COOKIE } from '@/lib/session';
import { text } from '@/lib/validate';

// POST /api/auth/login  { email, password }
export const POST = handler(async (request) => {
  const body = await readJson(request);
  const email = text(body.email, 'Email', { max: 120 }).toLowerCase();
  const password = text(body.password, 'Password', { max: 100 });

  const user = await queryOne(
    `SELECT u.user_id, u.full_name, u.password_hash, u.is_active, r.role_name
     FROM users u JOIN roles r ON r.role_id = u.role_id
     WHERE u.email = ?`, [email]);

  const valid = user && (await bcrypt.compare(password, user.password_hash));
  if (!valid) throw new HttpError(401, 'Incorrect email or password.');
  if (!user.is_active) throw new HttpError(403, 'This account has been deactivated by an administrator.');

  await query('UPDATE users SET last_login_at = NOW() WHERE user_id = ?', [user.user_id]);
  (await cookies()).set(SESSION_COOKIE, await createSessionToken(user), sessionCookieOptions());
  return json({ ok: true, role: user.role_name });
});
