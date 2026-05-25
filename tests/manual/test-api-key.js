/**
 * Development work by David Lane
 */
import 'dotenv/config';
import { getGoogleBrowserApiKey, getGoogleServerApiKey } from './lib/google-api-key.js';

console.log('🔑 Testing Google API Key setup...');
console.log('MODE:', process.env.MODE);
console.log('GOOGLE_BROWSER_API_KEY env:', process.env.GOOGLE_BROWSER_API_KEY ? '✅ Found' : '❌ Not set');
console.log('GOOGLE_SERVER_API_KEY env:', process.env.GOOGLE_SERVER_API_KEY ? '✅ Found' : '❌ Not set');
console.log('Legacy GOOGLE_API_KEY env:', process.env.GOOGLE_API_KEY ? '✅ Found' : '❌ Not set');

const browserKey = getGoogleBrowserApiKey();
const serverKey = getGoogleServerApiKey();

console.log('Resolved browser key length:', browserKey.length);
console.log('Resolved server key length:', serverKey.length);

if (browserKey && serverKey) {
  console.log('🎉 Browser + server Google API keys are configured!');
} else {
  console.log('❌ Missing Google API keys!');
  if (!browserKey) {
    console.log('   - Add GOOGLE_BROWSER_API_KEY (HTTP referrer restricted) to your .env');
  }
  if (!serverKey) {
    console.log('   - Add GOOGLE_SERVER_API_KEY (server-side key) to your .env');
  }
  console.log('Legacy fallback: set GOOGLE_API_KEY if you only have one key (not recommended).');
}
