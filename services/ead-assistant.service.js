/**
 * Retail appraiser and underwriter desk for a loaded UAD 3.6 package.
 * Development work by David Lane
 */
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { persistConversationTurn } from './langchain-memory.service.js';
import { resolveOpenAiAgentModel } from './openai-agent-model.js';

export const EXPERT_TITLE = 'Appraisal and underwriting reviewer';

export const APPRAISAL_SKILLS = [
  {
    id: 'photo-read',
    title: 'Photo read',
    detail:
      'Read each photo by its UAD 3.6 ImageCategoryType, room, and caption. Do not describe contents the package does not name.',
  },
  {
    id: 'sales-comparison',
    title: 'Sales comparison',
    detail:
      'Review the subject and the sales comparables that are on the page: address, sale price, adjusted price, and sale date.',
  },
  {
    id: 'condition-quality',
    title: 'Condition and quality',
    detail:
      'Use only condition, quality, and commentary present in the package. If a C or Q rating is missing, say it is missing.',
  },
];

export const UNDERWRITING_SKILLS = [
  {
    id: 'collateral-completeness',
    title: 'Collateral completeness',
    detail:
      'Check the retail file for one XML, one PDF, a subject property photo, dwelling front, property access, and comparable photos.',
  },
  {
    id: 'uad-coverage',
    title: 'UAD photo coverage',
    detail:
      'Flag a required or conditional UAD photo that is absent: view, dwelling rear, sketch or floor plan, manufactured-home labels, and a photo for each sales comparable.',
  },
  {
    id: 'value-support',
    title: 'Value support',
    detail:
      'Say whether the opinion of value sits with the comparable sale prices and adjusted prices. Do not produce a new value.',
  },
  {
    id: 'conditions',
    title: 'Conditions to clear',
    detail:
      'Write the stipulation an underwriter would ask for. Phrase it as a condition to clear, never as an approval or a denial.',
  },
  {
    id: 'ead-package',
    title: 'FHA EAD package',
    detail:
      'Treat SYS9001 through SYS9009 as delivery defects. This desk does not submit the package to HUD and does not decide insurability.',
  },
];

function skillLines(heading, skills) {
  const lines = [heading];
  for (const skill of skills) {
    lines.push(`- ${skill.title}: ${skill.detail}`);
  }
  return lines;
}

export function buildEadExpertPrompt() {
  return [
    'You are the desk expert on the FHA EAD 3.6 appraisal review page.',
    'You stay an appraisal reviewer and an underwriting reviewer on the same package.',
    'You read the summary, SYS findings, UAD photo categories, and comparable sales already parsed for this desk.',
    ...skillLines('Appraisal skill set:', APPRAISAL_SKILLS),
    ...skillLines('Underwriting skill set:', UNDERWRITING_SKILLS),
    'Hard rules:',
    '- This is decision support. Do not issue a credit decision, an approval, a denial, or a new appraised value.',
    '- Do not invent sale prices, addresses, ratings, or photo contents that are not in the package context.',
    '- If a field is missing, say it is missing.',
    '- Nothing here is submitted to HUD.',
    'Keep answers short and specific to the loaded package.',
  ].join('\n');
}

function money(n) {
  if (n == null || n === '') return '';
  const num = Number(n);
  if (!Number.isFinite(num)) return String(n);
  return `$${Math.round(num).toLocaleString('en-US')}`;
}

export function buildPackageContext(pkg) {
  const p = pkg && typeof pkg === 'object' ? pkg : {};
  const summary = p.summary || {};
  const lines = ['Loaded package:'];
  if (p.label) lines.push(`Label: ${p.label}`);
  if (summary.documentType) lines.push(`Document type: ${summary.documentType}`);
  if (summary.subjectAddress) lines.push(`Subject: ${summary.subjectAddress}`);
  if (summary.opinionOfValue) lines.push(`Opinion of value: ${money(summary.opinionOfValue)}`);
  if (summary.marketValueCondition) lines.push(`Condition: ${summary.marketValueCondition}`);
  if (summary.effectiveDate) lines.push(`Effective date: ${summary.effectiveDate}`);
  if (summary.appraiserName) lines.push(`Appraiser: ${summary.appraiserName}`);
  const findings = Array.isArray(p.findings) ? p.findings : [];
  if (!findings.length) lines.push('SYS findings: none.');
  else {
    lines.push('SYS findings:');
    findings.slice(0, 12).forEach((f) => {
      lines.push(`- ${f.code || 'NOTE'} (${f.severity || 'Info'}): ${f.message || ''}`);
    });
  }
  const sales = Array.isArray(p.sales) ? p.sales : [];
  if (sales.length) {
    lines.push('Sales on the map:');
    sales.forEach((s) => {
      const price = s.salePrice != null ? money(s.salePrice) : '';
      const adj = s.adjustedPrice != null ? ` adjusted ${money(s.adjustedPrice)}` : '';
      lines.push(`- ${s.label || s.role}: ${s.address || 'address missing'} ${price}${adj}`.trim());
    });
  }
  const images = Array.isArray(p.images) ? p.images : [];
  if (images.length) {
    lines.push('Photos by UAD category:');
    images.slice(0, 40).forEach((img) => {
      lines.push(
        `- ${img.group || 'Other'}: ${img.displayTitle || img.category || img.name || 'photo'}`
      );
    });
  }
  return lines.join('\n');
}

export async function chatEadExpert({ message, history, package: pkg, userId, sessionId }) {
  const key = String(process.env.OPENAI_API_KEY || '').trim();
  if (!key) {
    const err = new Error('OPENAI_API_KEY is not configured');
    err.code = 'OPENAI_NOT_CONFIGURED';
    throw err;
  }
  const text = String(message || '').trim();
  if (!text) {
    const err = new Error('Message is required');
    err.code = 'MESSAGE_REQUIRED';
    throw err;
  }
  const model = new ChatOpenAI({
    modelName: resolveOpenAiAgentModel('EAD_AI_MODEL'),
    temperature: 0.2,
    openAIApiKey: key,
  });
  const prior = (Array.isArray(history) ? history : [])
    .slice(-8)
    .filter((turn) => turn && (turn.role === 'user' || turn.role === 'assistant') && turn.content)
    .map((turn) =>
      turn.role === 'user'
        ? new HumanMessage(String(turn.content).slice(0, 4000))
        : new AIMessage(String(turn.content).slice(0, 4000))
    );
  const response = await model.invoke([
    new SystemMessage(`${buildEadExpertPrompt()}\n\n${buildPackageContext(pkg)}`),
    ...prior,
    new HumanMessage(text.slice(0, 4000)),
  ]);
  const raw = response?.content;
  const reply = (Array.isArray(raw)
    ? raw.map((part) => (typeof part === 'string' ? part : part?.text || '')).join('')
    : String(raw || '')
  ).trim();
  try {
    await persistConversationTurn(
      String(userId || 'ead-guest').slice(0, 100),
      String(sessionId || 'ead-desk').slice(0, 255),
      text,
      reply,
      'ead-appraiser-underwriter'
    );
  } catch (_) {
    /* chat still returns when memory storage is unavailable */
  }
  return { reply, title: EXPERT_TITLE };
}
