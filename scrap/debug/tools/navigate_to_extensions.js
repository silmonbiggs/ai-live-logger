// Navigate to Extensions tab to check extension status
const WebSocket = require('ws');

console.log('🔍 Getting list of Chrome tabs...');

// First get the list of tabs to find the Extensions tab
const http = require('http');

const options = {
  hostname: 'localhost',
  port: 9222,
  path: '/json/list',
  method: 'GET'
};

const req = http.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const tabs = JSON.parse(data);
      
      // Find the Extensions tab
      const extensionsTab = tabs.find(tab => 
        tab.url && tab.url.includes('chrome://extensions/')
      );
      
      if (extensionsTab) {
        console.log('✅ Found Extensions tab:', extensionsTab.id);
        
        // Connect to Extensions tab
        const WS_URL = `ws://localhost:9222/devtools/page/${extensionsTab.id}`;
        const ws = new WebSocket(WS_URL);
        
        ws.on('open', () => {
          console.log('✅ Connected to Extensions tab');
          
          // Check extension status
          const checkScript = `
            // Find our extension in the extensions page
            const extensionElements = document.querySelectorAll('extensions-item');
            let ourExtension = null;
            
            for (const ext of extensionElements) {
              const name = ext.shadowRoot?.querySelector('#name')?.textContent;
              const description = ext.shadowRoot?.querySelector('#description')?.textContent;
              
              if (name && (name.includes('AI Chat') || name.includes('ChatGPT') || name.includes('Logger'))) {
                ourExtension = {
                  name: name,
                  description: description,
                  id: ext.getAttribute('id'),
                  enabled: !ext.hasAttribute('disabled')
                };
                break;
              }
            }
            
            if (ourExtension) {
              console.log('Found our extension:', ourExtension);
              return ourExtension;
            } else {
              console.log('Extension not found in list');
              return { error: 'Extension not found' };
            }
          `;
          
          const message = {
            id: 1,
            method: 'Runtime.evaluate',
            params: {
              expression: checkScript,
              returnByValue: true
            }
          };
          
          ws.send(JSON.stringify(message));
        });
        
        ws.on('message', (data) => {
          const response = JSON.parse(data);
          
          if (response.id === 1) {
            if (response.error) {
              console.error('❌ Error checking extension:', response.error);
            } else {
              console.log('📋 Extension info:', response.result?.value);
            }
            
            setTimeout(() => {
              ws.close();
            }, 2000);
          }
        });
        
        ws.on('close', () => {
          console.log('✅ Extensions check complete');
          process.exit(0);
        });
        
      } else {
        console.log('❌ Extensions tab not found');
        console.log('Available tabs:', tabs.map(t => ({ title: t.title, url: t.url })));
        process.exit(1);
      }
      
    } catch (e) {
      console.error('❌ Error parsing tabs:', e.message);
      process.exit(1);
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Error getting tabs:', e.message);
  process.exit(1);
});

req.end();