# Team contribution and Git workflow

## Suggested split (adjust to what each member actually did)

| Area | Sai Mukesh Reddy (PES1UG24AM170) | Rushieswar Reddy (PES1UG24AM158) |
|---|---|---|
| Database design | ER diagram, normalisation write-up | relational schema diagram, constraints |
| SQL | `01_schema.sql`, `02_functions.sql`, `05_views.sql` | `03_procedures.sql`, `04_triggers.sql`, `07_security.sql` |
| Queries | `db/queries/02`–`04` (joins, nested, CTEs) | `db/queries/01`, `05`–`08` (DML, aggregates, transactions, indexes) |
| Vector DB | `lib/embeddings.js`, `lib/vectorStore.js`, `scripts/vector-demo.mjs` | `lib/matching.js`, `scripts/sync-vectors.mjs` |
| Web app | lost/found/search pages, report form | claims, reports, admin pages, authentication |
| Testing & docs | `scripts/test-db.mjs`, README | ARCHITECTURE.md, VIVA_GUIDE.md |

Both members should be able to explain every part. The viva asks for individual contribution *and* overall understanding.

## Git / GitHub

The folder is already a Git repository. Secrets, the vector data and the model cache are ignored by `.gitignore`.

```bash
git config user.name "Your Name"
```

```bash
git config user.email "you@example.com"
```

Commit in small, meaningful steps, each member from their own machine or account, so the history shows individual work:

```bash
git add db/01_schema.sql db/02_functions.sql
```

```bash
git commit -m "Add schema with constraints and stored functions"
```

Create an empty repository on GitHub (private, or public if your instructor allows), then:

```bash
git remote add origin https://github.com/<username>/smart-campus-lost-found.git
```

```bash
git push -u origin main
```

Add your teammate as a collaborator (Settings → Collaborators) so both of you can push. Use branches for larger
features (`git switch -c feature/claims`) and merge them through pull requests.

Never commit `.env.local`. Each machine creates its own with `npm run db:setup`.
