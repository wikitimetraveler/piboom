/**
 * Album cover vision helpers — single and multi (shelf) identification.
 */

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

  const albumMatch = text.match(/album[:\s]+["']?([^"'\n]+)["']?/i);
  if (albumMatch) info.albumName = albumMatch[1].trim();

  const artistMatch = text.match(/artist[:\s]+["']?([^"'\n]+)["']?/i);
  if (artistMatch) info.artistName = artistMatch[1].trim();

  const yearMatch = text.match(/(\d{4})/);
  if (yearMatch) info.year = yearMatch[1];

  const genreMatch = text.match(/genre[:\s]+["']?([^"'\n]+)["']?/i);
  if (genreMatch) info.genre = genreMatch[1].trim();

  const valueMatch = text.match(/value[:\s]+\$?(\d+(?:\.\d{2})?)/i);
  if (valueMatch) info.estimatedValue = parseFloat(valueMatch[1]);

  const sentences = text.split(/[.!?]/);
  if (sentences.length > 0) {
    info.description = sentences[0].trim();
  }

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

  let estimatedValue = raw.estimatedValue;
  if (estimatedValue != null && estimatedValue !== '') {
    const parsed = Number.parseFloat(String(estimatedValue).replace(/[$,]/g, ''));
    estimatedValue = Number.isFinite(parsed) ? parsed : null;
  } else {
    estimatedValue = null;
  }

  const confidence = String(raw.confidence || 'medium').toLowerCase();
  const normalizedConfidence = ['high', 'medium', 'low'].includes(confidence) ? confidence : 'medium';

  return {
    index: Number.isFinite(raw.index) ? raw.index : index + 1,
    albumName,
    artistName,
    year: raw.year ? String(raw.year).trim() : 'Unknown',
    genre: raw.genre ? String(raw.genre).trim() : 'Unknown',
    description: raw.description ? String(raw.description).trim() : 'Album identified by AI vision',
    estimatedValue,
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
  return 'Please identify this album cover and estimate its value. Provide the exact album name, artist name, release year, genre, a brief description, AND estimated market value in USD. Consider: original pressing vs reissue, condition (assume VG+ if visible), rarity, and current collector market. Format your response as JSON with fields: albumName, artistName, year, genre, description, estimatedValue (number, no $ sign), confidence (high|medium|low).';
}

export function buildShelfVisionPrompt(maxAlbums = 5) {
  const cap = clampMaxAlbums(maxAlbums);
  return `This photo may show multiple vinyl album covers or record jackets laid out together (up to ${cap}). Identify every distinct album cover you can see clearly.

Return JSON only in this shape:
{
  "albums": [
    {
      "index": 1,
      "albumName": "exact album title",
      "artistName": "artist name",
      "year": "release year or Unknown",
      "genre": "genre or Unknown",
      "description": "brief note",
      "estimatedValue": 0,
      "confidence": "high|medium|low",
      "position": "left-to-right position label"
    }
  ]
}

Rules:
- Return at most ${cap} albums.
- Order albums left-to-right, then top-to-bottom.
- Skip duplicates and unreadable covers.
- estimatedValue is USD number only (no $ sign); assume VG+ condition.
- If only one album is visible, still return an albums array with one item.`;
}

export async function identifySingleAlbumFromImage(openai, model, imageData) {
  const completion = await openai.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: 'You are an expert music historian and album cover identifier. When shown an album cover, you identify the album name, artist, and provide relevant details. Be precise and confident in your identification.',
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: buildSingleAlbumVisionPrompt() },
          { type: 'image_url', image_url: { url: imageData } },
        ],
      },
    ],
    max_tokens: 500,
    temperature: 0.3,
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
        content: 'You are an expert music historian and album cover identifier. You identify multiple album covers in one photo when present. Be precise; only list albums you can read clearly.',
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: buildShelfVisionPrompt(cap) },
          { type: 'image_url', image_url: { url: imageData } },
        ],
      },
    ],
    max_tokens: 1200,
    temperature: 0.3,
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
