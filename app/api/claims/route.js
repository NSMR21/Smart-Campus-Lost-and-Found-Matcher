import { handler, json, readJson, requireUser, requirePermission } from '@/lib/api';
import { withUser, callWithOut } from '@/lib/db';
import { listClaims } from '@/lib/data';
import { mirrorClaim } from '@/lib/vectorSafe';
import { id, text } from '@/lib/validate';

// GET /api/claims?status=PENDING&mine=1   (students always get only their own claims)
export const GET = handler(async (request) => {
  const session = await requireUser();
  const p = Object.fromEntries(new URL(request.url).searchParams);
  return json(await listClaims({ mine: p.mine === '1', status: p.status }, session));
});

// POST /api/claims  { found_id, lost_id?, proof_details }  -> CALL sp_submit_claim (transaction + row lock)
export const POST = handler(async (request) => {
  const session = await requirePermission('CLAIM_SUBMIT');
  const body = await readJson(request);
  const foundId = id(body.found_id, 'Found item');
  const lostId = id(body.lost_id, 'Lost report', { optional: true });
  const proof = text(body.proof_details, 'Proof of ownership', { min: 15, max: 2000 });

  const claimId = await withUser(session.userId, (conn) =>
    callWithOut(conn, 'sp_submit_claim', [foundId, session.userId, lostId, proof]));
  await mirrorClaim(claimId);
  return json({ claim_id: claimId }, 201);
});
