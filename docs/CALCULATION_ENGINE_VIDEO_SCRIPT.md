# Calculation Engine — HeyGen Video Script (DAG-lite + FHA Streamline)

**Target:** FHA Streamline Loan Amount Worksheet (`/finance/fha-streamline-loan-amount-calculator.html`)  
**Duration:** 2–3 minutes  
**Format:** HeyGen avatar + screen capture  
**Technical reference:** [CALCULATION_ENGINE.md](CALCULATION_ENGINE.md), `public/shared/calculationEngine.js`, `public/shared/calcEngineLibrary.js`, `public/finance/fha-streamline-loan-amount-calculator.html`

---

## Paste into HeyGen / teleprompter (spoken-speed cut, ~2 min)

> "This is our **FHA Streamline Loan Amount** worksheet—the same Excel-style chain HUD processors know, but wired through one shared **Calculations Engine** with **DAG-lite**.
>
> Watch the **Additional Amounts** section. Interest due, escrow, and MIP are separate inputs. When you change any of them, **G15** sums G12 through G14, that total flows to **G18**, then with the principal balance you get **G20**, and **DAG-lite** keeps walking—**G24** is the minimum loan amount, then **G28**, UFMIP on **E29** and **G29**, and finally **G30**, total loan amount. One keystroke, many dependent cells—without hand-wiring every listener.
>
> **DAG-lite** means directed acyclic graph, lite. On load, `createFHACalculatorConfig()` registers each formula group. The engine builds a reverse map: when field G15 changes, which results must refresh? After **calcMath** runs `sumRounded` or `minRoundDown`, propagation follows only those edges, with a depth cap and cycle guard so we never spin.
>
> Change the **UFMIP factor** on D29 and the same cascade hits E29, G29, and G30. Change base amount G7 and the **LTV ratio G33** updates too. Pure math lives in **calcEngineLibrary.js**; bindings and debouncing live in **calculationEngine.js**.
>
> For Encompass, pass **customIds**—for example mapping G9 to **CX.FHA.SL.PRINCIPAL.BALANCE**—so the same engine drives your custom form fields.
>
> So yes, we use graph thinking here—but practically it's **DAG-lite** on the FHA Streamline worksheet: spreadsheet logic, safe for embedded forms."

---

## Scene list (screen + B-roll)

### Intro (0:00–0:25)

**Narration:**
> "Here's how **DAG-lite** powers our **FHA Streamline Loan Amount** calculator."

**On-screen:**
- Open **`/finance/fha-streamline-loan-amount-calculator.html`**
- Show title **FHA Streamline Loan Amount Worksheet** and calculator pills (FHA Streamline / FHA Loan Amount / FHA NTB)

**Screenshot:** `calc-engine-video/01-fha-streamline-loan-amount-overview.png`

---

### Scene 1: The worksheet chain (0:25–0:55)

**Narration:**
> "FHA Streamline math is a chain: additional amounts sum to G15, adjust against the mortgage balance, take the minimum with max loan G8—that's G24—and roll UFMIP into the total on G30."

**On-screen:**
- Scroll **Additional Amounts** → **Loan Amount Calculation** → **Final Loan Amount**
- Optional slide: `G12+G13+G14 → G15 → G18 → G20 → G24 → G28 / E29 / G29 → G30`

**Demo values (suggested):**

| Field | Label | Example |
|-------|--------|---------|
| `fs_g9` | Current mortgage balance | 220000 |
| `fs_g12` | Additional amount 1 (interest) | 500 |
| `fs_g13` | Additional amount 2 (escrow) | 1500 |
| `fs_g14` | Additional amount 3 (MIP) | 222 |
| `fs_g8` | Maximum loan amount | 275000 |
| `fs_g7` | Base amount (for LTV) | 250000 |
| `fs_d29` | UFMIP factor % | 1.75 |

**Screenshot:** `calc-engine-video/02-fha-additional-amounts-filled.png`

---

### Scene 2: DAG-lite in action (0:55–1:35)

**Narration:**
> "Edit G12, G13, or G14 and watch G15 through G24 update in order—that's **DAG-lite** propagation, not ten separate change handlers."

