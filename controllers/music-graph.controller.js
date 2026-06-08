/**
 * Development work by David Lane
 */
import musicGraphService from '../services/music-graph.service.js';

function parseDepth(rawDepth) {
  const parsed = parseInt(rawDepth, 10);
  if (!Number.isFinite(parsed)) return 3;
  return Math.max(1, Math.min(6, parsed));
}

function parseNodeId(rawNodeId) {
  const parsed = parseInt(rawNodeId, 10);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

export async function getCollectionGraph(req, res) {
  try {
    await musicGraphService.ensureMusicGraphReady();
    const userId = String(req.params.userId || '').trim();
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }
    const depth = parseDepth(req.query.depth);
    const graph = await musicGraphService.getCollectionGraph(userId, depth);
    return res.json({ success: true, data: graph });
  } catch (error) {
    console.error('Error getting collection music graph:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch collection music graph',
      details: error.message
    });
  }
}

export async function getArtistGraph(req, res) {
  try {
    await musicGraphService.ensureMusicGraphReady();
    const key = String(req.params.key || '').trim();
    if (!key) {
      return res.status(400).json({ success: false, error: 'Artist key is required' });
    }

    const artistNode = await musicGraphService.findArtistNode(key);
    if (!artistNode) {
      return res.status(404).json({ success: false, error: 'Artist node not found' });
    }

    const depth = parseDepth(req.query.depth);
    const graph = await musicGraphService.getMusicGraph(artistNode.id, depth);
    return res.json({ success: true, data: graph });
  } catch (error) {
    console.error('Error getting artist music graph:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch artist music graph',
      details: error.message
    });
  }
}

export async function refreshMusicGraph(req, res) {
  try {
    await musicGraphService.ensureMusicGraphReady();
    const userId = req.body?.userId != null ? String(req.body.userId).trim() : null;
    const force = req.body?.force === true;
    const result = await musicGraphService.seedCollectionGraph({ userId, force });
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error refreshing music graph:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to refresh music graph',
      details: error.message
    });
  }
}

export async function getMusicGraphSummary(req, res) {
  try {
    await musicGraphService.ensureMusicGraphReady();
    const nodeId = parseNodeId(req.params.nodeId);
    if (!nodeId) {
      return res.status(400).json({ success: false, error: 'Invalid nodeId parameter' });
    }
    const depth = parseDepth(req.query.depth);
    const summary = await musicGraphService.summarizeMusicGraph(nodeId, depth);
    return res.json({ success: true, data: summary });
  } catch (error) {
    console.error('Error getting music graph summary:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to build music graph summary',
      details: error.message
    });
  }
}

export async function getMusicGraph(req, res) {
  try {
    await musicGraphService.ensureMusicGraphReady();
    const nodeId = parseNodeId(req.params.nodeId);
    if (!nodeId) {
      return res.status(400).json({ success: false, error: 'Invalid nodeId parameter' });
    }
    const depth = parseDepth(req.query.depth);
    const graph = await musicGraphService.getMusicGraph(nodeId, depth);
    return res.json({ success: true, data: graph });
  } catch (error) {
    console.error('Error getting music graph:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch music graph',
      details: error.message
    });
  }
}

export default {
  getCollectionGraph,
  getArtistGraph,
  refreshMusicGraph,
  getMusicGraphSummary,
  getMusicGraph
};
