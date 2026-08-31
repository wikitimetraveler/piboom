/**
 * Development work by David Lane
 */
import axios from 'axios';
import { geocodeAddressFree } from '../services/free-geocoding.service.js';
import { getGoogleBrowserApiKey, getGoogleServerApiKey } from '../lib/google-api-key.js';
import { mbGet } from '../services/musicbrainz.service.js';
import {
  wikimediaApiGet,
  wikidataApiGet,
  WikimediaRateLimitError
} from '../services/music-research-wikimedia.service.js';
import {
  getMusicBrainzArtistByName,
  applyMusicBrainzFallback,
  enrichMemberBirthDatesFromMusicBrainz
} from '../services/music-research-musicbrainz.service.js';

const WIKIMEDIA_RATE_LIMIT_MESSAGE =
  'Wikipedia is temporarily rate-limiting requests. Please wait a minute and try again.';

function isWikimediaRateLimitError(error) {
  return error instanceof WikimediaRateLimitError || error?.name === 'WikimediaRateLimitError';
}

function respondWikimediaRateLimit(res) {
  return res.status(503).json({
    error: WIKIMEDIA_RATE_LIMIT_MESSAGE,
    rateLimited: true
  });
}

/** Batch english labels for Q-ids (up to 50 per request — API limit). */
async function wikidataLabelsEnForIds(rawIds) {
  const uniq = [...new Set((rawIds || []).filter(Boolean).map(String))];
  const map = new Map();
  if (!uniq.length) return map;

  for (let i = 0; i < uniq.length; i += 50) {
    const chunk = uniq.slice(i, i + 50);
    const idsParam = chunk.map((id) => encodeURIComponent(String(id))).join('|');
    const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${idsParam}&format=json&props=labels&languages=en`;
    const res = await wikidataApiGet(url);
    const entities = res.data?.entities || {};
    for (const id of Object.keys(entities)) {
      const v = entities[id]?.labels?.en?.value;
      if (v) map.set(id, v);
    }
  }
  return map;
}

// Google Knowledge Graph search - now uses MusicBrainz for better data
export async function searchKnowledgeGraph(req, res) {
  try {
    const { artist } = req.body;
    
    if (!artist) {
      return res.status(400).json({ error: 'Artist name is required' });
    }

    // Use MusicBrainz API for detailed artist information
    const response = await mbGet('/artist', { query: artist, limit: 1 });

    const data = response.data;

    if (data.artists && data.artists.length > 0) {
      const artistData = data.artists[0];
      const description = `${artistData.name || artist} is a ${artistData.type || 'music artist'}${artistData.area ? ` from ${artistData.area.name}` : ''}${artistData.begin_area ? ` (born in ${artistData.begin_area.name})` : ''}.`;
      
      const result = {
        success: true,
        name: artistData.name || artist,
        description,
        detailedDescription: description,
        genre: artistData.tags ? artistData.tags.map(tag => tag.name).join(', ') : 'Music',
        birthDate: artistData['life-span']?.begin || 'Not specified',
        birthPlace: artistData.area?.name || artistData.begin_area?.name || 'Not specified',
        bandMembers: [],
        url: `https://musicbrainz.org/artist/${artistData.id}`,
        image: '',
        imageUrl: ''
      };

      res.json(result);
    } else {
      // Fallback to basic info if MusicBrainz doesn't have data
      res.json({
        success: true,
        name: artist,
        description: `${artist} is a music artist with a significant following and impact on the music industry.`,
        detailedDescription: `${artist} is a music artist with a significant following and impact on the music industry.`,
        genre: 'Music',
        birthDate: 'Not specified',
        birthPlace: 'Not specified',
        bandMembers: [],
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(artist.replace(/\s+/g, '_'))}`,
        image: '',
        imageUrl: ''
      });
    }
  } catch (error) {
    console.error('MusicBrainz search error:', error);
    res.json({
      success: true,
      name: artist,
      description: `${artist} — artist lookup is briefly unavailable. Search again in a moment.`,
      detailedDescription: `${artist} — artist lookup is briefly unavailable. Search again in a moment.`,
      genre: 'Music',
      birthDate: 'Not specified',
      birthPlace: 'Not specified',
      bandMembers: [],
      url: '',
      image: '',
      imageUrl: ''
    });
  }
}

// Wikipedia search with Wikidata integration
export async function searchWikipedia(req, res) {
  const { artist } = req.body;

  if (!artist) {
    return res.status(400).json({ error: 'Artist name is required' });
  }

  try {
    // First search for the page with music context to avoid disambiguation
    // Add "band" or "musician" to prioritize music results over non-music topics
    const searchQuery = encodeURIComponent(`${artist} band music`);
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&srsearch=${searchQuery}&srlimit=1`;
    
    const searchResponse = await wikimediaApiGet(searchUrl);
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
    const summaryResponse = await wikimediaApiGet(summaryUrl);
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
          let enrichedMembers = await enrichBandMembersWithLocations(wikidataInfo.bandMembers);
          enrichedMembers = await enrichMemberBirthDatesFromMusicBrainz(enrichedMembers);
          wikidataInfo.bandMembers = enrichedMembers;
        } catch (error) {
          console.error('❌ Error during member enrichment:', error.message);
          // Keep the original members if enrichment fails
        }
      }
    }

    const mbArtist = await getMusicBrainzArtistByName(artist);
    const mergedDates = applyMusicBrainzFallback(
      {
        birthDate: wikidataInfo.birthDate || 'Unknown',
        birthPlace: wikidataInfo.birthPlace || 'Unknown',
        name: pageTitle
      },
      mbArtist
    );

    const result = {
      name: pageTitle,
      description: summaryData.extract || 'No description available',
      genre: wikidataInfo.genre || 'Various',
      birthDate: mergedDates.birthDate || 'Unknown',
      birthPlace: mergedDates.birthPlace || 'Unknown',
      bandMembers: wikidataInfo.bandMembers || [],
      url: summaryData.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(pageTitle)}`,
      image: summaryData.thumbnail?.source || ''
    };

    res.json(result);
  } catch (error) {
    if (isWikimediaRateLimitError(error)) {
      const mb = await getMusicBrainzArtistByName(artist);
      if (mb) {
        let bandMembers = [];
        try {
          bandMembers = await getMusicBrainzMembers(artist);
          bandMembers = await enrichMemberBirthDatesFromMusicBrainz(bandMembers);
        } catch (mbErr) {
          console.error('MusicBrainz members fallback failed:', mbErr.message);
        }
        return res.json({
          name: mb.name,
          description: `${mb.name} is a music artist (data from MusicBrainz; Wikipedia temporarily unavailable).`,
          genre: 'Various',
          birthDate: mb.birthDate,
          birthPlace: mb.birthPlace,
          bandMembers,
          url: `https://musicbrainz.org/artist/${mb.mbid}`,
          image: '',
          wikipediaRateLimited: true
        });
      }
      return respondWikimediaRateLimit(res);
    }
    console.error('Wikipedia search error:', error);
    res.status(500).json({ error: 'Failed to search Wikipedia' });
  }
}

