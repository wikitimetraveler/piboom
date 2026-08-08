# DevConnect Labs Glossary

Short definitions for AI agents and developers working with Encompass and mortgage domain.

| Term | Definition |
|------|-------------|
| Loan Pipeline | Encompass queue of loans in progress; queryable via Loan Pipeline API |
| ScreenBindings | In-app binding of web forms to Encompass loan fields when running inside Encompass (browser context) |
| Encompass Hub | Server-side REST APIs (Pipeline, Loans, Users, etc.) used by DevConnect Labs |
| Processor assignment tool | Finance page `processor-assignment.html`: scores loans (rules and optional OpenAI), assigns Processor associate slots via hub associates API; processors JSON + rules persisted in browser and optionally Postgres (`processor_assignment_tool_config` per env) |
| Developer Connect | ICE Mortgage Technology developer portal and API docs |
| LO Connect | Loan Officer Connect – Encompass web app for LOs; supports custom tools and Web-IFB forms |
| Web-IFB / IFB | Web Input Form Builder – WYSIWYG form builder for Encompass; scripts run in form context |
| TPO Connect | Third-Party Originator Connect – ICE web portal for correspondent/wholesale lending; guest apps embed via SSF iframe (`tpoApplication` / `auth` / `loan`). Labs knowledge page: `/finance/tpo-connect.html` |
| Encompass | ICE Mortgage Technology loan origination system (LOS) |
| ice-sources.json | Generated index of ICE repos, Postman, docs; built by `npm run build:ice-knowledge` |
| The Screen Test | AI tool (tool9) for reviewing Encompass manifest XML form code; extracts field IDs, checks calculations, flags syntax/type/deprecated issues |
| tool9 | Finance developer tool — The Screen Test, manifest form code review |
| customFieldCalcParser | Parser in `public/shared/customFieldCalcParser.js` for Encompass IIf formulas; extracts scenarios, suggested values, Nothing/Y/N handling |
| unit-tests-utils | Shared helpers in `public/shared/unit-tests-utils.js` for unit test parsing (extractFieldId, coerce, isBlankForTest, etc.); used by browser and Node |
| Unit Tests tool | Finance tool at `unit-tests.html` for running Excel-based Encompass field tests; uses customFieldCalcParser for scenario generation |
| Unit Test Library | Excel files stored in PostgreSQL `unit_test_files.file_content` (BYTEA); available from any machine sharing the same DB; run `npm run migrate:unit-tests` to backfill legacy disk files |
| Test Case Search | Searchable database of unit tests by Encompass field ID; `GET /api/unit-tests/search?fieldId=CX.TYPE` returns all tests that use that field; JSONB `field_ids` + GIN index for fast lookup; key feature for finding which tests cover a field |
