import axios from 'axios';
import { config } from '../config/index.js';

// Google Knowledge Graph search - now uses MusicBrainz for better data
export async function searchKnowledgeGraph(req, res) {
  try {
    const { artist } = req.body;
    
    if (!artist) {
      return res.status(400).json({ error: 'Artist name is required' });
    }

    console.log('🔍 Searching MusicBrainz for:', artist);

    // Use MusicBrainz API for detailed artist information
    const searchQuery = encodeURIComponent(artist);
    const musicBrainzUrl = `https://musicbrainz.org/ws/2/artist?query=${searchQuery}&fmt=json&limit=1`;

    const response = await axios.get(musicBrainzUrl, {
      headers: {
        'User-Agent': 'PiBoom/1.0 (https://github.com/wikitimetraveler/piboom)'
      }
    });

    const data = response.data;

    if (data.artists && data.artists.length > 0) {
      const artistData = data.artists[0];
      
      const result = {
        name: artistData.name || artist,
        description: `${artistData.name || artist} is a ${artistData.type || 'music artist'}${artistData.area ? ` from ${artistData.area.name}` : ''}${artistData.begin_area ? ` (born in ${artistData.begin_area.name})` : ''}.`,
        genre: artistData.tags ? artistData.tags.map(tag => tag.name).join(', ') : 'Music',
        birthDate: artistData['life-span']?.begin || 'Not specified',
        birthPlace: artistData.area?.name || artistData.begin_area?.name || 'Not specified',
        bandMembers: [],
        url: `https://musicbrainz.org/artist/${artistData.id}`,
        image: ''
      };

      res.json(result);
    } else {
      // Fallback to basic info if MusicBrainz doesn't have data
      res.json({ 
        name: artist,
        description: `${artist} is a music artist with a significant following and impact on the music industry.`,
        genre: 'Music',
        birthDate: 'Not specified',
        birthPlace: 'Not specified',
        bandMembers: [],
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(artist.replace(/\s+/g, '_'))}`,
        image: ''
      });
    }
  } catch (error) {
    console.error('MusicBrainz search error:', error);
    res.status(500).json({ error: 'Failed to search MusicBrainz' });
  }
}

// Wikipedia search with Wikidata integration
export async function searchWikipedia(req, res) {
  try {
    const { artist } = req.body;
    
    if (!artist) {
      return res.status(400).json({ error: 'Artist name is required' });
    }

    console.log('🔍 Searching Wikipedia/Wikidata for:', artist);

    // First search for the page
    const searchQuery = encodeURIComponent(artist);
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&srsearch=${searchQuery}&srlimit=1`;
    
    const searchResponse = await axios.get(searchUrl);
    const searchData = searchResponse.data;
    
    if (!searchData.query?.search?.[0]) {
      res.json({ 
        name: artist,
        description: 'No Wikipedia page found',
        error: 'No results found'
      });
      return;
    }

    const pageTitle = searchData.query.search[0].title;
    console.log('📄 Found Wikipedia page:', pageTitle);

    // Get page summary for description first
    const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`;
    const summaryResponse = await axios.get(summaryUrl);
    const summaryData = summaryResponse.data;

    // Get Wikidata information for structured data
    const wikidataInfo = await getWikidataInfo(pageTitle);
    
    // Fallback: if Wikidata didn't find birth place, try extracting from description
    if (wikidataInfo.birthPlace === 'Unknown' && summaryData.extract) {
      const extractedPlace = extractPlaceFromText(summaryData.extract);
      if (extractedPlace) {
        wikidataInfo.birthPlace = extractedPlace;
        console.log('📍 Fallback extraction from description:', extractedPlace);
      }
    }
    
    // Fallback: if no band members found in Wikidata, try multiple sources
    if (wikidataInfo.bandMembers.length === 0 && summaryData.extract) {
      // Try text extraction first
      const extractedMembers = extractBandMembersFromText(summaryData.extract);
      if (extractedMembers.length > 0) {
        wikidataInfo.bandMembers = extractedMembers;
        console.log('👥 Text extraction of band members:', extractedMembers.length);
      }
      
      // Also try MusicBrainz as additional source
      try {
        const musicBrainzMembers = await getMusicBrainzMembers(artist);
        if (musicBrainzMembers.length > 0) {
          console.log('🎵 MusicBrainz found additional members:', musicBrainzMembers.length);
          // Merge with existing members, avoiding duplicates
          const existingNames = wikidataInfo.bandMembers.map(m => m.name.toLowerCase());
          for (const mbMember of musicBrainzMembers) {
            if (!existingNames.includes(mbMember.name.toLowerCase())) {
              wikidataInfo.bandMembers.push(mbMember);
            }
          }
        }
      } catch (error) {
        console.error('❌ MusicBrainz lookup failed:', error.message);
      }
      
      // Look up individual member information for all found members
      if (wikidataInfo.bandMembers.length > 0) {
        console.log('🔄 Starting member enrichment process...');
        try {
          const enrichedMembers = await enrichBandMembersWithLocations(wikidataInfo.bandMembers);
          wikidataInfo.bandMembers = enrichedMembers;
          console.log('📍 Enriched band members with locations:', enrichedMembers.length);
        } catch (error) {
          console.error('❌ Error during member enrichment:', error.message);
          // Keep the original members if enrichment fails
        }
      }
    }

    const result = {
      name: pageTitle,
      description: summaryData.extract || 'No description available',
      genre: wikidataInfo.genre || 'Various',
      birthDate: wikidataInfo.birthDate || 'Unknown',
      birthPlace: wikidataInfo.birthPlace || 'Unknown',
      bandMembers: wikidataInfo.bandMembers || [],
      url: summaryData.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(pageTitle)}`,
      image: summaryData.thumbnail?.source || ''
    };

    res.json(result);
  } catch (error) {
    console.error('Wikipedia search error:', error);
    res.status(500).json({ error: 'Failed to search Wikipedia' });
  }
}

// Get structured data from Wikidata
async function getWikidataInfo(pageTitle) {
  try {
    // Get Wikidata ID from Wikipedia page
    const wikidataUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageprops&titles=${encodeURIComponent(pageTitle)}&ppprop=wikibase_item`;
    
    const wikidataResponse = await axios.get(wikidataUrl);
    const pages = wikidataResponse.data.query?.pages;
    const pageId = Object.keys(pages)[0];
    const wikidataId = pages[pageId]?.pageprops?.wikibase_item;
    
    if (!wikidataId) {
      console.log('❌ No Wikidata ID found');
      return { birthDate: 'Unknown', birthPlace: 'Unknown', bandMembers: [] };
    }

    console.log('🔍 Found Wikidata ID:', wikidataId);

    // Get structured data from Wikidata
    const dataUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${wikidataId}&format=json&props=claims`;
    
    const dataResponse = await axios.get(dataUrl);
    const entity = dataResponse.data.entities[wikidataId];
    
    if (!entity) {
      return { birthDate: 'Unknown', birthPlace: 'Unknown', bandMembers: [] };
    }

    const claims = entity.claims || {};
    
    // Extract birth place (P19) or formation place (P740 for bands)
    let birthPlace = 'Unknown';
    
    // Try birth place first (P19) - for individual artists
    if (claims.P19 && claims.P19[0]) {
      const placeId = claims.P19[0].mainsnak?.datavalue?.value?.id;
      if (placeId) {
        birthPlace = await getPlaceName(placeId);
      }
    }
    
    // If no birth place, try formation place for bands (P740)
    if (birthPlace === 'Unknown' && claims.P740 && claims.P740[0]) {
      const placeId = claims.P740[0].mainsnak?.datavalue?.value?.id;
      if (placeId) {
        birthPlace = await getPlaceName(placeId);
      }
    }

    // Extract birth date (P569) or formation date (P571) for bands
    let birthDate = 'Unknown';
    
    // Try birth date first (P569) - for individual artists
    if (claims.P569 && claims.P569[0]) {
      const dateValue = claims.P569[0].mainsnak?.datavalue?.value?.time;
      if (dateValue) {
        birthDate = formatWikidataDate(dateValue);
      }
    }
    
    // If no birth date, try formation date (P571) - for bands
    if (birthDate === 'Unknown' && claims.P571 && claims.P571[0]) {
      const dateValue = claims.P571[0].mainsnak?.datavalue?.value?.time;
      if (dateValue) {
        birthDate = formatWikidataDate(dateValue);
      }
    }

    // Extract band members (P527 for "has part") with enhanced data
    let bandMembers = [];
    if (claims.P527) {
      for (const member of claims.P527) {
        const memberId = member.mainsnak?.datavalue?.value?.id;
        if (memberId) {
          const memberName = await getEntityLabel(memberId);
          if (memberName) {
            // Try to get member's birth date and place directly from their Wikidata
            const memberInfo = await getMemberInfoFromWikidata(memberId);
            bandMembers.push({ 
              name: memberName, 
              instrument: 'Unknown', 
              birthPlace: memberInfo.birthPlace || 'Unknown',
              birthDate: memberInfo.birthDate || 'Unknown'
            });
          }
        }
      }
    }

    console.log('📍 Wikidata extracted:', { birthPlace, birthDate, members: bandMembers.length });

    return {
      birthDate,
      birthPlace,
      bandMembers,
      genre: 'Various' // Could extract from P136 (genre) if needed
    };

  } catch (error) {
    console.error('Wikidata extraction error:', error);
    return { birthDate: 'Unknown', birthPlace: 'Unknown', bandMembers: [] };
  }
}

// Get place name from Wikidata ID
async function getPlaceName(placeId) {
  try {
    const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${placeId}&format=json&props=labels&languages=en`;
    const response = await axios.get(url);
    const entity = response.data.entities[placeId];
    return entity?.labels?.en?.value || 'Unknown';
  } catch (error) {
    console.error('Error getting place name:', error);
    return 'Unknown';
  }
}

// Get entity label from Wikidata ID
async function getEntityLabel(entityId) {
  try {
    const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${entityId}&format=json&props=labels&languages=en`;
    const response = await axios.get(url);
    const entity = response.data.entities[entityId];
    return entity?.labels?.en?.value || null;
  } catch (error) {
    console.error('Error getting entity label:', error);
    return null;
  }
}

// Get member info directly from Wikidata
async function getMemberInfoFromWikidata(memberId) {
  try {
    const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${memberId}&format=json&props=claims`;
    const response = await axios.get(url);
    const entity = response.data.entities[memberId];
    
    if (!entity) {
      return { birthDate: 'Unknown', birthPlace: 'Unknown' };
    }
    
    const claims = entity.claims || {};
    let birthDate = 'Unknown';
    let birthPlace = 'Unknown';
    
    // Extract birth date (P569)
    if (claims.P569 && claims.P569[0]) {
      const dateValue = claims.P569[0].mainsnak?.datavalue?.value?.time;
      if (dateValue) {
        birthDate = formatWikidataDate(dateValue);
      }
    }
    
    // Extract birth place (P19)
    if (claims.P19 && claims.P19[0]) {
      const placeId = claims.P19[0].mainsnak?.datavalue?.value?.id;
      if (placeId) {
        birthPlace = await getPlaceName(placeId);
      }
    }
    
    return { birthDate, birthPlace };
  } catch (error) {
    console.error('Error getting member info from Wikidata:', error);
    return { birthDate: 'Unknown', birthPlace: 'Unknown' };
  }
}

// Format Wikidata date
function formatWikidataDate(dateString) {
  try {
    // Wikidata dates are in format +1965-00-00T00:00:00Z
    const year = dateString.match(/\+(\d{4})/);
    if (year) {
      return year[1];
    }
    return 'Unknown';
  } catch (error) {
    return 'Unknown';
  }
}

// Extract place from text as fallback
function extractPlaceFromText(text) {
  const placePatterns = [
    /formed in[:\s]+([^,\.\n]+?)(?:\s+in\s+\d{4}|\s+on\s+|\s+at\s+|$)/i,
    /born in[:\s]+([^,\.\n]+?)(?:\s+in\s+\d{4}|\s+on\s+|\s+at\s+|$)/i,
    /from[:\s]+([^,\.\n]+?)(?:\s+in\s+\d{4}|\s+on\s+|\s+at\s+|$)/i,
    /based in[:\s]+([^,\.\n]+?)(?:\s+in\s+\d{4}|\s+on\s+|\s+at\s+|$)/i,
    /originated in[:\s]+([^,\.\n]+?)(?:\s+in\s+\d{4}|\s+on\s+|\s+at\s+|$)/i,
    /started in[:\s]+([^,\.\n]+?)(?:\s+in\s+\d{4}|\s+on\s+|\s+at\s+|$)/i,
    /established in[:\s]+([^,\.\n]+?)(?:\s+in\s+\d{4}|\s+on\s+|\s+at\s+|$)/i,
    /founded in[:\s]+([^,\.\n]+?)(?:\s+in\s+\d{4}|\s+on\s+|\s+at\s+|$)/i,
    /created in[:\s]+([^,\.\n]+?)(?:\s+in\s+\d{4}|\s+on\s+|\s+at\s+|$)/i
  ];
  
  for (const pattern of placePatterns) {
    const match = text.match(pattern);
    if (match) {
      let place = match[1].trim();
      place = place.replace(/[,\n].*$/, '').trim();
      if (place.length > 0 && place.length < 100) {
        return place;
      }
    }
  }
  
  return null;
}

// Extract band members from text as fallback
function extractBandMembersFromText(text) {
  const members = [];
  
  // Look for patterns like "consisted of [names]" or "members included [names]"
  const memberPatterns = [
    /consisted of[:\s]+([^.]+?)\./i,
    /members included[:\s]+([^.]+?)\./i,
    /members were[:\s]+([^.]+?)\./i,
    /band members[:\s]+([^.]+?)\./i,
    /lineup included[:\s]+([^.]+?)\./i,
    /composed of[:\s]+([^.]+?)\./i,
    /original members[:\s]+([^.]+?)\./i,
    /founding members[:\s]+([^.]+?)\./i,
    /current members[:\s]+([^.]+?)\./i
  ];
  
  for (const pattern of memberPatterns) {
    const match = text.match(pattern);
    if (match) {
      const memberText = match[1];
      console.log('🎵 Found member text:', memberText);
      
      // Split by common separators and clean up
      const memberNames = memberText
        .split(/[,;]|\sand\s/i)
        .map(name => name.trim())
        .filter(name => name.length > 0 && name.length < 50)
        .map(name => {
          // Clean up common prefixes/suffixes
          return name
            .replace(/^(Canadians?|Americans?|British|English|Scottish|Irish|Welsh|Australian|New Zealanders?)\s+/i, '')
            .replace(/\s+(Canadians?|Americans?|British|English|Scottish|Irish|Welsh|Australian|New Zealanders?)$/i, '')
            .trim();
        })
        .filter(name => name.length > 0);
      
      // Handle the case where we have "and" in the middle of the text
      // Split the original text more carefully
      const fullMemberText = memberText.replace(/^(Canadians?|Americans?|British|English|Scottish|Irish|Welsh|Australian|New Zealanders?)\s+/i, '');
      const allMembers = fullMemberText
        .split(/\sand\s/i)
        .map(part => part.trim())
        .filter(part => part.length > 0)
        .flatMap(part => part.split(/[,;]/))
        .map(name => name.trim())
        .filter(name => name.length > 0 && name.length < 50);
      
      console.log('👥 All members after better splitting:', allMembers);
      
      // Use the better splitting result
      allMembers.forEach(name => {
        if (name && name.length > 0) {
          members.push({
            name: name,
            birthPlace: 'Unknown',
            birthDate: 'Unknown'
          });
        }
      });
      
      break; // Only process the first match
    }
  }
  
  return members;
}

// Enrich band members with individual location data
async function enrichBandMembersWithLocations(members) {
  console.log('🔍 Enriching band members with location data...');
  
  const enrichedMembers = [];
  
  // Limit to first 5 members to avoid timeout but get more data
  const membersToProcess = members.slice(0, 5);
  console.log(`👥 Processing ${membersToProcess.length} members (limited to avoid timeout)`);
  
  for (const member of membersToProcess) {
    try {
      console.log(`👤 Looking up: ${member.name}`);
      
      // Search for the individual member on Wikipedia
      const searchResponse = await axios.get('https://en.wikipedia.org/w/api.php', {
        params: {
          action: 'query',
          format: 'json',
          list: 'search',
          srsearch: member.name,
          srlimit: 1
        }
      });
      
      if (searchResponse.data.query.search.length > 0) {
        const pageTitle = searchResponse.data.query.search[0].title;
        console.log(`📄 Found Wikipedia page for ${member.name}: ${pageTitle}`);
        
        // Get the member's Wikidata information
        const memberWikidataInfo = await getWikidataInfo(pageTitle);
        
        // Get summary for additional context
        const summaryResponse = await axios.get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`);
        const summaryData = summaryResponse.data;
        
        // Fallback: if Wikidata didn't find birth place, try extracting from description
        if (memberWikidataInfo.birthPlace === 'Unknown' && summaryData.extract) {
          const extractedPlace = extractPlaceFromText(summaryData.extract);
          if (extractedPlace) {
            memberWikidataInfo.birthPlace = extractedPlace;
            console.log(`📍 Fallback extraction for ${member.name}: ${extractedPlace}`);
          }
        }
        
        // Update the member with found information
        enrichedMembers.push({
          name: member.name,
          birthPlace: memberWikidataInfo.birthPlace || 'Unknown',
          birthDate: memberWikidataInfo.birthDate || 'Unknown'
        });
        
        console.log(`✅ Enriched ${member.name}: ${memberWikidataInfo.birthPlace} (${memberWikidataInfo.birthDate})`);
      } else {
        console.log(`❌ No Wikipedia page found for ${member.name}`);
        enrichedMembers.push(member); // Keep original data
      }
      
      // Add a small delay to be respectful to APIs
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      console.error(`❌ Error enriching ${member.name}:`, error.message);
      enrichedMembers.push(member); // Keep original data on error
    }
  }
  
  return enrichedMembers;
}

