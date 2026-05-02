import axios from 'axios';
import OpenAI from 'openai';
import { config } from '../config/index.js';
import { mbGet } from '../services/musicbrainz.service.js';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: config.openaiApiKey
});

// AI-powered album analysis
export async function analyzeAlbumsWithAI(req, res) {
  try {
    const { artist, albums } = req.body;
    
    if (!artist || !albums || !Array.isArray(albums)) {
      return res.status(400).json({ error: 'Artist name and albums array are required' });
    }

    // Prepare album information for AI analysis
    const albumList = albums.map(album => 
      `${album.title} (${album.year}) - ${album.genre}`
    ).join('\n');

    const prompt = `As a music expert and AI assistant, analyze the following albums by ${artist}:

${albumList}

Please provide a comprehensive analysis covering:

1. **Musical Evolution**: How has ${artist}'s sound evolved across these albums? What are the key changes in style, production, or themes?

2. **Key Albums**: Which albums are most significant and why? Highlight breakthrough albums, fan favorites, or critically acclaimed works.

3. **Musical Style**: What are the defining characteristics of ${artist}'s sound? Include genre influences, instrumentation, and unique elements.

4. **Cultural Impact**: How has ${artist} influenced music and culture? What is their legacy?

5. **Recommendations**: For someone new to ${artist}, which albums should they start with and in what order?

Please keep each section concise but informative (2-3 sentences each). Focus on insights that would help music lovers understand and appreciate ${artist}'s discography.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a knowledgeable music critic and historian with deep expertise in analyzing artist discographies. Provide insightful, accurate, and engaging analysis that helps music lovers understand an artist's work and evolution."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 800,
      temperature: 0.7
    });

    const aiResponse = completion.choices[0].message.content;
    console.log('🤖 Raw AI Response:', aiResponse);
    
    // Parse the AI response into structured sections
    const analysis = parseAIResponse(aiResponse);
    console.log('📊 Parsed Analysis:', analysis);

    res.json({
      success: true,
      artist: artist,
      albumCount: albums.length,
      rawResponse: aiResponse, // Include raw response for debugging
      ...analysis
    });

  } catch (error) {
    console.error('Error in AI album analysis:', error);
    
    if (error.code === 'insufficient_quota') {
      return res.status(503).json({ 
        error: 'AI service temporarily unavailable',
        message: 'OpenAI API quota exceeded. Please try again later.'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to analyze albums with AI',
      message: error.message 
    });
  }
}

// Parse AI response into structured sections
function parseAIResponse(response) {
  const sections = {
    evolution: '',
    keyAlbums: '',
    style: '',
    impact: '',
    recommendations: ''
  };

  try {
    console.log('🔍 Starting to parse AI response...');
    
    // Split response into sections based on headers (case-insensitive, flexible matching)
    const lines = response.split('\n');
    let currentSection = '';
    let currentContent = [];

    for (const line of lines) {
      const trimmedLine = line.trim();
      const lowerLine = trimmedLine.toLowerCase();
      
      // Match various formats: "1. **Musical Evolution**:", "Musical Evolution:", etc.
      if (lowerLine.includes('musical evolution') && (lowerLine.includes('**') || lowerLine.includes(':') || lowerLine.includes('1'))) {
        if (currentSection && currentContent.length > 0) {
          sections[currentSection] = currentContent.join(' ').trim();
        }
        currentSection = 'evolution';
        currentContent = [];
        console.log('  Found section: Musical Evolution');
      } else if (lowerLine.includes('key album') && (lowerLine.includes('**') || lowerLine.includes(':') || lowerLine.includes('2'))) {
        if (currentSection && currentContent.length > 0) {
          sections[currentSection] = currentContent.join(' ').trim();
        }
        currentSection = 'keyAlbums';
        currentContent = [];
        console.log('  Found section: Key Albums');
      } else if (lowerLine.includes('musical style') && (lowerLine.includes('**') || lowerLine.includes(':') || lowerLine.includes('3'))) {
        if (currentSection && currentContent.length > 0) {
          sections[currentSection] = currentContent.join(' ').trim();
        }
        currentSection = 'style';
        currentContent = [];
        console.log('  Found section: Musical Style');
      } else if (lowerLine.includes('cultural impact') && (lowerLine.includes('**') || lowerLine.includes(':') || lowerLine.includes('4'))) {
        if (currentSection && currentContent.length > 0) {
          sections[currentSection] = currentContent.join(' ').trim();
        }
        currentSection = 'impact';
        currentContent = [];
        console.log('  Found section: Cultural Impact');
      } else if (lowerLine.includes('recommendation') && (lowerLine.includes('**') || lowerLine.includes(':') || lowerLine.includes('5'))) {
        if (currentSection && currentContent.length > 0) {
          sections[currentSection] = currentContent.join(' ').trim();
        }
        currentSection = 'recommendations';
        currentContent = [];
        console.log('  Found section: Recommendations');
      } else if (trimmedLine && !trimmedLine.match(/^\d+\./) && currentSection) {
        // Don't include header lines, just content
        if (!trimmedLine.startsWith('**') || !trimmedLine.endsWith('**')) {
          currentContent.push(trimmedLine);
        }
      }
    }

    // Add the last section
    if (currentSection && currentContent.length > 0) {
      sections[currentSection] = currentContent.join(' ').trim();
    }

    // Clean up sections (remove numbers, bullets, markdown, etc.)
    Object.keys(sections).forEach(key => {
      if (sections[key]) {
        sections[key] = sections[key]
          .replace(/^\d+\.\s*/, '') // Remove leading numbers
          .replace(/^[-*•]\s*/, '') // Remove bullets
          .replace(/\*\*/g, '') // Remove bold markers
          .replace(/^:\s*/, '') // Remove leading colons
          .trim();
        console.log(`  ✓ ${key}: ${sections[key].substring(0, 50)}...`);
      } else {
        console.log(`  ✗ ${key}: (empty)`);
      }
    });

    // If all sections are empty, try a simpler split
    if (!sections.evolution && !sections.keyAlbums && !sections.style && !sections.impact) {
      console.log('⚠️ No sections found, using fallback...');
      // Just put the whole response in evolution
      sections.evolution = response.trim();
    }

  } catch (error) {
    console.error('❌ Error parsing AI response:', error);
    // Fallback: put entire response in evolution section
    sections.evolution = response.substring(0, 500) + '...';
  }

  return sections;
}

// Get album information (reuse from music-research controller)
export async function getAlbums(req, res) {
  try {
    const { artist } = req.body;
    
    if (!artist) {
      return res.status(400).json({ error: 'Artist name is required' });
    }


    // Use MusicBrainz API for album information
    const response = await mbGet('/release-group', {
      query: `artist:${artist}`,
      type: 'album',
      limit: 20
    });

    const data = response.data;

    if (data['release-groups'] && data['release-groups'].length > 0) {
      const albums = data['release-groups'].map(releaseGroup => ({
        title: releaseGroup.title,
        year: releaseGroup['first-release-date'] ? releaseGroup['first-release-date'].substring(0, 4) : 'Unknown',
        genre: releaseGroup.tags ? releaseGroup.tags.map(tag => tag.name).join(', ') : 'Unknown',
        artist: artist,
        coverArt: `https://coverartarchive.org/release-group/${releaseGroup.id}/front-250`,
        musicBrainzId: releaseGroup.id,
        type: 'Album'
      }));

      res.json({
        success: true,
        artist: artist,
        albums: albums
      });
    } else {
      res.json({
        success: true,
        artist: artist,
        albums: [],
        message: 'No albums found for this artist'
      });
    }

  } catch (error) {
    console.error('Error fetching albums:', error);
    res.status(500).json({ 
      error: 'Failed to fetch albums',
      message: error.message 
    });
  }
}

