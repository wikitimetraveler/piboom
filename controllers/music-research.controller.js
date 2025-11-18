import axios from 'axios';
import { config } from '../config/index.js';

// Google Knowledge Graph search - now uses MusicBrainz for better data
export async function searchKnowledgeGraph(req, res) {
  try {
    const { artist } = req.body;
    
    if (!artist) {
      return res.status(400).json({ error: 'Artist name is required' });
    }

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

    // First search for the page with music context to avoid disambiguation
    // Add "band" or "musician" to prioritize music results over non-music topics
    const searchQuery = encodeURIComponent(`${artist} band music`);
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&srsearch=${searchQuery}&srlimit=1`;
    
    const searchResponse = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'piBoom/1.0 (https://github.com/wikitimetraveler/piboom; contact@example.com)'
      }
    });
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

    // Get page summary for description first
    const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`;
    const summaryResponse = await axios.get(summaryUrl, {
      headers: {
        'User-Agent': 'piBoom/1.0 (https://github.com/wikitimetraveler/piboom; contact@example.com)'
      }
    });
    const summaryData = summaryResponse.data;

    // Get Wikidata information for structured data
    const wikidataInfo = await getWikidataInfo(pageTitle);
    
    // Fallback: if Wikidata didn't find birth place, try extracting from description
    if (wikidataInfo.birthPlace === 'Unknown' && summaryData.extract) {
      const extractedPlace = extractPlaceFromText(summaryData.extract);
      if (extractedPlace) {
        wikidataInfo.birthPlace = extractedPlace;
      }
    }
    
    // Fallback: if no band members found in Wikidata, try multiple sources
    if (wikidataInfo.bandMembers.length === 0 && summaryData.extract) {
      // Try text extraction first
      const extractedMembers = extractBandMembersFromText(summaryData.extract);
      if (extractedMembers.length > 0) {
        wikidataInfo.bandMembers = extractedMembers;
      }
      
      // Also try MusicBrainz as additional source
      try {
        const musicBrainzMembers = await getMusicBrainzMembers(artist);
        if (musicBrainzMembers.length > 0) {
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
        try {
          const enrichedMembers = await enrichBandMembersWithLocations(wikidataInfo.bandMembers);
          wikidataInfo.bandMembers = enrichedMembers;
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
    
    const wikidataResponse = await axios.get(wikidataUrl, {
      headers: {
        'User-Agent': 'piBoom/1.0 (https://github.com/wikitimetraveler/piboom; contact@example.com)'
      }
    });
    const pages = wikidataResponse.data.query?.pages;
    const pageId = Object.keys(pages)[0];
    const wikidataId = pages[pageId]?.pageprops?.wikibase_item;
    
    if (!wikidataId) {
      return { birthDate: 'Unknown', birthPlace: 'Unknown', bandMembers: [] };
    }

    // Get structured data from Wikidata
    const dataUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${wikidataId}&format=json&props=claims`;
    
    const dataResponse = await axios.get(dataUrl, {
      headers: {
        'User-Agent': 'piBoom/1.0 (https://github.com/wikitimetraveler/piboom; contact@example.com)'
      }
    });
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
              instrument: memberInfo.instruments && memberInfo.instruments.length > 0 
                ? memberInfo.instruments.join(', ') 
                : 'Unknown', 
              birthPlace: memberInfo.birthPlace || 'Unknown',
              birthDate: memberInfo.birthDate || 'Unknown',
              deathDate: memberInfo.deathDate || null,
              deathPlace: memberInfo.deathPlace || null,
              associatedActs: memberInfo.associatedActs || [],
              imageUrl: memberInfo.imageUrl || null,
              equipment: []
            });
          }
        }
      }
    }

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
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'piBoom/1.0 (https://github.com/wikitimetraveler/piboom; contact@example.com)'
      }
    });
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
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'piBoom/1.0 (https://github.com/wikitimetraveler/piboom; contact@example.com)'
      }
    });
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
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'piBoom/1.0 (https://github.com/wikitimetraveler/piboom; contact@example.com)'
      }
    });
    const entity = response.data.entities[memberId];
    
    if (!entity) {
      return { 
        birthDate: 'Unknown', 
        birthPlace: 'Unknown', 
        deathDate: null, 
        deathPlace: null,
        instruments: [],
        associatedActs: [],
        imageUrl: null
      };
    }
    
    const claims = entity.claims || {};
    let birthDate = 'Unknown';
    let birthPlace = 'Unknown';
    let deathDate = null;
    let deathPlace = null;
    let instruments = [];
    let associatedActs = [];
    let imageUrl = null;
    
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
    
    // Extract death date (P570)
    if (claims.P570 && claims.P570[0]) {
      const dateValue = claims.P570[0].mainsnak?.datavalue?.value?.time;
      if (dateValue) {
        deathDate = formatWikidataDate(dateValue);
      }
    }
    
    // Extract death place (P20)
    if (claims.P20 && claims.P20[0]) {
      const placeId = claims.P20[0].mainsnak?.datavalue?.value?.id;
      if (placeId) {
        deathPlace = await getPlaceName(placeId);
      }
    }
    
    // Extract instruments (P1303 - instrument played)
    if (claims.P1303) {
      for (const instrumentClaim of claims.P1303) {
        const instrumentId = instrumentClaim.mainsnak?.datavalue?.value?.id;
        if (instrumentId) {
          const instrumentName = await getEntityLabel(instrumentId);
          if (instrumentName) {
            instruments.push(instrumentName);
          }
        }
      }
    }
    
    // Extract associated acts/bands (P463 - member of)
    if (claims.P463) {
      const limitedActs = claims.P463.slice(0, 5); // Limit to 5 to avoid too many requests
      for (const actClaim of limitedActs) {
        const actId = actClaim.mainsnak?.datavalue?.value?.id;
        if (actId) {
          const actName = await getEntityLabel(actId);
          if (actName) {
            // Try to get years active from qualifiers
            const startTime = actClaim.qualifiers?.P580?.[0]?.datavalue?.value?.time;
            const endTime = actClaim.qualifiers?.P582?.[0]?.datavalue?.value?.time;
            
            const yearsActive = formatYearsActive(startTime, endTime);
            associatedActs.push({
              name: actName,
              years: yearsActive
            });
          }
        }
      }
    }
    
    // Extract image (P18)
    if (claims.P18 && claims.P18[0]) {
      const imageName = claims.P18[0].mainsnak?.datavalue?.value;
      if (imageName) {
        // Convert to Commons URL
        imageUrl = await getWikimediaImageUrl(imageName);
      }
    }
    
    return { 
      birthDate, 
      birthPlace, 
      deathDate,
      deathPlace,
      instruments,
      associatedActs,
      imageUrl
    };
  } catch (error) {
    console.error('Error getting member info from Wikidata:', error);
    return { 
      birthDate: 'Unknown', 
      birthPlace: 'Unknown', 
      deathDate: null,
      deathPlace: null,
      instruments: [],
      associatedActs: [],
      imageUrl: null
    };
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

// Format years active from start and end times
function formatYearsActive(startTime, endTime) {
  if (!startTime && !endTime) return '';
  
  const start = startTime ? formatWikidataDate(startTime) : '?';
  const end = endTime ? formatWikidataDate(endTime) : 'present';
  
  if (start === end) return start;
  return `${start}-${end}`;
}

// Get Wikimedia Commons image URL
async function getWikimediaImageUrl(imageName) {
  try {
    // Convert spaces to underscores
    const fileName = imageName.replace(/ /g, '_');
    // Create thumbnail URL (250px width)
    const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}?width=250`;
    return url;
  } catch (error) {
    console.error('Error getting image URL:', error);
    return null;
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
      
      // Use the better splitting result and try to extract instruments
      allMembers.forEach(name => {
        if (name && name.length > 0 && isValidPersonName(name)) {
          // Try to extract instrument from parentheses like "John Doe (guitar)"
          const instrumentMatch = name.match(/^(.+?)\s*\(([^)]+)\)$/);
          if (instrumentMatch) {
            members.push({
              name: instrumentMatch[1].trim(),
              instrument: instrumentMatch[2].trim(),
              birthPlace: 'Unknown',
              birthDate: 'Unknown',
              equipment: []
            });
          } else {
            members.push({
              name: name,
              instrument: 'Unknown',
              birthPlace: 'Unknown',
              birthDate: 'Unknown',
              equipment: []
            });
          }
        }
      });
      
      break; // Only process the first match
    }
  }
  
  return members;
}

// Validate if a string looks like a real person name
function isValidPersonName(name) {
  // Remove common prefixes
  const cleanName = name.trim();
  
  // Must start with capital letter (proper name)
  if (!/^[A-Z]/.test(cleanName)) return false;
  
  // Filter out common non-person words
  const invalidWords = [
    'flour', 'water', 'sugar', 'salt', 'butter', 'milk', 'egg', 'eggs',
    'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
    'album', 'albums', 'song', 'songs', 'track', 'tracks', 'record', 'records',
    'music', 'band', 'group', 'members', 'artists', 'musicians',
    'guitar', 'bass', 'drums', 'vocals', 'keyboard', 'piano', // instruments alone
    'lead', 'rhythm', 'backing', 'session', // roles alone
    'american', 'british', 'canadian', 'australian', 'english', 'scottish', 'irish', 'welsh',
    'rock', 'pop', 'jazz', 'blues', 'metal', 'punk', 'folk', 'country' // genres
  ];
  
  const lowerName = cleanName.toLowerCase();
  if (invalidWords.includes(lowerName)) return false;
  
  // Should have at least one space (first name + last name) or be a known single name
  // Single names are usually stage names and should be capitalized throughout or have special chars
  const wordCount = cleanName.split(/\s+/).length;
  if (wordCount === 1 && cleanName.length < 3) return false; // Too short for a real name
  
  // Filter out sentences (too many words)
  if (wordCount > 5) return false;
  
  // Must contain letters (not just numbers or special chars)
  if (!/[a-zA-Z]{2,}/.test(cleanName)) return false;
  
  // Filter out things that look like dates or numbers
  if (/^\d+/.test(cleanName)) return false;
  
  return true;
}

// Enrich band members with individual location data and instruments
async function enrichBandMembersWithLocations(members) {
  const enrichedMembers = [];
  
  // Limit to first 10 members to avoid timeout but get more data
  const membersToProcess = members.slice(0, 10);
  
  for (const member of membersToProcess) {
    try {
      // Search for the individual member on Wikipedia
      const searchResponse = await axios.get('https://en.wikipedia.org/w/api.php', {
        params: {
          action: 'query',
          format: 'json',
          list: 'search',
          srsearch: member.name,
          srlimit: 1
        },
        headers: {
          'User-Agent': 'piBoom/1.0 (https://github.com/wikitimetraveler/piboom; contact@example.com)'
        }
      });
      
      if (searchResponse.data.query.search.length > 0) {
        const pageTitle = searchResponse.data.query.search[0].title;
        
        // Get the member's Wikidata ID
        const wikidataIdResponse = await axios.get('https://en.wikipedia.org/w/api.php', {
          params: {
            action: 'query',
            format: 'json',
            prop: 'pageprops',
            titles: pageTitle,
            ppprop: 'wikibase_item'
          },
          headers: {
            'User-Agent': 'piBoom/1.0 (https://github.com/wikitimetraveler/piboom; contact@example.com)'
          }
        });
        
        const pages = wikidataIdResponse.data.query?.pages;
        const pageId = Object.keys(pages)[0];
        const wikidataId = pages[pageId]?.pageprops?.wikibase_item;
        
        let memberInfo = {};
        if (wikidataId) {
          // Get detailed member info from Wikidata
          memberInfo = await getMemberInfoFromWikidata(wikidataId);
        }
        
        // Get summary for additional context and image
        const summaryResponse = await axios.get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`, {
          headers: {
            'User-Agent': 'piBoom/1.0 (https://github.com/wikitimetraveler/piboom; contact@example.com)'
          }
        });
        const summaryData = summaryResponse.data;
        
        // Fallback: if Wikidata didn't find birth place, try extracting from description
        if (memberInfo.birthPlace === 'Unknown' && summaryData.extract) {
          const extractedPlace = extractPlaceFromText(summaryData.extract);
          if (extractedPlace) {
            memberInfo.birthPlace = extractedPlace;
          }
        }
        
        // Determine instrument - prefer existing data, then Wikidata, then extract from Wikipedia
        let instrument = member.instrument || 'Unknown';
        if (memberInfo.instruments && memberInfo.instruments.length > 0) {
          instrument = memberInfo.instruments.join(', ');
        } else if (summaryData.extract) {
          // Try to extract instrument from Wikipedia summary
          const extractedInstrument = extractInstrumentFromText(summaryData.extract, member.name);
          if (extractedInstrument && extractedInstrument !== 'Unknown') {
            instrument = extractedInstrument;
          }
        }
        
        // Use Wikipedia thumbnail if no Wikidata image
        const imageUrl = memberInfo.imageUrl || summaryData.thumbnail?.source || null;
        
        // Extract signature equipment from Wikipedia text
        const equipment = summaryData.extract ? extractSignatureEquipment(summaryData.extract, member.name) : [];
        
        // Update the member with found information
        enrichedMembers.push({
          name: member.name,
          instrument: instrument,
          birthPlace: memberInfo.birthPlace || 'Unknown',
          birthDate: memberInfo.birthDate || 'Unknown',
          deathDate: memberInfo.deathDate || null,
          deathPlace: memberInfo.deathPlace || null,
          associatedActs: memberInfo.associatedActs || [],
          imageUrl: imageUrl,
          equipment: equipment
        });
      } else {
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

// Extract instrument from Wikipedia text
function extractInstrumentFromText(text, memberName) {
  // Look for patterns like "John is a guitarist" or "John (vocals)" or "John plays guitar"
  const instrumentPatterns = [
    new RegExp(`${memberName}[^.]*?\\(([^)]+)\\)`, 'i'),
    new RegExp(`${memberName}[^.]*?(?:plays|played)\\s+(?:the\\s+)?([\\w\\s,]+?)(?:\\.|,|and)`, 'i'),
    /(?:vocalist|singer|guitarist|bassist|drummer|keyboardist|pianist|saxophonist|trumpeter)/gi
  ];
  
  // Check for patterns with member name
  for (let i = 0; i < 2; i++) {
    const match = text.match(instrumentPatterns[i]);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  
  // Check for common instrument keywords in the text
  const commonInstruments = {
    'vocalist': 'vocals',
    'singer': 'vocals',
    'guitarist': 'guitar',
    'bassist': 'bass',
    'drummer': 'drums',
    'keyboardist': 'keyboards',
    'pianist': 'piano',
    'saxophonist': 'saxophone',
    'trumpeter': 'trumpet'
  };
  
  for (const [key, value] of Object.entries(commonInstruments)) {
    if (text.toLowerCase().includes(key)) {
      return value;
    }
  }
  
  return 'Unknown';
}

// Extract signature equipment from Wikipedia text
function extractSignatureEquipment(text, memberName) {
  const equipment = [];
  
  // Patterns for equipment mentions
  const equipmentPatterns = [
    // "John used a Fender Stratocaster"
    new RegExp(`${memberName}[^.]*?(?:used|uses|played|plays|known for|favored|preferred)\\s+(?:a|an|the)?\\s*([A-Z][\\w\\s-]+(?:guitar|bass|drum|keyboard|piano|amp|amplifier|synthesizer|organ))`, 'gi'),
    // Generic equipment mentions in context
    /(?:Fender|Gibson|Gretsch|Rickenbacker|Martin|Yamaha|Roland|Moog|Hammond|Marshall|Vox|Orange)\s+[\w\s-]+/gi,
    // Specific guitar models
    /(?:Stratocaster|Telecaster|Les Paul|SG|Flying V|Explorer|Precision Bass|Jazz Bass|Thunderbird)/gi
  ];
  
  for (const pattern of equipmentPatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const item = match[1] || match[0];
      if (item && item.length > 3 && item.length < 50) {
        // Clean up and add
        const cleaned = item.trim().replace(/\s+/g, ' ');
        if (!equipment.includes(cleaned)) {
          equipment.push(cleaned);
        }
      }
    }
  }
  
  return equipment.slice(0, 3); // Limit to top 3
}

// Get band members from MusicBrainz
async function getMusicBrainzMembers(artistName) {
  try {
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
          // Try to get instrument from relationship attributes
          let instrument = 'Unknown';
          if (relation.attributes && relation.attributes.length > 0) {
            instrument = relation.attributes.join(', ');
          }
          bandMembers.push({
            name: member.name,
            instrument: instrument,
            birthPlace: 'Unknown', // Will be enriched later
            birthDate: 'Unknown',  // Will be enriched later
            deathDate: null,
            deathPlace: null,
            associatedActs: [],
            imageUrl: null,
            equipment: [],
            mbid: member.id,
            type: member.type || 'Person'
          });
        }
      }
    }

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
    let bandMembers = [];

    // Extract band members from relationships
    // For bands, look for "member" type relationships (forward direction)
    // For individuals, look for "member of band" type relationships (backward direction)
    if (detailedArtist.relations) {
      for (const relation of detailedArtist.relations) {
        // Check for members of the band (type: "member", direction: forward)
        if (relation.type === 'member' && relation.artist && (!relation.direction || relation.direction === 'forward')) {
          const member = relation.artist;
          // Try to get instrument from relationship attributes
          let instrument = 'Unknown';
          if (relation.attributes && relation.attributes.length > 0) {
            instrument = relation.attributes.join(', ');
          }
          bandMembers.push({
            name: member.name,
            instrument: instrument,
            birthPlace: 'Unknown', // MusicBrainz doesn't have birth places
            birthDate: 'Unknown',
            deathDate: null,
            deathPlace: null,
            associatedActs: [],
            imageUrl: null,
            equipment: [],
            mbid: member.id,
            type: member.type || 'Person'
          });
        }
        // Also check "member of band" relationships (backward direction)
        // This handles cases where the relationship is stored differently
        if (relation.type === 'member of band' && relation.artist && relation.direction === 'backward') {
          const member = relation.artist;
          let instrument = 'Unknown';
          if (relation.attributes && relation.attributes.length > 0) {
            instrument = relation.attributes.join(', ');
          }
          // Avoid duplicates
          if (!bandMembers.find(m => m.mbid === member.id)) {
            bandMembers.push({
              name: member.name,
              instrument: instrument,
              birthPlace: 'Unknown',
              birthDate: 'Unknown',
              deathDate: null,
              deathPlace: null,
              associatedActs: [],
              imageUrl: null,
              equipment: [],
              mbid: member.id,
              type: member.type || 'Person'
            });
          }
        }
      }
    }

    // Enrich band members with Wikipedia/Wikidata data to get birth places
    if (bandMembers.length > 0) {
      try {
        const enrichedMembers = await enrichBandMembersWithLocations(bandMembers);
        bandMembers = enrichedMembers;
      } catch (error) {
        console.error('Error enriching band members:', error);
        // Continue with unenriched members if enrichment fails
      }
    }

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

    res.json({
      query: searchQuery,
      videos: videos,
      total: videos.length
    });

  } catch (error) {
    console.error('YouTube search error:', error);
    console.error('Error details:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Failed to search YouTube',
      details: error.message,
      response: error.response?.data
    });
  }
}

// YouTube search
export async function searchYouTube(req, res) {
  try {
    const { artist } = req.body;
    
    if (!artist) {
      return res.status(400).json({ error: 'Artist name is required' });
    }

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
        thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url || '',
        url: `https://www.youtube.com/watch?v=${item.id.videoId}`
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
          // Pass band's formation place as context to help geocode member locations
          const geocoded = await geocodeLocation(member.birthPlace, apiKey, artistInfo.birthPlace);
          if (geocoded) {
            // Check if this location is already in mapData
            const exists = mapData.some(loc => 
              Math.abs(loc.lat - geocoded.lat) < 0.01 && 
              Math.abs(loc.lng - geocoded.lng) < 0.01
            );
            
            if (!exists) {
              // Add member name to geocoded data for marker matching
              geocoded.memberName = member.name;
              geocoded.memberInstrument = member.instrument;
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
    
    const searchResponse = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'piBoom/1.0 (https://github.com/wikitimetraveler/piboom; contact@example.com)'
      }
    });
    const searchData = searchResponse.data;
    
    if (!searchData.query?.search?.[0]) {
      return { name: artist, birthPlace: 'Unknown', birthDate: 'Unknown', bandMembers: [] };
    }

    const pageTitle = searchData.query.search[0].title;

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

// Geocode a location using Google Maps API with context-aware fallback strategies
async function geocodeLocation(placeName, apiKey, bandContext = null) {
  // 🚫🚫🚫 AUTOMATIC GEOCODING COMPLETELY DISABLED TO PREVENT API CHARGES 🚫🚫🚫
  console.warn('🚫 GEOCODING DISABLED - No API calls will be made for location:', placeName);
  return null;
  
  /* DISABLED TO PREVENT API CHARGES
  try {
    // Try original place name first
    let result = await tryGeocode(placeName, apiKey);
    if (result) return result;
    
    // Build smart variations based on band context (country of origin)
    const variations = [placeName]; // Always try original first
    
    // Check if placeName is incomplete (just a city, no country info)
    const hasCountryInfo = placeName.includes(',') || 
                          placeName.toLowerCase().includes('usa') ||
                          placeName.toLowerCase().includes('uk') ||
                          placeName.toLowerCase().includes('kingdom') ||
                          placeName.toLowerCase().includes('korea') ||
                          placeName.toLowerCase().includes('england') ||
                          placeName.toLowerCase().includes('scotland');
    
    // Only use band context if location is incomplete (just city name)
    if (!hasCountryInfo && bandContext) {
      const contextCountry = detectCountryFromContext(bandContext);
      if (contextCountry) {
        // Add context country variations FIRST (most likely correct)
        variations.push(
          `${placeName}, ${contextCountry}`,
          `${placeName} ${contextCountry}`
        );
        if (contextCountry.includes('United Kingdom') || contextCountry.includes('UK')) {
          variations.push(`${placeName}, England`, `${placeName}, Scotland`, `${placeName}, Wales`);
        }
        if (contextCountry.includes('South Korea')) {
          variations.push(`${placeName}-si, South Korea`, `${placeName}, Gyeonggi, South Korea`);
        }
      }
    }
    
    // Then add standard fallbacks - UK and USA first (most popular music)
    variations.push(
      `${placeName}, United Kingdom`, // UK first - lots of classic rock bands
      `${placeName}, UK`,
      `${placeName}, England`,
      `${placeName}, England, UK`,
      `${placeName}, USA`, // USA second - lots of artists
      `${placeName}, United States`,
      `${placeName}, Scotland, UK`,
      `${placeName}, Wales, UK`,
      `${placeName}, Ireland`,
      `${placeName}, Northern Ireland`,
      `${placeName}, South Korea`, // K-pop
      `${placeName}-si, South Korea`,
      `${placeName}, Gyeonggi, South Korea`,
      `${placeName}, Korea`,
      `${placeName}, Japan`, // J-pop
      `${placeName}, Tokyo, Japan`,
      `${placeName}, Canada`,
      `${placeName}, Australia`,
      `${placeName}, Germany`,
      `${placeName}, France`,
      `${placeName}, Italy`,
      `${placeName}, Sweden`,
      `${placeName}, California, USA`,
      `${placeName}, Texas, USA`,
      `${placeName}, New York, USA`,
      `${placeName}, London, UK`,
      `${placeName}, Kent, England`,
      placeName.replace(/,.*$/, ''),
      placeName.split(',')[0] + ', UK',
      placeName.split(',')[0] + ', USA',
      placeName.split(',')[0] + ', South Korea'
    );
    
    // Try each variation
    for (const variation of variations) {
      result = await tryGeocode(variation, apiKey);
      if (result) {
        result.name = placeName; // Keep original name
        return result;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Geocoding error for', placeName, ':', error);
    return null;
  }
  */
}

// Detect country from band context (formation place)
function detectCountryFromContext(context) {
  if (!context || typeof context !== 'string') return null;
  
  const ctx = context.toLowerCase();
  
  // Check for countries in the context
  if (ctx.includes('south korea') || ctx.includes('seoul') || ctx.includes('busan') || ctx.includes('korea')) {
    return 'South Korea';
  }
  if (ctx.includes('united kingdom') || ctx.includes('london') || ctx.includes('england') || 
      ctx.includes('liverpool') || ctx.includes('manchester') || ctx.includes('birmingham')) {
    return 'United Kingdom';
  }
  if (ctx.includes('scotland') || ctx.includes('glasgow') || ctx.includes('edinburgh')) {
    return 'United Kingdom';
  }
  if (ctx.includes('wales') || ctx.includes('cardiff')) {
    return 'United Kingdom';
  }
  if (ctx.includes('united states') || ctx.includes('usa') || ctx.includes('california') || 
      ctx.includes('new york') || ctx.includes('texas') || ctx.includes('los angeles')) {
    return 'USA';
  }
  if (ctx.includes('japan') || ctx.includes('tokyo') || ctx.includes('osaka')) {
    return 'Japan';
  }
  if (ctx.includes('canada') || ctx.includes('toronto') || ctx.includes('montreal')) {
    return 'Canada';
  }
  if (ctx.includes('australia') || ctx.includes('sydney') || ctx.includes('melbourne')) {
    return 'Australia';
  }
  if (ctx.includes('germany') || ctx.includes('berlin') || ctx.includes('hamburg')) {
    return 'Germany';
  }
  if (ctx.includes('france') || ctx.includes('paris')) {
    return 'France';
  }
  if (ctx.includes('sweden') || ctx.includes('stockholm')) {
    return 'Sweden';
  }
  
  return null;
}

// Helper function to attempt geocoding
async function tryGeocode(address, apiKey) {
  // 🚫🚫🚫 AUTOMATIC GEOCODING COMPLETELY DISABLED TO PREVENT API CHARGES 🚫🚫🚫
  console.warn('🚫 GEOCODING DISABLED - No API calls will be made for:', address);
  return null;
  
  /* DISABLED TO PREVENT API CHARGES
  try {
    const geocodingUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
    
    const geoResponse = await axios.get(geocodingUrl);
    const geoData = geoResponse.data;
    
    if (geoData.results && geoData.results.length > 0 && geoData.status === 'OK') {
      const location = geoData.results[0].geometry.location;
      return {
        name: address,
        lat: location.lat,
        lng: location.lng
      };
    }
    
    return null;
  } catch (error) {
    return null;
  }
  */
}

// Get Google API key
export async function getGoogleApiKey(req, res) {
  try {
    // Get API key from environment variable
    const apiKey = process.env.GOOGLE_API_KEY;
    
    if (apiKey) {
      res.json({ apiKey: apiKey });
    } else {
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