// Get band members from MusicBrainz
async function getMusicBrainzMembers(artistName) {
  try {
    console.log('🎵 Searching MusicBrainz for band members:', artistName);
    
    // Search for artist
    const searchResponse = await axios.get('https://musicbrainz.org/ws/2/artist', {
      params: {
        query: artistName,
        fmt: 'json',
        limit: 1
      },
      headers: {
        'User-Agent': 'piBoom/1.0 (https://github.com/wikitimetraveler/piboom)'
      }
    });

    if (!searchResponse.data.artists || searchResponse.data.artists.length === 0) {
      return [];
    }

    const artistData = searchResponse.data.artists[0];
    console.log('🎵 Found MusicBrainz artist:', artistData.name);

    // Get detailed artist info with relationships
    const detailResponse = await axios.get(`https://musicbrainz.org/ws/2/artist/${artistData.id}`, {
      params: {
        inc: 'artist-rels',
        fmt: 'json'
      },
      headers: {
        'User-Agent': 'piBoom/1.0 (https://github.com/wikitimetraveler/piboom)'
      }
    });

    const detailedArtist = detailResponse.data;
    const bandMembers = [];

    // Extract band members from relationships
    if (detailedArtist.relations) {
      for (const relation of detailedArtist.relations) {
        if (relation.type === 'member of band' && relation.artist) {
          const member = relation.artist;
          bandMembers.push({
            name: member.name,
            birthPlace: 'Unknown', // Will be enriched later
            birthDate: 'Unknown',  // Will be enriched later
            mbid: member.id,
            type: member.type || 'Person'
          });
        }
      }
    }

    console.log('👥 Found MusicBrainz band members:', bandMembers.length);
    return bandMembers;

  } catch (error) {
    console.error('MusicBrainz search error:', error);
    return [];
  }
}

