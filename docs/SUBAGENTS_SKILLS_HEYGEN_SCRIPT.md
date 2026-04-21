# Subagents + Skills — HeyGen Script

**Target:** Mixed technical audience (engineering + product)  
**Duration:** 60-90 seconds  
**Format:** HeyGen avatar + screen capture

---

## Intro (0:00-0:08)

**Narration:**  
> "At DevConnect Labs, we use Cursor in two layers: skills for standards, and subagents for speed."

**On-screen:**  
- Open repo root in Cursor  
- Show `AGENTS.md` and `docs/` in sidebar

---

## Scene 1: Skills = Repository Playbooks (0:08-0:28)

**Narration:**  
> "Skills are our reusable playbooks. They encode domain rules so the agent stays consistent with how this repo is built. For example: Bootstrap plus vanilla JavaScript on the frontend, thin controllers, and service-layer logic in `services/`."

**On-screen:**  
- Open `AGENTS.md`  
- Highlight conventions: service-layer logic, no React, Bootstrap + vanilla JS

---

## Scene 2: Subagents = Specialized Execution (0:28-0:48)

**Narration:**  
> "Subagents are specialized assistants we spin up for focused work. We use them when we need targeted expertise, fast exploration, or parallel analysis. Instead of one long context thread, each subagent handles a scoped task and reports back."

**On-screen:**  
- Show subagent picker/types in Cursor  
- Highlight examples: `explore`, `modern-ui-ux`, `refactor`, `shell`

---

## Scene 3: How We Decide (0:48-1:03)

**Narration:**  
> "Decision rule is simple: skill first for guardrails and domain correctness, subagent when the task benefits from specialization or parallel discovery. Together, they reduce rework and keep code quality stable."

**On-screen:**  
- Split view with a skill file and subagent invocation UI  
- Overlay text: "Skill = standards" and "Subagent = scoped execution"

---

## Scene 4: Real Repo Example (1:03-1:20)

**Narration:**  
> "In our Unit Tests tool cleanup, we used exploration to map the current UI flow, a modern UI and UX subagent to propose a cleaner structure, then implemented task-first sections with advanced controls collapsed by default. Same capability, lower clutter."

**On-screen:**  
- Open `public/finance/unit-tests.html`  
- Show workflow section labels and advanced grouping  
- Briefly show `public/finance/js/unit-tests.js` section initialization logic

---

## Close (1:20-1:28)

**Narration:**  
> "That is how we ship faster in this repo: skills keep us aligned, subagents keep us efficient."

**On-screen:**  
- Return to project overview / brand mark

---

## Key Lines for Captions

- Skills encode repo-specific standards
- Subagents handle specialized, scoped tasks
- Skill first, subagent when specialization or scale is needed
- Faster delivery with stable conventions

---

## Optional 30-Second Teaser

**Narration:**  
> "We run Cursor in two layers: skills and subagents. Skills enforce our repo standards, like service-layer architecture and Bootstrap plus vanilla JS. Subagents handle specialized tasks, like UI audits or deep code exploration. Skill for guardrails, subagent for speed. That combo helps us move fast without breaking consistency."

