// Simple Claude structure analysis
const WebSocket = require('ws');

const CLAUDE_TAB_ID = 'E496815C76D0B562F7249C435E19F736';
const WS_URL = `ws://localhost:9222/devtools/page/${CLAUDE_TAB_ID}`;

console.log('🔍 Simple Claude structure analysis...');

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
  console.log('✅ Connected');
  
  const script = `
    // Find message elements containing our known text
    const messages = [];
    const knownTexts = ['test_success', 'Fresh_test_message', 'seq_ok'];
    
    knownTexts.forEach(text => {
      const elements = Array.from(document.querySelectorAll('*')).filter(el => {
        const content = el.textContent?.trim();
        return content === text || (content && content.includes(text) && content.length < 100);
      });
      
      elements.forEach(el => {
        messages.push({
          text: text,
          element: el.tagName,
          className: el.className,
          id: el.id,
          dataAttrs: Array.from(el.attributes).filter(a => a.name.startsWith('data-')).map(a => a.name + '=' + a.value),
          parent: el.parentElement ? {
            tag: el.parentElement.tagName,
            class: el.parentElement.className,
            dataAttrs: Array.from(el.parentElement.attributes).filter(a => a.name.startsWith('data-')).map(a => a.name + '=' + a.value)
          } : null
        });
      });
    });
    
    // Find input field
    const inputs = [];
    document.querySelectorAll('textarea, [contenteditable], input').forEach(el => {
      inputs.push({
        tag: el.tagName,
        type: el.type,
        placeholder: el.placeholder,
        className: el.className,
        value: el.value || el.textContent
      });
    });
    
    JSON.stringify({ messages, inputs });
  `;
  
  ws.send(JSON.stringify({
    id: 1,
    method: 'Runtime.evaluate',
    params: { expression: script, returnByValue: true }
  }));
});

ws.on('message', (data) => {
  const response = JSON.parse(data);
  if (response.id === 1) {
    try {
      const result = JSON.parse(response.result?.value || '{}');
      console.log('📋 Messages found:', result.messages?.length || 0);
      result.messages?.forEach((msg, i) => {
        console.log(`[${i}] "${msg.text}" in ${msg.element}.${msg.className}`);
        if (msg.dataAttrs.length > 0) console.log(`    Data: ${msg.dataAttrs.join(', ')}`);
        if (msg.parent) console.log(`    Parent: ${msg.parent.tag}.${msg.parent.class}`);
      });
      
      console.log('💬 Inputs found:', result.inputs?.length || 0);
      result.inputs?.forEach((input, i) => {
        console.log(`[${i}] ${input.tag} placeholder="${input.placeholder}" class="${input.className}"`);
      });
    } catch (e) {
      console.log('Raw result:', response.result?.value);
    }
    process.exit(0);
  }
});

ws.on('error', console.error);
ws.on('close', () => console.log('Done'));