// MusicBrainz search for band members
export async function searchMusicBrainz(req, res) {
  try {
    const { artist } = req.body;
    
    if (!artist) {
      return res.status(400).json({ error: 'Artist name is required' });
    }

    console.log('🎵 Searching MusicBrainz for:', artist);
    
    // Search for artist
    const searchResponse = await axios.get('https://musicbrainz.org/ws/2/artist', {
      params: {
        query: artist,
        fmt: 'json',
        limit: 1
      },
      headers: {
        'User-Agent': 'piBoom/1.0 (https://github.com/wikitimetraveler/piboom)'
      }
    });

    if (!searchResponse.data.artists || searchResponse.data.artists.length === 0) {
      return res.json({ error: 'Artist not found in MusicBrainz' });
    }

    const artistData = searchResponse.data.artists[0];
    console.log('🎵 Found MusicBrainz artist:', artistData.name, 'ID:', artistData.id);

    // Get detailed artist info with relationships
    const detailResponse = await axios.get(`https://musicbrainz.org/ws/2/artist/${artistData.id}`, {
      params: {
        inc: 'artist-rels',
        fmt: 'json'
      },
      headers: {
        'User-Agent': 'piBoom/1.0 (https://github.com/wikitimetraveler/piboom)'
      }
    });

    const detailedArtist = detailResponse.data;
    const bandMembers = [];

    // Extract band members from relationships
    if (detailedArtist.relations) {
      for (const relation of detailedArtist.relations) {
        if (relation.type === 'member of band' && relation.artist) {
          const member = relation.artist;
          bandMembers.push({
            name: member.name,
            birthPlace: 'Unknown', // MusicBrainz doesn't have birth places
            birthDate: 'Unknown',
            mbid: member.id,
            type: member.type || 'Person'
          });
        }
      }
    }

    console.log('👥 Found MusicBrainz band members:', bandMembers.length);

    res.json({
      name: detailedArtist.name,
      mbid: detailedArtist.id,
      type: detailedArtist.type,
      country: detailedArtist.country,
      beginDate: detailedArtist['begin-area']?.name || 'Unknown',
      bandMembers: bandMembers
    });

  } catch (error) {
    console.error('MusicBrainz search error:', error);
    res.status(500).json({ error: 'Failed to search MusicBrainz' });
  }
}

