// Server-side authentication and authorisation.
// The JWT cookie only identifies the user; the role and permissions are
// re-read from the database on every request, so RBAC changes made by an
// admin (or a deactivated account) take effect immediately.
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { query, queryOne } from './db.js';
import { SESSION_COOKIE, verifySessionToken } from './session.js';

export const getSession = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const payload = await verifySessionToken(token);
  if (!payload) return null;

  const user = await queryOne(
    `SELECT u.user_id, u.full_name, u.email, u.is_active, r.role_name
     FROM users u JOIN roles r ON r.role_id = u.role_id
     WHERE u.user_id = ?`, [payload.uid]);
  if (!user || !user.is_active) return null;

  const rows = await query('SELECT permission_code FROM vw_user_permissions WHERE user_id = ?', [user.user_id]);
  return {
    userId: user.user_id,
    name: user.full_name,
    email: user.email,
    role: user.role_name,
    permissions: rows.map((r) => r.permission_code),
  };
});

export function can(session, permission) {
  return Boolean(session?.permissions.includes(permission));
}

/** For pages: redirect to /login when signed out, to /dashboard when not allowed. */
export async function requirePageSession(permission) {
  const session = await getSession();
  // proxy.js already sent visitors without a token to /login, so reaching this point without a
  // session means the token is valid but the account was deactivated: clear the cookie first
  if (!session) redirect('/api/auth/logout');
  if (permission && !can(session, permission)) redirect('/dashboard?denied=1');
  return session;
}
