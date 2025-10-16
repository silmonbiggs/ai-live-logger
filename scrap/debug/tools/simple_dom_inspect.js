// Simple DOM inspector for Claude responses
const WebSocket = require('ws');

const CLAUDE_TAB_ID = '728865D285FCF956CA4732911870216D';
const WS_URL = `ws://localhost:9222/devtools/page/${CLAUDE_TAB_ID}`;

console.log('🔍 Simple Claude DOM inspection...');

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
  console.log('✅ Connected to Claude tab');
  
  // Simple script to find elements containing specific text
  const inspectionScript = `
    // Look for elements containing "seq_ok" (visible Claude response)
    const allElements = Array.from(document.querySelectorAll('*'));
    const results = [];
    
    // Find elements containing our known response
    allElements.forEach(el => {
      const text = el.textContent || '';
      if (text.includes('seq_ok') || text.includes('play_ok') || text.includes('vol_ok')) {
        results.push({
          tagName: el.tagName,
          className: el.className,
          id: el.id,
          textContent: text.trim().slice(0, 100),
          attributes: Array.from(el.attributes).map(a => a.name + '=' + a.value).join(' ')
        });
      }
    });
    
    console.log('FOUND RESPONSE ELEMENTS:', results.length);
    results.forEach((r, i) => {
      console.log(\`[\${i}] \${r.tagName} class="\${r.className}" text="\${r.textContent}"\`);
      console.log(\`    attributes: \${r.attributes}\`);
    });
    
    // Also check common message selectors
    const testSelectors = [
      '[data-message-author-role]',
      '[data-testid*="message"]',
      '[class*="message"]'
    ];
    
    testSelectors.forEach(sel => {
      const els = document.querySelectorAll(sel);
      console.log(\`\${sel}: \${els.length} elements\`);
      if (els.length > 0) {
        Array.from(els).slice(0, 2).forEach((el, i) => {
          console.log(\`  [\${i}] \${el.tagName} - "\${(el.textContent || '').slice(0, 50)}"\`);
        });
      }
    });
    
    'DOM_INSPECTION_COMPLETE';
  `;
  
  const message = {
    id: 1,
    method: 'Runtime.evaluate',
    params: {
      expression: inspectionScript,
      returnByValue: true
    }
  };
  
  ws.send(JSON.stringify(message));
});

ws.on('message', (data) => {
  const response = JSON.parse(data);
  
  if (response.id === 1) {
    console.log('Result:', response.result?.value);
    setTimeout(() => process.exit(0), 1000);
  }
});

ws.on('error', (error) => {
  console.error('❌ Error:', error.message);
});

ws.on('close', () => {
  console.log('🔌 Connection closed');
});