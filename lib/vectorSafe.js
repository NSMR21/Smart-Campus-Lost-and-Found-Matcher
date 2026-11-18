// Fire-and-forget wrappers: the vector database mirrors MySQL, so a failure
// there is logged but never fails the user's request.
import { syncStatus, syncStatusesForClaim, removeItem } from './itemSync.js';

async function safely(label, fn) {
  try {
    await fn();
  } catch (err) {
    console.warn(`[vector] ${label}: ${err.message}`);
  }
}

export const mirrorStatus = (kind, id) => safely(`status ${kind}-${id}`, () => syncStatus(kind, id));
export const mirrorClaim = (claimId) => safely(`claim ${claimId}`, () => syncStatusesForClaim(claimId));
export const mirrorDelete = (kind, id) => safely(`delete ${kind}-${id}`, () => removeItem(kind, id));
