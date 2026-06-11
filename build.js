/**
 * Simple build script to copy webextension-polyfill to vendor directory
 * Run with: node build.js
 */

import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const vendorDir = join(__dirname, 'src', 'vendor');
const sourceFile = join(__dirname, 'node_modules', 'webextension-polyfill', 'dist', 'browser-polyfill.min.js');
const destFile = join(vendorDir, 'browser-polyfill.min.js');

// Create vendor directory if it doesn't exist
if (!existsSync(vendorDir)) {
  mkdirSync(vendorDir, { recursive: true });
}

// Copy polyfill
try {
  copyFileSync(sourceFile, destFile);
  console.log('✓ Copied webextension-polyfill to src/vendor/');
} catch (error) {
  console.error('✗ Failed to copy polyfill:', error.message);
  process.exit(1);
}

console.log('\n✓ Build complete!');
console.log('\nTo load the extension:');
console.log('1. Chrome/Edge: Navigate to chrome://extensions/, enable "Developer mode", click "Load unpacked", select the project root');
console.log('2. Firefox: Navigate to about:debugging#/runtime/this-firefox, click "Load Temporary Add-on", select manifest.json');