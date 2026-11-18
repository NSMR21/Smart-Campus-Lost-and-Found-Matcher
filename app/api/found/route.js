import { handler, json, readJson, requirePermission, requireUser } from '@/lib/api';
import { withUser } from '@/lib/db';
import { listFound } from '@/lib/data';
import { indexAndMatch } from '@/lib/matching';
import { itemFields, date, id, text } from '@/lib/validate';

// GET /api/found?q=&category=&building=&status=&from=&to=&mine=1   (public view, no hidden marks)
export const GET = handler(async (request) => {
  const session = await requireUser();
  const p = Object.fromEntries(new URL(request.url).searchParams);
  return json(await listFound({ ...p, mine: p.mine === '1' }, session));
});

// POST /api/found  - report a found item; owners of matching lost reports are notified by trigger
export const POST = handler(async (request) => {
  const session = await requirePermission('REPORT_FOUND');
  const body = await readJson(request);
  const f = itemFields(body);
  const foundDate = date(body.found_date, 'Date found');
  const heldAt = id(body.held_at_id, 'Collection point');
  const hiddenMarks = text(body.hidden_marks, 'Hidden identifying marks', { optional: true, max: 255 });

  const foundId = await withUser(session.userId, async (conn) => {
    const [result] = await conn.query(
      `INSERT INTO found_items (finder_id, category_id, location_id, held_at_id, title, description, color, brand,
                               hidden_marks, found_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [session.userId, f.category_id, f.location_id, heldAt, f.title, f.description, f.color, f.brand,
        hiddenMarks, foundDate]);
    return result.insertId;
  });

  const { matches } = await indexAndMatch('found', foundId);
  return json({ found_id: foundId, matches }, 201);
});
