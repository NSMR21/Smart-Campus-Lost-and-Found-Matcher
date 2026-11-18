import { handler, json, readJson, requirePermission, HttpError } from '@/lib/api';
import { withUser } from '@/lib/db';
import { text, id } from '@/lib/validate';

// POST /api/admin/locations  { building_id, location_name, floor_no?, is_collection_point }
export const POST = handler(async (request) => {
  const session = await requirePermission('MASTER_DATA_MANAGE');
  const body = await readJson(request);
  const buildingId = id(body.building_id, 'Building');
  const name = text(body.location_name, 'Location name', { min: 2, max: 60 });
  let floor = null;
  if (body.floor_no !== '' && body.floor_no !== null && body.floor_no !== undefined) {
    floor = Number(body.floor_no);
    if (!Number.isInteger(floor)) throw new HttpError(400, 'Floor must be a whole number.');
  }
  const [result] = await withUser(session.userId, (conn) => conn.query(
    'INSERT INTO locations (building_id, location_name, floor_no, is_collection_point) VALUES (?, ?, ?, ?)',
    [buildingId, name, floor, Boolean(body.is_collection_point)]));
  return json({ location_id: result.insertId }, 201);
});
