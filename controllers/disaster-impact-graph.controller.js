/**
 * Development work by David Lane
 */
import disasterImpactGraphService from '../services/disaster-impact-graph.service.js';

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

async function ensureGraphReady() {
  await disasterImpactGraphService.ensureDisasterImpactGraphReady();
}

export async function getImpactGraph(req, res) {
  try {
    await ensureGraphReady();
    const nodeId = parseNodeId(req.params.nodeId);
    if (!nodeId) {
      return res.status(400).json({ success: false, error: 'Invalid nodeId parameter' });
    }
    const depth = parseDepth(req.query.depth);
    const graph = await disasterImpactGraphService.getImpactGraph(nodeId, depth);
    return res.json({ success: true, data: graph });
  } catch (error) {
    console.error('❌ Error getting impact graph:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch impact graph',
      details: error.message
    });
  }
}

export async function getLoansByCounty(req, res) {
  try {
    await ensureGraphReady();
    const countyFips = String(req.params.countyFips || '').trim();
    if (!countyFips) {
      return res.status(400).json({ success: false, error: 'countyFips is required' });
    }
    const payload = await disasterImpactGraphService.findLoansImpactedByCounty(countyFips);
    return res.json({ success: true, data: payload });
  } catch (error) {
    console.error('❌ Error getting impacted loans by county:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to find impacted loans for county',
      details: error.message
    });
  }
}

export async function getLoansByDisaster(req, res) {
  try {
    await ensureGraphReady();
    const disasterId = String(req.params.disasterId || '').trim();
    if (!disasterId) {
      return res.status(400).json({ success: false, error: 'disasterId is required' });
    }
    const payload = await disasterImpactGraphService.findLoansImpactedByDisaster(disasterId);
    return res.json({ success: true, data: payload });
  } catch (error) {
    console.error('❌ Error getting impacted loans by disaster:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to find impacted loans for disaster',
      details: error.message
    });
  }
}

export async function getDisasterEgoGraph(req, res) {
  try {
    await ensureGraphReady();
    const disasterId = String(req.params.disasterId || '').trim();
    if (!disasterId) {
      return res.status(400).json({ success: false, error: 'disasterId is required' });
    }
    const depth = parseDepth(req.query.depth ?? 2);
    const payload = await disasterImpactGraphService.getDisasterEgoGraph(disasterId, depth);
    return res.json({ success: true, data: payload });
  } catch (error) {
    console.error('❌ Error getting disaster ego graph:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch disaster ego graph',
      details: error.message
    });
  }
}

export async function getImpactSummary(req, res) {
  try {
    await ensureGraphReady();
    const nodeId = parseNodeId(req.params.nodeId);
    if (!nodeId) {
      return res.status(400).json({ success: false, error: 'Invalid nodeId parameter' });
    }
    const summary = await disasterImpactGraphService.summarizeImpact(nodeId);
    return res.json({ success: true, data: summary });
  } catch (error) {
    console.error('❌ Error getting impact summary:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to build impact summary',
      details: error.message
    });
  }
}

/** Force-reseed graph_nodes / graph_edges from current disasters + loans (not live /near). */
export async function refreshImpactGraph(req, res) {
  try {
    const payload = await disasterImpactGraphService.refreshDisasterImpactGraphFromCurrentData();
    return res.json({
      success: true,
      message: 'Impact graph reseeded from current disasters and loans',
      data: payload
    });
  } catch (error) {
    console.error('❌ Error refreshing impact graph:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to refresh impact graph',
      details: error.message
    });
  }
}

export default {
  getImpactGraph,
  getLoansByCounty,
  getLoansByDisaster,
  getDisasterEgoGraph,
  getImpactSummary,
  refreshImpactGraph
};
