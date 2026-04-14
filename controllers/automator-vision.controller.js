import OpenAI from 'openai';
import { config } from '../config/index.js';

const openai = config.openaiApiKey ? new OpenAI({ apiKey: config.openaiApiKey }) : null;

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

export async function postParseAutomatorFieldImage(req, res) {
  try {
    if (!openai) {
      return res.status(503).json({ error: 'OpenAI not configured' });
    }

    const imageData = req.body?.imageData;
    if (!imageData || typeof imageData !== 'string' || !imageData.startsWith('data:image')) {
      return res.status(400).json({ error: 'imageData data URL is required' });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.1,
      max_tokens: 700,
      messages: [
        {
          role: 'system',
          content: [
            'You extract Encompass custom field definition rows from screenshots.',
            'Return only JSON with this exact shape: {"lines":["[CX.ID]\\tNew\\tString(3)\\tDescription\\tN"]}.',
            'Each line should be tab-separated and contain: [FieldId], Action(New or Modify), Type token, Description, optional N.',
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
    });

    const raw = completion.choices?.[0]?.message?.content || '';
    const parsed = extractJsonObject(raw);
    const lines = Array.isArray(parsed?.lines)
      ? parsed.lines.filter((line) => typeof line === 'string' && line.trim())
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
    return res.status(500).json({
      error: 'Failed to parse field definitions from image',
      details: error.message,
    });
  }
}
