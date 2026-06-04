# Unified Disasters — HeyGen Video Script (Database + Graph)

**Target:** Unified Disasters (`/finance/disasters-unified.html`) and disaster data model  
**Duration:** 2–3 minutes  
**Format:** HeyGen avatar + screen capture  
**Technical reference:** [UNIFIED_DISASTERS_DB_SCHEMA.md](UNIFIED_DISASTERS_DB_SCHEMA.md), [DISASTER_RISK.md](DISASTER_RISK.md)

---

## Paste into HeyGen / teleprompter (spoken-speed cut, ~2 min)

> "This is **Unified Disasters**—one screen for FEMA declarations, wildfires, earthquakes, hurricanes, and weather alerts, plus the loans and hazard webcams around them.
>
> Under the hood there is **no separate Unified Disasters table**. Everything lives in shared Postgres: **`disasters`** for rolling events, **`fire_cameras`** for fixed webcam mounts, and **`loans`** for pipeline properties with risk scores and flood data.
>
> **`disasters`** is one row per event—source, event type, county FIPS, start time, coordinates, and the raw JSON from FEMA, FIRMS, USGS, NWS, or NHC. We keep about **ninety days** and refresh daily with `npm run refresh-disasters`.
>
> **`fire_cameras`** is different—those are **stable mounts**, not events. ALERTCalifornia, USGS river and volcano cams, FAA weather cams, coastal WebCOOS—each row has lat, lng, hazard tags, and snapshot URLs. That catalog is its own ingest: `refresh:hazard-webcams`.
>
> When you pick a disaster on the map, **`GET /api/disasters/near`** asks: what loans and cameras are within this radius? With **PostGIS**, that is `ST_DWithin` on geography points. Without PostGIS, we fall back to Haversine—the same API shape either way.
>
> We also run a second model—the **impact graph**. **`graph_nodes`** and **`graph_edges`** are derived: county, disaster, zip, loan, milestone, processor. Edges like **HAS_DECLARATION**, **CONTAINS**, and **NEAR**—where **NEAR** comes from the same spatial join at seed time. A recursive SQL walk answers: which loans are reachable from this disaster, not just how many miles away?
>
> **Unified Disasters** uses the **spatial** path live. The **graph** is for relationship analytics and the prototype impact-graph page—it reseeds when you rebuild it.
>
> Full schema reference is in **`docs/UNIFIED_DISASTERS_DB_SCHEMA.md`**—DDL, indexes, and sample SQL to count rows by source."

---

## Scene list (screen + B-roll)

### Intro (0:00–0:20)

**Narration:**  
> "Here is how **Unified Disasters** maps to our Postgres schema."

**On-screen:**  
- Open `/finance/disasters-unified.html`  
- Brief pan: source command deck, AG Grid, selection banner  

**Screenshot:** `disaster-video/01-unified-disasters-overview.png`

---

### Scene 1: Fact tables — `disasters` (0:20–0:50)

**Narration:**  
> "Events land in **`disasters`**: county FIPS, source, event type, title, lat and lng, and a unique key on county, source, source id, and start time so we do not duplicate feeds."

**On-screen:**  
- Grid filtered by source (FEMA, firms, usgs)  
- Optional: `docs/UNIFIED_DISASTERS_DB_SCHEMA.md` — section 1 table  
- Optional B-roll: `services/disasters.service.js` `CREATE TABLE disasters`  

**Screenshot:** `disaster-video/02-disasters-grid-by-source.png`

---

### Scene 2: `fire_cameras` — not in `disasters` (0:50–1:10)

**Narration:**  
> "Webcams are **`fire_cameras`**—fixed locations with hazard types like fire, flood, or coastal. They are ingested separately and show up in nearby camera lists and KML export, not as disaster event rows."

**On-screen:**  
- Open `/finance/disasters-webcams.html` or nearby cameras on unified page after selecting an event  
- Show camera card with source badge  

**Screenshot:** `disaster-video/03-nearby-hazard-webcams.png`

---

### Scene 3: Spatial model — `/near` (1:10–1:40)

**Narration:**  
> "Select a disaster. The UI calls **`/api/disasters/near`** with lat, lng, and radius—disasters, loans, and cameras together, each with distance in miles when we have coordinates."

**On-screen:**  
- Click grid row → nearby loans list + webcams  
- Optional DevTools: Network tab `GET /api/disasters/near?...`  
- Optional: `docs/DISASTER_RISK.md` PostGIS bullet  

**Screenshot:** `disaster-video/04-selected-disaster-nearby-loans.png`

---

### Scene 4: Graph approach (1:40–2:20)

**Narration:**  
> "The **impact graph** adds **`graph_nodes`** and **`graph_edges`**. Think: county to disaster to zip to loan to milestone to processor—plus direct **NEAR** edges from PostGIS when we seed. Traversal is recursive SQL, not pgRouting. The prototype page is **`disaster-impact-graph.html`**; APIs like **`/api/disaster-impact-graph/disaster/:id/loans`**."

**On-screen:**  
- Open `/disaster-impact-graph.html`  
- Show impacted loans table for a disaster id  
- Optional: `docs/UNIFIED_DISASTERS_DB_SCHEMA.md` — Graph approach section  
- Optional diagram: exported PNG of county → disaster → loan chain  

**Screenshot:** `disaster-video/05-impact-graph-loans-by-disaster.png`

---

### Outro (2:20–2:40)

**Narration:**  
> "Operational truth for maps and AI: **`disasters`**, **`loans`**, PostGIS **near**. For why a loan ties to an event through county or processor paths, use the **graph**. Schema doc and SQL snippets are in the repo under **UNIFIED_DISASTERS_DB_SCHEMA**."

**On-screen:**  
- `docs/UNIFIED_DISASTERS_DB_SCHEMA.md` — Quick SQL section  

---

## On-screen checklist (producer)

| # | URL / asset | Action |
|---|-------------|--------|
| 1 | `/finance/disasters-unified.html` | Grid + source pills |
| 2 | Same | Select row → nearby loans |
| 3 | `/finance/disasters-webcams.html` | Camera catalog |
| 4 | `/disaster-impact-graph.html` | Disaster → loans query |
| 5 | `docs/UNIFIED_DISASTERS_DB_SCHEMA.md` | Schema tables (B-roll) |

---

## Hosted MP4 (Unified Disasters UI)

- **File:** `public/finance/assets/unified-disasters-db-graph-walkthrough.mp4`
- **URL:** `/finance/assets/unified-disasters-db-graph-walkthrough.mp4`
- **Embed + download:** bottom sheet **Data model & graph** on `/finance/disasters-unified.html`

---

## Related

- [UNIFIED_DISASTERS_DB_SCHEMA.md](UNIFIED_DISASTERS_DB_SCHEMA.md) — full schema + graph approach
- [DISASTER_RISK.md](DISASTER_RISK.md) — APIs, ingest, UI
- [CALCULATION_ENGINE_VIDEO_SCRIPT.md](CALCULATION_ENGINE_VIDEO_SCRIPT.md) — same HeyGen format
- `services/disasters.service.js`, `services/disaster-impact-graph.service.js`, `services/disaster-spatial.service.js`
