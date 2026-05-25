/**
 * Live Music Pilgrimage Atlas API.
 */
import {
  getAtlasOverview,
  getAtlasPayload,
  getStopDetail,
  getVenueIndex,
} from '../services/music-pilgrimage-atlas.service.js';
import {
  deleteBookmark,
  deleteSavedRoute,
  isValidClientId,
  listBookmarks,
  listSavedRoutes,
  saveRoute,
  upsertBookmark,
} from '../services/music-pilgrimage-personal.service.js';

export async function atlasOverview(req, res) {
  try {
    const data = await getAtlasOverview();
    res.json({ success: true, data });
  } catch (error) {
    console.error('atlasOverview:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function atlasQuery(req, res) {
  try {
    const clientId = String(req.query.clientId || '').trim() || null;
    const data = await getAtlasPayload(req.query, { clientId });
    res.json(data);
  } catch (error) {
    console.error('atlasQuery:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function atlasStopDetail(req, res) {
  try {
    const clientId = String(req.query.clientId || '').trim() || null;
    const stop = await getStopDetail(req.params.id, clientId);
    if (!stop) {
      return res.status(404).json({ success: false, error: 'Stop not found' });
    }
    res.json({ success: true, stop });
  } catch (error) {
    console.error('atlasStopDetail:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function atlasVenues(req, res) {
  try {
    const venues = await getVenueIndex(req.query);
    res.json({ success: true, venues });
  } catch (error) {
    console.error('atlasVenues:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function getBookmarks(req, res) {
  try {
    const clientId = String(req.query.clientId || '').trim();
    if (!isValidClientId(clientId)) {
      return res.status(400).json({ success: false, error: 'clientId (UUID) is required' });
    }
    const bookmarks = await listBookmarks(clientId);
    res.json({ success: true, bookmarks });
  } catch (error) {
    console.error('getBookmarks:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function postBookmark(req, res) {
  try {
    const { clientId, bookmarkType, showId, venueName, city, state, notes } = req.body || {};
    if (!isValidClientId(clientId)) {
      return res.status(400).json({ success: false, error: 'clientId (UUID) is required' });
    }
    const bookmark = await upsertBookmark(clientId, {
      bookmarkType,
      showId,
      venueName,
      city,
      state,
      notes,
    });
    res.json({ success: true, bookmark });
  } catch (error) {
    console.error('postBookmark:', error.message);
    res.status(400).json({ success: false, error: error.message });
  }
}

export async function removeBookmark(req, res) {
  try {
    const clientId = String(req.query.clientId || req.body?.clientId || '').trim();
    if (!isValidClientId(clientId)) {
      return res.status(400).json({ success: false, error: 'clientId (UUID) is required' });
    }
    const removed = await deleteBookmark(clientId, req.params.id);
    res.json({ success: true, removed: !!removed });
  } catch (error) {
    console.error('removeBookmark:', error.message);
    res.status(400).json({ success: false, error: error.message });
  }
}

export async function getRoutes(req, res) {
  try {
    const clientId = String(req.query.clientId || '').trim();
    if (!isValidClientId(clientId)) {
      return res.status(400).json({ success: false, error: 'clientId (UUID) is required' });
    }
    const routes = await listSavedRoutes(clientId);
    res.json({ success: true, routes });
  } catch (error) {
    console.error('getRoutes:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function postRoute(req, res) {
  try {
    const { clientId, label, filterConfig } = req.body || {};
    if (!isValidClientId(clientId)) {
      return res.status(400).json({ success: false, error: 'clientId (UUID) is required' });
    }
    const route = await saveRoute(clientId, label, filterConfig);
    res.json({ success: true, route });
  } catch (error) {
    console.error('postRoute:', error.message);
    res.status(400).json({ success: false, error: error.message });
  }
}

export async function removeRoute(req, res) {
  try {
    const clientId = String(req.query.clientId || req.body?.clientId || '').trim();
    if (!isValidClientId(clientId)) {
      return res.status(400).json({ success: false, error: 'clientId (UUID) is required' });
    }
    const removed = await deleteSavedRoute(clientId, req.params.id);
    res.json({ success: true, removed: !!removed });
  } catch (error) {
    console.error('removeRoute:', error.message);
    res.status(400).json({ success: false, error: error.message });
  }
}
