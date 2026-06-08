# Music Graph

Collection-seeded music knowledge graph stored in dedicated Postgres adjacency-list tables (`music_graph_nodes`, `music_graph_edges`).

## Model

**Nodes:** `artist`, `album`, `venue`, `show`, `member`

**Edges:**

| Edge | Direction | Meaning |
|------|-----------|---------|
| `HAS_ALBUM` | artist → album | Discography / collection link |
| `MEMBER_OF` | member → artist | Band membership (MusicBrainz) |
| `PERFORMED_AT` | show → venue | Concert location |
| `PERFORMED_BY` | show → artist | Who played |
| `RECORDING_OF` | album → show | Live album link (reserved) |

## Seed source (v1)

1. **`records`** — vinyl collection rows drive artist + album nodes and `HAS_ALBUM` edges.
2. **MusicBrainz** — band members via `artist-rels` (`services/music-graph-musicbrainz.service.js`).
3. **`grateful_dead_shows`** — when collection artist is Grateful Dead.
4. **`concerts` + `venues` + `artists`** — best-effort show links for other artists.

Reseed is idempotent (`ON CONFLICT` upserts). Collection ownership is stored on album node `metadata_json` (`recordId`, `userId`, storage zone/slot).

## API

Base path: `/api/music-graph`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/collection/:userId` | Seed if needed; return merged subgraph for user's collection albums. Query: `depth` (1–6) |
| GET | `/artist/:key` | Resolve artist by MusicBrainz MBID or slug/name; return neighborhood |
| POST | `/refresh` | Reseed. Body: `{ userId?, force? }` |
| GET | `/:nodeId/summary` | Node/edge type counts from traversal |
| GET | `/:nodeId` | Traversal payload `{ nodes, edges, paths }`. Query: `depth` |

## Key paths

| Component | Path |
|-----------|------|
| Graph service | `services/music-graph.service.js` |
| MusicBrainz seed helpers | `services/music-graph-musicbrainz.service.js` |
| Controller | `controllers/music-graph.controller.js` |
| Routes | `routes/music-graph.routes.js` |
| Unit tests | `tests/unit/music-graph.service.test.js`, `tests/unit/music-graph-musicbrainz.service.test.js` |

## Related

- [`docs/DATABASE_SCHEMA_OVERVIEW.md`](DATABASE_SCHEMA_OVERVIEW.md) — `records`, `grateful_dead_shows`, `concerts`
- [`docs/MUSIC_PILGRIMAGE_ATLAS.md`](MUSIC_PILGRIMAGE_ATLAS.md) — Grateful Dead tour map (separate from graph tables)
- [`docs/UNIFIED_DISASTERS_DB_SCHEMA.md`](UNIFIED_DISASTERS_DB_SCHEMA.md) — disaster impact graph (separate `graph_nodes` / `graph_edges`)

## Manual refresh

```bash
curl -X POST http://localhost:3000/api/music-graph/refresh \
  -H "Content-Type: application/json" \
  -d '{"userId":"cosmic-turtle","force":true}'
```

```bash
curl "http://localhost:3000/api/music-graph/collection/cosmic-turtle?depth=3"
```
