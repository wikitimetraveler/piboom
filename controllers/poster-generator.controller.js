import axios from 'axios';

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

