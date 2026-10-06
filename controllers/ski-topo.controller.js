/**
 * Ski Topo HTTP — brief, stops, DEM, Maps key.
 * Development work by David Lane
 */
import { Router } from 'express';
import { getGoogleBrowserApiKey } from '../lib/google-api-key.js';
import skiTopoService from '../services/ski-topo.service.js';
import skiPlacesService from '../services/ski-places.service.js';
import { loadDem, SKI_DEM_SPECS, summarizeTerrain } from '../services/ski-dem.service.js';
import { findRuns, getTrails } from '../services/ski-trails.service.js';

const router = Router();

router.get('/google-api-key', (_req, res) => {
  const apiKey = getGoogleBrowserApiKey();
  res.json({ apiKey, success: Boolean(apiKey) });
});

router.get('/catalog', async (_req, res) => {
  try {
    const [destinations, routes] = await Promise.all([
      skiTopoService.loadDestinations(),
      skiTopoService.loadRoutes(),
    ]);
    res.json({ destinations, routes });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/brief', async (_req, res) => {
  try {
    res.json(await skiTopoService.getBrief());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/stops', async (req, res) => {
  try {
    const route = String(req.query.route || '').trim();
    const kind = String(req.query.kind || '').trim();
    if (route && !['wrightwood', 'big-bear'].includes(route)) {
      return res.status(400).json({ error: 'route must be wrightwood or big-bear' });
    }
    const stops = await skiPlacesService.getStops({ route, kind });
    res.json({ route: route || null, kind: kind || 'all', stops });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/dem/:id', (req, res) => {
  const id = String(req.params.id || '');
  if (!SKI_DEM_SPECS.some((s) => s.id === id)) {
    return res.status(404).json({ error: 'Unknown DEM' });
  }
  try {
    const dem = loadDem(id);
    const want = String(req.query.grids || '') === '1';
    const summary = summarizeTerrain(dem);
    res.json(want ? { ...dem, terrain: summary } : { ...dem, terrain: { ...summary, grids: undefined } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const num = (v) => (v === undefined || v === '' ? undefined : Number(v));

router.get('/trails/:id', (req, res) => {
  const id = String(req.params.id || '');
  if (!SKI_DEM_SPECS.some((s) => s.id === id)) {
    return res.status(404).json({ error: 'Unknown ski area' });
  }
  try {
    const resort = String(req.query.resort || '').trim() || undefined;
    const trails = getTrails(id, { resort });
    if (!trails) return res.status(404).json({ error: 'Trails not baked — run npm run build:ski-trails' });
    const { difficulty, facing } = req.query;
    const filtered = difficulty || facing || req.query.maxPitch || req.query.minPitch || req.query.minVertical;
    const runs = filtered
      ? findRuns(trails.runs, {
          difficulty: difficulty ? String(difficulty).split(',') : undefined,
          facing: facing ? String(facing) : undefined,
          minPitch: num(req.query.minPitch),
          maxPitch: num(req.query.maxPitch),
          minVerticalFt: num(req.query.minVertical),
        })
      : trails.runs;
    res.json({ ...trails, runs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
