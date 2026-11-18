import { handler, json, readJson, requireUser, routeId, HttpError } from '@/lib/api';
import { can } from '@/lib/auth';
import { queryOne, withUser } from '@/lib/db';
import { getFound, getClaimsForFound, getMatchesForFound } from '@/lib/data';
import { indexAndMatch } from '@/lib/matching';
import { mirrorStatus, mirrorDelete } from '@/lib/vectorSafe';
import { itemFields, date, id as idField, text } from '@/lib/validate';

// GET /api/found/:id  - hidden marks, claims and matches only for staff
export const GET = handler(async (request, context) => {
  const session = await requireUser();
  const id = await routeId(context);
  const found = await getFound(id, session);
  if (!found) throw new HttpError(404, 'Found item not found.');
  if (!can(session, 'VIEW_HIDDEN_DETAILS')) return json(found);
  const [claims, matches] = await Promise.all([getClaimsForFound(id), getMatchesForFound(id)]);
  return json({ ...found, claims, matches });
});

// PATCH /api/found/:id  { action: 'dispose' }  or edited fields (finder while AVAILABLE, or staff)
export const PATCH = handler(async (request, context) => {
  const session = await requireUser();
  const id = await routeId(context);
  const found = await queryOne('SELECT finder_id, status FROM found_items WHERE found_id = ?', [id]);
  if (!found) throw new HttpError(404, 'Found item not found.');
  const body = await readJson(request);

  if (body.action === 'dispose') {
    if (!can(session, 'ITEM_DISPOSE')) throw new HttpError(403, 'Permission denied: ITEM_DISPOSE');
    if (found.status !== 'AVAILABLE') throw new HttpError(400, 'Only unclaimed items can be disposed.');
    await withUser(session.userId, (conn) =>
      conn.query("UPDATE found_items SET status = 'DISPOSED' WHERE found_id = ?", [id]));
    await mirrorStatus('found', id);
    return json({ ok: true });
  }

  const isStaff = can(session, 'VIEW_HIDDEN_DETAILS');
  if (!isStaff && !(found.finder_id === session.userId && found.status === 'AVAILABLE')) {
    throw new HttpError(403, 'You can only edit your own report while it is unclaimed.');
  }
  const f = itemFields(body);
  const foundDate = date(body.found_date, 'Date found');
  const heldAt = idField(body.held_at_id, 'Collection point');
  const hiddenMarks = text(body.hidden_marks, 'Hidden identifying marks', { optional: true, max: 255 });
  await withUser(session.userId, (conn) => conn.query(
    `UPDATE found_items
        SET title = ?, description = ?, category_id = ?, location_id = ?, color = ?, brand = ?,
            found_date = ?, held_at_id = ?, hidden_marks = ?
      WHERE found_id = ?`,
    [f.title, f.description, f.category_id, f.location_id, f.color, f.brand, foundDate, heldAt, hiddenMarks, id]));

  const { matches } = await indexAndMatch('found', id);
  return json({ ok: true, matches });
});

// DELETE /api/found/:id  (admin; fails if the item already has a recorded hand-over)
export const DELETE = handler(async (request, context) => {
  const session = await requireUser();
  if (!can(session, 'ITEM_DISPOSE')) throw new HttpError(403, 'Permission denied: ITEM_DISPOSE');
  const id = await routeId(context);
  await withUser(session.userId, (conn) => conn.query('DELETE FROM found_items WHERE found_id = ?', [id]));
  await mirrorDelete('found', id);
  return json({ ok: true });
});
