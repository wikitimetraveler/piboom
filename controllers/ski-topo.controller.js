/**
 * Ski Topo HTTP — brief, stops, DEM, Maps key.
 * Development work by David Lane
 */
import { createReadStream, existsSync } from 'node:fs';
import { Router } from 'express';
import { getGoogleBrowserApiKey } from '../lib/google-api-key.js';
import skiTopoService from '../services/ski-topo.service.js';
import skiPlacesService from '../services/ski-places.service.js';
import skiCamsService from '../services/ski-cams.service.js';
import { loadDem, SKI_DEM_SPECS, summarizeTerrain } from '../services/ski-dem.service.js';
import { findRuns, getTrails } from '../services/ski-trails.service.js';
import { lidarFilePath, loadLidarManifest } from '../services/ski-lidar.service.js';

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

router.get('/cams/:id', async (req, res) => {
  try {
    const payload = await skiCamsService.getSkiCams(String(req.params.id || ''));
    if (!payload) return res.status(404).json({ error: 'Unknown ski resort' });
    res.json(payload);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/stops', async (req, res) => {
  try {
    const route = String(req.query.route || '').trim();
    const kind = String(req.query.kind || '').trim();
    if (route) {
      const routes = await skiTopoService.loadRoutes();
      if (!Object.prototype.hasOwnProperty.call(routes, route)) {
        return res.status(400).json({ error: `route must be one of: ${Object.keys(routes).join(', ')}` });
      }
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
    const treeOnly = String(req.query.tree || '') === '1';
    const filtered = difficulty || facing || treeOnly || req.query.maxPitch || req.query.minPitch || req.query.minVertical;
    const runs = filtered
      ? findRuns(trails.runs, {
          difficulty: difficulty ? String(difficulty).split(',') : undefined,
          facing: facing ? String(facing) : undefined,
          minPitch: num(req.query.minPitch),
          maxPitch: num(req.query.maxPitch),
          minVerticalFt: num(req.query.minVertical),
          treeOnly,
        })
      : trails.runs;
    res.json({ ...trails, runs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const LIDAR_MISSING = 'Lidar not baked — run npm run build:ski-lidar';

router.get('/lidar/:id/:lod', (req, res) => {
  const id = String(req.params.id || '');
  const lod = String(req.params.lod || '');
  if (!SKI_DEM_SPECS.some((s) => s.id === id)) {
    return res.status(404).json({ error: 'Unknown ski area' });
  }
  if (lod !== '0' && lod !== '1') {
    return res.status(400).json({ error: 'lod must be 0 or 1' });
  }
  const file = lidarFilePath(id, lod);
  if (!existsSync(file)) return res.status(404).json({ error: LIDAR_MISSING });
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  createReadStream(file).pipe(res);
});

router.get('/lidar/:id', (req, res) => {
  const id = String(req.params.id || '');
  if (!SKI_DEM_SPECS.some((s) => s.id === id)) {
    return res.status(404).json({ error: 'Unknown ski area' });
  }
  try {
    const manifest = loadLidarManifest(id);
    if (!manifest) return res.status(404).json({ error: LIDAR_MISSING });
    res.json(manifest);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
