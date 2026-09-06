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

export const MAX_SHELF_ALBUMS = 6;
export const SHELF_VISION_BATCH = 6;

export function clampMaxAlbums(value, fallback = MAX_SHELF_ALBUMS) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(MAX_SHELF_ALBUMS, Math.max(1, n));
}

export function clampShelfBatch(value, fallback = SHELF_VISION_BATCH) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(SHELF_VISION_BATCH, Math.max(1, n));
}

export function albumIdentityKey(album) {
  const title = String(album?.albumName || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  const artist = String(album?.artistName || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  return `${artist}::${title}`;
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

export function extractJsonObject(text) {
  if (!text || typeof text !== 'string') return null;
  let from = 0;
  while (from < text.length) {
    const start = text.indexOf('{', from);
    if (start < 0) return null;
    let depth = 0;
    let closedAt = -1;
    for (let i = start; i < text.length; i += 1) {
      const ch = text[i];
      if (ch === '{') depth += 1;
      else if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          closedAt = i;
          break;
        }
      }
    }
    if (closedAt < 0) return null;
    try {
      return JSON.parse(text.slice(start, closedAt + 1));
    } catch {
      from = start + 1;
    }
  }
  return null;
}

export function parseVisionSingleAlbum(text) {
  if (!text || typeof text !== 'string') return null;

  const parsed = extractJsonObject(text);
  if (parsed) {
    if (Array.isArray(parsed.albums) && parsed.albums.length === 1) {
      return normalizeAlbumEntry(parsed.albums[0], 0);
    }
    return normalizeAlbumEntry(parsed, 0);
  }

  return normalizeAlbumEntry(extractAlbumInfoFromText(text), 0);
}

export function parseVisionAlbumsFromText(text) {
  if (!text || typeof text !== 'string') return [];

  const parsed = extractJsonObject(text);
  if (parsed) {
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

  const single = normalizeAlbumEntry(extractAlbumInfoFromText(text), 0);
  return single ? [single] : [];
}

export function buildSingleAlbumVisionPrompt() {
  return `Identify the album in this photo from the cover artwork and any readable title or artist text. Return JSON only:
{"albumName":"album title","artistName":"artist name","year":"four-digit year only if printed on the jacket","confidence":"high|medium|low"}

Rules:
- Identify the release from the cover art even if the lettering is stylized or partly obscured.
- Prefer printed title and artist when they are readable.
- Do not guess market value, condition, pressing, or collector grade.
- If the year is not printed on the jacket, omit year or use "".
- If you cannot identify the album, return {}.`;
}

export function buildShelfVisionPrompt(maxAlbums = SHELF_VISION_BATCH, alreadyFound = []) {
  const batch = clampShelfBatch(maxAlbums);
  const found = Array.isArray(alreadyFound) ? alreadyFound.filter(Boolean) : [];
  const skipBlock =
    found.length > 0
      ? `\nAlready identified (do not repeat these):\n${found
          .slice(0, MAX_SHELF_ALBUMS)
          .map((line) => `- ${line}`)
          .join('\n')}\n`
      : '';

  return `This photo may show several vinyl or CD album covers. Identify the next batch of distinct albums you can recognize (up to ${batch} in this response).
${skipBlock}
Return JSON only:
{
  "albums": [
    {
      "index": 1,
      "albumName": "album title",
      "artistName": "artist name",
      "year": "four-digit year only if printed",
      "confidence": "high|medium|low",
      "position": "left-to-right / row position label"
    }
  ],
  "moreRemain": true
}

Rules:
- Return at most ${batch} NEW albums in this response.
- Identify each release from cover art plus any readable title/artist text.
- Set moreRemain to true if additional identifiable covers remain; otherwise false.
- Order albums left-to-right, then top-to-bottom.
- Skip duplicates, unreadable spines, and covers already listed.
- Do not guess market value, condition, pressing, or collector grade.
- If only one new album is visible, still return an albums array with one item.
- If none remain, return {"albums":[],"moreRemain":false}.`;
}

export async function identifySingleAlbumFromImage(openai, model, imageData) {
  const completion = await openai.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: 'You identify album covers from photos. Return the album title and artist from artwork and readable text. Include a year only if it is printed on the jacket. Never invent market value, condition, pressing, or collector grade. If you cannot identify the album, return nothing.',
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

export function parseShelfBatchMeta(text) {
  if (!text || typeof text !== 'string') return { moreRemain: false };
  const parsed = extractJsonObject(text);
  if (!parsed) return { moreRemain: false };
  if (typeof parsed.moreRemain === 'boolean') return { moreRemain: parsed.moreRemain };
  if (Array.isArray(parsed.albums) && parsed.albums.length >= SHELF_VISION_BATCH) {
    return { moreRemain: true };
  }
  return { moreRemain: false };
}

export async function identifyShelfAlbumsFromImage(
  openai,
  model,
  imageData,
  maxAlbums = MAX_SHELF_ALBUMS,
  batchSize = SHELF_VISION_BATCH
) {
  const cap = clampMaxAlbums(maxAlbums);
  const batch = clampShelfBatch(batchSize);
  const albums = [];
  const seen = new Set();
  const responses = [];
  let rounds = 0;
  const maxRounds = Math.ceil(cap / batch) + 1;

  while (albums.length < cap && rounds < maxRounds) {
    rounds += 1;
    const alreadyFound = albums.map((a) => `${a.artistName} — ${a.albumName}`);
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content:
            'You identify album covers in a photo. List title and artist for each cover you can recognize from artwork or readable text. Never invent market value, condition, pressing, or collector grade. Work in small batches and never repeat albums already listed.',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: buildShelfVisionPrompt(batch, alreadyFound) },
            { type: 'image_url', image_url: { url: imageData } },
          ],
        },
      ],
      max_tokens: 1200,
      temperature: 0,
    });

    const aiResponse = completion.choices[0]?.message?.content || '';
    responses.push(aiResponse);
    const batchAlbums = parseVisionAlbumsFromText(aiResponse);
    let added = 0;
    for (const album of batchAlbums) {
      if (albums.length >= cap) break;
      const key = albumIdentityKey(album);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      albums.push({ ...album, index: albums.length + 1 });
      added += 1;
    }

    const { moreRemain } = parseShelfBatchMeta(aiResponse);
    if (added === 0 || !moreRemain) break;
  }

  return {
    aiResponse: responses.join('\n---\n'),
    albums,
    meta: { rounds, batch, requested: cap, identified: albums.length },
  };
}

export async function identifyStackAlbumsFromImages(openai, model, images, maxAlbums = MAX_SHELF_ALBUMS) {
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
