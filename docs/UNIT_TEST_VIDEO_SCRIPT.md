# Unit Test Tool – Video Script

**Target:** DevConnect Labs Encompass Unit Testing  
**Duration:** 3–5 minutes  
**Format:** Screen recording + voiceover or AI avatar

---

## Intro (0:00–0:30)

**Narration:**
> "This is the DevConnect Labs Unit Test tool. It helps you test Encompass custom field calculations against real loan data—without leaving your browser."

**On-screen:**
- Show unit-tests page (Finance → Unit Tests)
- Brief view of the grid and toolbar

**Screenshot:** `screenshots/01-unit-tests-overview.png` – Full page, grid + toolbar visible

---

## Scene 1: Load Test Data (0:30–1:15)

**Narration:**
> "You can load tests from Excel, or generate them from a calculated custom field. Let's generate from a custom field."

**Actions:**
1. Click **Generate from Custom Field**
2. In the modal, type or select a calculated field (e.g. `[CX.TEST] = 1 + [353]`)
3. Show the preview of SET and COMPARE steps
4. Click **Generate & Load**

**Narration:**
> "The tool creates SET steps for each input field and a COMPARE step for the output. You fill in test values for each scenario."

**Screenshot:** `screenshots/02-generate-from-field-modal.png` – Modal with field expression and preview

---

## Scene 2: Edit Test Values (1:15–2:15)

**Narration:**
> "All cells are editable. For date fields, you get a date picker. For numbers, a number editor. For booleans, a Y/N dropdown."

**Actions:**
1. Click a Test 1 cell in a SET row
2. Show date picker for a DateTime field
3. Click a different cell and show number or text edit
4. Show the Action column dropdown (GET, SET, COMPARE)

**Narration:**
> "Step, Target, and Action can be edited too. The grid infers field types from the Description or from Encompass metadata."

**Screenshot:** `screenshots/03-editable-cells-date-picker.png` – Date picker open; `screenshots/04-action-dropdown.png` – Action column dropdown

---

## Scene 3: Run Tests Against Encompass (2:15–3:30)

**Narration:**
> "To run tests, enter a Loan GUID from your Encompass pipeline. The tool calls the Encompass API to SET values, GET results, and COMPARE."

**Actions:**
1. Enter or paste a Loan GUID
2. Click **Run Tests**
3. Show pass/fail results in the grid (green/red cell shading)
4. Open the results panel and show summary

**Narration:**
> "Pass means the calculated value matches your expected value. Fail means it doesn't—so you can fix the formula or the test."

**Screenshot:** `screenshots/05-run-results-pass-fail.png` – Grid with green/red shading; `screenshots/06-results-panel.png` – Results summary panel

---

## Scene 4: Export & Import (3:30–4:00)

**Narration:**
> "You can export tests to Excel or CSV for sharing, and import them back. Tests are also saved to the database so you can re-run them later."

**Actions:**
1. Click Export → JSON or CSV
2. Briefly show the Import option

**Screenshot:** `screenshots/07-export-import.png` – Export dropdown or Import dialog

---

## Outro (4:00–4:30)

**Narration:**
> "That's the Unit Test tool—create tests from custom fields, edit values with type-aware editors, and run them against Encompass loans. DevConnect Labs."

**On-screen:**
- Return to main view or show DevConnect Labs branding

---

## Optional: AI Assistant (30 sec)

**Narration:**
> "There's also an AI assistant for questions about unit testing, test scenarios, and Encompass APIs."

**Actions:**
- Expand the AI Assistant panel
- Ask a sample question (e.g. "How do I test a date field?")
- Show a short response

**Screenshot:** `screenshots/08-ai-assistant.png` – AI panel expanded with Q&A

---

## Key Phrases for Captions/Subtitles

- Encompass custom field calculations
- SET and COMPARE steps
- Date picker for DateTime fields
- Run tests against real loan data
- Pass/fail results
- Export to Excel or CSV

---

## Screenshot Checklist (for future videos)

| # | Screenshot | Captures |
|---|------------|----------|
| 1 | `01-unit-tests-overview.png` | Full page, grid + toolbar |
| 2 | `02-generate-from-field-modal.png` | Generate modal, field expression |
| 3 | `03-editable-cells-date-picker.png` | Date picker open |
| 4 | `04-action-dropdown.png` | GET/SET/COMPARE dropdown |
| 5 | `05-run-results-pass-fail.png` | Green/red pass-fail grid |
| 6 | `06-results-panel.png` | Results summary |
| 7 | `07-export-import.png` | Export dropdown |

**Folder:** `docs/screenshots/` or `docs/unit-test-video/`

---

## Technical Notes for Video Tools

- **Aspect ratio:** 16:9
- **Resolution:** 1920×1080 recommended
- **URL:** `/finance/unit-tests.html` (or full path in your deployment)
- **Prerequisites:** Encompass OAuth configured, at least one calculated custom field, a test loan in pipeline
