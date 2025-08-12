import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const config = {
  port: Number(process.env.PORT || 3000),
  musicDir: path.resolve(process.env.MUSIC_DIR || path.join(__dirname, '..', 'music')),
  defaultVolume: Number(process.env.DEFAULT_VOLUME || 70),
  mode: (process.env.MODE || 'pi').toLowerCase() // 'pi' or 'cloud'
};