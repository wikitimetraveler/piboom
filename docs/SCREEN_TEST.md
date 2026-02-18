# The Screen Test

Form-code-specific AI assistant for Encompass manifest XML and form objects (ICE Mortgage Technology). Analyzes manifest XML for issues: syntax errors, type mismatches, deprecated patterns, and field reference problems.

## Scope

| In scope | Out of scope |
|----------|--------------|
| Manifest XML – CustomFieldList, Field, Option, Calculation, Audit | Business rules (separate logic) |
| Form objects – field IDs, types, calculations, dropdown options | Live Encompass API calls |
| Field references, [#] vs [@], syntax | ICE knowledge index (that’s Encompass Assistant) |

## Important: Encompass Field Access

**Encompass form code can access ALL fields – native and custom.** Do NOT flag "field not in manifest" as an error.

- **Native fields** (e.g. `[19]`, `[4002]`, `[CX.RS.CRITICAL]`) are always available.
- **Custom fields from other packages** (e.g. `CX.RS.ASSETS`, `CX.RS.BORR`) may be referenced; they don’t need to be in this manifest.
- The manifest only lists custom fields *defined in this package*. Calculations may legitimately reference any field on the loan.

Only flag field-reference issues for **typos**, **wrong syntax** ([#] vs [@] misuse), or **invalid format** – never for "not defined in manifest."

## Implementation

| Component | Path |
|-----------|------|
| Controller | `controllers/reviewer-ai.controller.js` |
| Routes | `routes/reviewer.routes.js` |
| UI | `public/finance/tool9.html` |
| Client JS | `public/finance/js/tool9.js` |

**Endpoint:** `POST /api/reviewer/ai/chat`

**Request body:**
- `message` (required) – user question or review request
- `formCode` (optional) – manifest XML or form code to analyze
- `context` (optional) – array of prior messages for conversation history

**Model:** GPT-4o (128K context for large manifests)

## Voice Commands

- "Open screen test"
- "Open the screen test"
- "Check for issues"

## What the AI Looks For

1. **Calculation issues** – syntax errors, circular dependencies, deprecated functions
2. **Field reference issues** – typos, [#] vs [@] misuse, invalid format (NOT "field not in manifest")
3. **Type mismatches** – field type vs usage (e.g. DROPDOWN with numeric calculation)
4. **Deprecated patterns** – old APIs, obsolete field IDs
5. **Inconsistencies** – naming, duplicate logic, orphaned fields
6. **Option/Calculation conflicts** – DROPDOWN with both static Option and dynamic Calculation

## Environment

Requires `OPENAI_API_KEY` in `.env`. Returns 503 if missing.

## Related

- **docs/AI_SYSTEM.md** – AI architecture
- **docs/ENCOMPASS.md** – Encompass integration
- **docs/ICE_KNOWLEDGE_SOURCES.md** – Screen Test does *not* use the ICE knowledge index; it analyzes manifest XML directly.
