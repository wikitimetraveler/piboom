/**
 * Development work by David Lane
 *
 * Stafford Act / 44 CFR § 206.48 knowledge for disaster AI experts.
 * Expert consumer only — not a live hazard feed and not legal advice.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_PATH = path.join(
  __dirname,
  '..',
  'knowledge-sources',
  'disaster',
  'docs',
  '44-cfr-206.48-governor-request-factors.md'
);

/** Compact prompt appendix (always available even if the markdown file is missing). */
export const STAFFORD_206_48_PROMPT_APPENDIX = `
## REGULATORY KNOWLEDGE — 44 CFR § 206.48 (Governor's major disaster request)

FEMA evaluates a Governor's request for Stafford Act major disaster assistance using
these factors (plus other relevant information). This is expert context for explaining
why EM/DR may lag, be limited, or not land — not legal advice and not an auto-score.
Never invent PDA dollars, TTR, GDP, casualties, or insurance figures not in context.

### Public Assistance (PA)
1. Estimated cost vs statewide population (per capita; ~$1/capita CPI-adjusted indicator; ~$1M minimum belief for small states).
2. Localized / county / Tribal concentrations (critical facilities; high local per capita).
3. Insurance in force (or that should have been) — reduces anticipated assistance.
4. Hazard mitigation that reduced damages (e.g. building codes).
5. Recent multiple disasters in last 12 months (Stafford + Governor declarations + State funds spent).
6. Other Federal programs that may fit better than FEMA PA.

### Individual Assistance / IHP
Federal IA is supplemental to State/Tribal/local capacity.
Principal factors: (1) State fiscal capacity (TTR, GDP by State, local per capita income, other treasury limits) and resource availability (gov/NGO/private housing & donations; cumulative disasters in last 24 months including gubernatorial); (2) Uninsured home and personal property losses (PDA: cause, jurisdictions, homes/degree, cost, ownership, insurance %).
Also: impacted population demographics (poverty, SSI/SNAP, unemployment, age, disability, LEP, Tribal); infrastructure outages >72h (life-saving, essential community, transport/utilities); casualties; disaster-related unemployment (self-employed / seasonal).

### ACME ops lens
- Governor declarations are early-warning research (Hurricane Tracker SoE windows); Policy Desk does not record them.
- IA/IHP is more borrower-facing; PA is public infrastructure.
- Distinguish planning estimates (e.g. Hurricane Tracker SoE windows) from actual FEMA dates and Policy Desk declarations.
`.trim();

let cachedFileBody = null;

/**
 * Load the markdown knowledge source (cached). Falls back to null if missing.
 */
export function loadStafford20648Source({ force = false } = {}) {
  if (!force && cachedFileBody != null) return cachedFileBody;
  try {
    if (fs.existsSync(SOURCE_PATH)) {
      cachedFileBody = fs.readFileSync(SOURCE_PATH, 'utf8');
      return cachedFileBody;
    }
  } catch (err) {
    console.warn('⚠️ Stafford 206.48 knowledge file unreadable:', err.message);
  }
  cachedFileBody = '';
  return cachedFileBody;
}

/**
 * Prompt block injected into disaster expert system prompts.
 */
export function getStafford20648PromptAppendix() {
  // Prefer file body when present so edits to knowledge-sources ship without code churn.
  const fromFile = loadStafford20648Source();
  if (fromFile && fromFile.trim().length > 200) {
    return `## REGULATORY KNOWLEDGE — 44 CFR § 206.48 (Governor's major disaster request)\n\n${fromFile.trim()}\n\n(Use as expert context only. Not legal advice. Do not invent PDA / TTR / casualty figures.)`;
  }
  return STAFFORD_206_48_PROMPT_APPENDIX;
}

/**
 * Append Stafford knowledge to a disaster-expert system prompt.
 */
export function appendStaffordKnowledgeToPrompt(basePrompt = '') {
  const appendix = getStafford20648PromptAppendix();
  if (!appendix) return String(basePrompt || '');
  return `${String(basePrompt || '').trim()}\n\n${appendix}`;
}
