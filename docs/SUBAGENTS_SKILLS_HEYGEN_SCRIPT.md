# Subagents + Skills — HeyGen Script

> **Note:** HeyGen v3 API is live at `/api/heygen/*` (`services/heygen.service.js`). Regenerate booth clips with `npm run generate:disaster-heygen-demo` or render from the live studio on Unified Disasters. For this subagents tour, paste scripts into HeyGen manually or use `POST /api/heygen/videos` with `HEYGEN_API_KEY` configured.

**Target:** Mixed technical audience (engineering + product)  
**Duration:** 2-3 minutes  
**Format:** HeyGen avatar + screen capture

---

## Intro (0:00-0:20)

**Narration:**  
> "At DevConnect Labs, we run Cursor with a simple operating model: skills for consistency, and subagents for specialized execution. This lets us move faster without drifting from repo conventions."

**On-screen:**  
- Open repo root in Cursor  
- Show `AGENTS.md` and `docs/` in sidebar

---

## Scene 1: Skills = Repository Playbooks (0:20-1:00)

**Narration:**  
> "Skills are reusable playbooks tied to specific workflows. They help the agent apply the right process instead of guessing. In this repo, that includes domain-focused skills like genealogy cleanup and nature discovery patterns, and delivery-focused skills like regression testing and release-readiness checks. We also use skills to enforce repo conventions, like Bootstrap plus vanilla JavaScript on the frontend, thin controllers, and service-layer logic in `services/`."

**On-screen:**  
- Open `AGENTS.md`  
- Highlight conventions: service-layer logic; Encompass = Bootstrap + vanilla JS; non-Encompass may use React + TypeScript  

- Show `.cursor/skills/` and briefly reveal examples: `regression-tester`, `genealogy-american-history`, `nature-discovery-bootstrap`

---

## Scene 2: Subagents = Specialized Execution (1:00-1:40)

**Narration:**  
> "Subagents are specialized assistants for focused tasks. We use `explore` to map unfamiliar code quickly, `refactor` when we need safer structural changes, `modern-ui-ux` for interface clarity and hierarchy, and `shell` for command-driven tasks like git or build checks. The point is scope: each subagent gets a bounded goal and returns a focused result we can apply."

**On-screen:**  
- Show subagent picker/types in Cursor  
- Highlight examples: `explore`, `modern-ui-ux`, `refactor`, `shell`  
- Briefly show a parallel flow diagram: "Explore findings" -> "UI proposal" -> "Implementation"

---

## Scene 3: How We Decide (1:40-2:05)

**Narration:**  
> "Our decision rule is straightforward. Start with a skill when the task has known domain rules or quality gates. Bring in a subagent when the work benefits from specialization, isolation, or parallel discovery. In many cases we combine both: skill gives the process guardrails, subagent accelerates execution inside those guardrails."

**On-screen:**  
- Split view with a skill file and subagent invocation UI  
- Overlay text: "Skill = standards" and "Subagent = scoped execution"

---

## Scene 4: Real Repo Workflow A (2:05-2:25)

**Narration:**  
> "In our Unit Tests tool cleanup, we first used exploration to map the current UI flow, then used a modern UI and UX subagent to propose a cleaner structure. After that, we implemented task-first sections with advanced controls collapsed by default. Same capability, much lower clutter."

**On-screen:**  
- Open `public/finance/unit-tests.html`  
- Show workflow section labels and advanced grouping  
- Briefly show `public/finance/js/unit-tests.js` section initialization logic

---

## Scene 5: Real Repo Workflow B (2:25-2:45)

**Narration:**  
> "For reliability, we use the regression testing skill as a default QA pattern: run CI-oriented tests, fix the first clear failure with minimal diffs, and report pass or blocked status. This keeps changes reviewable while maintaining velocity."

**On-screen:**  
- Open `.cursor/skills/regression-tester/SKILL.md`  
- Show terminal running tests and a concise fix loop

---

## Close (2:45-3:00)

**Narration:**  
> "That is how we ship reliably at speed in this repo. Skills keep us aligned with standards, subagents keep execution focused, and combining them gives us both quality and momentum."

**On-screen:**  
- Return to project overview / brand mark

---

## Key Lines for Captions

- Skills encode repo-specific standards and workflows
- Subagents handle specialized, scoped execution
- Start with skills for guardrails; add subagents for speed and depth
- Combining both reduces rework and improves delivery quality

---

## Optional 60-Second Teaser

