/**
 * Lightweight static server for ISS Station page demos (no Postgres).
 * Development work by David Lane
 */
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import planetariumIssService from '../services/planetarium-iss.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const app = express();
const port = Number(process.env.PORT || 3000);

app.use(express.static(path.join(root, 'public')));
app.use('/data', express.static(path.join(root, 'data')));

app.get('/api/planetarium/iss-crew', async (_req, res) => {
  try {
    const result = await planetariumIssService.fetchIssCrew(globalThis.fetch);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(502).json({ success: false, error: error.message });
  }
});

app.get('/api/planetarium/iss-passes', async (req, res) => {
  try {
    const result = await planetariumIssService.fetchIssPasses(
      req.query.lat,
      req.query.lon,
      globalThis.fetch,
      { at: req.query.at }
    );
    res.json({ success: true, ...result });
  } catch (error) {
    const status = error.code === 'INVALID_COORDS' ? 400 : 502;
    res.status(status).json({ success: false, error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Station demo server on http://localhost:${port}/planetarium/station.html`);
});
