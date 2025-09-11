import 'dotenv/config';

console.log('🔑 Testing Google API Key...');
console.log('MODE:', process.env.MODE);
console.log('GOOGLE_API_KEY:', process.env.GOOGLE_API_KEY ? '✅ Found' : '❌ Not found');
console.log('Key length:', process.env.GOOGLE_API_KEY?.length || 0);

if (process.env.GOOGLE_API_KEY) {
  console.log('🎉 Google API key is configured!');
} else {
  console.log('❌ Google API key is missing!');
  console.log('Make sure your .env file exists and contains:');
  console.log('GOOGLE_API_KEY=your_actual_api_key_here');
}
