// Inspect Claude's DOM structure to find correct selectors for responses
const WebSocket = require('ws');

const CLAUDE_TAB_ID = '728865D285FCF956CA4732911870216D';
const WS_URL = `ws://localhost:9222/devtools/page/${CLAUDE_TAB_ID}`;

console.log('🔍 Inspecting Claude DOM structure for correct selectors...');

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
  console.log('✅ Connected to Claude tab');
  
  // Script to analyze the DOM structure of message elements
  const inspectionScript = `
    (function() {
      console.log('🔍 DOM INSPECTION: Looking for message elements...');
      
      // Get all elements that might be messages
      const allElements = document.querySelectorAll('*');
      const messageElements = [];
      
      // Look for elements containing our test content
      const testContent = ['seq_ok', 'play_ok', 'vol_ok', 'test', 'SEQUENCE', 'PLAY', 'VOLUME'];
      
      allElements.forEach((el, index) => {
        if (el.textContent && el.textContent.trim()) {
          const text = el.textContent.trim();
          
          // Check if this element contains any of our test content
          const containsTestContent = testContent.some(content => 
            text.includes(content) && text.length < 200 // Avoid huge container elements
          );
          
          if (containsTestContent) {
            const elementInfo = {
              index: index,
              tagName: el.tagName,
              id: el.id || 'none',
              className: el.className || 'none',
              textContent: text.slice(0, 100),
              textLength: text.length,
              attributes: Array.from(el.attributes || []).map(attr => 
                \`\${attr.name}="\${attr.value}"\`
              ),
              parentTagName: el.parentElement?.tagName || 'none',
              parentClassName: el.parentElement?.className || 'none',
              parentId: el.parentElement?.id || 'none'
            };
            
            messageElements.push(elementInfo);
            
            console.log(\`Found element \${index}:\`, elementInfo);
          }
        }
      });
      
      console.log(\`Total message elements found: \${messageElements.length}\`);
      
      // Also check for common message selectors
      const commonSelectors = [
        '[data-message-author-role]',
        '[data-message-id]',
        '[data-testid*="message"]',
        '[class*="message"]',
        '[class*="chat"]',
        '[class*="conversation"]',
        '[role="group"]',
        '[role="article"]'
      ];
      
      console.log('🎯 Testing common selectors:');
      
      commonSelectors.forEach(selector => {
        try {
          const elements = document.querySelectorAll(selector);
          console.log(\`\${selector}: \${elements.length} elements\`);
          
          if (elements.length > 0 && elements.length < 20) {
            Array.from(elements).slice(0, 3).forEach((el, i) => {
              console.log(\`  [\${i}] \${el.tagName} - "\${(el.textContent || '').slice(0, 50)}..."\`);
            });
          }
        } catch (e) {
          console.log(\`\${selector}: Error - \${e.message}\`);
        }
      });
      
      // Return summary data
      return {
        totalElements: allElements.length,
        messageElements: messageElements,
        timestamp: Date.now()
      };
    })();
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
    if (response.error) {
      console.error('❌ Error inspecting DOM:', response.error);
    } else {
      console.log('📋 DOM inspection complete');
      const result = response.result?.value;
      
      if (result && result.messageElements) {
        console.log(`\n📊 SUMMARY:`);
        console.log(`Total DOM elements: ${result.totalElements}`);
        console.log(`Message elements found: ${result.messageElements.length}`);
        
        console.log(`\n🎯 MESSAGE ELEMENTS ANALYSIS:`);
        result.messageElements.forEach((el, i) => {
          console.log(`\n[${i}] ${el.tagName}.${el.className}`);
          console.log(`    Text: "${el.textContent}"`);
          console.log(`    ID: ${el.id}`);
          console.log(`    Parent: ${el.parentTagName}.${el.parentClassName}`);
          console.log(`    Attributes: ${el.attributes.join(', ')}`);
        });
      }
      
      setTimeout(() => {
        console.log('\n✅ DOM inspection complete - check console output above');
        process.exit(0);
      }, 2000);
    }
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error.message);
  process.exit(1);
});

ws.on('close', () => {
  console.log('🔌 DOM inspection connection closed');
});