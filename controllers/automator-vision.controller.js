/**
 * Development work by David Lane
 */
import OpenAI from 'openai';
import { config } from '../config/index.js';
import { resolveOpenAiVisionModel } from '../services/openai-vision-model.js';

const openai = config.openaiApiKey ? new OpenAI({ apiKey: config.openaiApiKey }) : null;

/** Vision extraction can stall if OpenAI is slow; prevents open-ended hangs (override AUTOMATOR_VISION_OPENAI_TIMEOUT_MS). */
const AUTOMATOR_VISION_OPENAI_TIMEOUT_MS = Number(process.env.AUTOMATOR_VISION_OPENAI_TIMEOUT_MS || 120000);
const AUTOMATOR_VISION_MAX_TOKENS = Math.min(
  16384,
  Math.max(700, Number(process.env.AUTOMATOR_VISION_MAX_TOKENS || 4096) || 4096),
);

function extractJsonObject(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1]);
    } catch (_) {
      // continue to broad extraction below
    }
  }
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch (_) {
      return null;
    }
  }
  return null;
}

function sanitizeDescriptionText(raw) {
  if (raw === null || raw === undefined) return '';
  return String(raw)
    .replace(/\[(?=[^\]\s]*[A-Za-z0-9])[^\]\s]+\]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,;:.!?])/g, '$1')
    .trim();
}

export function sanitizeAutomatorVisionLine(line) {
  if (typeof line !== 'string') return '';
  const trimmed = line.trim();
  if (!trimmed) return '';
  const parts = trimmed.split('\t').map((p) => p.trim());
  if (parts.length < 4) return trimmed;
  parts[3] = sanitizeDescriptionText(parts[3] || '');
  return parts.join('\t');
}

export async function postParseAutomatorFieldImage(req, res) {
  try {
    if (!openai) {
      return res.status(503).json({ error: 'OpenAI not configured' });
    }

    const imageData = req.body?.imageData;
    if (!imageData || typeof imageData !== 'string' || !imageData.startsWith('data:image')) {
      return res.status(400).json({ error: 'imageData data URL is required' });
    }

    const completion = await openai.chat.completions.create(
      {
        model: resolveOpenAiVisionModel('AUTOMATOR_VISION_MODEL'),
        temperature: 0.1,
        max_tokens: AUTOMATOR_VISION_MAX_TOKENS,
        messages: [
          {
            role: 'system',
            content: [
              'You extract Encompass custom field definition rows from screenshots.',
              'Return only JSON with this exact shape: {"lines":["[CX.ID]\\tNew\\tString(3)\\tDescription\\tN"]}.',
              'Each line should be tab-separated and contain: [FieldId], Action(New or Modify), Type token, Description, optional N.',
              'Description must be human-readable only and must not repeat the FieldId or any bracketed id token.',
              'Do not add commentary, markdown, or extra keys.',
            ].join(' '),
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Extract all visible field rows from this image.' },
              { type: 'image_url', image_url: { url: imageData } },
            ],
          },
        ],
      },
      { timeout: AUTOMATOR_VISION_OPENAI_TIMEOUT_MS },
    );

    const raw = completion.choices?.[0]?.message?.content || '';
    const parsed = extractJsonObject(raw);
    const lines = Array.isArray(parsed?.lines)
      ? parsed.lines
        .filter((line) => typeof line === 'string' && line.trim())
        .map((line) => sanitizeAutomatorVisionLine(line))
      : [];

    if (lines.length === 0) {
      return res.status(422).json({
        error: 'No field rows extracted from image',
        details: 'Try a clearer screenshot or crop tightly to the field table.',
      });
    }

    return res.json({ success: true, lines });
  } catch (error) {
    console.error('Automator vision parse failed:', error.message);
    const timedOut =
      error.code === 'ETIMEDOUT' ||
      error.message?.includes?.('timeout') ||
      error.message?.includes?.('timed out');
    if (timedOut) {
      return res.status(504).json({
        error: 'Vision request timed out',
        details: `OpenAI did not respond within ${AUTOMATOR_VISION_OPENAI_TIMEOUT_MS}ms. Retry with a smaller image or raise AUTOMATOR_VISION_OPENAI_TIMEOUT_MS.`,
      });
    }
    return res.status(500).json({
      error: 'Failed to parse field definitions from image',
      details: error.message,
    });
  }
}
