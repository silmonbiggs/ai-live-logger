// Minimal injection to fetch and execute the logger
const tabId = 'E496815C76D0B562F7249C435E19F736';
const { execSync } = require('child_process');

const expression = `
(function() {
  console.log('[INJECTOR] Loading signal processing logger from HTTP server...');
  fetch('http://localhost:8000/debug/tools/signal_processing_logger.js')
    .then(response => {
      if (!response.ok) throw new Error('Failed to fetch logger: ' + response.status);
      return response.text();
    })
    .then(code => {
      eval(code);
      console.log('[INJECTOR] Signal processing logger injected successfully!');
    })
    .catch(error => {
      console.error('[INJECTOR] Failed to load logger:', error);
    });
})();
`;

const command = `curl -X POST "http://localhost:9222/page/${tabId}/runtime/evaluate" -H "Content-Type: application/json" -d '{"expression":"${expression.replace(/"/g, '\\"').replace(/\n/g, '\\n')}","awaitPromise":false}'`;

try {
  const result = execSync(command, { encoding: 'utf8' });
  console.log('Injection completed:', result);
} catch (error) {
  console.error('Injection failed:', error.message);
}