// Comprehensive Claude DOM analysis to find real message structure
const WebSocket = require('ws');

const CLAUDE_TAB_ID = 'E496815C76D0B562F7249C435E19F736';
const WS_URL = `ws://localhost:9222/devtools/page/${CLAUDE_TAB_ID}`;

console.log('🔬 Comprehensive Claude DOM Analysis...');

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
  console.log('✅ Connected to Claude tab');
  
  const analysisScript = `
    (function() {
      const results = {
        messageStructure: [],
        inputElements: [],
        conversationElements: [],
        dataAttributes: new Set(),
        classPatterns: new Set(),
        roleIndicators: []
      };
      
      // 1. Find all elements with data attributes
      document.querySelectorAll('[data-message-author-role]').forEach(el => {
        results.roleIndicators.push({
          role: el.getAttribute('data-message-author-role'),
          tagName: el.tagName,
          className: el.className,
          textPreview: (el.textContent || '').slice(0, 50)
        });
      });
      
      // 2. Find the conversation container
      const conversationSelectors = [
        '[data-testid*="conversation"]',
        '[role="main"]',
        '[class*="conversation"]',
        'main'
      ];
      
      conversationSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          results.conversationElements.push({
            selector: selector,
            count: elements.length,
            firstElement: {
              tagName: elements[0].tagName,
              className: elements[0].className,
              childCount: elements[0].children.length
            }
          });
        }
      });
      
      // 3. Find input elements
      const inputSelectors = [
        'textarea',
        '[contenteditable="true"]',
        'input[type="text"]',
        '[data-testid*="input"]',
        '[placeholder*="Message"]'
      ];
      
      inputSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          results.inputElements.push({
            selector: selector,
            tagName: el.tagName,
            placeholder: el.placeholder || '',
            value: el.value || '',
            contentEditable: el.contentEditable,
            className: el.className
          });
        });
      });
      
      // 4. Analyze message structure by looking at recent messages
      // Find elements containing known test responses
      const knownMessages = ['test_success', 'Fresh_test_message', 'seq_ok', 'vol_ok'];
      
      knownMessages.forEach(messageText => {
        const elements = Array.from(document.querySelectorAll('*')).filter(el => {
          const text = el.textContent?.trim();
          return text && text.includes(messageText) && text.length < 500;
        });
        
        elements.forEach(el => {
          // Walk up the DOM tree to find message container
          let current = el;
          let depth = 0;
          const ancestors = [];
          
          while (current && depth < 10) {
            ancestors.push({
              depth: depth,
              tagName: current.tagName,
              className: current.className || '',
              id: current.id || '',
              dataAttrs: Array.from(current.attributes || [])
                .filter(attr => attr.name.startsWith('data-'))
                .map(attr => \`\${attr.name}="\${attr.value}"\`)
            });
            current = current.parentElement;
            depth++;
          }
          
          results.messageStructure.push({
            text: messageText,
            foundIn: el.tagName,
            ancestors: ancestors
          });
        });
      });
      
      // 5. Collect all data attributes found
      document.querySelectorAll('*').forEach(el => {
        Array.from(el.attributes || []).forEach(attr => {
          if (attr.name.startsWith('data-')) {
            results.dataAttributes.add(attr.name);
          }
          if (attr.name === 'class' && attr.value.includes('message')) {
            results.classPatterns.add(attr.value);
          }
        });
      });
      
      return {
        roleIndicators: results.roleIndicators,
        conversationElements: results.conversationElements,
        inputElements: results.inputElements,
        messageStructure: results.messageStructure,
        dataAttributes: Array.from(results.dataAttributes),
        classPatterns: Array.from(results.classPatterns)
      };
    })();
  `;
  
  const message = {
    id: 1,
    method: 'Runtime.evaluate',
    params: {
      expression: analysisScript,
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
        console.log('\n📊 COMPREHENSIVE DOM ANALYSIS RESULTS:\n');
        
        console.log('1️⃣ ROLE INDICATORS (data-message-author-role):');
        if (results.roleIndicators.length > 0) {
          results.roleIndicators.forEach((item, i) => {
            console.log(`  [${i}] role="${item.role}" ${item.tagName}.${item.className}`);
            console.log(`      Text: "${item.textPreview}..."`);
          });
        } else {
          console.log('  ❌ No elements with data-message-author-role found');
        }
        
        console.log('\n2️⃣ CONVERSATION CONTAINERS:');
        results.conversationElements.forEach(item => {
          console.log(`  ${item.selector}: ${item.count} elements`);
          if (item.firstElement) {
            console.log(`    First: ${item.firstElement.tagName}.${item.firstElement.className}`);
            console.log(`    Children: ${item.firstElement.childCount}`);
          }
        });
        
        console.log('\n3️⃣ INPUT ELEMENTS:');
        results.inputElements.forEach(item => {
          console.log(`  ${item.selector}: ${item.tagName}`);
          console.log(`    Placeholder: "${item.placeholder}"`);
          console.log(`    Class: ${item.className}`);
        });
        
        console.log('\n4️⃣ MESSAGE STRUCTURE ANALYSIS:');
        results.messageStructure.forEach(msg => {
          console.log(`  Message: "${msg.text}"`);
          console.log('  DOM Hierarchy:');
          msg.ancestors.slice(0, 5).forEach(ancestor => {
            console.log(`    ${'  '.repeat(ancestor.depth)}${ancestor.tagName}${ancestor.id ? '#' + ancestor.id : ''}${ancestor.className ? '.' + ancestor.className.split(' ').slice(0, 2).join('.') : ''}`);
            if (ancestor.dataAttrs.length > 0) {
              console.log(`    ${'  '.repeat(ancestor.depth + 1)}Data: ${ancestor.dataAttrs.join(', ')}`);
            }
          });
        });
        
        console.log('\n5️⃣ ALL DATA ATTRIBUTES FOUND:');
        console.log('  ', results.dataAttributes.slice(0, 20).join(', '));
        
        console.log('\n6️⃣ MESSAGE-RELATED CLASSES:');
        results.classPatterns.slice(0, 10).forEach(className => {
          console.log(`  "${className}"`);
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
  console.log('🔌 Analysis complete');
});