// Search for a specific album by name
export async function searchAlbum(req, res) {
  try {
    const { albumName } = req.body;
    
    if (!albumName) {
      return res.status(400).json({ error: 'Album name is required' });
    }

    console.log('🔍 Searching for album:', albumName);

    // Use MusicBrainz API to search for specific album
    const response = await mbGet('/release-group', {
      query: `releasegroup:${albumName}`,
      type: 'album',
      limit: 5
    });

    const data = response.data;

    if (data['release-groups'] && data['release-groups'].length > 0) {
      // Get the best match (first result)
      const releaseGroup = data['release-groups'][0];
      const artistName = releaseGroup['artist-credit'] && releaseGroup['artist-credit'][0] 
        ? releaseGroup['artist-credit'][0].name 
        : 'Unknown Artist';

      const album = {
        title: releaseGroup.title,
        year: releaseGroup['first-release-date'] ? releaseGroup['first-release-date'].substring(0, 4) : 'Unknown',
        genre: releaseGroup.tags ? releaseGroup.tags.map(tag => tag.name).join(', ') : 'Unknown',
        artist: artistName,
        coverArt: `https://coverartarchive.org/release-group/${releaseGroup.id}/front-250`,
        musicBrainzId: releaseGroup.id,
        type: 'Album'
      };

      res.json({
        success: true,
        album: album
      });
    } else {
      res.json({
        success: false,
        message: 'Album not found'
      });
    }

  } catch (error) {
    console.error('Error searching album:', error);
    res.status(500).json({ 
      error: 'Failed to search for album',
      message: error.message 
    });
  }
}

