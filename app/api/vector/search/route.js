import { handler, json, readJson, requirePermission, HttpError } from '@/lib/api';
import { embedText } from '@/lib/embeddings';
import { vectorSearch } from '@/lib/vectorStore';

// POST /api/vector/search  { q, kind?, status? }  - READ: raw nearest-neighbour query on the vector table
export const POST = handler(async (request) => {
  await requirePermission('VECTOR_DB_MANAGE');
  const body = await readJson(request);
  const q = String(body.q ?? '').trim();
  if (q.length < 2) throw new HttpError(400, 'Type a query.');
  const { model, vector } = await embedText(q.slice(0, 300));
  const hits = await vectorSearch(vector, {
    kind: ['lost', 'found'].includes(body.kind) ? body.kind : undefined,
    statuses: body.status ? [body.status] : undefined,
    model,
    limit: 10,
  });
  return json({ model, dimension: vector.length, preview: vector.slice(0, 8).map((x) => Number(x.toFixed(4))), hits });
});
