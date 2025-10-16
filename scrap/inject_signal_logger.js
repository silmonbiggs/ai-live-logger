// Direct injection script for signal processing logger
const tabId = 'E496815C76D0B562F7249C435E19F736';
const fs = require('fs');
const path = require('path');

// Read the signal processing logger
const loggerPath = path.join(__dirname, 'debug', 'tools', 'signal_processing_logger.js');
const loggerCode = fs.readFileSync(loggerPath, 'utf8');

console.log('Injecting signal processing logger...');

// Execute via Chrome DevTools Protocol
const { execSync } = require('child_process');

const command = `curl -X POST "http://localhost:9222/page/${tabId}/runtime/evaluate" -H "Content-Type: application/json" -d "{\\"expression\\":\\"${loggerCode.replace(/"/g, '\\"').replace(/\n/g, '\\n')}\\",\\"awaitPromise\\":false}"`;

try {
  const result = execSync(command, { encoding: 'utf8' });
  console.log('Injection result:', result);
  console.log('Signal processing logger should now be active in Claude tab.');
} catch (error) {
  console.error('Injection failed:', error.message);
}