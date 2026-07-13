---
name: disaster-source-modeling-expert
description: Designs, reviews, and evaluates candidate disaster-source data workflows across ingest, normalization, quality scoring, and output delivery. Use when prompts mention disaster sources, hazard feeds, or potential new providers such as FEMA, NOAA, NASA, or USGS.
---

# Disaster Source Modeling Expert

## Purpose

Use this skill to build, review, or evaluate candidate disaster-source pipelines with reliable source quality checks and clear implementation guidance.

**Repo companion:** `.cursor/agents/disaster-expert.md` (product/ops owner). Docs: `docs/DISASTER_RISK.md`, `docs/UNIFIED_DISASTERS_DB_SCHEMA.md`.

## Quick Start

1. Identify the user goal:
   - New modeling/design request
   - Review/debug request
   - Candidate source evaluation request
2. Inventory the source set (example: FEMA, NOAA, NASA, USGS).
3. Define or verify the pipeline stages:
   - Ingest
   - Normalize
   - Score quality/freshness
   - Publish/output
4. Produce:
   - A working checklist while implementing
   - A final structured report

## DevConnect Labs invariants (non-negotiable)

Encode these in designs, reviews, UI copy, and AI prompts:

| Concern | Rule |
|---------|------|
| **Ops triage vs probability** | `loans.disaster_risk_score` / `calculateRiskScore` is an **ops triage** ranking (FEMA declarations ± distance×recency + `FLOOD_ZONE_TRIAGE_WEIGHTS`). It is **not** \(P(\text{loss})\) and must not be labeled as a probability in docs/UI/scripts. |
| **Two proximity channels** | **Live:** `GET /api/disasters/near` (PostGIS `ST_DWithin` or Haversine) = operational truth. **Graph:** `NEAR` edges from `seedNearSpatialEdges` are persisted, per-disaster nearest-N (default 25), with `metadata_json.seeded_at`. Never equate them without that freshness stamp. |
| **Multi-hazard channel** | FIRMS / USGS / NWS / NHC stay on Unified Disasters + `/near`. Do **not** fold them into the loan ops triage score unless the product explicitly asks for a new fused model. |
| **Flood weights** | Use the explicit zone→weight table (`floodZoneTriageWeight` / `FLOOD_ZONE_TRIAGE_WEIGHTS`). Do not reintroduce substring heuristics (`includes('V')`, etc.). |
| **Coordinates** | Use `Number.isFinite` (and reject null/`''` before `Number()`). Do not treat `0` as missing (equator / prime meridian). |
| **FIRMS clustering** | `clusterFirmsDetectionsByDistance` — union-find **single-linkage**, order-independent membership, centroids per component. Document chaining (diameter can exceed \(2r\)). Quality gates remain precision-oriented. |
| **Graph path confidence** | Heuristic link strength. Multiply with `COALESCE(e.confidence, 0.5)` — do **not** remap explicit `0` → `0.5` via `NULLIF`. |
| **Webcam cadence** | `fire_cameras` ingest stays off the daily disaster refresh job. |

### Key implementation paths

| Area | Path / symbol |
|------|----------------|
| Event ingest + FIRMS QA/cluster | `services/disasters.service.js` |
| Ops triage score | `services/disaster-risk.service.js` (`calculateRiskScore`, `floodZoneTriageWeight`, …) |
| Live proximity | `services/disaster-spatial.service.js` |
| Graph NEAR seed | `services/disaster-impact-graph.service.js` (`seedNearSpatialEdges`) |
| Tests | `tests/unit/disaster-risk-score.test.js`, `disasters-firms-quality.test.js`, `disaster-impact-graph-spatial.test.js` |

## Modeling Workflow

Use this sequence for new or updated pipelines.

1. Define source contracts
   - Source name, endpoint/file pattern, update cadence
   - Required fields and optional fields
   - Rate limits, auth, and failure behavior
2. Define canonical schema
   - Stable IDs
   - Event type taxonomy
   - Geo/time normalization
   - Confidence and provenance fields
3. Define quality scoring
   - Freshness score (based on source cadence + observed lag)
   - Completeness score (required field coverage)
   - Consistency score (cross-field validation)
   - Reliability score (historical success + provider trust tier)
4. Define output model
   - Consumer-facing schema
   - Sort/priority rules
   - Conflict resolution across sources
   - Which channel consumes the source: events table, `/near`, ops triage, graph only, or AI context

## Review Workflow

Use this when evaluating existing code or data models.

1. Check source assumptions
   - Hard-coded source behavior without validation
   - Missing retries/backoff or timeout handling
   - Silent empty success vs hard fail on provider outages
2. Check schema correctness
   - Ambiguous IDs or missing provenance
   - Timezone/geo normalization gaps
   - Event upsert `ON CONFLICT DO NOTHING` (no refresh of mutated fields)
3. Check scoring behavior
   - Scores without documented thresholds
   - Freshness/reliability logic not aligned with source cadence
   - Loan score mislabeled as probability
   - Flood substring rules instead of zone table
   - Live `/near` confused with graph `NEAR` without `seeded_at`
4. Check spatial / clustering correctness
   - Falsy coordinate guards (`!lat`) that drop valid `0`
   - FIRMS seed-first greedy clustering (should be union-find)
   - Global-only NEAR edge caps that starve sparse regions
5. Check operational safety
   - No guardrails for stale feeds
   - Webcam bulk ingest accidentally on daily schedule

## Candidate Source Evaluation Workflow

Use this when assessing a possible new disaster source before integration.

