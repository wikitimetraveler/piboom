import {
  getAllFamilyData,
  getAllPeople,
  getPersonById,
  searchPeople,
  getRelationships,
  getChildren,
  getParents,
  getSpouses,
  getSiblings,
  getMusicalEra,
  getPeopleAliveDuring,
  getPeopleByGeneration,
  getFamilyStats,
  getMuseumContent,
  getFeaturedStory,
  getProminentLanes,
  getWarParticipants,
  getWarCampaignsSummary,
  getOccupationSummary,
  getDirectAncestorStory,
  getLanePdfGalleryData,
  getLanePdfPortraitsForPerson,
  getLaneBookSayings
} from '../services/genealogy.service.js';
import { config } from '../config/index.js';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { summarizeGenealogyImageImport, writeImportArtifact } from '../services/genealogy-import.service.js';
import { geocodeAddressFree } from '../services/free-geocoding.service.js';
import { resolveGenealogyGeocodeQuery } from '../services/genealogy-geocode.service.js';
import {
  getHiddenPlateState,
  hidePlate,
  undoLastHide,
  clearClientHides,
  bulkImportHiddenPlates,
  isValidClientId
} from '../services/lane-pdf-gallery-hides.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadStorage = multer.memoryStorage();
export const genealogyImageUpload = multer({
  storage: uploadStorage,
  limits: { fileSize: 15 * 1024 * 1024, files: 40 }
});

/**
 * Get complete family data (nodes + links) for D3 visualization
 */
