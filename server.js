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
import { ingestFirmsNrt, ingestUsgsQuakes, ingestNwsCap, ingestNhc, ingestFema, ingestCaFireCameras, pruneOldDisasters, initDisastersSchema } from './services/disasters.service.js';
import { ensureDisasterImpactGraphReady, refreshDisasterImpactGraphFromCurrentData } from './services/disaster-impact-graph.service.js';

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

const FINANCE_SESSION_COOKIE = 'dc_finance_session';
const FINANCE_SESSION_VALUE = '1';
/** Paths that are allowed without finance session cookie (scripts, styles, images for /finance/ pages). */
const FINANCE_PUBLIC_FILE = /\.(js|mjs|css|png|jpg|jpeg|gif|svg|webp|ico|woff2?|ttf|eot|map|json|txt|xml|kml|wasm)$/i;

function readCookieHeader(req, name) {
  const raw = req.headers.cookie;
  if (!raw) return null;
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i === -1) continue;
    const k = part.slice(0, i).trim();
    if (k !== name) continue;
    return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

function financePathNeedsSession(urlPath) {
  if (urlPath === '/finance' || urlPath === '/finance/') return true;
  if (!urlPath.startsWith('/finance/')) return false;
  return !FINANCE_PUBLIC_FILE.test(urlPath);
}

function requireFinanceSession(req, res, next) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  if (!financePathNeedsSession(req.path)) return next();
  if (readCookieHeader(req, FINANCE_SESSION_COOKIE) === FINANCE_SESSION_VALUE) return next();
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

app.use(requireFinanceSession);
app.use(express.static(path.join(__dirname, 'public')));
app.use('/data', express.static(path.join(__dirname, 'data'))); // Serve KML files
app.get('/vendor/exceljs.min.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'node_modules', 'exceljs', 'dist', 'exceljs.min.js'));
});
app.use('/api', buildRoutes(io));

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

if (config.autoIngestDisasters) {
  // Simple scheduler (once per day) for disaster data sources
  setInterval(async () => {
    const startedAt = Date.now();
    try {
      const results = {};
      const runSource = async (label, fn) => {
        try {
          results[label] = await fn();
          console.log(`✅ Disaster scheduler source complete: ${label}`, results[label]);
        } catch (err) {
          results[label] = { error: err.message };
          console.warn(`⚠️ Disaster scheduler source failed: ${label}`, { error: err.message });
        }
      };
      await runSource('firms', ingestFirmsNrt);
      await runSource('usgs', ingestUsgsQuakes);
      await runSource('nws', ingestNwsCap);
      await runSource('nhc', ingestNhc);
      await runSource('fema', ingestFema);
      // Camera feed disabled - too many records (198k+)
      // await ingestCaFireCameras();
      try {
        const graphRes = await refreshDisasterImpactGraphFromCurrentData();
        console.log('✅ Disaster scheduler graph refresh complete', graphRes);
      } catch (graphErr) {
        console.warn('⚠️ Disaster scheduler graph refresh failed', { error: graphErr.message });
      }
      console.log('✅ Disaster scheduler run complete', {
        elapsedMs: Date.now() - startedAt
      });
    } catch (e) {
      console.warn('⚠️ Disaster scheduler run failed (non-fatal)', {
        error: e.message,
        elapsedMs: Date.now() - startedAt
      });
    }
  }, 24 * 60 * 60 * 1000); // Once per day (24 hours)
} else {
  console.log('⏸️ Skipping automatic disaster refresh scheduler');
}

// Nightly prune older than 90 days
if (config.autoIngestDisasters) {
  setInterval(async () => {
    try {
      await pruneOldDisasters();
      console.log('✅ Disaster prune run complete');
    } catch (err) {
      console.warn('⚠️ Disaster prune run failed', { error: err.message });
    }
  }, 24 * 60 * 60 * 1000);
} else {
  console.log('⏸️ Skipping disaster pruning (auto ingestion disabled)');
}

app.get('*', (req,res)=>{
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

server.listen(config.port, ()=>{
  // Server started successfully
});