// Identify album from image using OpenAI Vision
export async function identifyAlbumFromImage(req, res) {
  try {
    const { imageData } = req.body;
    
    if (!imageData) {
      return res.status(400).json({ error: 'Image data is required' });
    }

    console.log('🖼️ Analyzing album cover image with AI...');

    // Use OpenAI Vision API to identify the album
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Vision-capable model
      messages: [
        {
          role: "system",
          content: "You are an expert music historian and album cover identifier. When shown an album cover, you identify the album name, artist, and provide relevant details. Be precise and confident in your identification."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Please identify this album cover and estimate its value. Provide the exact album name, artist name, release year, genre, a brief description, AND estimated market value in USD. Consider: original pressing vs reissue, condition (assume VG+ if visible), rarity, and current collector market. Format your response as JSON with fields: albumName, artistName, year, genre, description, estimatedValue (number, no $ sign)."
            },
            {
              type: "image_url",
              image_url: {
                url: imageData
              }
            }
          ]
        }
      ],
      max_tokens: 500,
      temperature: 0.3 // Lower temperature for more precise identification
    });

    const aiResponse = completion.choices[0].message.content;
    console.log('🤖 AI Response:', aiResponse);

    // Parse the AI response (try to extract JSON or parse text)
    let albumInfo;
    try {
      // Try to parse as JSON first
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        albumInfo = JSON.parse(jsonMatch[0]);
      } else {
        // Fallback: extract info from text
        albumInfo = extractAlbumInfoFromText(aiResponse);
      }
    } catch (parseError) {
      console.log('⚠️ JSON parse failed, extracting from text');
      albumInfo = extractAlbumInfoFromText(aiResponse);
    }

    if (albumInfo && albumInfo.albumName && albumInfo.artistName) {
      res.json({
        success: true,
        albumName: albumInfo.albumName,
        artistName: albumInfo.artistName,
        year: albumInfo.year || 'Unknown',
        genre: albumInfo.genre || 'Unknown',
        description: albumInfo.description || 'Album identified by AI vision',
        estimatedValue: albumInfo.estimatedValue || null
      });
    } else {
      res.json({
        success: false,
        message: 'Could not identify the album from this image'
      });
    }

  } catch (error) {
    console.error('Error identifying album from image:', error);
    
    if (error.code === 'insufficient_quota') {
      return res.status(503).json({ 
        error: 'AI service temporarily unavailable',
        message: 'OpenAI API quota exceeded. Please try again later.'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to identify album from image',
      message: error.message 
    });
  }
}

// Extract album info from text response (fallback)
function extractAlbumInfoFromText(text) {
  const info = {
    albumName: '',
    artistName: '',
    year: '',
    genre: '',
    description: '',
    estimatedValue: null
  };

  // Try to extract album name
  const albumMatch = text.match(/album[:\s]+["']?([^"'\n]+)["']?/i);
  if (albumMatch) info.albumName = albumMatch[1].trim();

  // Try to extract artist name
  const artistMatch = text.match(/artist[:\s]+["']?([^"'\n]+)["']?/i);
  if (artistMatch) info.artistName = artistMatch[1].trim();

  // Try to extract year
  const yearMatch = text.match(/(\d{4})/);
  if (yearMatch) info.year = yearMatch[1];

  // Try to extract genre
  const genreMatch = text.match(/genre[:\s]+["']?([^"'\n]+)["']?/i);
  if (genreMatch) info.genre = genreMatch[1].trim();

  // Try to extract estimated value
  const valueMatch = text.match(/value[:\s]+\$?(\d+(?:\.\d{2})?)/i);
  if (valueMatch) info.estimatedValue = parseFloat(valueMatch[1]);

  // Use first sentence as description
  const sentences = text.split(/[.!?]/);
  if (sentences.length > 0) {
    info.description = sentences[0].trim();
  }

  return info;
}
