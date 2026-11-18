# Testing

## Automated database tests
```bash
npm run db:test
```
`scripts/test-db.mjs` runs 32 assertions against the live database. Each test runs in a transaction that is rolled
back, so the data is unchanged afterwards.

| Group | What is checked |
|---|---|
| Constraints (9) | CHECK on email / SRN / year / colour, UNIQUE email and one-claim-per-item, FK insert and RESTRICT delete, generated column formula |
| Triggers (11) | future dates rejected, collection point required, normalisation, finder cannot claim, claim → CLAIM_PENDING + staff notifications, approve → competing claim rejected, student cannot verify, ID check for high-value items, hand-over closes the case, closed items locked, audit `changed_by` |
| Functions & views (6) | `fn_has_permission` (incl. deactivated user), `fn_category_root`, `fn_rule_match_score`, public view hides hidden marks, recursive category path |
| Procedures (6) | guard paths of `sp_verify_claim`, `sp_record_return`, `sp_submit_claim`, `sp_change_user_role`, `sp_dispose_unclaimed` |

Expected output: `32 passed, 0 failed`.

## SQL Lab check
Log in as staff or admin, open **SQL Lab** and press **Run** on each block. All 73 blocks were run through the API:
read blocks return rows, rollback blocks show their effects and are rolled back, and CON-1…4 / R-10…12 show the
intended constraint/trigger errors.

## Manual end-to-end test cases (UI)

| # | Steps | Expected |
|---|---|---|
| 1 | Register a new student with SRN `PES1XX24AM170` | error "SRN must look like PES1UG24AM170" (CHECK constraint message) |
| 2 | Student reports a lost black umbrella at Bus Bay, 3 days ago | report saved; F-20 suggested at ~90%; status MATCHED; notification created |
| 3 | Student claims F-20 linked to that report | claim PENDING; F-20 CLAIM_PENDING; staff notified |
| 4 | Same student claims F-20 again | "You have already claimed this item." (UNIQUE) |
| 5 | Staff approve the claim | claim APPROVED; F-20 CLAIM_APPROVED; claimant notified with the collection point |
| 6 | Staff record the hand-over | F-20 RETURNED; lost report RECOVERED; owner and finder notified; vector docs updated |
| 7 | Staff approve claim #6 (wallet) | claim #7 (competing) becomes REJECTED automatically |
| 8 | Staff try to hand over claim #3 (ID card) without ticking "ID checked" | refused: ID proof required for high-value items |
| 9 | Student opens `/admin/users` | redirected to the dashboard with "no permission" |
| 10 | Admin removes CLAIM_VERIFY from STAFF, staff try to verify | "Permission denied: CLAIM_VERIFY"; re-grant restores it |
| 11 | Admin changes their own role to STAFF | "Cannot remove the last active administrator" |
| 12 | Admin deactivates a student, who then reloads | session rejected (redirect to login) |
| 13 | Smart search "keys for my scooter" | Honda bike keys ranked first; keyword search finds nothing |
| 14 | Vector console: delete `lost-33`, then Re-embed | count drops by 1 and comes back |

Cases 2–6, 10, 11 and 14 were executed in the browser while building the project; `scripts/test-db.mjs`
covers the database-level equivalents.
