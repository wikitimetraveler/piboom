import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { config } from './config/index.js';
import buildRoutes from './routes/index.routes.js';
import { initializeDatabase, createTables } from './services/database.service.js';
import { ingestFirmsNrt, ingestUsgsQuakes, ingestNwsCap, ingestNhc, ingestFema, ingestCaFireCameras, pruneOldDisasters, initDisastersSchema } from './services/disasters.service.js';

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

// Initialize disasters schema - REQUIRED
try {
  await initDisastersSchema();
  console.log('✅ Disasters schema ready');
} catch (err) {
  console.error('❌ Failed to initialize disasters schema:', err.message);
  console.error('   Application cannot start without database');
  process.exit(1);
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
      // Camera feed disabled - too many records (198k+)
      // await ingestCaFireCameras();
      console.log('✅ Initial data ingestion complete');
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

// Allow iframe embedding for Encompass Assistant
app.use('/finance/encompass-assistant.html', (req, res, next) => {
  res.removeHeader('X-Frame-Options');
  res.setHeader('X-Frame-Options', 'ALLOWALL');
  next();
});

// Make io available to routes
app.locals.io = io;

app.use(express.static(path.join(__dirname, 'public')));
app.use('/data', express.static(path.join(__dirname, 'data'))); // Serve KML files
app.get('/vendor/xlsx.full.min.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'node_modules', 'xlsx', 'dist', 'xlsx.full.min.js'));
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
    try {
      await ingestFirmsNrt();
      await ingestUsgsQuakes();
      await ingestNwsCap();
      await ingestNhc();
      await ingestFema();
      // Camera feed disabled - too many records (198k+)
      // await ingestCaFireCameras();
    } catch (e) {
      // non-fatal
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
    } catch {}
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