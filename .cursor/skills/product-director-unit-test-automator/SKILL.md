---
name: product-director-unit-test-automator
description: Guides Product Director workflows for the Unit Test and Automator tools, including acceptance criteria, UX checks, parsing/output validation, and release-readiness review. Use when the user mentions product direction, Tez, Unit Test, Automator, tool4, or asks for QA/ship decisions on these tools.
---

# Product Director: Unit Test + Automator

## Purpose
Use this skill to align implementation and validation with Product Director expectations for:
- `public/finance/unit-tests.html`
- `public/finance/tool4.html`

## Operating Rules
1. Keep scope tight to Unit Test and Automator unless the user asks broader.
2. Favor small safe diffs and preserve existing Bootstrap + vanilla JS patterns.
3. Treat controllers as thin and keep business logic out of UI files unless already in-page.
4. Verify both function and UX clarity (labels, button states, status messages, empty states).

## Product Review Checklist
- Clear primary action path from load/paste -> parse/extract -> output.
- Disabled/enabled button states match readiness.
- Error messages are specific and actionable.
- Success messages include what happened (counts or next step).
- Credits/product identity remain visible and consistent.
- Keyboard flow works for critical inputs and paste/drop areas.

## Unit Test Tool Expectations
- Upload and parse paths are obvious and resilient.
- Scenario/test result surfaces are readable in normal and night themes.
- Sticky actions and dropdown tools remain usable on smaller viewports.
- Product credits (Tez/David) remain visible in all themes.

## Automator Tool Expectations
- Image import supports upload, drag/drop, and paste.
- Paste/drop zone is keyboard reachable and provides guidance.
- Extract button enables only when image data is ready.
- Parsed output flows directly into field definitions + JSON generation.

## Response Format For Product Reviews
When asked to assess readiness, return:
1. **Blocking issues** (if any)
2. **Polish improvements**
3. **Ship recommendation**: Ready / Needs fixes
4. **Validation steps run**

## Done Criteria
- Functional flow works end-to-end for the requested area.
- No regressions in nearby interactions.
- User-facing text is concise and clear.
