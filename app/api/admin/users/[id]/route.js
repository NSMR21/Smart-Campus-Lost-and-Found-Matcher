import { handler, json, readJson, requirePermission, routeId, HttpError } from '@/lib/api';
import { withUser } from '@/lib/db';
import { ROLES } from '@/lib/constants';
import { oneOf } from '@/lib/validate';

// PATCH /api/admin/users/:id  { role }  -> CALL sp_change_user_role   |  { is_active }
export const PATCH = handler(async (request, context) => {
  const session = await requirePermission('USER_MANAGE');
  const userId = await routeId(context);
  const body = await readJson(request);

  if (body.role !== undefined) {
    const role = oneOf(body.role, ROLES, 'Role');
    await withUser(session.userId, (conn) =>
      conn.query('CALL sp_change_user_role(?, ?, ?)', [session.userId, userId, role]));
    return json({ ok: true, role });
  }

  if (body.is_active !== undefined) {
    if (userId === session.userId) throw new HttpError(400, 'You cannot deactivate your own account.');
    const active = Boolean(body.is_active);
    await withUser(session.userId, async (conn) => {
      await conn.query('UPDATE users SET is_active = ? WHERE user_id = ?', [active, userId]);
      await conn.query(
        `INSERT INTO audit_log (table_name, record_id, action, old_value, new_value, changed_by)
         VALUES ('users', ?, 'UPDATE', ?, ?, ?)`,
        [userId, active ? 'INACTIVE' : 'ACTIVE', active ? 'ACTIVE' : 'INACTIVE', session.userId]);
    });
    return json({ ok: true, is_active: active });
  }
  throw new HttpError(400, 'Nothing to update.');
});
