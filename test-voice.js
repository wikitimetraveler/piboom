// Test script for Pi mode voice system
import { config } from './config/index.js';

console.log('🧪 Testing Pi mode voice system...');
console.log('Platform:', process.platform);
console.log('Mode:', config.mode);
console.log('Port:', config.port);

// Test environment variables
console.log('\n🔍 Environment check:');
console.log('MODE:', process.env.MODE || 'not set (using default)');
console.log('GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS || 'not set');

// Test Google Cloud credentials file
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

try {
  const credentialsPath = join(__dirname, 'google-credentials.json');
  const credentials = JSON.parse(readFileSync(credentialsPath, 'utf8'));
  console.log('✅ Google Cloud credentials found and valid');
  console.log('   Project ID:', credentials.project_id);
  console.log('   Client Email:', credentials.client_email);
} catch (error) {
  console.log('❌ Google Cloud credentials error:', error.message);
}

console.log('\n🚀 To start the server in Pi mode:');
if (process.platform === 'win32') {
  console.log('   Run: start-pi.bat');
  console.log('   Or: set MODE=pi && set GOOGLE_APPLICATION_CREDENTIALS=%CD%\\google-credentials.json && npm start');
} else {
  console.log('   Run: ./start-pi.sh');
  console.log('   Or: MODE=pi GOOGLE_APPLICATION_CREDENTIALS=$(pwd)/google-credentials.json npm start');
}

console.log('\n📋 Voice commands available:');
console.log('   - play, pause, volume up, volume down');
console.log('   - what song, help');
console.log('\n🎯 The system will use:');
if (process.platform === 'win32') {
  console.log('   - Frontend Web Speech API for voice recognition');
  console.log('   - Windows built-in text-to-speech for feedback');
  console.log('   - Backend processing for command execution');
} else {
  console.log('   - Google Cloud Speech-to-Text for voice recognition');
  console.log('   - espeak for text-to-speech feedback');
  console.log('   - arecord/sox for audio processing');
}
