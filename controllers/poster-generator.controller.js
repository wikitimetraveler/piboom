/**
 * Development work by David Lane
 */
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import { resolveOpenAiVisionModel } from '../services/openai-vision-model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

const SHARE_STORE_PATH = path.join(__dirname, '..', 'data', 'poster-shares.json');
const POSTER_DIR = path.join(__dirname, '..', 'public', 'shared', 'posters');

async function loadShareStore() {
  try {
    const data = await fs.readFile(SHARE_STORE_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return {};
  }
}

async function saveShareStore(store) {
  await fs.mkdir(path.dirname(SHARE_STORE_PATH), { recursive: true });
  await fs.writeFile(SHARE_STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
}

// Generate concert poster using OpenAI DALL-E
export async function generatePoster(req, res) {
  try {
    const {
      artist,
      album,
      style,
      albumCoverUrl,
      albumCoverData,
      customPrompt,
      quality = 'standard',
      size = '1024x1792',
      title,
      subtitle,
      venue,
      date,
      addQrCode
    } = req.body;

    if (!artist || !album) {
      return res.status(400).json({ error: 'Artist and album are required' });
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: 'OpenAI API key not configured',
        message: 'Please add OPENAI_API_KEY to your .env file'
      });
    }

    // Build the prompt based on style
    const stylePrompts = {
      fillmore: `1960s Fillmore Auditorium concert poster style with swirling psychedelic lettering, ornate decorative borders, vibrant flowing colors (orange, pink, purple), art nouveau influence, Bill Graham style. Concert poster for "${album}" by ${artist}. Include ornate decorative text, peacock feathers, flowing hair motifs.`,
      blacklight: `1970s black light poster style with Day-Glo neon colors (hot pink, electric blue, lime green, orange), bold outlines, cosmic imagery, stars and planets, peace symbols. Psychedelic concert poster for "${album}" by ${artist}. Glowing under black light effect, trippy mushrooms, yin-yang symbols.`,
      neon: `Modern neon synthwave concert poster with vibrant electric colors, grid lines, sunset gradient (purple to pink), futuristic typography, chrome effects, vapor wave aesthetic. Concert poster for "${album}" by ${artist}. Miami Vice colors, geometric shapes, retro-futuristic.`,
      psychedelic: `Intense psychedelic concert poster with fractal patterns, kaleidoscope effects, melting colors, DMT-inspired visuals, sacred geometry, third eye imagery, mandala patterns. Trippy poster for "${album}" by ${artist}. Cosmic consciousness, infinite spirals, vibrant rainbow colors.`,
      art_deco: `1920s Art Deco concert poster with geometric patterns, gold and black color scheme, elegant typography, symmetrical design, sunburst motifs, streamlined forms. Concert poster for "${album}" by ${artist}. Luxurious, glamorous, Great Gatsby aesthetic.`,
      minimalist: `Minimalist concert poster with clean design, single-color or subtle gradient background, bold sans-serif typography, lots of negative space, modern and understated. Concert poster for "${album}" by ${artist}. Simple, elegant, no clutter.`,
      vintage: `Vintage concert poster with worn paper texture, sepia tones, letterpress typography, aged edges, nostalgic feel. Concert poster for "${album}" by ${artist}. Classic rock poster aesthetic, faded colors, retro charm.`,
      grunge: `Grunge concert poster with torn edges, distressed textures, punk aesthetic, raw and edgy typography, dark moody colors. Concert poster for "${album}" by ${artist}. 90s alternative rock vibe, gritty, rebellious.`
    };

    let prompt = stylePrompts[style] || stylePrompts.blacklight;
    if (customPrompt && typeof customPrompt === 'string' && customPrompt.trim()) {
      prompt = prompt + ' ' + customPrompt.trim();
    }

    // Inject overlay text into prompt when provided
    const overlayParts = [];
    if (title && title !== album) overlayParts.push(`Title: "${title}"`);
    if (subtitle && subtitle !== artist) overlayParts.push(`Subtitle: "${subtitle}"`);
    if (venue) overlayParts.push(`Venue: "${venue}"`);
    if (date) overlayParts.push(`Date: "${date}"`);
    if (overlayParts.length > 0) {
      prompt += ' Include these text elements: ' + overlayParts.join(', ') + '.';
    }

    // Image reference: use GPT-4 Vision to describe album cover when available, then inject into prompt
    let coverImageData = null;
    if (albumCoverData && albumCoverData.startsWith('data:image')) {
      coverImageData = albumCoverData;
    } else if (albumCoverUrl) {
      try {
        const imgRes = await axios.get(albumCoverUrl, { responseType: 'arraybuffer' });
        const base64 = Buffer.from(imgRes.data).toString('base64');
        const contentType = imgRes.headers['content-type'] || 'image/jpeg';
        coverImageData = `data:${contentType};base64,${base64}`;
      } catch (e) {
        console.warn('Could not fetch album cover for vision:', e.message);
      }
    }

    if (coverImageData && openai) {
      try {
        const visionRes = await openai.chat.completions.create({
          model: resolveOpenAiVisionModel('POSTER_VISION_MODEL'),
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Describe this album cover in 2-3 sentences: colors, mood, visual style, typography, and any distinctive elements. Be concise.' },
                { type: 'image_url', image_url: { url: coverImageData } }
              ]
            }
          ],
          max_tokens: 150,
          temperature: 0.3
        });
        const description = visionRes.choices?.[0]?.message?.content?.trim();
        if (description) {
          prompt = `Concert poster in a style inspired by this album's visual mood and color palette. Album cover description: ${description}. ${prompt}`;
        } else {
          prompt = `Concert poster in a style inspired by this album's visual mood and color palette. ${prompt}`;
        }
      } catch (e) {
        console.warn('Vision description failed, using fallback:', e.message);
        prompt = `Concert poster in a style inspired by this album's visual mood and color palette. ${prompt}`;
      }
    } else if (coverImageData && !openai) {
      prompt = `Concert poster in a style inspired by this album's visual mood and color palette. ${prompt}`;
    }

    // QR code in prompt when requested
    if (addQrCode) {
      const spotifyUrl = `https://open.spotify.com/search/${encodeURIComponent(artist + ' ' + album)}`;
      prompt += ` Include a small QR code in the bottom corner linking to: ${spotifyUrl}.`;
    }

    // Map UI sizes/qualities onto gpt-image-1 (this account no longer has dall-e-3).
    // Legacy UI values: 1024x1792 / 1792x1024 / standard / hd
    const sizeMap = {
      '1024x1024': '1024x1024',
      '1024x1792': '1024x1536',
      '1792x1024': '1536x1024',
      '1024x1536': '1024x1536',
      '1536x1024': '1536x1024',
      auto: 'auto'
    };
    const qualityMap = {
      standard: 'medium',
      hd: 'high',
      low: 'low',
      medium: 'medium',
      high: 'high',
      auto: 'auto'
    };
    const imageModel = String(process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1').trim() || 'gpt-image-1';
    const posterSize = sizeMap[size] || '1024x1536';
    const posterQuality = qualityMap[quality] || 'medium';

    console.log('Generating poster with', imageModel, '...');
    console.log('Style:', style, 'Quality:', posterQuality, 'Size:', posterSize);
    console.log('Album:', album, 'by', artist);

    const response = await axios.post(
      'https://api.openai.com/v1/images/generations',
      {
        model: imageModel,
        prompt,
        n: 1,
        size: posterSize,
        quality: posterQuality
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 120000
      }
    );

    const image = response.data?.data?.[0];
    if (!image) {
      throw new Error('No image data returned from image model');
    }

    let posterUrl = image.url || null;
    // gpt-image-1 returns b64_json (no durable URL) — persist under /shared/posters/
    if (!posterUrl && image.b64_json) {
      const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      const fileName = `gen-${id}.png`;
      await fs.mkdir(POSTER_DIR, { recursive: true });
      await fs.writeFile(path.join(POSTER_DIR, fileName), Buffer.from(image.b64_json, 'base64'));
      posterUrl = `/shared/posters/${fileName}`;
    }

    if (!posterUrl) {
      throw new Error('Image model returned neither url nor b64_json');
    }

    console.log('✅ Poster generated successfully');

    res.json({
      success: true,
      posterUrl,
      artist,
      album,
      style,
      model: imageModel
    });
  } catch (error) {
    console.error('❌ Error generating poster:', error.message);

    if (error.response?.status === 400) {
      const detail = error.response.data?.error?.message || 'Bad request';
      console.error('Image API 400 detail:', detail);
      return res.status(400).json({
        error: 'Invalid request to image API',
        message: detail
      });
    } else if (error.response?.status === 429) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Too many requests. Please wait a moment and try again.'
      });
    }

    res.status(500).json({
      error: 'Failed to generate poster',
      message: error.response?.data?.error?.message || error.message
    });
  }
}

