# Lane Trading Cards — catalog taxonomy

First Edition trading cards live in `data/lane-trading-cards-first-edition.json` and are served by `GET /api/genealogy/lane-cards` via `services/genealogy.service.js`.

## Card kinds (`cardKind`)

| Kind | `personId` | Purpose |
|------|------------|---------|
| `person` (default) | Lane person id | Named individual with birth/death, branch, and citations |
| `artifact` | `0` | Source object: plate extract, frontispiece, printed book spread |
| `event` | `0` | Historical moment spanning people; links to related person cards |

Person cards do not show a “Person” label in the grid—only artifact and event cards show a kind ribbon.

## Catalog tiers (`rarity`)

Tiers describe **museum catalog prominence**, not game loot.

| Tier | When to use |
|------|-------------|
| **Common** | Basic birth/death/family facts; household or supporting lines |
| **Notable** | Occupation, town office, migration, land/civic context |
| **Rare** | War service, captivity, famous tie, major event participation |
| **Legendary** | Founder line, major branch anchors, iconic figures |

Legacy `uncommon` values are normalized to `notable` in the service layer.

## Timeline spine

Root array `timelineSpine` holds curated chronological beats (not every card gets a row). Each beat requires `year` and `label`; optional `cardId` opens the linked card in timeline view. Beats inherit tier/kind badges from the linked card when present.

## Curation checklist

When adding or editing a card:

1. Assign **kind** first (`person`, `artifact`, or `event`).
2. Pick **tier** from definitions above (manual curation only—no auto-tiering).
3. Set `personId` (`0` for artifact/event).
4. Wire `relatedCardIds` for events and cross-links.
5. Add front art via `CURATED_CARD_FRONT_IMAGE_BY_ID` in `public/family/js/lane-trading-cards.js` when not using a person portrait.
6. Add a spine beat when the moment should appear in timeline view.
7. Bump `generatedAt` / `taxonomyVersion` when changing deck structure.

## API filters

Query params on `/api/genealogy/lane-cards`:

- `cardKind` or `kind` — `person`, `artifact`, `event`
- `rarity` — `common`, `notable`, `rare`, `legendary`
- `era`, `branch`, `tag`, `q`, `personId` — existing filters

Response includes `taxonomy`, `kinds`, `rarities`, and `timelineSpine`.

## UI

- **Card view** — grid with tier pills and artifact/event ribbons.
- **Timeline view** — curated spine; `?view=timeline` deep link; filters apply to both views.
- **Export** — catalog PDF and 9-card sheets include tier/kind metadata on card faces where rendered.

## Regenerating deck metadata

Batch tier/kind/spine updates: `node scripts/tools/update-lane-trading-cards-taxonomy.mjs`

After JSON changes in Postgres-backed deployments, refresh the `lane-trading-cards-first-edition` dataset so API caches match the file.
