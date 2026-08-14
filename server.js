/**
 * Development work by David Lane
 */
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { config } from './config/index.js';
import buildRoutes from './routes/index.routes.js';
import { initializeDatabase, createTables } from './services/database.service.js';
import { refreshGenealogyCachesFromPostgres } from './services/genealogy.service.js';
import { ingestFirmsNrt, ingestUsgsQuakes, ingestNwsCap, ingestNhc, ingestFema, ingestCaFireCameras, pruneOldDisasters, initDisastersSchema, backfillDisasterGeocodes } from './services/disasters.service.js';
import { ensureDisasterImpactGraphReady, refreshDisasterImpactGraphFromCurrentData } from './services/disaster-impact-graph.service.js';
import { financePathNeedsSession, hasFinanceSession } from './lib/finance-session.js';
import { scheduleDailyAt } from './lib/disaster-daily-scheduler.js';
import { attachStudioRealtime } from './services/studio-socket.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Initialize database if DATABASE_URL is provided - REQUIRED
let pool;
try {
  pool = initializeDatabase();
  if (!pool) {
    console.error('❌ Database connection failed - DATABASE_URL required');
    console.error('   Application cannot start without database');
    process.exit(1);
  }
} catch (err) {
  console.error('❌ Database initialization failed:', err.message);
  console.error('   Application cannot start without database');
  process.exit(1);
}

// Create tables - REQUIRED for app to function
try {
  await createTables();
  console.log('✅ Database tables ready');
} catch (err) {
  console.error('❌ Failed to create database tables:', err.message);
  console.error('   Application cannot start without database');
  process.exit(1);
}

try {
  const hydrated = await refreshGenealogyCachesFromPostgres({ bootstrapFromFilesystem: false });
  if (hydrated?.success) {
    console.log(
      `✅ Lane Postgres cache hydrated: ${hydrated.graphNodes} people, ${hydrated.datasetCount} dataset(s)`
    );
  } else {
    console.warn(`⚠️ Lane Postgres cache hydration skipped: ${hydrated?.error || 'unknown error'}`);
  }
} catch (err) {
  console.warn(`⚠️ Lane Postgres cache hydration failed: ${err.message}`);
}

// Initialize disasters schema - REQUIRED
try {
  await initDisastersSchema();
  console.log('✅ Disasters schema ready');
} catch (err) {
  console.error('❌ Failed to initialize disasters schema:', err.message);
  console.error('   Application cannot start without database');
  process.exit(1);
}

try {
  await ensureDisasterImpactGraphReady();
  console.log('✅ Disaster impact graph schema ready');
} catch (err) {
  console.warn(`⚠️ Disaster impact graph initialization skipped: ${err.message}`);
}

if (config.autoIngestDisasters) {
  console.log('🔄 Starting initial data source ingestion...');
  (async () => {
    try {
      await ingestFirmsNrt();
      await ingestUsgsQuakes();
      await ingestNwsCap();
      await ingestNhc();
      await ingestFema();
      const graphRes = await refreshDisasterImpactGraphFromCurrentData();
      // Camera feed disabled - too many records (198k+)
      // await ingestCaFireCameras();
      console.log('✅ Initial data ingestion complete', { graphRefreshed: graphRes?.refreshed === true });
    } catch (e) {
      console.warn('⚠️  Some data sources failed on initial ingestion (non-fatal):', e.message);
    }
  })();
} else {
  console.log('⏸️ Automatic disaster ingestion disabled (enable AUTO_INGEST_DISASTERS to re-activate)');
}

// Add middleware for parsing JSON request bodies (increased limit for image uploads)
// Capture raw body for webhook signature verification
app.use(
  express.json({
    limit: '50mb',
    verify: (req, res, buf) => {
      req.rawBody = buf;
    }
  })
); // Support base64 image uploads
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

function requireFinanceSession(req, res, next) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  if (!financePathNeedsSession(req.path)) return next();
  if (hasFinanceSession(req)) return next();
  const returnTo = encodeURIComponent(req.originalUrl);
  return res.redirect(302, `/?returnTo=${returnTo}&financeLogin=1`);
}

