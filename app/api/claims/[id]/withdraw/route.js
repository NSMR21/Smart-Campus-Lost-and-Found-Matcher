import { handler, json, requireUser, routeId } from '@/lib/api';
import { withUser } from '@/lib/db';
import { mirrorClaim } from '@/lib/vectorSafe';

// POST /api/claims/:id/withdraw  - claimant withdraws a pending claim (CALL sp_withdraw_claim)
export const POST = handler(async (request, context) => {
  const session = await requireUser();
  const claimId = await routeId(context);
  await withUser(session.userId, (conn) => conn.query('CALL sp_withdraw_claim(?, ?)', [claimId, session.userId]));
  await mirrorClaim(claimId);
  return json({ ok: true });
});
