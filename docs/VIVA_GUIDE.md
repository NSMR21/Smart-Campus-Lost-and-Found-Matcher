# Viva and demonstration guide

## 1. Ten-minute demo script
1. **Login as a student** (`mukesh@pes.edu`). Show the dashboard and the role pill in the sidebar.
2. **Report a lost item**: title *Black umbrella*, description *Black umbrella with a wooden handle, left at the bus bay
   shelter.*, category Umbrellas, colour black, location Bus Bay. For the date, use the date shown on found item F-20
   (Found items → Black umbrella) or one day earlier.
   The detail page shows a ~95% match with F-20 and the score breakdown (rule / semantic / total).
   Do not pick a date two or more days after F-20 was found: an item cannot be found before it was lost, so
   `fn_rule_match_score` returns 0 and the total drops to about 38%. That makes a good viva question.
   Mention: INSERT → BEFORE/AFTER triggers → vector upsert → `sp_match_candidates_for_lost` + vector search →
   `sp_upsert_match` → strong-match trigger → notification.
3. **Smart search**: type *"money purse"*. Vector search finds the brown leather wallet; the FULLTEXT keyword search
   finds nothing, because no report contains those words. *"cellphone with damaged display"* finds the Redmi phone
   the same way.
4. **Claim** F-20 with proof. The claim page shows PENDING, and the item became CLAIM_PENDING (trigger).
5. **Login as staff** (`staff@pes.edu`). Open the claims queue → the umbrella claim. **Approve** (`sp_verify_claim`), then
   **Record hand-over** (`sp_record_return`).
6. **Competing claims**: open claim #6 (genuine wallet owner). Point out the claimant's proof next to the finder's
   secret marks (staff only; the umbrella has none). Approve it. Claim #7 (Sameer's fake claim) becomes REJECTED
   automatically through the trigger cascade.
7. **Reports**: recursive-CTE monthly chart, category stats view, RANK() leaderboard.
8. **SQL Lab**:
   - run J-6 (users joined four times);
   - run N-3 (correlated sub-query);
   - run C-3 (recursive closure);
   - run R-9 (the trigger cascade, rolled back);
   - run CON-1..4 (constraint errors).
9. **Login as admin** (`admin@pes.edu`):
   - **Permissions (RBAC)**: untick CLAIM_VERIFY for STAFF, show staff can no longer approve, then tick it back;
   - **Users & roles**: try to demote the only admin (the procedure refuses);
   - **Vector database**: run a query, change a status (update), re-embed, delete.
10. In **MySQL Workbench**, log in as `lf_student_demo` and run `SELECT hidden_marks FROM found_items`
    → error 1143 (column-level privilege).

## 2. Likely questions and answers

**Why two databases?**
MySQL guarantees consistency for the business records: keys, constraints, transactions. Matching free-text
descriptions needs similarity search over embeddings, which is what a vector database is built for. MySQL stays the
source of truth; the vector store can be rebuilt from it at any time.

**What is an embedding? What is cosine similarity?**
An embedding is a fixed-length vector (here 384 numbers) produced by a neural network, such that sentences with similar
meaning are close together. Cosine similarity = cos of the angle between two vectors = dot product of the normalised
vectors (1 = same direction, 0 = unrelated).

**How is the match score computed?**
`fn_rule_match_score` gives 0..1 from category relation (0.35), location (0.25), date gap (0.20), colour (0.15) and brand
(0.05). The vector DB gives the semantic score. `total_score` is a STORED generated column = 0.6·rule + 0.4·semantic.
Pairs are stored at ≥ 0.35, and a trigger notifies the owner at ≥ 0.55.

**Which normal form is the schema in? Show a transitive dependency you removed.**
3NF/BCNF. `item_returns` does not store found_id or the claimant: claim_id → found_id, so storing it would be
redundant. Department names live in `departments`, not in `student_profiles`. Building names live in `buildings`,
not in `locations`.

**Why is `total_score` stored if it is derived?**
It is a *generated* column: MySQL computes it, so it can never be inconsistent, and it can be indexed
(`idx_match_score`) for ranking.

**Why are competing claims rejected in the verifications trigger and not in the claims trigger?**
MySQL forbids a trigger from modifying the table that fired it (error 1442). The decision is inserted into
`verifications`, and that trigger updates `claims`.

