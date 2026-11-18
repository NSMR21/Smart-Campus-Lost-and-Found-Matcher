import { handler, json, requireUser } from '@/lib/api';
import { query } from '@/lib/db';
import { getNotifications } from '@/lib/data';

// GET /api/notifications
export const GET = handler(async () => {
  const session = await requireUser();
  return json(await getNotifications(session.userId));
});

// POST /api/notifications  - mark all as read
export const POST = handler(async () => {
  const session = await requireUser();
  const result = await query('UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND NOT is_read', [session.userId]);
  return json({ ok: true, updated: result.affectedRows });
});