1. Validate provider fit
   - Geographic coverage and hazard categories match product needs
   - Licensing/terms permit operational use and storage
2. Validate data contract quality
   - Stable identifiers and deterministic update behavior
   - Required fields available for canonical mapping
3. Validate operational reliability
   - Documented cadence, rate limits, and outage behavior
   - Measured response reliability (or clearly noted unknowns)
4. Validate integration cost and value
   - Estimated implementation complexity (low/medium/high)
   - Expected quality uplift versus existing source set
   - Target channel: events / cameras / triage / graph / AI-only
5. Apply weighted rubric and thresholds
   - Score all categories from 1-5
   - Compute weighted overall score
   - Apply hard-gate checks before final recommendation
6. Produce recommendation
   - `Adopt`, `Pilot`, or `Reject`
   - Include rationale and smallest next step

## Weighted Scoring Rubric

Use this rubric for candidate source decisions.

### Categories and scoring anchors (1-5)

- `Coverage_fit`
  - 1: Minimal geographic/hazard relevance
  - 3: Partial coverage for important use cases
  - 5: Strong coverage aligned to primary product needs
- `Data_quality_and_schema_mappability`
  - 1: Many missing/ambiguous required fields
  - 3: Core fields present with moderate mapping effort
  - 5: High-quality structured fields with straightforward mapping
- `Freshness_and_cadence`
  - 1: Infrequent or unpredictable updates
  - 3: Useful cadence with occasional lag
  - 5: Reliable, near-target cadence with low lag
- `Reliability_and_operability`
  - 1: Frequent outages/timeouts, weak operational guarantees
  - 3: Acceptable reliability with manageable incidents
  - 5: Strong uptime behavior and robust operational characteristics
- `Access_and_cost`
  - 1: High access friction or prohibitive cost
  - 3: Moderate complexity/cost tradeoff
  - 5: Low-friction access and favorable cost profile
- `Licensing_and_terms`
  - 1: Restrictive terms that block intended usage
  - 3: Usable with notable constraints
  - 5: Clear terms supporting operational storage and redistribution needs

### Default weights

- `Coverage_fit`: 0.20
- `Data_quality_and_schema_mappability`: 0.20
- `Freshness_and_cadence`: 0.15
- `Reliability_and_operability`: 0.20
- `Access_and_cost`: 0.10
- `Licensing_and_terms`: 0.15

### Formula and unknown handling

- Compute:
  - `overall_score = sum(category_score * weight)`
- If a category is unknown:
  - Mark it explicitly as `unknown`
  - Use a conservative temporary score of 2 for initial decisioning
  - Add a follow-up action to replace unknowns with measured values

### Decision thresholds and hard gates

- Hard gate:
  - If `Licensing_and_terms <= 2`, recommendation cannot be `Adopt`
- Thresholds:
  - `Adopt`: `overall_score >= 4.0` and no hard-gate violation
  - `Pilot`: `overall_score` from 3.0 to 3.99, or hard-gate violation with otherwise strong signal
  - `Reject`: `overall_score < 3.0`

### Worked example

- Candidate provider scores:
  - `Coverage_fit`: 5
  - `Data_quality_and_schema_mappability`: 4
  - `Freshness_and_cadence`: 4
  - `Reliability_and_operability`: 3
  - `Access_and_cost`: 4
  - `Licensing_and_terms`: 5
- Computed score:
  - `overall_score = (5*0.20) + (4*0.20) + (4*0.15) + (3*0.20) + (4*0.10) + (5*0.15) = 4.15`
- Decision:
  - `Adopt` (score meets threshold and no hard-gate violation)

## Working Checklist Template

Copy and update this checklist during execution:

```markdown
Task Progress:
- [ ] Confirm source inventory and contracts
- [ ] Evaluate candidate source fit (coverage, licensing, fields)
- [ ] Validate canonical schema (IDs, geo, time, provenance)
- [ ] Score candidate with weighted rubric and compute overall score
- [ ] Assign output channel (events /near / triage / graph / AI)
- [ ] Implement or verify quality scoring rules
- [ ] Verify ops-triage vs probability labeling
- [ ] Verify live /near vs graph NEAR + seeded_at
- [ ] Add/verify stale-source and failure guardrails
- [ ] Validate output mapping and conflict resolution
- [ ] Decide recommendation (Adopt, Pilot, Reject)
- [ ] Produce final report
```

## Final Report Template

Return this structure at completion:

```markdown
## Summary
- [1-3 bullets on what was modeled/reviewed]

## Findings
- [Key issue or decision]
- [Key issue or decision]

## Source Decision
- Recommendation: [Adopt | Pilot | Reject]
- Rationale: [Why this decision was made]

## Rubric Summary
- Category scores: [Coverage, Quality/Mappability, Freshness, Reliability, Access/Cost, Licensing]
- Weighted overall score: [0.00 to 5.00]
- Hard gates triggered: [None | list]

## Channel mapping
- Events / /near / ops triage / graph / AI: [which apply]

## Risks
- [Data freshness, reliability, schema, or operational risks]

## Recommendations
1. [Most important next action]
2. [Second action]

## Next Steps
- [Concrete follow-up task]
```

## Guardrails

- Prefer smallest safe changes that keep behavior stable.
- Keep controllers thin and place business logic in services.
- Do not add speculative sources or undocumented assumptions.
- Do not introduce React or parallel disaster math libraries.
- When data is missing or external access is unavailable, report a blocker clearly and propose the smallest next step.