// Search albums by artist using MusicBrainz
export async function searchAlbums(req, res) {
  try {
    const { artist } = req.body;
    
    if (!artist) {
      return res.status(400).json({ error: 'Artist name is required' });
    }

    console.log('🎵 Searching MusicBrainz for albums by:', artist);

    // First, find the artist
    const searchResponse = await axios.get('https://musicbrainz.org/ws/2/artist', {
      params: {
        query: artist,
        fmt: 'json',
        limit: 1
      },
      headers: {
        'User-Agent': 'piBoom/1.0 (https://github.com/your-repo)'
      }
    });

    if (!searchResponse.data.artists || searchResponse.data.artists.length === 0) {
      return res.json({ error: 'Artist not found in MusicBrainz' });
    }

    const artistData = searchResponse.data.artists[0];
    console.log('🎵 Found artist:', artistData.name, 'ID:', artistData.id);

    // Get albums for this artist
    const albumsResponse = await axios.get(`https://musicbrainz.org/ws/2/release-group`, {
      params: {
        artist: artistData.id,
        type: 'album',
        fmt: 'json',
        limit: 20
      },
      headers: {
        'User-Agent': 'piBoom/1.0 (https://github.com/your-repo)'
      }
    });

    const albums = albumsResponse.data['release-groups'].map(album => ({
      id: album.id,
      title: album.title,
      year: album['first-release-date'] ? album['first-release-date'].substring(0, 4) : 'Unknown',
      releaseDate: album['first-release-date'] || '9999-12-31', // Use far future date for unknown years
      type: album['primary-type'] || 'Album',
      coverArt: `https://coverartarchive.org/release-group/${album.id}/front-250`,
      coverArtLarge: `https://coverartarchive.org/release-group/${album.id}/front-500`,
      artist: artistData.name
    }));

    // Sort albums chronologically from first to last (oldest to newest)
    albums.sort((a, b) => {
      // Handle unknown years by putting them at the end
      if (a.year === 'Unknown' && b.year === 'Unknown') return 0;
      if (a.year === 'Unknown') return 1;
      if (b.year === 'Unknown') return -1;
      
      // Sort by release date (oldest first)
      return new Date(a.releaseDate) - new Date(b.releaseDate);
    });

    console.log('🎵 Found albums (sorted chronologically):', albums.length);

    res.json({
      artist: artistData.name,
      albums: albums,
      total: albums.length
    });

  } catch (error) {
    console.error('Album search error:', error);
    res.status(500).json({ error: 'Failed to search albums' });
  }
}

