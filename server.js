import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { config } from './config/index.js';
import buildRoutes from './routes/index.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Add middleware for parsing JSON request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Make io available to routes
app.locals.io = io;

app.use(express.static(path.join(__dirname, 'public')));
app.use('/api', buildRoutes(io));

app.get('/health', (req,res)=>res.json({ok:true, mode: config.mode, platform: process.platform}));

app.get('*', (req,res)=>{
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

server.listen(config.port, ()=>{
  console.log(`🎵 Pi BOOM Audio System listening on http://localhost:${config.port}`);
  console.log(`🔧 Mode: ${config.mode} | Platform: ${process.platform}`);
  console.log(`🎤 Music directory: ${config.musicDir}`);
  console.log(`🔊 Voice activation: ${config.mode === 'pi' ? 'ENABLED' : 'DISABLED'}`);
  console.log(`📡 Socket.IO server ready for voice commands`);
  
  if (config.mode === 'pi') {
    console.log(`🎯 Pi mode active - using local audio playback and voice recognition`);
  }
});