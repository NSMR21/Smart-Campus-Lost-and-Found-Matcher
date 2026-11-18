import { handler, json, readJson, requireUser, routeId, HttpError } from '@/lib/api';
import { can } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';
import { oneOf } from '@/lib/validate';

// PATCH /api/matches/:id  { status: 'DISMISSED' | 'SUGGESTED' }  - "not my item" / undo
export const PATCH = handler(async (request, context) => {
  const session = await requireUser();
  const matchId = await routeId(context);
  const body = await readJson(request);
  const status = oneOf(body.status, ['DISMISSED', 'SUGGESTED'], 'status');

  const match = await queryOne(
    `SELECT pm.match_status, l.owner_id FROM potential_matches pm
     JOIN lost_items l ON l.lost_id = pm.lost_id WHERE pm.match_id = ?`, [matchId]);
  if (!match) throw new HttpError(404, 'Match not found.');
  if (match.owner_id !== session.userId && !can(session, 'MATCH_MANAGE')) {
    throw new HttpError(403, 'Only the owner of the lost report or staff can change this suggestion.');
  }
  if (match.match_status === 'CONFIRMED') throw new HttpError(400, 'A confirmed match cannot be changed.');
  await query('UPDATE potential_matches SET match_status = ? WHERE match_id = ?', [status, matchId]);
  return json({ ok: true });
});
