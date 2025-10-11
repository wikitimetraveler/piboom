import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Auto-detect deployment environment
const isCloudDeployment = process.env.RENDER_EXTERNAL_URL || 
                         process.env.HEROKU_APP_NAME || 
                         process.env.VERCEL_URL ||
                         process.env.NETLIFY_URL;

const DEV_MODE = isCloudDeployment ? 'cloud' : 'pi';

export const config = {
  port: Number(process.env.PORT || 3000),
  musicDir: path.resolve(process.env.MUSIC_DIR || path.join(__dirname, '..', 'music')),
  defaultVolume: Number(process.env.DEFAULT_VOLUME || 70),
  mode: (process.env.MODE || DEV_MODE).toLowerCase(), // 'pi' or 'cloud'
  
  // Database configuration
  databaseUrl: process.env.DATABASE_URL,
  
  // API Keys
  openaiApiKey: process.env.OPENAI_API_KEY,
  googleApiKey: process.env.GOOGLE_API_KEY,
  
  // Spotify OAuth
  spotifyClientId: process.env.SPOTIFY_CLIENT_ID,
  spotifyClientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  spotifyRedirectUri: process.env.SPOTIFY_REDIRECT_URI
};