import { handler, json, readJson, requirePermission, routeId } from '@/lib/api';
import { withUser } from '@/lib/db';
import { mirrorClaim } from '@/lib/vectorSafe';
import { oneOf, text } from '@/lib/validate';

// POST /api/claims/:id/verify  { decision: 'APPROVED' | 'REJECTED', remarks }
// -> CALL sp_verify_claim : locks claim + item, inserts the verification; triggers cascade the statuses
export const POST = handler(async (request, context) => {
  const session = await requirePermission('CLAIM_VERIFY');
  const claimId = await routeId(context);
  const body = await readJson(request);
  const decision = oneOf(body.decision, ['APPROVED', 'REJECTED'], 'Decision');
  const remarks = text(body.remarks, 'Remarks', { optional: true, max: 255 });

  await withUser(session.userId, (conn) =>
    conn.query('CALL sp_verify_claim(?, ?, ?, ?)', [claimId, session.userId, decision, remarks]));
  await mirrorClaim(claimId);
  return json({ ok: true, decision });
});
