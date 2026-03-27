# API Routes Index

All API routes are mounted under `/api`. Base URL examples assume `http://localhost:3000` or your `RENDER_EXTERNAL_URL`.

## Worksheets & Encompass

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/encompass-hub/status` | Hub connection status |
| GET | `/api/encompass-hub/users` | Company users |
| GET | `/api/encompass-hub/pipeline` | Loan pipeline |
| GET | `/api/encompass-hub/loans/:loanGuid` | Loan details |
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
| POST | `/api/encompass-hub/loan-batch/update-requests` | Proxy to Encompass `POST …/loanBatch/updateRequests` (body: loanIds + loanData or filter + loanData) |
| * | `/api/encompass/*` | Encompass Assistant (search, chat, summary) |
| POST | `/api/webhooks/encompass` | Encompass webhook receiver |
| POST | `/api/reviewer/ai/chat` | The Screen Test AI |
| POST | `/api/unit-tests/files` | Upload unit test Excel to library |
| GET | `/api/unit-tests/files` | List stored unit test files |
| GET | `/api/unit-tests/files/:id` | Download unit test file |
| DELETE | `/api/unit-tests/files/:id` | Delete unit test file from library |
| GET | `/api/unit-tests/search` | Search tests by field ID (query: fieldId) |
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
| `routes/chat.routes.js` | `/api/chat` |
| (others) | See `routes/index.routes.js` |
