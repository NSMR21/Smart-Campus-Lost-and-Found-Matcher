import { handler, json, readJson, requireUser, HttpError } from '@/lib/api';
import { can } from '@/lib/auth';
import { queryOne } from '@/lib/db';
import { runMatching } from '@/lib/matching';
import { oneOf, id } from '@/lib/validate';

// POST /api/matches/run  { kind: 'lost' | 'found', id }  - re-run hybrid matching for one report
export const POST = handler(async (request) => {
  const session = await requireUser();
  const body = await readJson(request);
  const kind = oneOf(body.kind, ['lost', 'found'], 'kind');
  const itemId = id(body.id, 'id');

  const row = await queryOne(kind === 'lost'
    ? 'SELECT owner_id AS user_id FROM lost_items WHERE lost_id = ?'
    : 'SELECT finder_id AS user_id FROM found_items WHERE found_id = ?', [itemId]);
  if (!row) throw new HttpError(404, 'Report not found.');
  if (row.user_id !== session.userId && !can(session, 'MATCH_MANAGE')) {
    throw new HttpError(403, 'Permission denied: MATCH_MANAGE');
  }
  const result = await runMatching(kind, itemId);
  return json({ ...result, message: `${result.stored} suggestion(s) after checking ${result.candidates} candidate(s).` });
});
