// Debug injection script for signal processing logger
const tabId = 'E496815C76D0B562F7249C435E19F736';
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('=== DEBUG INJECTION STARTING ===');

// Read the logger directly
const loggerPath = path.join(__dirname, 'debug', 'tools', 'signal_processing_logger.js');
console.log('Reading logger from:', loggerPath);

if (!fs.existsSync(loggerPath)) {
    console.error('ERROR: Logger file not found at', loggerPath);
    process.exit(1);
}

const loggerCode = fs.readFileSync(loggerPath, 'utf8');
console.log('Logger code length:', loggerCode.length, 'chars');

// Simple test injection
const testExpression = `
console.log('[INJECTION TEST] Starting...');
window.injectionTest = 'working';
console.log('[INJECTION TEST] Set test variable');
'injection-test-complete';
`;

console.log('Testing basic injection...');

try {
    const testCommand = `curl -s -X POST "http://localhost:9222/page/${tabId}/runtime/evaluate" -H "Content-Type: application/json" -d '{"expression":"${testExpression.replace(/"/g, '\\"').replace(/\n/g, '\\n')}","awaitPromise":false}'`;
    
    const testResult = execSync(testCommand, { encoding: 'utf8' });
    console.log('Test injection result:', testResult);
    
    if (testResult.includes('injection-test-complete')) {
        console.log('✅ Basic injection works, proceeding with logger...');
        
        // Now inject the actual logger in smaller chunks
        const initCode = `
console.log('[SIGNAL LOGGER] Manual injection starting...');
if (window.signalProcessingLogger) {
    console.log('[SIGNAL LOGGER] Clearing existing logger...');
    delete window.signalProcessingLogger;
}
'logger-init-ready';
        `;
        
        const initCommand = `curl -s -X POST "http://localhost:9222/page/${tabId}/runtime/evaluate" -H "Content-Type: application/json" -d '{"expression":"${initCode.replace(/"/g, '\\"').replace(/\n/g, '\\n')}","awaitPromise":false}'`;
        
        console.log('Initializing logger space...');
        execSync(initCommand);
        
        // Try to load via script tag instead of eval
        const loadCode = `
console.log('[SIGNAL LOGGER] Creating script tag...');
var script = document.createElement('script');
script.src = 'http://localhost:8000/debug/tools/signal_processing_logger.js';
script.onload = function() { console.log('[SIGNAL LOGGER] ✅ Loaded via script tag!'); };
script.onerror = function(e) { console.error('[SIGNAL LOGGER] ❌ Script tag failed:', e); };
document.head.appendChild(script);
'script-tag-added';
        `;
        
        const loadCommand = `curl -s -X POST "http://localhost:9222/page/${tabId}/runtime/evaluate" -H "Content-Type: application/json" -d '{"expression":"${loadCode.replace(/"/g, '\\"').replace(/\n/g, '\\n')}","awaitPromise":false}'`;
        
        console.log('Loading via script tag...');
        const loadResult = execSync(loadCommand, { encoding: 'utf8' });
        console.log('Script tag result:', loadResult);
        
        console.log('=== INJECTION COMPLETE ===');
        console.log('Check Claude console for "[SIGNAL LOGGER]" messages');
        
    } else {
        console.log('❌ Basic injection failed');
    }
    
} catch (error) {
    console.error('Injection failed:', error.message);
}