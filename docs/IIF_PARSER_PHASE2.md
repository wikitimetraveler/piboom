# Phase 2: IIf Parser — IsDate/DateDiff/Contains + Pre-fill Values

## Goal

1. **Parse IsDate, DateDiff, Contains** in IIf conditions for scenario logic and value extraction.
2. **Pre-fill suggested values** in SET/GET/COMPARE cells based on extracted conditions.

---

## Part A: Parsing IsDate, DateDiff, Contains

### Patterns from manifest.xml

| Pattern | Example | Purpose |
|---------|---------|---------|
| `IsDate([field])` | `Not IsDate([CX.DISASTER.DATE])` | True if field is valid date |
| `DateDiff("d", [@field1], [@field2]) > N` | `DateDiff("d", [@CX.DISASTER.DATE], [@3142]) > 90` | Days between two date fields |
| `[field].Contains("literal")` | `[19].Contains("Refi")` | String contains substring |
| `[field].StartsWith("literal")` | `[CX.TYPE].StartsWith("Conv")` | String starts with substring |

### Implementation

**1. Add `extractConditionValues(conditionString)`** — extend or complement `extractComparisonValues`:

- **IsDate:** `IsDate\(\[([^\]]+)\]\)` → `{ type: 'isDate', fieldId, negated?: boolean }`
- **DateDiff:** `DateDiff\s*\(\s*"d"\s*,\s*\[([^\]]+)\]\s*,\s*\[([^\]]+)\]\s*\)\s*(<=|>=|<>|<|>|=)\s*(-?\d+)` → `{ type: 'dateDiff', field1, field2, op, value }`
- **Contains:** `\[([^\]]+)\]\.Contains\s*\(\s*"([^"]*)"\s*\)` → `{ type: 'contains', fieldId, substring }`

Return a unified array of condition parts for scenario descriptions and suggested values.

**2. Suggested value logic per type:**

| Type | Condition | Suggested value (true branch) |
|------|-----------|-------------------------------|
| `isDate` | `IsDate([x])` | Valid date, e.g. `01/15/2025` |
| `isDate` | `Not IsDate([x])` | Empty or invalid string |
| `dateDiff` | `DateDiff(...) > 90` | Two dates 91+ days apart |
| `dateDiff` | `DateDiff(...) <= 90` | Two dates within 90 days |
| `contains` | `[19].Contains("Refi")` | `"Refi"` or string containing it |

---

## Part B: Pre-filling Suggested Values

### Flow

1. For each scenario, call `getSuggestedValuesForScenario(scenario, inputFields)`.
2. Use `extractComparisonValues` + `extractConditionValues` to build `Record<fieldId, suggestedValue>`.
3. Pre-fill SET row cells: `row['Test ' + (idx+1)] = suggested[fieldId] ?? ''`.
4. For COMPARE: if `result` is single field ref `[x]`, suggest same as that field's SET value; else leave blank.

### Add `getSuggestedValuesForScenario(scenario, allInputFields)`

- Input: `{ condition, result, isElse }` and list of input field IDs.
- Return `Record<fieldId, suggestedValue>`.

---

## Suggested Value Rules (Conservative)

- **Numeric `<= N`:** `Math.min(100, N - 1)` or `N / 2` if N small.
- **Numeric `> 0`:** `1`.
- **Numeric `>= N`:** `N`.
- **IsDate (positive):** `"01/15/2025"` (fixed placeholder).
- **IsDate (Not):** `""` or `"invalid"`.
- **Contains("X"):** `"X"` or `"prefix X suffix"`.
- **DateDiff > 90:** field1 = `"01/01/2025"`, field2 = `"04/15/2025"` (105 days).

---

## Files to Modify

| File | Changes |
|------|---------|
| [public/shared/customFieldCalcParser.js](public/shared/customFieldCalcParser.js) | Add `extractConditionValues`, `getSuggestedValuesForScenario`; extend `generateUnitTestFromCustomField` to pre-fill cells |

---

## Part C: Nothing and Y/N Handling

### Nothing (VB null)

- **`[field] = Nothing`** → `{ type: 'nothing', fieldId, negated: false }` — suggested value: blank.
- **`[field] <> Nothing`** → `{ type: 'nothing', fieldId, negated: true }` — suggested value: `"Y"`.
- `null`, `NULL`, `Nothing` are treated as blank in `isBlankForTest` and `coerce`.

### Y/N cycling

- **`[field] = "Y"`** — suggested values cycle across scenarios: Y, N, blank.
- **`[field] = "N"`** — suggested values cycle: N, Y, blank.

---

## Part D: Concatenated IIf (`&`)

Formulas like `IIf(A,"x","") & IIf(B,"y","") & IIf(C,"z","")` are supported:

- **`splitByTopLevelAmpersand(expression)`** — splits by `&` at depth 0 only (ignores `&` inside parens/quotes).
- **`parseAllIIfScenarios(expression)`** — splits, parses each IIf block with `parseIIfScenarios`, merges scenarios.
- **`generateUnitTestFromCustomField`** uses `parseAllIIfScenarios` so concatenated formulas produce scenarios from all IIf blocks.

---

## Edge Cases

- **OrElse / AndAlso:** Use first matching pattern per field; if conflicting, prefer the one that suggests a value.
- **Result is expression:** e.g. `[#CX.CASHOUT.AMOUNT] - [#CX.CASHOUT.ALLOWED]` — leave COMPARE blank.
- **Result is single field:** e.g. `[#1415#1]` — COMPARE suggested = same as SET for that field.

---

## Part E: Special Fields

Special fields with known value sets get improved suggestions:

| Field | Example values | Notes |
|-------|----------------|-------|
| `CX.SUNRISE` | Date strings | Sunrise/sunset date field |
| `CX.APPRAISAL.TYPE` | Appraisal type codes | e.g. 2055, 1004, etc. |
| `CX.TYPE` | `"Conv"`, `"FHA"`, `"VA"`, etc. | Loan type; `StartsWith("Conv")` → suggest `"Conv"` or `"Conventional"` |

---

## Part F: Else-Scenario N/Blank

For else branches (when condition is false), suggest N or blank for Y/N fields:

- **`collectYNAndNothingFieldsFromScenarios(allScenarios)`** — gathers fields that use Y/N or Nothing in any scenario.
- **`getSuggestedValuesForScenario`** — when `isElse` is true, suggests N or blank for those fields when no other condition applies.
