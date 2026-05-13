# API Routes Index

All API routes are mounted under `/api`. Base URL examples assume `http://localhost:3000` or your `RENDER_EXTERNAL_URL`.

## Worksheets & Encompass

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/encompass-hub/status` | Hub connection status |
| GET | `/api/encompass-hub/users` | Company users |
| GET | `/api/encompass-hub/pipeline` | Loan pipeline |
| GET | `/api/encompass-hub/loans/:loanGuid` | Loan details |
| GET | `/api/encompass-hub/loans/:loanGuid/associates` | Loan associates (v1); optional query `userId`, `roleId`, `fixedRoleId` |
| PUT | `/api/encompass-hub/loans/:loanGuid/associates/:logId` | Assign associate slot (body e.g. `{ "id": "userEntityId" }`) |
| DELETE | `/api/encompass-hub/loans/:loanGuid/associates/:logId` | Unassign associate slot |
| GET | `/api/encompass-hub/processor-assignment/config` | Load saved tool config from Postgres for `X-Encompass-Env` (`correspondent` \| `retail`); returns `{ encompassEnv, config, updatedAt }` |
| PUT | `/api/encompass-hub/processor-assignment/config` | Save tool config (JSON keys: `processorsJson`, `rulesJson`, `roleConfigJson`, `pipelineLimit`, `delayMs`, `complexityMode`, `complexityAiModel`, `complexityMaxPoints`); merges with existing row per env |
| POST | `/api/encompass-hub/processor-assignment/run` | Run complexity scoring + processor assignment (`dryRun`, `processors`, `complexityRules`, `pipelineFilters`, …) |
| POST | `/api/encompass-hub/loans/:loanId/field-writer` | Write fields |
| POST | `/api/encompass-hub/loans/:loanGuid/field-reader` | Read fields |
| GET | `/api/encompass-hub/analytics/calc-summary` | Calculator summary |
| GET | `/api/encompass-hub/analytics/ratios` | Ratio analytics |
| GET | `/api/encompass-hub/visualizations/map3d` | 3D map dataset |
| GET | `/api/encompass-hub/visualizations/stacked-cubes` | Stacked cubes dataset |
| GET | `/api/encompass-hub/visualizations/timeline` | Timeline dataset |
| GET | `/api/encompass-hub/native-fields` | Native fields |
| GET | `/api/encompass-hub/custom-fields` | Custom fields |
| POST | `/api/encompass-hub/create-fields` | Create custom fields (tool4 JSON payload) |
| POST | `/api/encompass-hub/update-fields` | Update custom fields (tool4 JSON payload for Modify rows) |
| POST | `/api/encompass-hub/automator/parse-field-image` | Parse field-definition rows from image via vision API (`{ imageData }`) |
| POST | `/api/encompass-hub/loan-batch/update-requests` | Proxy to Encompass `POST …/loanBatch/updateRequests` (body: loanIds + loanData or filter + loanData) |
| * | `/api/encompass/*` | Encompass Assistant (search, chat, summary) |
| POST | `/api/webhooks/encompass` | Encompass webhook receiver |
| POST | `/api/reviewer/ai/chat` | The Screen Test AI |
| POST | `/api/unit-tests/files` | Upload unit test Excel to library |
| GET | `/api/unit-tests/files` | List stored unit test files |
| GET | `/api/unit-tests/files/:id` | Download unit test file |
| DELETE | `/api/unit-tests/files/:id` | Delete unit test file from library |
| GET | `/api/unit-tests/search` | Search tests by field ID (query: fieldId) |
| GET | `/api/unit-tests/br-rules/search` | Search saved BR / Tool 8 payloads by field ID |
| GET | `/api/unit-tests/br-rules` | List saved business rules (XML, VB snippet, Tool 8 JSON) |
| POST | `/api/unit-tests/br-rules/file` | Upload `.xml` / `.json` / `.txt` (multipart field `file`) |
| POST | `/api/unit-tests/br-rules` | Save pasted body JSON: `{ sourceFormat, body, originalName? }` — formats: `encompass_br_xml`, `tool8_field_matrix_json`, `encompass_br_vb_snippet` |
| GET | `/api/unit-tests/br-rules/:id` | Get one rule (JSON including `body_text`) |
| DELETE | `/api/unit-tests/br-rules/:id` | Delete saved rule |
| POST | `/api/unit-tests/executions` | Save test execution |
| GET | `/api/unit-tests/executions` | Get executions (by fileName) |
| GET | `/api/unit-tests/executions/all` | All executions |
| DELETE | `/api/unit-tests/executions/:id` | Delete execution |
| * | `/api/unit-tests/ai/*` | Unit tests AI routes |
| POST | `/api/loan-pipeline/generate` | Generate test loans |
| GET | `/api/loan-pipeline/loans` | All loans |
| GET | `/api/loan-pipeline/loans/:id` | Single loan |
| POST | `/api/loan-pipeline/analyze` | Analyze all loans |
| POST | `/api/loan-pipeline/analyze/:id` | Analyze one loan |
| GET | `/api/loan-pipeline/kml` | Download KML |
| GET | `/api/loan-pipeline/stats` | Pipeline stats |
| GET | `/api/loan-pipeline/milestones/:milestone` | Loans by milestone |
| GET | `/api/loan-pipeline/risk-summary` | Risk summary |
| GET | `/api/loan-pipeline/fema-disasters` | FEMA disasters |
| GET | `/api/loan-pipeline/query-fema` | Query FEMA directly |
| GET | `/api/loan-pipeline/flood-zones` | FEMA NFHL flood zones |
| GET | `/api/loan-pipeline/flood-zones-loans` | Loans by flood zone |
| POST | `/api/loan-pipeline/update-flood-zones` | Update flood zones |
| POST | `/api/loan-pipeline/geocode-loans` | Geocode loans |
| POST | `/api/loan-pipeline/regeocode-loans` | Re-geocode loans |
| DELETE | `/api/loan-pipeline/cleanup` | Cleanup test loans |
| POST | `/api/loan-pipeline/ai/chat` | Loan Pipeline AI chat |
| POST | `/api/loan-pipeline/ai/chat-disaster-expert` | Disaster expert chat |
| POST | `/api/loan-pipeline/ai/insights` | Generate insights |
| POST | `/api/loan-pipeline/ai/analyze` | Analyze dashboard |
| GET | `/api/loan-pipeline/ai/history` | Conversation history |

## GSE scenario analyzer (public rules, investor overlays, FHFA sample data)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/gse/products` | Merged Fannie/Freddie/FHA/VA/USDA product catalog from `data/gse/*.json` |
| GET | `/api/gse/sources` | `rule-metadata.json` + overlay catalog metadata (count/version) |
| POST | `/api/gse/analyze-scenario` | Body: non-PII scenario JSON → summary, product fit rows, explanation fields, overlay findings, suggestions |
| POST | `/api/gse/import-loan-json` | Validate + normalize scenario JSON (same shape as analyze); no persistence |
| GET | `/api/gse/loan-limits` | Query `state`, `county`, `units` → bundled FHFA sample limit row |
| POST | `/api/gse/loan-program-expert` | Dedicated GSE AI advisor response (recommendation, verifications, overlay risks, citations) |
| POST | `/api/finance/loan-program-expert` | Shared finance AI advisor endpoint (same contract as `/api/gse/loan-program-expert`) |

### GSE AI endpoint response shape

`POST /api/gse/loan-program-expert` and `/api/finance/loan-program-expert` return:

- `recommendation`: top product recommendation text
- `rationale[]`: explanation bullets
- `requiredVerifications[]`: checklist before lock/final recommendation
- `overlayRisks[]`: investor overlay operations items (investor/title/severity/status/reasons)
- `productsConsidered[]`: top product summaries with next steps
- `citations[]`: source references from `data/gse/rule-metadata.json`
- `sourceDisclaimer`: guide-disclaimer string for compliance context

## Disasters

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/disasters` | List disasters |
| POST | `/api/disasters/refresh` | Refresh all sources |
| POST | `/api/disasters/refresh-cameras` | Refresh cameras |
| GET | `/api/disasters/cameras` | List cameras |
| GET | `/api/disasters/stats` | Stats |
| GET | `/api/disasters/export.csv` | CSV export |

## Chat & AI

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/chat/chat` | Legacy chat |
| POST | `/api/chat/langchain/chat` | LangChain chat (persistent) |
| GET | `/api/chat/langchain/history` | Conversation history |
| DELETE | `/api/chat/langchain/history` | Clear history |
| GET | `/api/chat/langchain/stats` | Conversation stats |
| GET | `/api/chat/greeting` | Greeting |
| POST | `/api/chat/switch-assistant` | Switch assistant |
| GET | `/api/chat/current-assistant` | Current assistant |

## Music, Voice, Other Domains

| Method | Path | Description |
|--------|------|-------------|
| * | `/api/audio/*` | Audio routes |
| * | `/api/voice/*` | Voice (init, start, stop, speak, etc.) |
| * | `/api/music-research/*` | Knowledge graph, Wikipedia, MusicBrainz, etc. |
| * | `/api/album-discovery/*` | Album AI analysis, search |
| * | `/api/spotify/*` | Spotify auth, profile, playlists |
| * | `/api/collection/*` | Collection CRUD |
| POST | `/api/collection/add` | Add album (body: artist, album, … optional `storageZone` + `storageSlot`, or `storageCode` e.g. `C4`) |
| GET | `/api/collection/storage/next-slot` | Next shelf index: query `userId`, `zone` (A–G) → `{ nextSlot }` |
| PATCH | `/api/collection/:id` | Update album (optional `storageZone` + `storageSlot` or `storageCode`; send empty/null both to clear) |
| * | `/api/audio-fingerprint/*` | Song identification |
| * | `/api/sample-detection/*` | Covers, samples |
| * | `/api/tree-discovery/*` | Tree identification |
| * | `/api/tree-collection/*` | Tree collection |
| POST | `/api/critter-discovery/identify-image` | Identify animal from photo (Vision AI) |
| POST | `/api/critter-discovery/critter-info` | Get critter/animal info (body: animalName, optional expert: socal or desert or reptile) |
| POST | `/api/critter-discovery/chat` | Chat with critter expert (body: message, expert: socal or desert or reptile) |
| POST | `/api/critter-collection/add` | Add critter to collection |
| GET | `/api/critter-collection` | List critters (query: userId, sortBy, order, search) |
| GET | `/api/critter-collection/stats` | Critter collection stats |
| PUT | `/api/critter-collection/:id` | Update critter |
| DELETE | `/api/critter-collection/:id` | Delete critter |
| POST | `/api/nature-collection/share` | Share nature collection |
| GET | `/api/nature-collection/share/:id` | Get shared nature collection |
| * | `/api/genealogy/*` | Family data, people, stats |
| * | `/api/grateful-dead/*` | Shows, KML, geocoding |
| * | `/api/concert-collection/*` | Concert collection |
| * | `/api/kml/*` | KML upload, YouTube search |
| * | `/api/poster-generator/*` | Poster generation |
| * | `/api/blacklight/*` | Poster search |
| * | `/api/ouija-board/*` | Ouija board |
| * | `/api/bikes/*` | Bikes CRUD |
| * | `/api/customers/*` | Customers CRUD |
| * | `/api/fish-catches/*` | Fish catches |
| * | `/api/finds/*` | Finds (thrift/flea/vintage): CRUD, `GET /google-api-key` (browser Maps key), `POST /analyze`, `POST /score-preview`, voice note, summary text |

## Route Files

| Route file | Mount path |
|------------|------------|
| `routes/encompass-hub.routes.js` | `/api/encompass-hub` |
| `routes/encompass-assistant.routes.js` | `/api/encompass` |
| `routes/encompass-webhook.routes.js` | `/api/webhooks` |
| `routes/reviewer.routes.js` | `/api/reviewer` |
| `routes/unit-tests.routes.js` | `/api/unit-tests` |
| `routes/nature-collection.routes.js` | `/api/nature-collection` |
| `routes/loan-pipeline.routes.js` | `/api/loan-pipeline` |
| `routes/disasters.routes.js` | `/api/disasters` |
| `routes/finds.routes.js` | `/api/finds` |
| `routes/gse.routes.js` | `/api/gse` |
| `routes/chat.routes.js` | `/api/chat` |
| (others) | See `routes/index.routes.js` |
