import { handler, json, readJson, requirePermission, HttpError } from '@/lib/api';
import { queryOne, withUser } from '@/lib/db';
import { getRbacMatrix } from '@/lib/data';
import { id } from '@/lib/validate';

// permissions an administrator can never lose (prevents locking everyone out)
const PROTECTED = ['USER_MANAGE', 'RBAC_MANAGE'];

// GET /api/admin/rbac  - roles, permissions and grants
export const GET = handler(async () => {
  await requirePermission('RBAC_MANAGE');
  return json(await getRbacMatrix());
});

// POST /api/admin/rbac  { role_id, permission_id, granted }  - grant / revoke
export const POST = handler(async (request) => {
  const session = await requirePermission('RBAC_MANAGE');
  const body = await readJson(request);
  const roleId = id(body.role_id, 'Role');
  const permissionId = id(body.permission_id, 'Permission');

  const info = await queryOne(
    `SELECT r.role_name, p.permission_code FROM roles r, permissions p WHERE r.role_id = ? AND p.permission_id = ?`,
    [roleId, permissionId]);
  if (!info) throw new HttpError(404, 'Unknown role or permission.');
  if (!body.granted && info.role_name === 'ADMIN' && PROTECTED.includes(info.permission_code)) {
    throw new HttpError(400, `${info.permission_code} cannot be removed from ADMIN.`);
  }

  await withUser(session.userId, async (conn) => {
    if (body.granted) {
      await conn.query('INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [roleId, permissionId]);
    } else {
      await conn.query('DELETE FROM role_permissions WHERE role_id = ? AND permission_id = ?', [roleId, permissionId]);
    }
    await conn.query(
      `INSERT INTO audit_log (table_name, record_id, action, new_value, changed_by)
       VALUES ('role_permissions', ?, ?, ?, ?)`,
      [roleId, body.granted ? 'INSERT' : 'DELETE', `${info.role_name}:${info.permission_code}`.slice(0, 40), session.userId]);
  });
  return json({ ok: true });
});
