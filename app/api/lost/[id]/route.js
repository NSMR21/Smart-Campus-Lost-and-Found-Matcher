import { handler, json, readJson, requireUser, routeId, HttpError } from '@/lib/api';
import { can } from '@/lib/auth';
import { queryOne, withUser } from '@/lib/db';
import { getLost, getMatchesForLost } from '@/lib/data';
import { indexAndMatch } from '@/lib/matching';
import { mirrorStatus, mirrorDelete } from '@/lib/vectorSafe';
import { itemFields, date } from '@/lib/validate';

async function loadForChange(id, session) {
  const lost = await queryOne('SELECT owner_id, status FROM lost_items WHERE lost_id = ?', [id]);
  if (!lost) throw new HttpError(404, 'Lost report not found.');
  if (lost.owner_id !== session.userId && !can(session, 'MATCH_MANAGE')) {
    throw new HttpError(403, 'Only the owner or staff can change this report.');
  }
  return lost;
}

// GET /api/lost/:id  - report with its match suggestions
export const GET = handler(async (request, context) => {
  const session = await requireUser();
  const id = await routeId(context);
  const lost = await getLost(id);
  if (!lost) throw new HttpError(404, 'Lost report not found.');
  const isOwner = lost.owner_id === session.userId;
  if (!isOwner && !can(session, 'VIEW_HIDDEN_DETAILS')) delete lost.owner_email;
  const matches = isOwner || can(session, 'MATCH_MANAGE') ? await getMatchesForLost(id) : [];
  return json({ ...lost, matches });
});

// PATCH /api/lost/:id  { action: 'close' | 'reopen' }  or edited fields
export const PATCH = handler(async (request, context) => {
  const session = await requireUser();
  const id = await routeId(context);
  const lost = await loadForChange(id, session);
  const body = await readJson(request);

  if (body.action === 'close' || body.action === 'reopen') {
    const [from, to] = body.action === 'close' ? [['OPEN', 'MATCHED'], 'CLOSED'] : [['CLOSED'], 'OPEN'];
    if (!from.includes(lost.status)) throw new HttpError(400, `A ${lost.status} report cannot be changed this way.`);
    await withUser(session.userId, (conn) =>
      conn.query('UPDATE lost_items SET status = ? WHERE lost_id = ?', [to, id]));
    await mirrorStatus('lost', id);
    return json({ ok: true, status: to });
  }

  if (!['OPEN', 'MATCHED'].includes(lost.status)) throw new HttpError(400, 'Only open reports can be edited.');
  const f = itemFields(body);
  const lostDate = date(body.lost_date, 'Date lost');
  await withUser(session.userId, (conn) => conn.query(
    `UPDATE lost_items
        SET title = ?, description = ?, category_id = ?, location_id = ?, color = ?, brand = ?, lost_date = ?
      WHERE lost_id = ?`,
    [f.title, f.description, f.category_id, f.location_id, f.color, f.brand, lostDate, id]));

  // the text changed: re-embed (vector UPDATE) and refresh the match suggestions
  const { matches } = await indexAndMatch('lost', id);
  return json({ ok: true, matches });
});

// DELETE /api/lost/:id
export const DELETE = handler(async (request, context) => {
  const session = await requireUser();
  const id = await routeId(context);
  const lost = await loadForChange(id, session);
  if (lost.status === 'RECOVERED') throw new HttpError(400, 'Recovered reports are kept as history.');
  await withUser(session.userId, (conn) => conn.query('DELETE FROM lost_items WHERE lost_id = ?', [id]));
  await mirrorDelete('lost', id);
  return json({ ok: true });
});
