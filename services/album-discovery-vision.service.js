/**
 * Album cover vision helpers — single and multi (shelf) identification.
 */

function blankUnknown(value) {
  const s = String(value || '').trim();
  if (!s || /^(unknown|n\/a|none|null)$/i.test(s)) return '';
  return s;
}

function yearIfPrinted(value) {
  const s = blankUnknown(value);
  const match = s.match(/\b(1[89]\d{2}|20\d{2})\b/);
  return match ? match[1] : '';
}

export function extractAlbumInfoFromText(text) {
  const info = {
    albumName: '',
    artistName: '',
    year: '',
    genre: '',
    description: '',
    estimatedValue: null,
    confidence: 'medium',
  };

  const albumMatch = text.match(/album(?:Name)?[:\s]+["']?([^"'\n]+)["']?/i);
  if (albumMatch) info.albumName = albumMatch[1].trim();

  const artistMatch = text.match(/artist(?:Name)?[:\s]+["']?([^"'\n]+)["']?/i);
  if (artistMatch) info.artistName = artistMatch[1].trim();

  const yearMatch = text.match(/year[:\s]+["']?(1[89]\d{2}|20\d{2})["']?/i);
  if (yearMatch) info.year = yearMatch[1];

  return info;
}

export function clampMaxAlbums(value, fallback = 5) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(5, Math.max(1, n));
}

export function normalizeAlbumEntry(raw, index = 0) {
  if (!raw || typeof raw !== 'object') return null;

  const albumName = String(raw.albumName || raw.title || raw.album || '').trim();
  const artistName = String(raw.artistName || raw.artist || '').trim();
  if (!albumName || !artistName) return null;

  const confidence = String(raw.confidence || 'medium').toLowerCase();
  const normalizedConfidence = ['high', 'medium', 'low'].includes(confidence) ? confidence : 'medium';

  return {
    index: Number.isFinite(raw.index) ? raw.index : index + 1,
    albumName,
    artistName,
    year: yearIfPrinted(raw.year),
    genre: '',
    description: '',
    estimatedValue: null,
    confidence: normalizedConfidence,
    position: raw.position ? String(raw.position).trim() : null,
  };
}

export function parseVisionSingleAlbum(text) {
  if (!text || typeof text !== 'string') return null;

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed.albums) && parsed.albums.length === 1) {
        return normalizeAlbumEntry(parsed.albums[0], 0);
      }
      return normalizeAlbumEntry(parsed, 0);
    }
  } catch {
    // fall through to text extraction
  }

  return normalizeAlbumEntry(extractAlbumInfoFromText(text), 0);
}

export function parseVisionAlbumsFromText(text) {
  if (!text || typeof text !== 'string') return [];

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed.albums)) {
        return parsed.albums
          .map((item, i) => normalizeAlbumEntry(item, i))
          .filter(Boolean);
      }
      if (Array.isArray(parsed)) {
        return parsed
          .map((item, i) => normalizeAlbumEntry(item, i))
          .filter(Boolean);
      }
      const single = normalizeAlbumEntry(parsed, 0);
      return single ? [single] : [];
    }
  } catch {
    // fall through
  }

  const single = normalizeAlbumEntry(extractAlbumInfoFromText(text), 0);
  return single ? [single] : [];
}

export function buildSingleAlbumVisionPrompt() {
  return `Read this album jacket. Return JSON only:
{"albumName":"title printed on the cover","artistName":"artist printed on the cover","year":"four-digit year only if printed on the jacket","confidence":"high|medium|low"}

Rules:
- Use only text you can read on the cover or spine.
- Do not guess year, genre, history, condition, pressing, or market value.
- If the year is not printed, omit year or use "".
- If title and artist are unreadable, return {}.`;
}

export function buildShelfVisionPrompt(maxAlbums = 5) {
  const cap = clampMaxAlbums(maxAlbums);
  return `This photo may show multiple vinyl album covers laid out together (up to ${cap}). Read every distinct jacket you can see clearly.

Return JSON only:
{
  "albums": [
    {
      "index": 1,
      "albumName": "title printed on the cover",
      "artistName": "artist printed on the cover",
      "year": "four-digit year only if printed",
      "confidence": "high|medium|low",
      "position": "left-to-right position label"
    }
  ]
}

Rules:
- Return at most ${cap} albums.
- Order albums left-to-right, then top-to-bottom.
- Skip duplicates and unreadable covers.
- Use only text visible on each jacket. Do not guess year, genre, history, condition, or market value.
- If only one album is visible, still return an albums array with one item.`;
}

export async function identifySingleAlbumFromImage(openai, model, imageData) {
  const completion = await openai.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: 'You read album jackets. Report only title and artist you can see, and a year only if it is printed. Never invent genre, history, condition, pressing, or collector value. If unsure, use confidence low or return nothing.',
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: buildSingleAlbumVisionPrompt() },
          { type: 'image_url', image_url: { url: imageData } },
        ],
      },
    ],
    max_tokens: 400,
    temperature: 0,
  });

  const aiResponse = completion.choices[0]?.message?.content || '';
  return {
    aiResponse,
    album: parseVisionSingleAlbum(aiResponse),
  };
}

export async function identifyShelfAlbumsFromImage(openai, model, imageData, maxAlbums = 5) {
  const cap = clampMaxAlbums(maxAlbums);
  const completion = await openai.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: 'You read album jackets in a photo. List only covers whose title and artist you can see. Never invent year, genre, history, condition, or collector value.',
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: buildShelfVisionPrompt(cap) },
          { type: 'image_url', image_url: { url: imageData } },
        ],
      },
    ],
    max_tokens: 900,
    temperature: 0,
  });

  const aiResponse = completion.choices[0]?.message?.content || '';
  const albums = parseVisionAlbumsFromText(aiResponse).slice(0, cap);
  return { aiResponse, albums };
}

export async function identifyStackAlbumsFromImages(openai, model, images, maxAlbums = 5) {
  const cap = clampMaxAlbums(maxAlbums);
  const queue = images.slice(0, cap);
  const albums = [];

  for (let i = 0; i < queue.length; i += 1) {
    const { album } = await identifySingleAlbumFromImage(openai, model, queue[i]);
    if (album) {
      albums.push({ ...album, index: albums.length + 1, sourceImageIndex: i });
    }
  }

  return { albums };
}
