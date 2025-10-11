import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { config } from './config/index.js';
import buildRoutes from './routes/index.routes.js';
import { initializeDatabase, createTables } from './services/database.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Initialize database if DATABASE_URL is provided
initializeDatabase();
await createTables();

// Add middleware for parsing JSON request bodies (increased limit for image uploads)
app.use(express.json({ limit: '50mb' })); // Support base64 image uploads
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Make io available to routes
app.locals.io = io;

app.use(express.static(path.join(__dirname, 'public')));
app.use('/api', buildRoutes(io));

app.get('/health', (req,res)=>res.json({ok:true, mode: config.mode, platform: process.platform}));

app.get('*', (req,res)=>{
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

server.listen(config.port, ()=>{
  // Server started successfully
});