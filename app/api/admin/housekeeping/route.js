import { handler, json, readJson, requirePermission, HttpError } from '@/lib/api';
import { withUser, callWithOut, query } from '@/lib/db';
import { mirrorStatus } from '@/lib/vectorSafe';
import { oneOf } from '@/lib/validate';

// POST /api/admin/housekeeping  { task: 'dispose' | 'remind', days }
//   dispose -> CALL sp_dispose_unclaimed(admin, days, @count)   (bulk UPDATE in a transaction)
//   remind  -> CALL sp_remind_stale_reports(days, @count)        (CURSOR loop)
export const POST = handler(async (request) => {
  const body = await readJson(request);
  const task = oneOf(body.task, ['dispose', 'remind'], 'task');
  const days = Number(body.days);
  if (!Number.isInteger(days) || days < 1 || days > 365) throw new HttpError(400, 'Days must be between 1 and 365.');

  if (task === 'dispose') {
    const session = await requirePermission('ITEM_DISPOSE');
    const before = await query(
      "SELECT found_id FROM found_items WHERE status = 'AVAILABLE' AND found_date < CURDATE() - INTERVAL ? DAY", [days]);
    const count = await withUser(session.userId, (conn) =>
      callWithOut(conn, 'sp_dispose_unclaimed', [session.userId, days]));
    for (const { found_id } of before) await mirrorStatus('found', found_id);
    return json({ ok: true, message: `${count} unclaimed item(s) marked as disposed.` });
  }

  const session = await requirePermission('MASTER_DATA_MANAGE');
  const count = await withUser(session.userId, (conn) => callWithOut(conn, 'sp_remind_stale_reports', [days]));
  return json({ ok: true, message: `${count} reminder notification(s) sent.` });
});
