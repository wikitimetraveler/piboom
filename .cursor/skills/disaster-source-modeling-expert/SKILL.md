---
name: disaster-source-modeling-expert
description: Designs, reviews, and evaluates candidate disaster-source data workflows across ingest, normalization, quality scoring, and output delivery. Use when prompts mention disaster sources, hazard feeds, or potential new providers such as FEMA, NOAA, NASA, or USGS.
---

# Disaster Source Modeling Expert

## Purpose

Use this skill to build, review, or evaluate candidate disaster-source pipelines with reliable source quality checks and clear implementation guidance.

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

## Review Workflow

Use this when evaluating existing code or data models.

1. Check source assumptions
   - Hard-coded source behavior without validation
   - Missing retries/backoff or timeout handling
2. Check schema correctness
   - Ambiguous IDs or missing provenance
   - Timezone/geo normalization gaps
3. Check scoring behavior
   - Scores without documented thresholds
   - Freshness/reliability logic not aligned with source cadence
4. Check operational safety
   - No guardrails for stale feeds
   - Silent failures or weak error surfacing

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
- [ ] Implement or verify quality scoring rules
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
- When data is missing or external access is unavailable, report a blocker clearly and propose the smallest next step.
