# Vector database (LanceDB)

## Why a vector database here
A lost report says *"lost my mobile, black, the screen protector is broken"*. The matching found report says
*"Black OnePlus phone with a cracked screen guard"*. They share almost no keywords: SQL `LIKE` and even FULLTEXT miss
the pair. An embedding model maps both sentences to nearby points in a 384-dimensional space (cosine similarity
≈ 0.55 here versus ≈ 0.15 for unrelated items), and a vector database finds the nearest points quickly while filtering
on metadata. MySQL keeps the structured facts; the vector database answers "what *means* the same thing?".

| | MySQL | LanceDB |
|---|---|---|
| Model | relational tables, constraints, transactions | collections of documents with a vector column (Lance columnar format) |
| Query | SQL, joins, aggregates | nearest-neighbour search + SQL-like filter predicates |
| Role in the project | source of truth for every record | semantic index of the report texts, rebuilt from MySQL at any time |

## Database creation
- **Database**: a folder (`LANCEDB_DIR`, default `./data/lancedb`) opened with `lancedb.connect(dir)`.
  It is embedded, so no server is needed.
- **Table** `item_vectors` is created with an explicit Arrow schema (`lib/vectorStore.js`):

| Column | Type | Purpose |
|---|---|---|
| id | Utf8 | `lost-12` / `found-7`; merge key |
| item_id | Int32 | MySQL primary key |
| kind | Utf8 | `lost` or `found` |
| user_id | Int32 | owner / finder (to exclude own items) |
| title, content | Utf8 | title and the exact text that was embedded |
| category_id, location_id | Int32 | metadata for filtering |
| status | Utf8 | mirrors the MySQL status |
| event_date | Utf8 | lost/found date (filter: found must not predate the loss) |
| model | Utf8 | embedding model that produced the vector (vectors from different models are never compared) |
| updated_at | Utf8 | last write |
| **vector** | **FixedSizeList<Float32>[384]** | the embedding |

- **Indexes** (`ensureIndexes()`): `BTree` on id and category_id, `Bitmap` on kind and status, and an `IVF_PQ`
  approximate nearest-neighbour index on `vector` (cosine) once the table has 256+ rows. Below that, LanceDB does an
  exact flat scan, which is faster for small tables.
- **Population**: `npm run vector:sync` drops and recreates the table, embeds every report in batches of 32, and builds the indexes.

## Embeddings
`lib/embeddings.js` runs **sentence-transformers/all-MiniLM-L6-v2** locally (ONNX through `@huggingface/transformers`)
with mean pooling and L2 normalisation, so cosine similarity = dot product. The text is `title + ". " + description`.
If the model cannot be loaded, it falls back to a deterministic hashed word/bigram/trigram embedding (`hash-ngram-384`).

## Read, Update, Delete in the application
| Operation | Where | Code |
|---|---|---|
| **Read**: semantic neighbours during matching | `lib/matching.js` | `table.vectorSearch(v).distanceType('cosine').where("kind = 'found' AND status IN (...) AND model = ... AND event_date >= ... AND user_id <> ...").limit(15)` |
| **Read**: natural-language search | Smart search page, `GET /api/search` | `semanticSearch()` in `lib/search.js`, then details joined from MySQL views |
| **Read**: fetch stored vectors | `getVectors(ids)` | `table.query().where("id IN (...)").select(['id','model','vector'])` |
| **Read**: browse / stats | Admin → Vector database | `listDocuments()`, `stats()` (`countRows`, `listIndices`, `version`) |
| **Create / Update** (upsert) | after every new or edited report | `table.mergeInsert('id').whenMatchedUpdateAll().whenNotMatchedInsertAll().execute(docs)`. Editing the text re-embeds it. |
| **Update** metadata | after claims, verifications, returns, disposal | `table.update({ where: "id = 'found-7'", values: { status: 'RETURNED' } })` |
| **Update** from the admin console | status dropdown / "Re-embed" | `PATCH /api/vector/:id`, `POST /api/vector/:id` |
| **Delete** | deleting a report; admin "Delete" button | `table.delete("id = 'lost-12'")` |

`npm run vector:demo` shows the same operations on a throw-away table (`demo_items`): create, insert, index,
filtered similarity search, update metadata and vector, delete, drop.

## Consistency between MySQL and LanceDB
MySQL is written first, inside its transaction. The vector write follows; if it fails, it is logged
(`lib/vectorSafe.js`) and the request still succeeds. Any drift is repaired by the next edit of that report, by
the admin "Re-embed" button, or by a full `npm run vector:sync`. This keeps the core workflow available even if the
vector store is unavailable, and matching then falls back to the SQL rule score.