// Search YouTube for album/artist
export async function searchYouTubeForAlbum(req, res) {
  try {
    const { artist, album } = req.body;
    
    if (!artist || !album) {
      return res.status(400).json({ error: 'Artist and album are required' });
    }

    console.log('🔍 Searching YouTube for:', `${artist} ${album}`);

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'YouTube API key not configured' });
    }

    const searchQuery = `${artist} ${album} album`;
    const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        part: 'snippet',
        q: searchQuery,
        type: 'video',
        maxResults: 10,
        key: apiKey
      }
    });

    const videos = response.data.items.map(item => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      description: item.snippet.description,
      thumbnail: item.snippet.thumbnails.medium.url,
      channelTitle: item.snippet.channelTitle,
      publishedAt: item.snippet.publishedAt,
      url: `https://www.youtube.com/watch?v=${item.id.videoId}`
    }));

    console.log('🔍 Found YouTube videos:', videos.length);

    res.json({
      query: searchQuery,
      videos: videos,
      total: videos.length
    });

  } catch (error) {
    console.error('YouTube search error:', error);
    res.status(500).json({ error: 'Failed to search YouTube' });
  }
}

// YouTube search
export async function searchYouTube(req, res) {
  try {
    const { artist } = req.body;
    
    if (!artist) {
      return res.status(400).json({ error: 'Artist name is required' });
    }

    console.log('🔍 Searching YouTube for:', artist);

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Google API key not configured' });
    }
    
    // Search YouTube Data API
    const searchQuery = encodeURIComponent(artist);
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${searchQuery}&type=video&key=${apiKey}&maxResults=6`;

    const response = await axios.get(url);
    const data = response.data;

    if (data.items && data.items.length > 0) {
      const videos = data.items.map(item => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
        thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url || ''
    }));

    res.json({ videos });
    } else {
      res.json({ videos: [] });
    }
  } catch (error) {
    console.error('YouTube search error:', error);
    res.status(500).json({ error: 'Failed to search YouTube' });
  }
}

// Map data for birth places using Wikipedia/Wikidata
export async function getMapData(req, res) {
  try {
    const { artist } = req.body;
    
    if (!artist) {
      return res.status(400).json({ error: 'Artist name is required' });
    }

    console.log('🔍 Getting map data for:', artist);

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Google API key not configured' });
    }

    // Get artist information from Wikipedia/Wikidata
    const artistInfo = await getArtistInfoFromWikipedia(artist);
    
    let mapData = [];
    let timelineEvents = [];

    // Process main artist birth/formation place
    if (artistInfo.birthPlace && artistInfo.birthPlace !== 'Unknown') {
      const geocoded = await geocodeLocation(artistInfo.birthPlace, apiKey);
      if (geocoded) {
        mapData.push(geocoded);
        
        // Determine if this is a birth or formation event
        const isBand = artistInfo.name.includes('Band') || artistInfo.name.includes('Group') || 
                      artistInfo.name.includes('Ensemble') || artistInfo.name.includes('Collective');
        const eventType = isBand ? 'formation' : 'birth';
        const eventTitle = isBand ? `Formed: ${artistInfo.name}` : `Born: ${artistInfo.name}`;
        const eventDescription = isBand ? `Formation of ${artistInfo.name}` : `Birth of ${artistInfo.name}`;
        
        timelineEvents.push({
          date: artistInfo.birthDate || 'Unknown',
          title: eventTitle,
          description: eventDescription,
          location: artistInfo.birthPlace,
          type: eventType,
          coordinates: { lat: geocoded.lat, lng: geocoded.lng }
        });
      }
    }

    // Process band members' birth places
    if (artistInfo.bandMembers && artistInfo.bandMembers.length > 0) {
      for (const member of artistInfo.bandMembers) {
        if (member.birthPlace && member.birthPlace !== 'Unknown') {
          const geocoded = await geocodeLocation(member.birthPlace, apiKey);
          if (geocoded) {
            // Check if this location is already in mapData
            const exists = mapData.some(loc => 
              Math.abs(loc.lat - geocoded.lat) < 0.01 && 
              Math.abs(loc.lng - geocoded.lng) < 0.01
            );
            
            if (!exists) {
              mapData.push(geocoded);
            }
            
          timelineEvents.push({
              date: member.birthDate || 'Unknown',
              title: `Band Member: ${member.name}`,
              description: `${member.name}${member.instrument ? ` (${member.instrument})` : ''}`,
              location: member.birthPlace,
              type: 'other',
              coordinates: { lat: geocoded.lat, lng: geocoded.lng }
      });
    }
  }
      }
    }

    console.log('📍 Map data extracted:', { locations: mapData.length, events: timelineEvents.length });

    res.json({
      mapData,
      timelineEvents 
    });
  } catch (error) {
    console.error('Map data error:', error);
    res.status(500).json({ error: 'Failed to get map data' });
  }
}

// Get artist info from Wikipedia/Wikidata
async function getArtistInfoFromWikipedia(artist) {
  try {
    // Search for the page
    const searchQuery = encodeURIComponent(artist);
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&srsearch=${searchQuery}&srlimit=1`;
    
    const searchResponse = await axios.get(searchUrl);
    const searchData = searchResponse.data;
    
    if (!searchData.query?.search?.[0]) {
      return { name: artist, birthPlace: 'Unknown', birthDate: 'Unknown', bandMembers: [] };
    }

    const pageTitle = searchData.query.search[0].title;
    console.log('📄 Found Wikipedia page for map data:', pageTitle);

    // Get Wikidata information
    const wikidataInfo = await getWikidataInfo(pageTitle);
        
        return {
      name: pageTitle,
      birthPlace: wikidataInfo.birthPlace,
      birthDate: wikidataInfo.birthDate,
      bandMembers: wikidataInfo.bandMembers
    };
  } catch (error) {
    console.error('Error getting artist info:', error);
    return { name: artist, birthPlace: 'Unknown', birthDate: 'Unknown', bandMembers: [] };
  }
}

