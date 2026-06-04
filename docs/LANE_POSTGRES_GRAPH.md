# Lane Postgres Graph Storage

Lane family data is now modeled in PostgreSQL with a relational graph shape and dataset registry.

For the canonical **`laneData.json`** person/link fields, edge direction, and relation types, see [LANE_FAMILY_TREE_SCHEMA.md](./LANE_FAMILY_TREE_SCHEMA.md).

## Tables

- `lane_person`: one row per person (`person_id`) with selected indexed columns and full source payload in `payload`.
- `lane_relationship`: graph edges between people (`source_person_id`, `target_person_id`, `relation`) with full edge JSON in `payload`.
- `lane_dataset`: canonical storage for `data/lane*.json` documents keyed by filename (without `.json`), with SHA-256 checksum.

Supporting Lane tables already in Postgres remain in use:

- `lane_pdf_gallery_hidden_plate`
- `lane_pdf_gallery_hide_stack`
- `lane_pdf_gallery_filter_preset`

## Import / Backfill

Use:

`npm run migrate:lane-json-postgres`

Behavior:

- Creates required tables (via `createTables()`).
- Imports all `data/lane*.json` files idempotently into `lane_dataset`.
- Rebuilds `lane_person` and `lane_relationship` from `laneData.json`.
- Uses upsert semantics, so reruns are safe.

## Runtime Cutover

At startup (`server.js`):

1. Database tables are created.
2. Lane JSON backfill runs.
3. `refreshGenealogyCachesFromPostgres()` hydrates in-memory genealogy caches from Postgres.

`services/genealogy.service.js` keeps existing sync API contracts; it now reads from hydrated Postgres caches first and only falls back to file JSON if Postgres data is not available.

## Notes

- API response shapes in genealogy controllers/routes are unchanged.
- Recursive CTE helpers for direct ancestor/descendant line IDs live in `services/lane-postgres.service.js`.