**Narration:**  
> "We run Cursor in two layers: skills and subagents. Skills provide repo guardrails, from architecture conventions to testing workflows. Subagents provide focused execution, like codebase exploration, UI refinement, and structured refactors. We usually start with a skill, then use subagents when the task needs specialization or parallel work. That combination helps us move fast while keeping quality stable."

---

## Spoken-Speed Cut (HeyGen Friendly, 2-3 Minutes)

### Intro (0:00-0:20)

**Narration:**  
> "At DevConnect Labs, we use Cursor in two layers. Skills for consistency. Subagents for focused execution. That is how we move faster without losing quality."

### Skills (0:20-1:00)

**Narration:**  
> "Skills are reusable playbooks. They tell the agent how to work in this repo. We use skills for architecture rules, testing flow, and domain tasks. Examples include regression testing, genealogy workflows, and nature discovery patterns. Skills keep output consistent with our standards."

### Subagents (1:00-1:40)

**Narration:**  
> "Subagents are specialized assistants. We use explore to map unfamiliar code. We use modern-ui-ux to improve clarity and layout. We use refactor for safer structure changes. We use shell for command-heavy tasks. Each subagent gets a narrow goal, then reports back."

### Decision Rule (1:40-2:05)

**Narration:**  
> "Our rule is simple. Start with a skill when guardrails matter. Add a subagent when the task needs specialization or parallel work. Most strong workflows use both."

### Workflow Examples (2:05-2:45)

**Narration:**  
> "Example one: Unit Tests cleanup. We explored the current flow, applied UI and UX guidance, and shipped a cleaner task-first layout with advanced controls collapsed by default.  
> Example two: Regression loop. We ran CI-oriented tests, fixed the first clear failure with minimal diffs, and reported pass or blocked status."

### Close (2:45-3:00)

**Narration:**  
> "Skills keep us aligned. Subagents keep us efficient. Together, they give us reliable delivery at speed."

---

## Spoken-Speed Cut — Technical (Engineering, 2-3 Minutes)

Use this read when the audience is mostly IC engineers and you want stack-level detail without slowing HeyGen.

### Intro (0:00-0:20)

**Narration:**  
> "In this repo, Cursor is wired in two layers. Skills are markdown playbooks that constrain behavior and process. Subagents are isolated runs with a dedicated subagent type, so we split context, parallelize discovery, and keep the main thread clean. The goal is small diffs and consistent architecture."

### Skills (0:20-1:00)

**Narration:**  
> "Skills live under `.cursor/skills/` in `SKILL.md` files. The agent is supposed to read the right skill for the job instead of free-styling. We have domain skills, for things like genealogy OCR cleanup and Bootstrap migration under `public/nature/`, and we have process skills, like regression-tester, which is aligned with our Jest CI and fix-the-first-failure rule. `AGENTS.md` still wins on stack: Encompass-related tools stay Bootstrap 5 and vanilla JavaScript—no React or TypeScript there—while non-Encompass apps may use React and TypeScript. Business logic stays in `services/` with thin request handlers. Skills operationalize that."

### Subagents (1:00-1:40)

**Narration:**  
> "Subagents map to `subagent_type` in the tool model. `explore` is read-only and good for file discovery and high-level architecture questions without edits. `refactor` is for module boundaries, renames, and design cleanup. `modern-ui-ux` is for layout, hierarchy, and component consistency on the front end. `shell` is for explicit git, npm, and test runs when we do not want the model to hand-wave commands. We pick the type to match the risk surface."

### Decision Rule (1:40-2:05)

**Narration:**  
> "Rule of thumb: if the task has a documented workflow or a quality gate, load the skill first so acceptance criteria and repo constraints are in scope. If the work is I-O heavy, parallel, or needs a different lens, launch a subagent, optionally in parallel, then merge results in the main agent. That keeps exploration cheap and review load low."

### Workflow Examples (2:05-2:45)

**Narration:**  
> "Unit Tests: static HTML in `public/finance/`, script split under `js/`. We used explore to trace DOM to initialization in `unit-tests.js`, then modern-ui-ux for a task-first information architecture and progressive disclosure of advanced options. For regression, regression-tester drives npm test, fix first failure, minimal diff, and clear pass-versus-blocked, which is what we want before merge."

### Close (2:45-3:00)

**Narration:**  
> "Skills pin policy and test discipline. Subagents add parallelism and role separation. That is the operating model for this codebase in Cursor."

