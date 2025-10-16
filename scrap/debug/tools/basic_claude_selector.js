// Basic Claude selector finder with simple text output
const WebSocket = require('ws');

const CLAUDE_TAB_ID = '728865D285FCF956CA4732911870216D';
const WS_URL = `ws://localhost:9222/devtools/page/${CLAUDE_TAB_ID}`;

console.log('🔍 Basic Claude selector analysis...');

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
  console.log('✅ Connected to Claude tab');
  
  // Simple script that returns a string with findings
  const simpleScript = `
    // Find elements containing 'seq_ok' (the known response)
    var foundElements = [];
    var allElements = document.querySelectorAll('*');
    
    for (var i = 0; i < allElements.length; i++) {
      var el = allElements[i];
      var text = el.textContent || '';
      
      if (text.trim() === 'seq_ok') {
        foundElements.push({
          tag: el.tagName,
          class: el.className,
          id: el.id,
          parent: el.parentElement ? el.parentElement.tagName : 'none',
          parentClass: el.parentElement ? el.parentElement.className : 'none'
        });
      }
    }
    
    // Also check for common message patterns
    var messageSelectors = [
      'article', 
      '[role="article"]',
      '[data-testid*="message"]',
      'div[class*="message"]'
    ];
    
    var selectorResults = [];
    for (var j = 0; j < messageSelectors.length; j++) {
      var selector = messageSelectors[j];
      var elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        selectorResults.push(selector + ':' + elements.length);
      }
    }
    
    'FOUND_ELEMENTS:' + JSON.stringify(foundElements) + '|SELECTORS:' + selectorResults.join(',');
  `;
  
  const message = {
    id: 1,
    method: 'Runtime.evaluate',
    params: {
      expression: simpleScript,
      returnByValue: true
    }
  };
  
  ws.send(JSON.stringify(message));
});

ws.on('message', (data) => {
  const response = JSON.parse(data);
  
  if (response.id === 1) {
    if (response.error) {
      console.error('❌ Error:', response.error);
    } else {
      const result = response.result?.value;
      console.log('Raw result:', result);
      
      if (typeof result === 'string' && result.includes('FOUND_ELEMENTS:')) {
        const parts = result.split('|SELECTORS:');
        const elementsStr = parts[0].replace('FOUND_ELEMENTS:', '');
        const selectorsStr = parts[1] || '';
        
        try {
          const elements = JSON.parse(elementsStr);
          console.log(`\\n🎯 Found ${elements.length} elements containing 'seq_ok':`);
          elements.forEach((el, i) => {
            console.log(`[${i}] ${el.tag}.${el.class} (parent: ${el.parent}.${el.parentClass})`);
          });
          
          console.log(`\\n📋 Working selectors: ${selectorsStr}`);
        } catch (e) {
          console.log('Parse error:', e.message);
          console.log('Raw data:', elementsStr);
        }
      }
    }
    
    setTimeout(() => process.exit(0), 1000);
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error.message);
});

ws.on('close', () => {
  console.log('🔌 Connection closed');
});