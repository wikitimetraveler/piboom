import OpenAI from 'openai';
import { resolveOpenAiAgentModel } from './openai-agent-model.js';

const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || '').trim();
const openaiClient = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

const SYSTEM_PROMPT = `You are a mortgage operations assistant. Given a small JSON object of Encompass-style pipeline fields for one loan, estimate how hard the loan will be for a human processor to move to clear-to-close (documentation friction, overlays, employment/property edge cases, thin credit, many expected underwriting tasks, etc.).

Return ONLY valid JSON with this exact shape:
{"points": <integer 0-50>, "rationale": "<one concise sentence>"}

Calibration: 0-10 straightforward, 11-25 typical, 26-40 elevated, 41-50 unusually heavy. If data is very sparse, stay in the low-mid range and explain uncertainty in rationale.`;

/** Keys most relevant for processor complexity (kept small for latency). */
export const AI_COMPLEXITY_FIELD_KEYS = [
  'Loan.LoanNumber',
  'Loan.BorrowerName',
  'Loan.LoanAmount',
  'Loan.LoanType',
  'Loan.LoanProgram',
  'Loan.LoanPurpose',
  'Loan.PropertyType',
  'Loan.NumberOfUnits',
  'Loan.OccupancyStatus',
  'Loan.TotalDTI',
  'Loan.LTV',
  'Loan.CLTV',
  'Loan.BorrowerScore',
  'Loan.BorrowerScore2',
  'Loan.BorrowerScore3',
  'Loan.CoBorrowerScore',
  'Loan.CoBorrowerScore2',
  'Loan.CoBorrowerScore3',
  'Loan.InvestorName',
  'Loan.LoanChannel',
  'Fields.1172',
  'Fields.4000',
  'Fields.CX.BORROWER.INCOME.TYPE',
  'Fields.CX.BORROWER.SELF.EMPLOYED',
  'Fields.CX.UW.CONDITION.COUNT',
  'Fields.CX.INVESTOR.PROGRAM',
];

/**
 * @param {Record<string, unknown>} fields
 * @returns {Record<string, unknown>}
 */
export function buildAiFieldSummary(fields) {
  if (!fields || typeof fields !== 'object') return {};
  const out = {};
  for (const k of AI_COMPLEXITY_FIELD_KEYS) {
    if (Object.prototype.hasOwnProperty.call(fields, k)) {
      const v = fields[k];
      if (v !== null && v !== undefined && `${v}`.trim() !== '') {
        out[k] = v;
      }
    }
  }
  return out;
}

/**
 * @param {unknown} raw
 * @returns {{ points: number, rationale: string }}
 */
export function parseAiComplexityJson(raw) {
  let parsed;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { points: 0, rationale: '' };
    }
  } else if (raw && typeof raw === 'object') {
    parsed = raw;
  } else {
    return { points: 0, rationale: '' };
  }
  let points = Number(parsed.points);
  if (!Number.isFinite(points)) points = 0;
  points = Math.max(0, Math.min(50, Math.round(points)));
  const rationale = typeof parsed.rationale === 'string' ? parsed.rationale.slice(0, 500) : '';
  return { points, rationale };
}

/**
 * @param {Record<string, unknown>} fields
 * @param {{ model?: string }} [options]
 * @returns {Promise<{ points: number, rationale: string }>}
 */
export async function scoreLoanComplexityWithAi(fields, options = {}) {
  if (!openaiClient) {
    const err = new Error('OPENAI_API_KEY is not set; AI complexity scoring is unavailable');
    err.statusCode = 503;
    throw err;
  }

  const summary = buildAiFieldSummary(fields);
  const model =
    options.model && `${options.model}`.trim()
      ? options.model.trim()
      : resolveOpenAiAgentModel('LOAN_COMPLEXITY_AI_MODEL');
  const payload = JSON.stringify(summary);
  const clipped = payload.length > 14000 ? `${payload.slice(0, 14000)}…` : payload;

  const response = await openaiClient.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Loan fields:\n${clipped}` },
    ],
    max_tokens: 220,
    temperature: 0.2,
    response_format: { type: 'json_object' },
  });

  const raw = response.choices?.[0]?.message?.content || '{}';
  return parseAiComplexityJson(raw);
}

export function isAiComplexityConfigured() {
  return Boolean(openaiClient);
}