// Allow iframe embedding for Encompass Assistant
app.use('/finance/encompass-assistant.html', (req, res, next) => {
  res.removeHeader('X-Frame-Options');
  res.setHeader('X-Frame-Options', 'ALLOWALL');
  next();
});

// Make io available to routes
app.locals.io = io;
attachStudioRealtime(io);

app.use(requireFinanceSession);
app.use('/api', buildRoutes(io));
app.use('/lib', express.static(path.join(__dirname, 'lib')));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/video', express.static(path.join(__dirname, 'video')));
app.use('/data', express.static(path.join(__dirname, 'data'))); // Serve KML files
app.get('/vendor/exceljs.min.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'node_modules', 'exceljs', 'dist', 'exceljs.min.js'));
});

app.get('/share/poster/:id', async (req, res) => {
  try {
    const shareStorePath = path.join(__dirname, 'data', 'poster-shares.json');
    const raw = await fs.readFile(shareStorePath, 'utf8');
    const store = JSON.parse(raw);
    const share = store[req.params.id];

    if (!share) {
      return res.status(404).send('Share not found');
    }

    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${share.title}</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f5f6f8; margin: 0; padding: 24px; }
    .card { max-width: 640px; margin: 0 auto; background: #fff; border-radius: 16px; padding: 20px; box-shadow: 0 12px 30px rgba(0,0,0,0.15); }
    img { width: 100%; border-radius: 12px; display: block; }
    h1 { font-size: 1.2rem; margin: 0 0 12px; }
    .actions { margin-top: 16px; display: flex; gap: 10px; flex-wrap: wrap; }
    a.button { padding: 10px 16px; border-radius: 8px; background: #2c7be5; color: white; text-decoration: none; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${share.title}</h1>
    <img src="${share.imageUrl}" alt="${share.title}" />
    <div class="actions">
      <a class="button" href="${share.imageUrl}" download>Download PNG</a>
    </div>
  </div>
</body>
</html>`);
  } catch (error) {
    res.status(404).send('Share not found');
  }
});

app.get('/share/collection/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'nature', 'share-collection.html'), (err) => {
    if (err) res.status(404).send('Share not found');
  });
});

app.get('/health', (req,res)=>res.json({ok:true, mode: config.mode, platform: process.platform}));

async function runScheduledDisasterIngest(label = 'Disaster scheduler') {
  const startedAt = Date.now();
  const runSource = async (sourceLabel, fn) => {
    try {
      const result = await fn();
      console.log(`✅ ${label} source complete: ${sourceLabel}`, result);
      return result;
    } catch (err) {
      console.warn(`⚠️ ${label} source failed: ${sourceLabel}`, { error: err.message });
      return { error: err.message };
    }
  };

  await runSource('firms', ingestFirmsNrt);
  await runSource('usgs', ingestUsgsQuakes);
  await runSource('nws', ingestNwsCap);
  await runSource('nhc', ingestNhc);
  await runSource('fema', ingestFema);

  try {
    const geocodeBackfill = await backfillDisasterGeocodes();
    console.log(`✅ ${label} geocode backfill complete`, geocodeBackfill);
  } catch (geocodeErr) {
    console.warn(`⚠️ ${label} geocode backfill failed`, { error: geocodeErr.message });
  }

  try {
    await pruneOldDisasters();
    console.log(`✅ ${label} prune complete`);
  } catch (pruneErr) {
    console.warn(`⚠️ ${label} prune failed`, { error: pruneErr.message });
  }

  try {
    const graphRes = await refreshDisasterImpactGraphFromCurrentData();
    console.log(`✅ ${label} graph refresh complete`, graphRes);
  } catch (graphErr) {
    console.warn(`⚠️ ${label} graph refresh failed`, { error: graphErr.message });
  }

  console.log(`✅ ${label} run complete`, { elapsedMs: Date.now() - startedAt });
}

if (config.autoIngestDisasters) {
  scheduleDailyAt({
    timeZone: 'America/Los_Angeles',
    hour: 6,
    label: 'Disaster daily ingest (6:00 AM Pacific)',
    run: () => runScheduledDisasterIngest('Disaster daily ingest'),
  });
} else {
  console.log('⏸️ Skipping automatic disaster refresh scheduler');
}

app.get('*', (req,res)=>{
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

server.listen(config.port, ()=>{
  // Server started successfully
});