import { handler, json, readJson, requirePermission, HttpError } from '@/lib/api';
import { loadQueryFiles, runBlock } from '@/lib/sqlLab';

// GET /api/sql-lab  - list of annotated query blocks from db/queries
export const GET = handler(async () => {
  await requirePermission('SQL_LAB_VIEW');
  return json(await loadQueryFiles());
});

// POST /api/sql-lab  { id }  - run one predefined block (never arbitrary SQL)
export const POST = handler(async (request) => {
  await requirePermission('SQL_LAB_VIEW');
  const { id } = await readJson(request);
  if (typeof id !== 'string' || !/^[A-Z0-9-]{2,12}$/.test(id)) throw new HttpError(400, 'Invalid query id.');
  const result = await runBlock(id);
  if (result.error) throw new HttpError(400, result.error);
  return json(result);
});
