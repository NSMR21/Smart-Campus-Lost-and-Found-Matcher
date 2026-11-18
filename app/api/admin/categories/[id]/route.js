import { handler, json, requirePermission, routeId } from '@/lib/api';
import { withUser } from '@/lib/db';

// DELETE /api/admin/categories/:id  - refused by the FOREIGN KEY (ON DELETE RESTRICT) while in use
export const DELETE = handler(async (request, context) => {
  const session = await requirePermission('MASTER_DATA_MANAGE');
  const categoryId = await routeId(context);
  await withUser(session.userId, (conn) => conn.query('DELETE FROM categories WHERE category_id = ?', [categoryId]));
  return json({ ok: true });
});
