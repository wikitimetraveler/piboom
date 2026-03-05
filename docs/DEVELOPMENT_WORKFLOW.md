# Development Workflow

Documentation for running, testing, and maintaining DevConnect Labs. No pre-commit hooks or automated script changes are used; workflow is manual.

## Start the Server

- **Standard:** `npm start` or `npm run dev` (with NODE_ENV=development)
- **Raspberry Pi:** `npm run pi`

## Tests

- **Jest unit tests:** `npm test`
- **Finance unit tests (Excel-based):** `npm run test:finance`

## Knowledge Refresh

After changing ICE repos, Postman collections, or Developer Connect docs:

```bash
npm run build:ice-knowledge
```

Updates `data/knowledge/ice-sources.json` for the Encompass Assistant.

## Checks and Maintenance

Scripts in `scripts/checks/` and `scripts/maintenance/` are run manually:

- `scripts/checks/check-flood-zones.js`
- `scripts/checks/check-fema-data.js`
- `scripts/checks/check-layer28-fields.js`
- `scripts/checks/check-update-status.js`
- `scripts/maintenance/` — cleanup, counts, flood zone updates

No automated hooks are configured by default.

## Reference

- Setup: [docs/SETUP.md](SETUP.md), [docs/DATABASE_SETUP.md](DATABASE_SETUP.md)
- Encompass: [docs/ENCOMPASS.md](ENCOMPASS.md)
- Glossary: [docs/GLOSSARY.md](GLOSSARY.md)
