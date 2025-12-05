import path from 'path';
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
app.use(express.json({ limit: '50mb' })); // Support base64 image uploads
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
app.use('/api', buildRoutes(io));

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
setInterval(async () => {
  try {
    await pruneOldDisasters();
  } catch {}
}, 24 * 60 * 60 * 1000);

app.get('*', (req,res)=>{
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

server.listen(config.port, ()=>{
  // Server started successfully
});