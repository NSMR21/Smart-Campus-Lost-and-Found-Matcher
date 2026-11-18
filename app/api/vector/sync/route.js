import { handler, json, requirePermission } from '@/lib/api';
import { syncAll } from '@/lib/itemSync';
import { runMatchingForAll } from '@/lib/matching';

// POST /api/vector/sync  - CREATE: rebuild the vector table from MySQL, build indexes, re-score matches
export const POST = handler(async () => {
  await requirePermission('VECTOR_DB_MANAGE');
  const started = Date.now();
  const result = await syncAll();
  const matching = await runMatchingForAll();
  return json({
    ok: true,
    ...result,
    ...matching,
    message: `Re-built ${result.documents} vectors (${result.model}) and re-scored ${matching.rescored} pairs in ${((Date.now() - started) / 1000).toFixed(1)}s.`,
  });
});
