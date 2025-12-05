import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Auto-detect deployment environment
const isCloudDeployment = !!(process.env.RENDER_EXTERNAL_URL || 
                         process.env.HEROKU_APP_NAME ||
                         process.env.VERCEL_URL ||
                         process.env.NETLIFY_URL);

const DEV_MODE = isCloudDeployment ? 'cloud' : 'pi';

export interface Config {
  port: number;
  musicDir: string;
  defaultVolume: number;
  mode: 'pi' | 'cloud';
  databaseUrl: string | undefined;
  openaiApiKey: string;
  googleApiKey: string;
  googleBrowserApiKey: string;
  googleServerApiKey: string;
  autoIngestDisasters: boolean;
  spotifyClientId: string;
  spotifyClientSecret: string;
  spotifyRedirectUri: string;
  shazamApiKey: string;
}

export const config: Config = {
  port: Number(process.env.PORT || 3000),
  musicDir: path.resolve(process.env.MUSIC_DIR || path.join(__dirname, '..', 'music')),
  defaultVolume: Number(process.env.DEFAULT_VOLUME || 70),
  mode: (process.env.MODE || DEV_MODE).toLowerCase() as 'pi' | 'cloud',
  
  // Database configuration
  databaseUrl: process.env.DATABASE_URL,
  
  // API Keys
  openaiApiKey: (process.env.OPENAI_API_KEY || '').trim(),
  googleApiKey: (process.env.GOOGLE_API_KEY || '').trim(),
  googleBrowserApiKey: (process.env.GOOGLE_BROWSER_API_KEY || process.env.GOOGLE_API_KEY || '').trim(),
  googleServerApiKey: (process.env.GOOGLE_SERVER_API_KEY || process.env.GOOGLE_API_KEY || '').trim(),
  autoIngestDisasters: (process.env.AUTO_INGEST_DISASTERS || '').toLowerCase() === 'true',
  
  // Spotify OAuth
  spotifyClientId: (process.env.SPOTIFY_CLIENT_ID || '').trim(),
  spotifyClientSecret: (process.env.SPOTIFY_CLIENT_SECRET || '').trim(),
  spotifyRedirectUri: (process.env.SPOTIFY_REDIRECT_URI || '').trim(),
  
  // Audio Fingerprinting - Shazam API (via RapidAPI)
  // 500 requests/month FREE forever!
  shazamApiKey: (process.env.SHAZAM_API_KEY || '').trim()
};