// Geocode a location using Google Maps API
async function geocodeLocation(placeName, apiKey) {
  try {
    const geocodingUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(placeName)}&key=${apiKey}`;
    
    const geoResponse = await axios.get(geocodingUrl);
    const geoData = geoResponse.data;
    
    if (geoData.results && geoData.results.length > 0) {
      const location = geoData.results[0].geometry.location;
      console.log('📍 Geocoded:', placeName, '->', location);
      return {
        name: placeName,
        lat: location.lat,
        lng: location.lng
      };
    }
    
    console.log('❌ Geocoding failed for:', placeName);
    return null;
  } catch (error) {
    console.error('Geocoding error for', placeName, ':', error);
    return null;
  }
}

// Get Google API key
export async function getGoogleApiKey(req, res) {
  try {
    // Get API key from environment variable
    const apiKey = process.env.GOOGLE_API_KEY;
    
    if (apiKey) {
      console.log('🗺️ Using Google Maps API key from environment');
      res.json({ apiKey: apiKey });
    } else {
      console.warn('❌ No Google Maps API key found in environment variables');
      res.json({ apiKey: null });
    }
  } catch (error) {
    console.error('Google API key error:', error);
    res.status(500).json({ error: 'Failed to get Google API key' });
  }
}

// Test birth date extraction
export async function testBirthDateExtraction(req, res) {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    // Mock birth date extraction
    const mockResult = {
      extractedDate: '1960-10-09',
      confidence: 0.85,
      source: 'Wikipedia'
    };

    res.json(mockResult);
  } catch (error) {
    console.error('Birth date extraction error:', error);
    res.status(500).json({ error: 'Failed to extract birth date' });
  }
}