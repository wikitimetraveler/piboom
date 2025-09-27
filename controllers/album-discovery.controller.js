import axios from 'axios';
import OpenAI from 'openai';
import { config } from '../config/index.js';

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

    console.log(`🤖 Analyzing ${albums.length} albums for ${artist} with AI`);

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
    
    // Parse the AI response into structured sections
    const analysis = parseAIResponse(aiResponse);

    res.json({
      success: true,
      artist: artist,
      albumCount: albums.length,
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
    // Split response into sections based on headers
    const lines = response.split('\n');
    let currentSection = '';
    let currentContent = [];

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine.includes('**Musical Evolution**') || trimmedLine.includes('Musical Evolution')) {
        if (currentSection && currentContent.length > 0) {
          sections[currentSection] = currentContent.join(' ').trim();
        }
        currentSection = 'evolution';
        currentContent = [];
      } else if (trimmedLine.includes('**Key Albums**') || trimmedLine.includes('Key Albums')) {
        if (currentSection && currentContent.length > 0) {
          sections[currentSection] = currentContent.join(' ').trim();
        }
        currentSection = 'keyAlbums';
        currentContent = [];
      } else if (trimmedLine.includes('**Musical Style**') || trimmedLine.includes('Musical Style')) {
        if (currentSection && currentContent.length > 0) {
          sections[currentSection] = currentContent.join(' ').trim();
        }
        currentSection = 'style';
        currentContent = [];
      } else if (trimmedLine.includes('**Cultural Impact**') || trimmedLine.includes('Cultural Impact')) {
        if (currentSection && currentContent.length > 0) {
          sections[currentSection] = currentContent.join(' ').trim();
        }
        currentSection = 'impact';
        currentContent = [];
      } else if (trimmedLine.includes('**Recommendations**') || trimmedLine.includes('Recommendations')) {
        if (currentSection && currentContent.length > 0) {
          sections[currentSection] = currentContent.join(' ').trim();
        }
        currentSection = 'recommendations';
        currentContent = [];
      } else if (trimmedLine && !trimmedLine.startsWith('**') && currentSection) {
        currentContent.push(trimmedLine);
      }
    }

    // Add the last section
    if (currentSection && currentContent.length > 0) {
      sections[currentSection] = currentContent.join(' ').trim();
    }

    // Clean up sections (remove numbers, bullets, etc.)
    Object.keys(sections).forEach(key => {
      if (sections[key]) {
        sections[key] = sections[key]
          .replace(/^\d+\.\s*/, '') // Remove leading numbers
          .replace(/^[-*]\s*/, '') // Remove bullets
          .replace(/\*\*/g, '') // Remove bold markers
          .trim();
      }
    });

  } catch (error) {
    console.error('Error parsing AI response:', error);
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

    console.log(`🎵 Searching for albums by: ${artist}`);

    // Use MusicBrainz API for album information
    const searchQuery = encodeURIComponent(artist);
    const musicBrainzUrl = `https://musicbrainz.org/ws/2/release-group?query=artist:${searchQuery}&type=album&fmt=json&limit=20`;

    const response = await axios.get(musicBrainzUrl, {
      headers: {
        'User-Agent': 'PiBoom/1.0 (https://github.com/wikitimetraveler/piboom)'
      }
    });

    const data = response.data;

    if (data['release-groups'] && data['release-groups'].length > 0) {
      const albums = data['release-groups'].map(releaseGroup => ({
        title: releaseGroup.title,
        year: releaseGroup['first-release-date'] ? releaseGroup['first-release-date'].substring(0, 4) : 'Unknown',
        genre: releaseGroup.tags ? releaseGroup.tags.map(tag => tag.name).join(', ') : 'Unknown',
        artist: artist,
        coverArt: `https://coverartarchive.org/release-group/${releaseGroup.id}/front-250`,
        musicBrainzId: releaseGroup.id
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
