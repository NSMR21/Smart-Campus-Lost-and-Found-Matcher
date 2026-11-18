import { handler, json, requirePermission } from '@/lib/api';
import { stats, listDocuments } from '@/lib/vectorStore';

// GET /api/vector?kind=&status=   - READ: table statistics + documents (metadata only)
export const GET = handler(async (request) => {
  await requirePermission('VECTOR_DB_MANAGE');
  const params = new URL(request.url).searchParams;
  const [summary, documents] = await Promise.all([
    stats(),
    listDocuments({ kind: params.get('kind') ?? undefined, status: params.get('status') ?? undefined, limit: 200 }),
  ]);
  return json({ stats: summary, documents });
});