export default {
  generatePoster
};

export async function createPosterShare(req, res) {
  try {
    const { imageData, title, type } = req.body;
    if (!imageData || typeof imageData !== 'string') {
      return res.status(400).json({ success: false, error: 'imageData is required' });
    }

    const match = imageData.match(/^data:image\/png;base64,(.+)$/);
    if (!match) {
      return res.status(400).json({ success: false, error: 'Only PNG data URLs are supported' });
    }

    const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const fileName = `${id}.png`;
    const buffer = Buffer.from(match[1], 'base64');

    await fs.mkdir(POSTER_DIR, { recursive: true });
    await fs.writeFile(path.join(POSTER_DIR, fileName), buffer);

    const store = await loadShareStore();
    store[id] = {
      id,
      title: title || 'Shared Poster',
      type: type || 'poster',
      imageUrl: `/shared/posters/${fileName}`,
      createdAt: new Date().toISOString()
    };
    await saveShareStore(store);

    return res.json({
      success: true,
      shareId: id,
      shareUrl: `/share/poster/${id}`,
      imageUrl: store[id].imageUrl
    });
  } catch (error) {
    console.error('❌ Error creating poster share:', error);
    return res.status(500).json({ success: false, error: 'Failed to create share link' });
  }
}

export async function getPosterShare(req, res) {
  try {
    const { id } = req.params;
    const store = await loadShareStore();
    if (!store[id]) {
      return res.status(404).json({ success: false, error: 'Share not found' });
    }
    return res.json({ success: true, share: store[id] });
  } catch (error) {
    console.error('❌ Error loading poster share:', error);
    return res.status(500).json({ success: false, error: 'Failed to load share' });
  }
}

export async function proxyPosterImage(req, res) {
  try {
    const imageUrl = req.query.url;
    if (!imageUrl) {
      return res.status(400).send('Missing url');
    }

    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 15000
    });

    res.setHeader('Content-Type', response.headers['content-type'] || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(Buffer.from(response.data));
  } catch (error) {
    return res.status(404).send('Image not available');
  }
}

