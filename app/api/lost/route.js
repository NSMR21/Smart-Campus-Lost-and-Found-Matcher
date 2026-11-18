import { handler, json, readJson, requirePermission, requireUser } from '@/lib/api';
import { withUser } from '@/lib/db';
import { listLost } from '@/lib/data';
import { indexAndMatch } from '@/lib/matching';
import { itemFields, date } from '@/lib/validate';

// GET /api/lost?q=&category=&building=&status=&from=&to=&mine=1
export const GET = handler(async (request) => {
  const session = await requireUser();
  const p = Object.fromEntries(new URL(request.url).searchParams);
  return json(await listLost({ ...p, mine: p.mine === '1' }, session));
});

// POST /api/lost  - report a lost item, index it in the vector DB and run matching
export const POST = handler(async (request) => {
  const session = await requirePermission('REPORT_LOST');
  const body = await readJson(request);
  const f = itemFields(body);
  const lostDate = date(body.lost_date, 'Date lost');

  const lostId = await withUser(session.userId, async (conn) => {
    const [result] = await conn.query(
      `INSERT INTO lost_items (owner_id, category_id, location_id, title, description, color, brand, lost_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [session.userId, f.category_id, f.location_id, f.title, f.description, f.color, f.brand, lostDate]);
    return result.insertId;
  });

  const { matches } = await indexAndMatch('lost', lostId);
  return json({ lost_id: lostId, matches }, 201);
});
