/**
 * HeyGen script builders for finance booth demos — calc engine, unit tests, Sven UX.
 * Spoken scripts align with docs/CALCULATION_ENGINE_VIDEO_SCRIPT.md,
 * docs/UNIT_TEST_VIDEO_SCRIPT.md, and docs/SVEN_UX_VIDEO_SCRIPT.md.
 */

/** ~25s FHA Streamline / DAG-lite booth hook. */
export const CALC_ENGINE_DEMO_SHORT_SCRIPT = [
  'This is our FHA Streamline Loan Amount worksheet — spreadsheet logic wired through one shared Calculations Engine with DAG-lite.',
  'Change an additional amount and G15 through G30 cascade automatically — no hand-wired listeners.',
  'Pure math lives in calcMath; bindings live in calculationEngine.js.',
  'Open the worksheet below to see one keystroke update the whole chain.'
].join(' ');

export const CALC_ENGINE_DEMO_SHORT_TITLE = 'Calculations Engine Demo';

/** ~25s Unit Test tool booth hook. */
export const UNIT_TESTS_DEMO_SHORT_SCRIPT = [
  'This is the DevConnect Labs Unit Test tool — test Encompass custom field calculations against real loan data without leaving your browser.',
  'Generate tests from a calculated field, edit values with type-aware editors, then run against a Loan GUID for pass or fail results.',
  'Tap Open Unit Tests below to try Story Mode or load your own workbook.'
].join(' ');

export const UNIT_TESTS_DEMO_SHORT_TITLE = 'Unit Tests Demo';

/** ~25s Sven UX punchline booth hook. */
export const SVEN_UX_DEMO_SHORT_SCRIPT = [
  "You say you're on Bootstrap five. Then I find mr-2 in the markup.",
  "That's not a margin — that's the ghost of Bootstrap four, waving hello. The living use me-2.",
  "I'm Sven, your UX guide for DevConnect Labs — one clear title, one obvious action, and interfaces that admit when they're thinking."
].join(' ');

export const SVEN_UX_DEMO_SHORT_TITLE = 'Sven UX Demo';

const DEMO_BUILDERS = {
  'calc-engine': () => ({
    title: CALC_ENGINE_DEMO_SHORT_TITLE,
    script: CALC_ENGINE_DEMO_SHORT_SCRIPT,
    aspectRatio: '16:9'
  }),
  'unit-tests': () => ({
    title: UNIT_TESTS_DEMO_SHORT_TITLE,
    script: UNIT_TESTS_DEMO_SHORT_SCRIPT,
    aspectRatio: '16:9'
  }),
  'sven-ux': () => ({
    title: SVEN_UX_DEMO_SHORT_TITLE,
    script: SVEN_UX_DEMO_SHORT_SCRIPT,
    aspectRatio: '16:9'
  })
};

export function getFinanceHeygenDemoShort(demoKey) {
  const builder = DEMO_BUILDERS[demoKey];
  if (!builder) throw new Error(`Unknown finance HeyGen demo: ${demoKey}`);
  return builder();
}

export function listFinanceHeygenDemoKeys() {
  return Object.keys(DEMO_BUILDERS);
}
