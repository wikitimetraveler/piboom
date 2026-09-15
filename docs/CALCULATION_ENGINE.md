# Calculation Engine

Reusable calculator framework for mortgage and finance calculations. Use this when building or modifying DTI, FHA, asset qualifier, closing cost, or other financial forms that need to map to Encompass field IDs.

## Overview

| File | Purpose |
|------|---------|
| `public/shared/calcEngineLibrary.js` | Pure calculation helpers (no DOM). Attaches to global `calcMath`. |
| `public/shared/calculationEngine.js` | DAG-lite framework: binds inputs → outputs with debouncing and cascade propagation. |

**Usage order:** Include `calcEngineLibrary.js` *before* `calculationEngine.js` so `calcMath` is available.

## Factory Functions

### DTI Calculator

```javascript
const config = createDTICalculatorConfig({
  prefix: 'dti',           // optional, default 'dti'
  customIds: {             // optional – map to Encompass field IDs
    annualIncome: 'CX.RS.INCOME',
    grossMonthly: 'CX.RS.GROSS_MONTHLY',
    principalInterest: '4002',
    // ... see full list in calculationEngine.js
  }
});
```

**customIds** keys: `annualIncome`, `monthlyIncomeCalc`, `grossMonthly`, `principalInterest`, `propertyTaxes`, `hazardInsurance`, `mortgageInsurance`, `hoa`, `totalHousing`, `frontEnd`, `autoLoan`, `creditCards`, `studentLoans`, `personalLoans`, `otherDebts`, `totalDebts`, `totalMonthlyPayment`, `backEnd`, `minIncomeNeeded`.

### FHA Calculator

Live worksheet: **`/finance/fha-streamline-loan-amount-calculator.html`** (uses `createFHACalculatorConfig()` + DAG-lite). HeyGen script: [CALCULATION_ENGINE_VIDEO_SCRIPT.md](CALCULATION_ENGINE_VIDEO_SCRIPT.md).

WebGPU demo (new page, not a worksheet replacement): **`/finance/calc-engine-webgpu.html`**. CPU `calcMath` still computes live values. WebGPU paints the FHA DAG and runs an **integer-cent** kernel as a verifier. Default GPU `f32` cannot safely round FHA-scale cents; this is **not** a speed-up (11 sequential cells vs dispatch + readback). Helpers: `dollarsToCents`, `centsToDollars`, `fhaLoanAmountIntegerCents`, `multiplyPercentageF32`. Optional engine hook: `onCellComputed`.

```javascript
const config = createFHACalculatorConfig({
  prefix: 'fs',
  customIds: { g12: 'CX.FHA.G12', g13: 'CX.FHA.G13', /* ... */ }
});
```

**customIds** keys: `g12`, `g13`, `g14`, `g15`, `g18`, `g9`, `g19`, `g20`, `g8`, `g22`, `g24`, `g28`, `d29`, `e29`, `g29`, `g30`, `g7`, `g33`.

### Asset Qualifier

```javascript
const config = createAssetQualifierConfig({
  prefix: 'aq',
  customIds: {
    liquidAssets: 'CX.RS.LIQUID',
    retirementAssets: 'CX.RS.RETIREMENT',
    // ...
  }
});
```

**customIds** keys: `cat1Factor`, `liquidAssets`, `cat1Eligible`, `cat2Factor`, `otherAssets`, `cat2Eligible`, `dob`, `retFactor`, `retirementAssets`, `retEligible`, `totalEligibleAssets`, `reserveMonths`, `monthlyPayment`, `requiredReserves`, `minAssetsResult`, `netEligibleAssets`, `supportablePayment`, `nonBorrowerAssets`, `hist12mo`, `messages`.

## calcMath Functions (calcEngineLibrary.js)

| Function | Description |
|----------|-------------|
| `sumRounded` | Sum of inputs, rounded to 2 decimals |
| `subtractRounded` | First value minus second, rounded |
| `copyValue` | Copy first value, rounded |
| `minRoundDown` | Min of inputs, floor |
| `roundDown` | Floor of first value |
| `multiplyPercentage` | base × (pct/100) |
| `divideRounded` | a/b, rounded |
| `annualToMonthly` | annual / 12 |
| `calculateDTI` | (payment / income) × 100. Uses `ctx.additionalData.grossMonthly` if set. |
| `calculateMinIncome` | totalPayment / 0.43 |
| `ageBasedRetFactor` | 1.0 if age > 56.9, else 0.7 (from DOB) |
| `multiplyRounded` | a × b, rounded |
| `minAssetsPass` | PASS if liquid+other+retirement-required ≥ 500000, else FAIL |
| `supportablePaymentRounded` | netAssets × factor (formula in source) |
| `messagesC31C32` | Asset qualifier guidance messages |
| `dollarsToCents` / `centsToDollars` | Integer-cent conversion (exact money path) |
| `fhaLoanAmountIntegerCents` | FHA loan-amount DAG in cents + G33 hundredths |
| `multiplyPercentageF32` | f32 stand-in for UFMIP; documents cent drift |

## DAG-Lite (Cascading Dependencies)

The engine supports **DAG-lite**: when a result field is used as an input to another group, changes propagate automatically. Configure:

- `enableDagLite: true`
- `maxCascadeDepth: 25`
- `enableReentryGuard: true` – prevents re-entrant computation during cascade

## Encompass Field Mapping

Pass `customIds` with Encompass field IDs (native `[4002]` or custom `CX.RS.X`) so the engine reads/writes the correct elements. The engine expects `document.getElementById(id)` – ensure your form elements use these IDs.

## Related

- **AGENTS.md** – Conventions: use calculationEngine + customIds
- **docs/ENCOMPASS.md** – Encompass integration
- **docs/CALCULATION_ENGINE_VIDEO_SCRIPT.md** – HeyGen / teleprompter script (DAG-lite explainer)
- **WebGPU DAG demo** – `/finance/calc-engine-webgpu.html` (paint + integer-cent verifier)
- **Encompass Assistant** – Knows calc methods (sumRounded, calculateDTI, etc.) for Q&A