**How do you prevent two staff members approving two claims for the same item at once?**
`sp_verify_claim` runs in a transaction and locks the claim row and the item row with `SELECT ... FOR UPDATE`. The
second session waits, then sees status CLAIM_APPROVED and fails with a clear message.

**Where is RBAC enforced?**
At four levels:
1. `proxy.js` (signed in at all);
2. API routes (`SELECT fn_has_permission(...)`);
3. stored procedures (they check again);
4. triggers on `verifications` / `item_returns`.

Plus native MySQL roles for the database accounts. Permissions are rows in `role_permissions`, so admins can
change them at runtime.

**How are passwords stored?**
bcrypt hash (cost 10, 60 characters) in `users.password_hash`. The JWT in the cookie contains only the user id,
name and role, and the role and permissions are re-read from the database on every request.

**What does `@app_user_id` do?**
The API sets this session variable on the connection before writing. The audit triggers read it to record *who*
made the change.

**What is a recursive CTE? Where do you use one?**
A WITH RECURSIVE query has an anchor part and a recursive part that joins back to the CTE until no new rows are produced.
It is used in `vw_category_tree` (path of each category), the category sub-tree filter, `fn_recovery_rate`, and the
month/day series generators in reports (C-4 and the monthly chart).

**Difference between a nested and a correlated sub-query?**
A nested (non-correlated) sub-query runs once and its result is reused (N-1). A correlated sub-query references the
outer row, so it is evaluated per outer row (N-3, N-10).

**Why LanceDB and not MongoDB / Pinecone / ChromaDB?**
It is embedded (nothing to install or host), free, works offline, supports filters + ANN indexes + update/delete, and
runs inside the Node.js server. Pinecone is a paid cloud service. Chroma and Mongo need a separate server process.

**What happens if the vector DB is down?**
Writes to MySQL still succeed, matching falls back to rule scores, and `npm run vector:sync` rebuilds the index.

## 3. Modification exercises the examiner may ask for (and where to change)

| Request | Change |
|---|---|
| "Give location more weight" | `fn_rule_match_score` in `db/02_functions.sql` (re-run the file), or the 0.6/0.4 split in the generated column (`ALTER TABLE potential_matches MODIFY total_score ...`) |
| "Add a new category / location" | Admin → Categories & locations (INSERT through the API), or an INSERT in SQL |
| "Add a new permission and role rule" | `INSERT INTO permissions ...` + tick it in the RBAC matrix; check it with `requirePermission('CODE')` |
| "Add a CHECK constraint" | e.g. `ALTER TABLE claims ADD CONSTRAINT chk_claim_len CHECK (CHAR_LENGTH(proof_details) <= 1000);` |
| "Write a query: students with more than one lost item" | `SELECT owner_id, COUNT(*) FROM lost_items GROUP BY owner_id HAVING COUNT(*) > 1;` |
| "New trigger: notify the finder when a claim is submitted" | add an INSERT into notifications in `trg_claims_after_insert` |
| "Show the top 3 categories by recovery rate" | `SELECT * FROM vw_category_stats ORDER BY recovery_rate DESC LIMIT 3;` |
| "Add a field to the lost form" | column in `01_schema.sql` + `lib/validate.js` `itemFields()` + `components/ItemReportForm.js` + INSERT in `app/api/lost/route.js` |
| "Change the strong-match threshold" | `0.55` in `trg_matches_after_insert/update` and `lib/constants.js` |

## 4. Concept checklist (all present)
DDL with PK/FK/UNIQUE/CHECK/DEFAULT/generated column · ON DELETE CASCADE / RESTRICT / SET NULL · composite & FULLTEXT
indexes · INSERT/UPDATE/DELETE incl. multi-table UPDATE/DELETE, INSERT…SELECT, upsert · inner/left/right/self/cross
joins · nested, correlated, EXISTS/NOT EXISTS, ANY/ALL, derived tables · recursive and non-recursive CTEs · window
functions (ROW_NUMBER, RANK, DENSE_RANK, NTILE, LAG, running SUM) · GROUP BY/HAVING/ROLLUP/GROUPING/GROUP_CONCAT ·
views · stored functions & procedures (IN/OUT, handlers, SIGNAL/RESIGNAL, cursor, loops, temporary table) · 22
triggers · transactions, SAVEPOINT, row locks, isolation levels · RBAC tables + native roles + column-level privileges
· vector DB create/read/update/delete with metadata filters and indexes.
