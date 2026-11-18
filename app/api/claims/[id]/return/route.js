import { handler, json, readJson, requirePermission, routeId } from '@/lib/api';
import { withUser, callWithOut } from '@/lib/db';
import { mirrorClaim } from '@/lib/vectorSafe';
import { text } from '@/lib/validate';

// POST /api/claims/:id/return  { id_proof_checked, remarks }  -> CALL sp_record_return
export const POST = handler(async (request, context) => {
  const session = await requirePermission('RETURN_RECORD');
  const claimId = await routeId(context);
  const body = await readJson(request);
  const remarks = text(body.remarks, 'Remarks', { optional: true, max: 255 });

  const returnId = await withUser(session.userId, (conn) =>
    callWithOut(conn, 'sp_record_return', [claimId, session.userId, Boolean(body.id_proof_checked), remarks]));
  await mirrorClaim(claimId);
  return json({ ok: true, return_id: returnId });
});
