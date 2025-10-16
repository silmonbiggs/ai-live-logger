// Find Claude response elements with multiple detection strategies
const WebSocket = require('ws');

const CLAUDE_TAB_ID = '728865D285FCF956CA4732911870216D';
const WS_URL = `ws://localhost:9222/devtools/page/${CLAUDE_TAB_ID}`;

console.log('🎯 Finding Claude response elements...');

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
  console.log('✅ Connected to Claude tab');
  
  // Multiple strategies to find Claude responses
  const findResponseScript = `
    (function() {
      const results = {
        strategy1_textSearch: [],
        strategy2_commonSelectors: [],
        strategy3_roleAttributes: [],
        strategy4_recentElements: [],
        allElementsCount: 0
      };
      
      const allElements = document.querySelectorAll('*');
      results.allElementsCount = allElements.length;
      
      // Strategy 1: Search for elements containing response text
      const responseTexts = ['seq_ok', 'play_ok', 'vol_ok', 'ok_', 'rapid', 'delay', 'reset'];
      
      allElements.forEach((el, index) => {
        if (el.textContent) {
          const text = el.textContent.trim();
          
          responseTexts.forEach(responseText => {
            if (text.includes(responseText) && text.length < 100) {
              results.strategy1_textSearch.push({
                index: index,
                tagName: el.tagName,
                className: el.className || '',
                id: el.id || '',
                textContent: text,
                selector: el.tagName.toLowerCase() + 
                         (el.id ? '#' + el.id : '') +
                         (el.className ? '.' + el.className.split(' ').join('.') : ''),
                attributes: Array.from(el.attributes || []).map(a => a.name + '=' + a.value)
              });
            }
          });
        }
      });
      
      // Strategy 2: Common message selectors
      const messageSelectors = [
        '[data-message-author-role="assistant"]',
        '[data-message-author-role="bot"]',
        '[data-role="assistant"]',
        '[role="assistant"]',
        '[data-testid*="message"]',
        '[data-testid*="assistant"]',
        '[class*="assistant"]',
        '[class*="response"]',
        '[class*="bot"]',
        'article',
        '[role="article"]'
      ];
      
      messageSelectors.forEach(selector => {
        try {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            results.strategy2_commonSelectors.push({
              selector: selector,
              count: elements.length,
              samples: Array.from(elements).slice(0, 2).map(el => ({
                text: (el.textContent || '').slice(0, 50),
                tagName: el.tagName,
                className: el.className || ''
              }))
            });
          }
        } catch (e) {
          // Skip invalid selectors
        }
      });
      
      // Strategy 3: Look for elements with role attributes
      const roleElements = document.querySelectorAll('[role], [data-role], [data-message-author-role]');
      roleElements.forEach(el => {
        results.strategy3_roleAttributes.push({
          tagName: el.tagName,
          role: el.getAttribute('role'),
          dataRole: el.getAttribute('data-role'),
          messageAuthorRole: el.getAttribute('data-message-author-role'),
          className: el.className || '',
          textPreview: (el.textContent || '').slice(0, 30)
        });
      });
      
      // Strategy 4: Look at recently modified elements (most likely to be responses)
      const recentElements = Array.from(document.querySelectorAll('*')).slice(-20);
      recentElements.forEach(el => {
        if (el.textContent && el.textContent.trim()) {
          results.strategy4_recentElements.push({
            tagName: el.tagName,
            className: el.className || '',
            textContent: el.textContent.trim().slice(0, 50),
            selector: el.tagName.toLowerCase() + 
                     (el.id ? '#' + el.id : '') +
                     (el.className ? '.' + el.className.split(' ').join('.') : '')
          });
        }
      });
      
      return results;
    })();
  `;
  
  const message = {
    id: 1,
    method: 'Runtime.evaluate',
    params: {
      expression: findResponseScript,
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
      const results = response.result?.value;
      
      if (results) {
        console.log(`\n📊 ANALYSIS RESULTS (${results.allElementsCount} total elements):`);
        
        console.log(`\n🎯 Strategy 1 - Text Search (${results.strategy1_textSearch.length} matches):`);
        results.strategy1_textSearch.forEach((item, i) => {
          console.log(`[${i}] ${item.selector}`);
          console.log(`    Text: "${item.textContent}"`);
          console.log(`    Attributes: ${item.attributes.join(', ')}`);
        });
        
        console.log(`\n🎯 Strategy 2 - Common Selectors (${results.strategy2_commonSelectors.length} working selectors):`);
        results.strategy2_commonSelectors.forEach(item => {
          console.log(`${item.selector}: ${item.count} elements`);
          item.samples.forEach((sample, i) => {
            console.log(`  [${i}] ${sample.tagName}.${sample.className} - "${sample.text}"`);
          });
        });
        
        console.log(`\n🎯 Strategy 3 - Role Attributes (${results.strategy3_roleAttributes.length} elements):`);
        results.strategy3_roleAttributes.slice(0, 10).forEach((item, i) => {
          console.log(`[${i}] ${item.tagName} role="${item.role}" data-role="${item.dataRole}" author-role="${item.messageAuthorRole}"`);
          console.log(`    Class: "${item.className}" Text: "${item.textPreview}"`);
        });
        
        console.log(`\n🎯 Strategy 4 - Recent Elements (${results.strategy4_recentElements.length} recent elements):`);
        results.strategy4_recentElements.slice(0, 5).forEach((item, i) => {
          console.log(`[${i}] ${item.selector} - "${item.textContent}"`);
        });
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