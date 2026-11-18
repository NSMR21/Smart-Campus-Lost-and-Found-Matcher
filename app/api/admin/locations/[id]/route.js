import { handler, json, requirePermission, routeId } from '@/lib/api';
import { withUser } from '@/lib/db';

// DELETE /api/admin/locations/:id  - refused by the FOREIGN KEY while reports reference it
export const DELETE = handler(async (request, context) => {
  const session = await requirePermission('MASTER_DATA_MANAGE');
  const locationId = await routeId(context);
  await withUser(session.userId, (conn) => conn.query('DELETE FROM locations WHERE location_id = ?', [locationId]));
  return json({ ok: true });
});
