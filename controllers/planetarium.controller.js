/**
 * Planetarium data API — ISS passes, events, catalog search, SpaceX launches, station
 * Development work by David Lane
 */
import { Router } from 'express';
import planetariumIssService from '../services/planetarium-iss.service.js';
import planetariumEventsService from '../services/planetarium-events.service.js';
import planetariumSpacexService from '../services/planetarium-spacex.service.js';
import planetariumStationService from '../services/planetarium-station.service.js';
import planetariumArrivalsService from '../services/planetarium-arrivals.service.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({
    ok: true,
    features: ['iss-passes', 'iss-tle', 'events', 'catalog', 'astronomy-engine', 'spacex', 'station', 'iss-arrivals'],
  });
});

router.get('/iss-passes', async (req, res) => {
  try {
    const lat = req.query.lat;
    const lon = req.query.lon;
    const at = req.query.at;
    const result = await planetariumIssService.fetchIssPasses(lat, lon, globalThis.fetch, { at });
    res.json({ success: true, ...result });
  } catch (error) {
    const status =
      error.code === 'INVALID_COORDS'
        ? 400
        : error.code === 'ISS_UPSTREAM' || error.code === 'ISS_TLE_UPSTREAM'
          ? 502
          : 500;
    res.status(status).json({ success: false, error: error.message });
  }
});

router.get('/events', (req, res) => {
  try {
    const from = req.query.from || new Date().toISOString().slice(0, 10);
    const to = req.query.to;
    const events = planetariumEventsService.filterSkyEvents({ from, to, limit: 10 });
    const meteors = planetariumEventsService.upcomingMeteorPeaks(from, 150);
    res.json({ success: true, from, events, meteorShowers: meteors });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/catalog/search', (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return res.status(400).json({ success: false, error: 'q is required' });
    const results = planetariumEventsService.searchCatalogIndex(q, 15);
    res.json({ success: true, query: q, results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/spacex', (req, res) => {
  try {
    const page = planetariumSpacexService.getSpacexPage({
      rocket: req.query.rocket,
      q: req.query.q,
      when: req.query.when,
      year: req.query.year,
      status: req.query.status,
    });
    res.json({ success: true, ...page });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/station', async (req, res) => {
  try {
    const page = await planetariumStationService.getStationPage(
      { module: req.query.module, mode: req.query.mode },
      globalThis.fetch,
      req.query.at
    );
    res.json({ success: true, ...page });
  } catch (error) {
    const status = error.code === 'ISS_TLE_UPSTREAM' ? 502 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
});

router.get('/iss-arrivals', async (_req, res) => {
  try {
    const payload = await planetariumArrivalsService.getIssArrivals(globalThis.fetch);
    res.json({ success: true, ...payload });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
