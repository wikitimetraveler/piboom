/**
 * Development work by David Lane
 */
import OpenAI from 'openai';
import { FIND_CATEGORIES } from './finds.service.js';
import { resolveOpenAiVisionModel } from './openai-vision-model.js';

const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || '').trim();
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

const MAX_IMAGES = 5;

const SYSTEM_PROMPT = `You are an expert at identifying thrift-store, flea-market, and vintage objects from photos.
Return a single JSON object with this exact shape (use null for unknown numbers, false for unknown booleans, "" for unknown strings):
{
  "title": "short descriptive title",
  "category": one of: art, bags, clothing, vintage_electronics, audio, books, decor, ceramics_glass, sporting, unknown,
  "subcategory": "",
  "identification": {
    "maker": "",
    "probableMaker": "",
    "signed": false,
    "numbered": false,
    "edition": "",
    "medium": "",
    "visibleText": "any readable text from the image",
    "confidence": 0.0 to 1.0
  },
  "condition": {
    "overall": "good|fair|poor|unknown",
    "framed": false,
    "notes": ""
  },
  "valuation": {
    "listingLow": null,
    "listingHigh": null,
    "realisticLow": null,
    "realisticHigh": null,
    "confidence": "low|medium|high",
    "notes": "brief note on how you estimated; mention listing vs sold prices are different"
  },
  "tags": ["string"],
  "summaryText": "2-4 sentences for a user and for text-to-speech",
  "notes": "what to verify next (signature pencil vs print, edition, etc.)"
}
Be conservative on valuation; realistic ranges should not assume retail gallery ask prices.
Output ONLY valid JSON, no markdown.`;

/**
 * @param {string[]} images - data URLs (data:image/...)
 * @param {string} [notes]
 * @returns {Promise<{ analysis: object }>}
 */
export async function analyzeFindImages({ images, notes }) {
  if (!openai) {
    const err = new Error('OpenAI not configured');
    err.statusCode = 503;
    throw err;
  }
  if (!Array.isArray(images) || images.length === 0) {
    const err = new Error('At least one image (data URL) is required');
    err.statusCode = 400;
    throw err;
  }
  const slice = images.slice(0, MAX_IMAGES);
  for (const url of slice) {
    if (typeof url !== 'string' || !url.startsWith('data:image')) {
      const err = new Error('Each image must be a data:image/* URL');
      err.statusCode = 400;
      throw err;
    }
  }

  const userContent = [
    { type: 'text', text: notes ? `User notes: ${notes}\n\nIdentify and analyze the object(s) in the images.` : 'Identify and analyze the object(s) in the images.' },
    ...slice.map((url) => ({ type: 'image_url', image_url: { url } })),
  ];

  const response = await openai.chat.completions.create({
    model: resolveOpenAiVisionModel('FINDS_VISION_MODEL'),
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
    max_tokens: 1200,
    temperature: 0.2,
    response_format: { type: 'json_object' },
  });

  const raw = response.choices?.[0]?.message?.content || '{}';
  let analysis;
  try {
    analysis = JSON.parse(raw);
  } catch {
    const err = new Error('AI returned invalid JSON');
    err.statusCode = 502;
    throw err;
  }

  if (typeof analysis.category === 'string' && !FIND_CATEGORIES.includes(analysis.category)) {
    analysis.category = 'unknown';
  }
  if (!analysis.identification || typeof analysis.identification !== 'object') {
    analysis.identification = {
      maker: '',
      probableMaker: '',
      signed: false,
      numbered: false,
      edition: '',
      medium: '',
      visibleText: '',
      confidence: 0,
    };
  }
  if (!analysis.valuation || typeof analysis.valuation !== 'object') {
    analysis.valuation = {
      listingLow: null,
      listingHigh: null,
      realisticLow: null,
      realisticHigh: null,
      confidence: 'low',
      notes: '',
    };
  }
  return { analysis };
}
