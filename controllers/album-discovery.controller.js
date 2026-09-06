/**
 * Development work by David Lane
 */
import axios from 'axios';
import OpenAI from 'openai';
import { config } from '../config/index.js';
import { resolveOpenAiVisionModel } from '../services/openai-vision-model.js';
import { mbGet } from '../services/musicbrainz.service.js';
import {
  clampMaxAlbums,
  identifyShelfAlbumsFromImage,
  identifySingleAlbumFromImage,
  identifyStackAlbumsFromImages,
} from '../services/album-discovery-vision.service.js';

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

function quoteMusicBrainzTerm(value) {
  return String(value || '')
    .trim()
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"');
}

function mapReleaseGroups(releaseGroups, artistName) {
  return (releaseGroups || []).map((releaseGroup) => ({
    title: releaseGroup.title,
    year: releaseGroup['first-release-date']
      ? String(releaseGroup['first-release-date']).substring(0, 4)
      : 'Unknown',
    releaseDate: releaseGroup['first-release-date'] || null,
    genre: releaseGroup.tags ? releaseGroup.tags.map((tag) => tag.name).join(', ') : 'Unknown',
    artist: artistName,
    coverArt: `https://coverartarchive.org/release-group/${releaseGroup.id}/front-250`,
    musicBrainzId: releaseGroup.id,
    type: releaseGroup['primary-type'] || 'Album'
  }));
}

// Get album information (reuse from music-research controller)
export async function getAlbums(req, res) {
  try {
    const { artist } = req.body;
    
    if (!artist) {
      return res.status(400).json({ error: 'Artist name is required' });
    }

    const quoted = quoteMusicBrainzTerm(artist);
    const searchResponse = await mbGet('/artist', { query: `"${quoted}"`, limit: 1 });
    const artistData = searchResponse.data?.artists?.[0];

    if (!artistData?.id) {
      return res.json({
        success: true,
        artist,
        albums: [],
        message: 'No albums found for this artist'
      });
    }

    const albumsResponse = await mbGet('/release-group', {
      artist: artistData.id,
      type: 'album',
      limit: 20
    });

    const albums = mapReleaseGroups(albumsResponse.data?.['release-groups'], artistData.name || artist);

    res.json({
      success: true,
      artist: artistData.name || artist,
      albums
    });
  } catch (error) {
    console.error('Error fetching albums:', error);
    res.status(503).json({
      success: false,
      error: 'Failed to fetch albums',
      message: 'Album lookup is briefly unavailable. Press Search to try again.'
    });
  }
}

export async function matchIdentifiedAlbumOnMusicBrainz(albumName, artistName) {
  const title = quoteMusicBrainzTerm(albumName);
  const artist = quoteMusicBrainzTerm(artistName);
  if (!title || !artist) return null;

  const response = await mbGet('/release-group', {
    query: `releasegroup:"${title}" AND artist:"${artist}"`,
    limit: 5
  });
  const groups = response.data?.['release-groups'] || [];
  if (!groups.length) return null;
  return mapReleaseGroups(groups, groups[0]?.['artist-credit']?.[0]?.name || artistName)[0] || null;
}

function catalogYear(year) {
  const s = String(year || '').trim();
  if (!s || /^(unknown|n\/a|none)$/i.test(s)) return '';
  return s;
}

function catalogGenre(genre) {
  const s = String(genre || '').trim();
  if (!s || /^(unknown|n\/a|none)$/i.test(s)) return '';
  return s;
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

function visionQuotaResponse(res) {
  return res.status(503).json({
    error: 'AI service temporarily unavailable',
    message: 'OpenAI API quota exceeded. Please try again later.',
  });
}

function visionErrorResponse(res, error, label) {
  console.error(`Error ${label}:`, error);
  if (error.code === 'insufficient_quota') {
    return visionQuotaResponse(res);
  }
  return res.status(500).json({
    error: `Failed to ${label}`,
    message: error.message,
  });
}

// Identify album from image using OpenAI Vision
export async function identifyAlbumFromImage(req, res) {
  try {
    const { imageData } = req.body;

    if (!imageData) {
      return res.status(400).json({ error: 'Image data is required' });
    }

    console.log('🖼️ Analyzing album cover image with AI...');
    const model = resolveOpenAiVisionModel('ALBUM_VISION_MODEL');
    const { aiResponse, album } = await identifySingleAlbumFromImage(openai, model, imageData);
    console.log('🤖 AI Response:', aiResponse);

    if (album) {
      let match = null;
      try {
        match = await matchIdentifiedAlbumOnMusicBrainz(album.albumName, album.artistName);
      } catch (lookupError) {
        console.warn('MusicBrainz confirm after cover identify failed:', lookupError.message);
      }

      return res.json({
        success: true,
        albumName: match?.title || album.albumName,
        artistName: match?.artist || album.artistName,
        year: catalogYear(match?.year) || album.year || '',
        genre: catalogGenre(match?.genre),
        description: '',
        estimatedValue: null,
        confidence: album.confidence,
        musicBrainzId: match?.musicBrainzId || null,
        coverArt: match?.coverArt || null,
        matched: Boolean(match),
      });
    }

    return res.json({
      success: false,
      message: 'Could not identify the album from this image',
    });
  } catch (error) {
    return visionErrorResponse(res, error, 'identify album from image');
  }
}

// Identify up to 6 albums from shelf photo or image stack
export async function identifyAlbumsFromImages(req, res) {
  try {
    const { imageData, images, mode = 'shelf', maxAlbums = 6 } = req.body;
    const cap = clampMaxAlbums(maxAlbums);
    const model = resolveOpenAiVisionModel('ALBUM_VISION_MODEL');

    if (mode === 'stack') {
      if (!Array.isArray(images) || images.length === 0) {
        return res.status(400).json({ error: 'images array is required for stack mode' });
      }
      console.log(`🖼️ Analyzing ${Math.min(images.length, cap)} album image(s) in stack mode...`);
      const { albums } = await identifyStackAlbumsFromImages(openai, model, images, cap);
      return res.json({
        success: albums.length > 0,
        albums,
        meta: { mode: 'stack', requested: cap, identified: albums.length, model },
        message: albums.length ? undefined : 'Could not identify albums from the provided images',
      });
    }

    if (!imageData) {
      return res.status(400).json({ error: 'imageData is required for shelf mode' });
    }

    console.log(`🖼️ Analyzing shelf photo for up to ${cap} albums...`);
    const { aiResponse, albums } = await identifyShelfAlbumsFromImage(openai, model, imageData, cap);
    console.log('🤖 AI shelf response:', aiResponse);

    return res.json({
      success: albums.length > 0,
      albums,
      meta: { mode: 'shelf', requested: cap, identified: albums.length, model },
      message: albums.length ? undefined : 'Could not identify any albums in this photo',
    });
  } catch (error) {
    return visionErrorResponse(res, error, 'identify albums from images');
  }
}
