import { handler, json, readJson, requirePermission } from '@/lib/api';
import { withUser } from '@/lib/db';
import { text, id } from '@/lib/validate';

// POST /api/admin/categories  { category_name, parent_category_id?, is_high_value }
export const POST = handler(async (request) => {
  const session = await requirePermission('MASTER_DATA_MANAGE');
  const body = await readJson(request);
  const name = text(body.category_name, 'Category name', { min: 2, max: 50 });
  const parent = id(body.parent_category_id, 'Parent category', { optional: true });
  const [result] = await withUser(session.userId, (conn) => conn.query(
    'INSERT INTO categories (category_name, parent_category_id, is_high_value) VALUES (?, ?, ?)',
    [name, parent, Boolean(body.is_high_value)]));
  return json({ category_id: result.insertId }, 201);
});