**Actions:**
1. Change **`fs_g12`** (interest due) — highlight **`fs_g15`**, **`fs_g18`**, **`fs_g20`**, **`fs_g24`** updating
2. Change **`fs_d29`** (UFMIP %) — highlight **`fs_e29`**, **`fs_g29`**, **`fs_g30`**
3. Optional DevTools: brief scroll to `dependentsByInputId` in `calculationEngine.js`

**On-screen (code, optional B-roll):**
- `createFHACalculatorConfig()` groups in `public/shared/calculationEngine.js` (lines ~318–331)
- `docs/CALCULATION_ENGINE.md` — **DAG-Lite (Cascading Dependencies)**

**Screenshot:** `calc-engine-video/03-fha-cascade-after-g12-change.png`

---

### Scene 3: Pure math layer (1:35–2:00)

**Narration:**
> "Formulas like **sumRounded**, **minRoundDown**, and **multiplyPercentage** live in **calcMath**—testable, no DOM."

**On-screen:**
- `public/shared/calcEngineLibrary.js` — scroll `sumRounded`, `minRoundDown`, `multiplyPercentage`
- Optional: `public/finance/unit-tests.html` with an FHA-related custom field test

---

### Scene 4: Encompass mapping (2:00–2:25)

**Narration:**
> "The page loads `createFHACalculatorConfig()`. For production Encompass forms, **customIds** map element IDs to fields like **CX.FHA.SL.PRINCIPAL.BALANCE** on G9."

**On-screen:**
- Bottom of `fha-streamline-loan-amount-calculator.html`: `new CalculationsEngine(createFHACalculatorConfig())`
- `data-encompass-field` attributes on inputs (e.g. G7, G9)
- Optional: `public/finance/js/encompass-test-loans.js` — `FHA_STREAMLINE_SCENARIOS`

**Screenshot:** `calc-engine-video/04-fha-encompass-field-attrs.png`

---

### Outro (2:25–2:40)

**Narration:**
> "**FHA Streamline** worksheet logic, one engine, **DAG-lite** cascades—that's the stack."

**On-screen:**
- **`fs_g30`** (Total Loan Amount) highlighted
- DevConnect Labs branding or Finance hub

---

## FHA Streamline calculator family (nav pills)

| Page | URL | Engine |
|------|-----|--------|
| FHA Streamline (full worksheet) | `/finance/fha-streamline-calculator.html` | Legacy `FhaStreamlineCalculations` (separate JS) |
| **FHA Loan Amount (this video)** | `/finance/fha-streamline-loan-amount-calculator.html` | **`CalculationsEngine` + `createFHACalculatorConfig()` + DAG-lite** |
| FHA NTB | `/finance/fha-streamline-ntb-calculator.html` | `CalculationsEngine` (custom config) |

Use **FHA Loan Amount** for DAG-lite demos; use **FHA Streamline** only if you need the full HUD worksheet UI (voice/audit features).

---

## Key phrases for captions / subtitles

- DAG-lite
- FHA Streamline Loan Amount
- Calculations Engine
- createFHACalculatorConfig
- calcMath / calcEngineLibrary
- G15 G24 G30 (worksheet cells)
- UFMIP factor D29
- CX.FHA.SL.*
- Encompass customIds

---

## Cross-links

- [CALCULATION_ENGINE.md](CALCULATION_ENGINE.md) — DAG-lite + FHA factory
- [UNIT_TEST_VIDEO_SCRIPT.md](UNIT_TEST_VIDEO_SCRIPT.md) — testing calculated fields
- [SVEN_UX_VIDEO_SCRIPT.md](SVEN_UX_VIDEO_SCRIPT.md) — same HeyGen format

---

## Technical notes for video tools

- **Aspect ratio:** 16:9  
- **Resolution:** 1920×1080  
- **URL:** `/finance/fha-streamline-loan-amount-calculator.html`  
- **Scripts loaded (in order):** `calcEngineLibrary.js` → `calculationEngine.js`  
- **Screenshot folder:** `docs/calc-engine-video/` (create when capturing)  
- **Auth:** page may use `finance-auth-guard.js`—ensure login or local dev access before recording
