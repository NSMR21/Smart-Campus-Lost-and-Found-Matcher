import { handler, json, requireUser, routeId, HttpError } from '@/lib/api';
import { can } from '@/lib/auth';
import { getClaim } from '@/lib/data';

// GET /api/claims/:id  - claimant or verifier only; hidden marks only for verifiers
export const GET = handler(async (request, context) => {
  const session = await requireUser();
  const claim = await getClaim(await routeId(context));
  if (!claim) throw new HttpError(404, 'Claim not found.');
  const isVerifier = can(session, 'CLAIM_VERIFY');
  if (claim.claimant_id !== session.userId && !isVerifier) throw new HttpError(403, 'Not your claim.');
  if (!isVerifier) delete claim.hidden_marks;
  return json(claim);
});
