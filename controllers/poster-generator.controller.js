import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    const { artist, album, style, albumCoverUrl } = req.body;
    
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
      'fillmore': `1960s Fillmore Auditorium concert poster style with swirling psychedelic lettering, ornate decorative borders, vibrant flowing colors (orange, pink, purple), art nouveau influence, Bill Graham style. Concert poster for "${album}" by ${artist}. Include ornate decorative text, peacock feathers, flowing hair motifs.`,
      
      'blacklight': `1970s black light poster style with Day-Glo neon colors (hot pink, electric blue, lime green, orange), bold outlines, cosmic imagery, stars and planets, peace symbols. Psychedelic concert poster for "${album}" by ${artist}. Glowing under black light effect, trippy mushrooms, yin-yang symbols.`,
      
      'neon': `Modern neon synthwave concert poster with vibrant electric colors, grid lines, sunset gradient (purple to pink), futuristic typography, chrome effects, vapor wave aesthetic. Concert poster for "${album}" by ${artist}. Miami Vice colors, geometric shapes, retro-futuristic.`,
      
      'psychedelic': `Intense psychedelic concert poster with fractal patterns, kaleidoscope effects, melting colors, DMT-inspired visuals, sacred geometry, third eye imagery, mandala patterns. Trippy poster for "${album}" by ${artist}. Cosmic consciousness, infinite spirals, vibrant rainbow colors.`
    };

    const prompt = stylePrompts[style] || stylePrompts['blacklight'];

    console.log('🎨 Generating poster with DALL-E...');
    console.log('Style:', style);
    console.log('Album:', album, 'by', artist);

    // Call OpenAI DALL-E API
    const response = await axios.post(
      'https://api.openai.com/v1/images/generations',
      {
        model: 'dall-e-3',
        prompt: prompt,
        n: 1,
        size: '1024x1792', // Portrait poster size
        quality: 'standard',
        style: 'vivid'
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000 // 60 second timeout
      }
    );

    if (response.data && response.data.data && response.data.data[0]) {
      const posterUrl = response.data.data[0].url;
      
      console.log('✅ Poster generated successfully');
      
      res.json({
        success: true,
        posterUrl: posterUrl,
        artist: artist,
        album: album,
        style: style
      });
    } else {
      throw new Error('No image data returned from DALL-E');
    }

  } catch (error) {
    console.error('❌ Error generating poster:', error.message);
    
    // Handle specific errors
    if (error.response?.status === 400) {
      return res.status(400).json({ 
        error: 'Invalid request to DALL-E',
        message: error.response.data?.error?.message || 'Bad request' 
      });
    } else if (error.response?.status === 429) {
      return res.status(429).json({ 
        error: 'Rate limit exceeded',
        message: 'Too many requests. Please wait a moment and try again.' 
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to generate poster',
      message: error.message 
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