// Get structured data from Wikidata
async function getWikidataInfo(pageTitle) {
  try {
    // Get Wikidata ID from Wikipedia page
    const wikidataUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageprops&titles=${encodeURIComponent(pageTitle)}&ppprop=wikibase_item`;
    
    const wikidataResponse = await wikimediaApiGet(wikidataUrl);
    const pages = wikidataResponse.data.query?.pages;
    const pageId = Object.keys(pages)[0];
    const wikidataId = pages[pageId]?.pageprops?.wikibase_item;
    
    if (!wikidataId) {
      return { birthDate: 'Unknown', birthPlace: 'Unknown', bandMembers: [] };
    }

    // Get structured data from Wikidata
    const dataUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${wikidataId}&format=json&props=claims`;

    const dataResponse = await wikidataApiGet(dataUrl);
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
      const memberIds = [];
      for (const member of claims.P527) {
        const mid = member.mainsnak?.datavalue?.value?.id;
        if (mid) memberIds.push(mid);
      }
      const memberLabelMap = await wikidataLabelsEnForIds(memberIds);
      for (const memberId of memberIds) {
        const memberName = memberLabelMap.get(memberId);
        if (!memberName) continue;
        const memberInfo = await getMemberInfoFromWikidata(memberId);
        bandMembers.push({
          name: memberName,
          instrument:
            memberInfo.instruments && memberInfo.instruments.length > 0
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

    return {
      birthDate,
      birthPlace,
      bandMembers,
      genre: 'Various' // Could extract from P136 (genre) if needed
    };

  } catch (error) {
    if (isWikimediaRateLimitError(error)) {
      throw error;
    }
    console.error('Wikidata extraction error:', error);
    return { birthDate: 'Unknown', birthPlace: 'Unknown', bandMembers: [] };
  }
}

// Get place name from Wikidata ID
async function getPlaceName(placeId) {
  try {
    const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${encodeURIComponent(
      placeId
    )}&format=json&props=labels&languages=en`;
    const response = await wikidataApiGet(url);
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
    const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${encodeURIComponent(
      entityId
    )}&format=json&props=labels&languages=en`;
    const response = await wikidataApiGet(url);
    const entity = response.data.entities[entityId];
    return entity?.labels?.en?.value || null;
  } catch (error) {
    console.error('Error getting entity label:', error);
    return null;
  }
}

// Get member info directly from Wikidata (1 claims request + batched label requests)
async function getMemberInfoFromWikidata(memberId) {
  try {
    const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${encodeURIComponent(
      memberId
    )}&format=json&props=claims`;
    const response = await wikidataApiGet(url);
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
    let deathDate = null;
    let instruments = [];
    let associatedActs = [];
    let imageUrl = null;

    const idsForLabels = [];

    let birthPlaceId = null;
    let deathPlaceId = null;

    // Extract birth date (P569)
    if (claims.P569 && claims.P569[0]) {
      const dateValue = claims.P569[0].mainsnak?.datavalue?.value?.time;
      if (dateValue) birthDate = formatWikidataDate(dateValue);
    }

    // Extract birth place (P19)
    if (claims.P19 && claims.P19[0]) {
      birthPlaceId = claims.P19[0].mainsnak?.datavalue?.value?.id;
      if (birthPlaceId) idsForLabels.push(birthPlaceId);
    }

    // Extract death date (P570)
    if (claims.P570 && claims.P570[0]) {
      const dateValue = claims.P570[0].mainsnak?.datavalue?.value?.time;
      if (dateValue) deathDate = formatWikidataDate(dateValue);
    }

    // Extract death place (P20)
    if (claims.P20 && claims.P20[0]) {
      deathPlaceId = claims.P20[0].mainsnak?.datavalue?.value?.id;
      if (deathPlaceId) idsForLabels.push(deathPlaceId);
    }

    const instrumentIds = [];
    if (claims.P1303) {
      for (const instrumentClaim of claims.P1303) {
        const iid = instrumentClaim.mainsnak?.datavalue?.value?.id;
        if (iid) instrumentIds.push(iid);
      }
    }
    idsForLabels.push(...instrumentIds);

    const limitedActs = claims.P463 ? claims.P463.slice(0, 5) : [];
    for (const actClaim of limitedActs) {
      const actId = actClaim.mainsnak?.datavalue?.value?.id;
      if (actId) idsForLabels.push(actId);
    }

    const labelMap = await wikidataLabelsEnForIds(idsForLabels);

    let birthPlace = birthPlaceId ? labelMap.get(birthPlaceId) || 'Unknown' : 'Unknown';
    let deathPlace = deathPlaceId ? labelMap.get(deathPlaceId) || null : null;

    for (const iid of instrumentIds) {
      const nm = labelMap.get(iid);
      if (nm) instruments.push(nm);
    }

    for (let i = 0; i < limitedActs.length; i++) {
      const actClaim = limitedActs[i];
      const actId = actClaim.mainsnak?.datavalue?.value?.id;
      if (!actId) continue;
      const actName = labelMap.get(actId);
      if (!actName) continue;
      const startTime = actClaim.qualifiers?.P580?.[0]?.datavalue?.value?.time;
      const endTime = actClaim.qualifiers?.P582?.[0]?.datavalue?.value?.time;
      associatedActs.push({
        name: actName,
        years: formatYearsActive(startTime, endTime)
      });
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
      const searchResponse = await wikimediaApiGet('https://en.wikipedia.org/w/api.php', {
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
        
        const wikidataIdResponse = await wikimediaApiGet('https://en.wikipedia.org/w/api.php', {
          params: {
            action: 'query',
            format: 'json',
            prop: 'pageprops',
            titles: pageTitle,
            ppprop: 'wikibase_item'
          }
        });
        
        const pages = wikidataIdResponse.data.query?.pages;
        const pageId = Object.keys(pages)[0];
        const wikidataId = pages[pageId]?.pageprops?.wikibase_item;
        
        let memberInfo = {};
        if (wikidataId) {
          memberInfo = await getMemberInfoFromWikidata(wikidataId);
        }
        
        const hasBirthPlace =
          memberInfo.birthPlace && memberInfo.birthPlace !== 'Unknown';
        let summaryData = { extract: '', thumbnail: null };

        if (!hasBirthPlace) {
          const summaryResponse = await wikimediaApiGet(
            `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`
          );
          summaryData = summaryResponse.data;
          if (summaryData.extract) {
            const extractedPlace = extractPlaceFromText(summaryData.extract);
            if (extractedPlace) {
              memberInfo.birthPlace = extractedPlace;
            }
          }
        }
        
        let instrument = member.instrument || 'Unknown';
        if (memberInfo.instruments && memberInfo.instruments.length > 0) {
          instrument = memberInfo.instruments.join(', ');
        } else if (summaryData.extract) {
          const extractedInstrument = extractInstrumentFromText(summaryData.extract, member.name);
          if (extractedInstrument && extractedInstrument !== 'Unknown') {
            instrument = extractedInstrument;
          }
        }
        
        const imageUrl = memberInfo.imageUrl || summaryData.thumbnail?.source || null;
        const equipment = summaryData.extract
          ? extractSignatureEquipment(summaryData.extract, member.name)
          : [];
        
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
      await new Promise((resolve) => setTimeout(resolve, 700));
      
    } catch (error) {
      console.error(`❌ Error enriching ${member.name}:`, error.message);
      enrichedMembers.push(member); // Keep original data on error
    }
  }
  
  const withMbDates = await enrichMemberBirthDatesFromMusicBrainz(enrichedMembers);
  return withMbDates;
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
    const searchResponse = await mbGet('/artist', { query: artistName, limit: 1 });

    if (!searchResponse.data.artists || searchResponse.data.artists.length === 0) {
      return [];
    }

    const artistData = searchResponse.data.artists[0];

    const detailResponse = await mbGet(`/artist/${artistData.id}`, { inc: 'artist-rels' });

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

    const searchResponse = await mbGet('/artist', { query: artist, limit: 1 });

    if (!searchResponse.data.artists || searchResponse.data.artists.length === 0) {
      return res.json({ error: 'Artist not found in MusicBrainz' });
    }

    const artistData = searchResponse.data.artists[0];

    const detailResponse = await mbGet(`/artist/${artistData.id}`, { inc: 'artist-rels' });

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

    const searchResponse = await mbGet('/artist', { query: artist, limit: 1 });

    if (!searchResponse.data.artists || searchResponse.data.artists.length === 0) {
      return res.json({ error: 'Artist not found in MusicBrainz' });
    }

    const artistData = searchResponse.data.artists[0];

    const albumsResponse = await mbGet('/release-group', {
      artist: artistData.id,
      type: 'album',
      limit: 20
    });

    const releaseGroups = albumsResponse.data['release-groups'] || [];
    const albums = releaseGroups.map(album => ({
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

    const apiKey = getGoogleServerApiKey();
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

    const apiKey = getGoogleServerApiKey();
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

    const apiKey = getGoogleServerApiKey();
    if (!apiKey) {
      return res.status(500).json({ error: 'Google API key not configured' });
    }

    const { artistInfo, wikipediaRateLimited } = await getArtistInfoWithFallbacks(artist);
    
    let mapData = [];
    let timelineEvents = [];

    const isBand =
      artistInfo.isBand === true ||
      artistInfo.name.includes('Band') ||
      artistInfo.name.includes('Group') ||
      artistInfo.name.includes('Ensemble') ||
      artistInfo.name.includes('Collective') ||
      (artistInfo.bandMembers && artistInfo.bandMembers.length > 0);

    // Process main artist birth/formation place
    if (artistInfo.birthPlace && artistInfo.birthPlace !== 'Unknown') {
      const geocoded = await geocodeLocation(artistInfo.birthPlace, apiKey);
      if (geocoded) {
        const eventType = isBand ? 'formation' : 'birth';
        geocoded.eventType = eventType;
        mapData.push(geocoded);
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
              geocoded.eventType = 'birth';
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

    const payload = { mapData, timelineEvents };
    if (wikipediaRateLimited) payload.wikipediaRateLimited = true;
    res.json(payload);
  } catch (error) {
    if (isWikimediaRateLimitError(error)) {
      return respondWikimediaRateLimit(res);
    }
    console.error('Map data error:', error);
    res.status(500).json({ error: 'Failed to get map data' });
  }
}

async function getArtistInfoWithFallbacks(artist) {
  try {
    const artistInfo = await getArtistInfoFromWikipedia(artist);
    return { artistInfo, wikipediaRateLimited: false };
  } catch (error) {
    if (!isWikimediaRateLimitError(error)) throw error;
    const mb = await getMusicBrainzArtistByName(artist);
    if (!mb) throw error;
    let bandMembers = [];
    try {
      bandMembers = await getMusicBrainzMembers(artist);
      bandMembers = await enrichMemberBirthDatesFromMusicBrainz(bandMembers);
    } catch (mbErr) {
      console.error('MusicBrainz members fallback failed:', mbErr.message);
    }
    return {
      artistInfo: {
        name: mb.name,
        birthPlace: mb.birthPlace,
        birthDate: mb.birthDate,
        bandMembers,
        isBand: mb.isBand,
        mbid: mb.mbid
      },
      wikipediaRateLimited: true
    };
  }
}

// Get artist info from Wikipedia/Wikidata
async function getArtistInfoFromWikipedia(artist) {
  try {
    const searchQuery = encodeURIComponent(artist);
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&srsearch=${searchQuery}&srlimit=1`;
    
    const searchResponse = await wikimediaApiGet(searchUrl);
    const searchData = searchResponse.data;
    
    if (!searchData.query?.search?.[0]) {
      const mb = await getMusicBrainzArtistByName(artist);
      if (mb) {
        return {
          name: mb.name,
          birthPlace: mb.birthPlace,
          birthDate: mb.birthDate,
          bandMembers: [],
          isBand: mb.isBand,
          mbid: mb.mbid
        };
      }
      return { name: artist, birthPlace: 'Unknown', birthDate: 'Unknown', bandMembers: [] };
    }

    const pageTitle = searchData.query.search[0].title;
    const wikidataInfo = await getWikidataInfo(pageTitle);
    const mb = await getMusicBrainzArtistByName(artist);
    return applyMusicBrainzFallback(
      {
        name: pageTitle,
        birthPlace: wikidataInfo.birthPlace,
        birthDate: wikidataInfo.birthDate,
        bandMembers: wikidataInfo.bandMembers
      },
      mb
    );
  } catch (error) {
    if (isWikimediaRateLimitError(error)) {
      throw error;
    }
    console.error('Error getting artist info:', error);
    const mb = await getMusicBrainzArtistByName(artist);
    if (mb) {
      return {
        name: mb.name,
        birthPlace: mb.birthPlace,
        birthDate: mb.birthDate,
        bandMembers: [],
        isBand: mb.isBand,
        mbid: mb.mbid
      };
    }
    return { name: artist, birthPlace: 'Unknown', birthDate: 'Unknown', bandMembers: [] };
  }
}

// Geocode a location using FREE OpenStreetMap Nominatim API with context-aware fallback strategies
async function geocodeLocation(placeName, apiKey, bandContext = null) {
  // Using FREE OpenStreetMap Nominatim API - no charges!
  try {
    // Try original place name first using free service
    let result = await tryGeocode(placeName);
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
    
    // Try each variation using free service
    for (const variation of variations) {
      result = await tryGeocode(variation);
      if (result) {
        result.name = placeName; // Keep original name
        return result;
      }
      // Rate limiting - Nominatim requires 1 req/sec
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return null;
  } catch (error) {
    console.error('Free geocoding error for', placeName, ':', error);
    return null;
  }
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

// Helper function to attempt geocoding using FREE service
async function tryGeocode(address) {
  // Using FREE OpenStreetMap Nominatim API - no charges!
  try {
    const result = await geocodeAddressFree(address);
    if (result && result.latitude && result.longitude) {
      return {
        name: address,
        lat: result.latitude,
        lng: result.longitude
      };
    }
    return null;
  } catch (error) {
    return null;
  }
}

// Get Google API key
export async function getGoogleApiKey(req, res) {
  try {
    // Get API key from environment variable
    const apiKey = getGoogleBrowserApiKey();
    
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