export async function getFamilyData(req, res) {
  try {
    const data = getAllFamilyData();
    
    if (!data) {
      return res.status(500).json({
        success: false,
        error: 'Failed to load genealogy data'
      });
    }
    
    res.json({
      success: true,
      data: data,
      stats: {
        people: data.nodes.length,
        relationships: data.links.length
      }
    });
  } catch (error) {
    console.error('Error getting family data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get all people in the family tree
 */
export async function getPeople(req, res) {
  try {
    const people = getAllPeople();
    
    res.json({
      success: true,
      count: people.length,
      people: people
    });
  } catch (error) {
    console.error('Error getting people:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get person by ID with relationships
 */
export async function getPerson(req, res) {
  try {
    const { id } = req.params;
    const person = getPersonById(id);
    
    if (!person) {
      return res.status(404).json({
        success: false,
        error: 'Person not found'
      });
    }
    
    // Get all relationships
    const relationships = getRelationships(id);
    const parents = getParents(id);
    const children = getChildren(id);
    const spouses = getSpouses(id);
    const siblings = getSiblings(id);
    const musicalEra = getMusicalEra(person.birthYear);
    
    const lanePdfPortraits = getLanePdfPortraitsForPerson(id);
    res.json({
      success: true,
      person: person,
      musicalEra: musicalEra,
      lanePdfPortraits: Array.isArray(lanePdfPortraits) ? lanePdfPortraits : [],
      family: {
        parents: parents,
        children: children,
        spouses: spouses,
        siblings: siblings,
        allRelationships: relationships
      }
    });
  } catch (error) {
    console.error('Error getting person:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Search for people by name
 */
export async function search(req, res) {
  try {
    const { q } = req.query;
    
    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Search query required'
      });
    }
    
    const results = searchPeople(q);
    
    res.json({
      success: true,
      query: q,
      count: results.length,
      results: results
    });
  } catch (error) {
    console.error('Error searching people:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get people by generation
 */
export async function getGeneration(req, res) {
  try {
    const { generation } = req.params;
    const people = getPeopleByGeneration(generation);
    
    res.json({
      success: true,
      generation: parseInt(generation),
      count: people.length,
      people: people
    });
  } catch (error) {
    console.error('Error getting generation:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get people alive during a specific year
 */
export async function getPeopleAliveInYear(req, res) {
  try {
    const { year } = req.params;
    const people = getPeopleAliveDuring(parseInt(year));
    const musicalEra = getMusicalEra(year);
    
    res.json({
      success: true,
      year: parseInt(year),
      musicalEra: musicalEra,
      count: people.length,
      people: people
    });
  } catch (error) {
    console.error('Error getting people by year:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get musical era for a year
 */
export async function getMusicalEraInfo(req, res) {
  try {
    const { year } = req.params;
    const musicalEra = getMusicalEra(year);
    const peopleAlive = getPeopleAliveDuring(parseInt(year));
    
    res.json({
      success: true,
      year: parseInt(year),
      musicalEra: musicalEra,
      familyMembersAlive: peopleAlive.length,
      familyMembers: peopleAlive.map(p => ({
        name: p.name,
        age: parseInt(year) - parseInt(p.birthYear),
        birthYear: p.birthYear
      }))
    });
  } catch (error) {
    console.error('Error getting musical era:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get family tree statistics
 */
export async function getStats(req, res) {
  try {
    const stats = getFamilyStats();
    
    res.json({
      success: true,
      stats: stats
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get curated museum content metadata (themes, media, timeline, docent config).
 */
export async function getMuseumContentData(req, res) {
  try {
    const content = getMuseumContent();
    res.json({
      success: true,
      content
    });
  } catch (error) {
    console.error('Error getting museum content:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Lane genealogy book sayings / excerpts for AI docent grounding.
 */
export async function getLaneBookSayingsData(req, res) {
  try {
    const doc = getLaneBookSayings();
    res.json({
      success: true,
      version: doc.version,
      source: doc.source,
      sourceLabel: doc.sourceLabel,
      entries: doc.entries || []
    });
  } catch (error) {
    console.error('Error getting Lane book sayings:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get opening featured chronological story (William E Lane of Boston).
 */
export async function getFeaturedStoryData(req, res) {
  try {
    const featuredStory = getFeaturedStory();
    res.json({
      success: true,
      featuredStory
    });
  } catch (error) {
    console.error('Error getting featured story:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get curated prominent Lane profiles for the museum gallery.
 */
export async function getProminentLanesData(req, res) {
  try {
    const prominentLanes = getProminentLanes();
    res.json({
      success: true,
      count: prominentLanes.length,
      prominentLanes
    });
  } catch (error) {
    console.error('Error getting prominent lanes:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Lane PDF extracted plates + page-based person candidates + curated portraits.
 */
export async function getLanePdfGallery(req, res) {
  try {
    const data = getLanePdfGalleryData();
    res.json({
      success: true,
      ...data
    });
  } catch (error) {
    console.error('Error getting Lane PDF gallery:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function getLanePdfGalleryHides(req, res) {
  try {
    const clientId = String(req.query.clientId ?? '').trim();
    if (!isValidClientId(clientId)) {
      return res.status(400).json({ success: false, error: 'clientId query (UUID) is required' });
    }
    const state = await getHiddenPlateState(clientId);
    return res.json({ success: true, ...state });
  } catch (error) {
    console.error('Error getting Lane PDF gallery hides:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function postLanePdfGalleryHidePlate(req, res) {
  try {
    const { clientId, imageId } = req.body ?? {};
    const state = await hidePlate(clientId, imageId);
    return res.json({ success: true, ...state });
  } catch (error) {
    console.error('Error hiding Lane PDF plate:', error);
    return res.status(400).json({ success: false, error: error.message });
  }
}

export async function postLanePdfGalleryUndoHide(req, res) {
  try {
    const { clientId } = req.body ?? {};
    if (!isValidClientId(clientId)) {
      return res.status(400).json({ success: false, error: 'clientId (UUID) is required' });
    }
    const result = await undoLastHide(clientId);
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error undo Lane PDF hide:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function deleteLanePdfGalleryClientHides(req, res) {
  try {
    const clientId = String(req.query.clientId ?? req.body?.clientId ?? '').trim();
    if (!isValidClientId(clientId)) {
      return res.status(400).json({ success: false, error: 'clientId (UUID) is required in query or body' });
    }
    const state = await clearClientHides(clientId);
    return res.json({ success: true, ...state });
  } catch (error) {
    console.error('Error clearing Lane PDF gallery hides:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/** One-shot: merge browser local hides into Postgres for this client id */
export async function postLanePdfGalleryBulkImport(req, res) {
  try {
    const { clientId, imageIds } = req.body ?? {};
    if (!isValidClientId(clientId)) {
      return res.status(400).json({ success: false, error: 'clientId (UUID) is required' });
    }
    const state = await bulkImportHiddenPlates(clientId, imageIds || []);
    return res.json({ success: true, ...state });
  } catch (error) {
    console.error('Error bulk-import Lane PDF gallery hides:', error);
    return res.status(400).json({ success: false, error: error.message });
  }
}

/**
 * Get available war campaigns and participant counts.
 */
export async function getWarCampaignsData(req, res) {
  try {
    const summary = getWarCampaignsSummary();
    res.json({
      success: true,
      ...summary
    });
  } catch (error) {
    console.error('Error getting war campaigns:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get participants for a specific war slug.
 */
export async function getWarParticipantsData(req, res) {
  try {
    const { warSlug } = req.params;
    const participants = getWarParticipants(warSlug);
    res.json({
      success: true,
      warSlug,
      count: participants.length,
      participants
    });
  } catch (error) {
    console.error('Error getting war participants:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Occupation labels aggregated from laneData occupation.job fields.
 */
export async function getOccupationsData(req, res) {
  try {
    const summary = getOccupationSummary();
    res.json({
      success: true,
      ...summary
    });
  } catch (error) {
    console.error('Error getting occupation summary:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get direct-ancestor-only storyline for a starting person.
 */
export async function getDirectAncestorStoryData(req, res) {
  try {
    const rawStartId = req.query.startId;
    const startId = rawStartId ? parseInt(rawStartId, 10) : 112;
    const order = String(req.query.order || 'oldest-first').toLowerCase();
    if (!Number.isFinite(startId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid startId'
      });
    }
    const story = getDirectAncestorStory(startId, order);
    if (!story) {
      return res.status(404).json({
        success: false,
        error: 'Start person not found'
      });
    }
    res.json({
      success: true,
      ...story
    });
  } catch (error) {
    console.error('Error getting direct ancestor story:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Expose browser-safe Google Maps key used by war history map page.
 */
export async function getGenealogyGoogleApiKey(req, res) {
  try {
    const key = config.googleBrowserApiKey || config.googleApiKey || '';
    if (!key) {
      return res.json({
        success: false,
        error:
          'Google Maps API key not configured. Set GOOGLE_BROWSER_API_KEY (referrer-restricted) or GOOGLE_API_KEY on the server.'
      });
    }
    res.json({
      success: true,
      apiKey: key
    });
  } catch (error) {
    console.error('Error getting genealogy map API key:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Mapbox public token for family pages (Mapbox GL + same stack as free-geocoding.service.js).
 */
export async function getGenealogyMapboxAccessToken(req, res) {
  try {
    const token = config.mapboxAccessToken || '';
    if (!token) {
      // 200 + JSON so production proxies/CDNs never substitute HTML error pages for fetch().json()
      return res.json({
        success: false,
        error:
          'Mapbox token not configured. Set MAPBOX_ACCESS_TOKEN (or MAPBOX_API_KEY / MAP_KEY) in the server environment.'
      });
    }
    res.json({
      success: true,
      accessToken: token
    });
  } catch (error) {
    console.error('Error getting Mapbox token for genealogy:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Forward geocode via geocodeAddressFree + Lane-specific query aliases.
 */
export async function getGenealogyGeocodeAddress(req, res) {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter q is required'
      });
    }
    const resolvedQuery = resolveGenealogyGeocodeQuery(q);
    const result = await geocodeAddressFree(resolvedQuery);
    const lat = result?.latitude;
    const lng = result?.longitude;
    if (lat == null || lng == null || Number.isNaN(+lat) || Number.isNaN(+lng)) {
      return res.json({
        success: false,
        query: q,
        resolvedQuery,
        error: 'No coordinates found'
      });
    }
    res.json({
      success: true,
      query: q,
      resolvedQuery,
      latitude: +lat,
      longitude: +lng,
      label: result.display_name || resolvedQuery,
      source: result.source || 'geocode'
    });
  } catch (error) {
    console.error('Error geocoding genealogy address:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get musical timeline (combines family + music history)
 */
export async function getMusicalTimeline(req, res) {
  try {
    const people = getAllPeople();
    
    // Create timeline entries
    const timeline = people.map(person => {
      const birthYear = parseInt(person.birthYear);
      const musicalEra = getMusicalEra(birthYear);
      
      return {
        year: birthYear,
        name: person.name,
        event: `${person.name} born`,
        musicalEra: musicalEra.era,
        musicalPeriod: musicalEra.period,
        music: musicalEra.music,
        generation: person.generation
      };
    }).sort((a, b) => a.year - b.year);
    
    res.json({
      success: true,
      timelineEvents: timeline.length,
      timeline: timeline
    });
  } catch (error) {
    console.error('Error getting musical timeline:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Accept genealogy source page images for OCR/import pipeline.
 */
export async function importImages(req, res) {
  try {
    const files = req.files || [];
    if (!files.length) {
      return res.status(400).json({
        success: false,
        error: 'No images uploaded'
      });
    }

    let providedOcrPages = [];
    if (req.body?.ocrPages) {
      try {
        providedOcrPages = JSON.parse(req.body.ocrPages);
      } catch {
        return res.status(400).json({
          success: false,
          error: 'Invalid ocrPages JSON payload'
        });
      }
    }

    const summary = summarizeGenealogyImageImport(files, providedOcrPages);
    const artifactPath = await writeImportArtifact(summary.laneData, Date.now());

    const qualityReport = {
      totalDetectedPeople: summary.parsed.people.length,
      totalRelationshipCandidates: summary.parsed.relationshipCandidates.length,
      totalAcceptedLinks: summary.strictLinks.accepted.length,
      totalRejectedLinks: summary.strictLinks.rejected.length,
      totalReviewItems: summary.parsed.reviewQueue.length + summary.strictLinks.rejected.length
    };

    const reviewQueue = {
      generatedAt: new Date().toISOString(),
      pageReviewItems: summary.parsed.reviewQueue,
      rejectedRelationshipCandidates: summary.strictLinks.rejected
    };
    const reviewQueuePath = path.join(__dirname, '..', 'data', `genealogy-import-review-${Date.now()}.json`);
    await fs.writeFile(reviewQueuePath, JSON.stringify(reviewQueue, null, 2), 'utf-8');

    return res.json({
      success: true,
      message: 'Images received for genealogy import pipeline',
      summary: {
        acceptedCount: summary.acceptedCount,
        rejectedCount: summary.rejectedCount,
        rejectedFiles: summary.rejectedFiles,
        validation: summary.validation
      },
      qualityReport,
      artifactPath,
      reviewQueuePath,
      laneData: summary.laneData
    });
  } catch (error) {
    console.error('Error importing genealogy images:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export default {
  getFamilyData,
  getPeople,
  getPerson,
  search,
  getGeneration,
  getPeopleAliveInYear,
  getMusicalEraInfo,
  getStats,
  getMuseumContentData,
  getFeaturedStoryData,
  getProminentLanesData,
  getLanePdfGallery,
  getLanePdfGalleryHides,
  postLanePdfGalleryHidePlate,
  postLanePdfGalleryUndoHide,
  deleteLanePdfGalleryClientHides,
  postLanePdfGalleryBulkImport,
  getLaneBookSayingsData,
  getWarCampaignsData,
  getWarParticipantsData,
  getOccupationsData,
  getDirectAncestorStoryData,
  getGenealogyGoogleApiKey,
  getGenealogyMapboxAccessToken,
  getGenealogyGeocodeAddress,
  getMusicalTimeline,
  importImages,
  genealogyImageUpload
};

