#!/usr/bin/env node

// Simple mode switcher for BOOM project
// Usage: node switch-mode.js [cloud|pi]

const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, 'config', 'index.js');

function switchMode(newMode) {
  if (!['cloud', 'pi'].includes(newMode)) {
    console.log('❌ Invalid mode. Use "cloud" for Windows development or "pi" for Raspberry Pi production.');
    console.log('Usage: node switch-mode.js [cloud|pi]');
    process.exit(1);
  }

  try {
    let configContent = fs.readFileSync(configPath, 'utf8');
    
    // Update the DEV_MODE value
    configContent = configContent.replace(
      /const DEV_MODE = ['"`][^'"`]+['"`];/,
      `const DEV_MODE = '${newMode}';`
    );
    
    fs.writeFileSync(configPath, configContent);
    
    console.log(`✅ Mode switched to: ${newMode.toUpperCase()}`);
    console.log(`   - ${newMode === 'cloud' ? 'Windows Development Mode' : 'Raspberry Pi Production Mode'}`);
    console.log('');
    console.log('🔄 Restart your server for changes to take effect:');
    console.log('   npm start');
    
  } catch (error) {
    console.error('❌ Error switching mode:', error.message);
    process.exit(1);
  }
}

// Get mode from command line argument
const newMode = process.argv[2];

if (!newMode) {
  console.log('🎵 BOOM Project Mode Switcher');
  console.log('');
  console.log('Current modes available:');
  console.log('  cloud  - Windows Development Mode (audio streaming via browser)');
  console.log('  pi     - Raspberry Pi Production Mode (system audio + voice activation)');
  console.log('');
  console.log('Usage: node switch-mode.js [cloud|pi]');
  console.log('');
  console.log('Examples:');
  console.log('  node switch-mode.js cloud    # Switch to Windows development mode');
  console.log('  node switch-mode.js pi       # Switch to Raspberry Pi production mode');
} else {
  switchMode(newMode);
}
