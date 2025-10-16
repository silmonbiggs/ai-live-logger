// ChatGPT Live Logger - Popup Script

document.addEventListener('DOMContentLoaded', function() {
  loadSettings();
  checkStatus();
});

function loadSettings() {
  chrome.storage.sync.get(['serverUrl'], function(result) {
    if (result.serverUrl) {
      document.getElementById('serverUrl').value = result.serverUrl;
    }
  });
}

function saveSettings() {
  const serverUrl = document.getElementById('serverUrl').value;
  
  chrome.storage.sync.set({
    serverUrl: serverUrl
  }, function() {
    updateStatus('Settings saved successfully!', 'success');
    
    // Notify content scripts
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'updateServerUrl',
        serverUrl: serverUrl
      });
    });
  });
}

function testConnection() {
  const serverUrl = document.getElementById('serverUrl').value;
  updateStatus('Testing connection...', 'info');
  
  fetch(`${serverUrl}/health`, {
    method: 'GET',
    mode: 'cors'
  })
  .then(response => {
    if (response.ok) {
      updateStatus('✅ Server connection successful!', 'success');
    } else {
      updateStatus(`❌ Server error: ${response.status}`, 'error');
    }
  })
  .catch(error => {
    updateStatus(`❌ Connection failed: ${error.message}`, 'error');
  });
}

function clearLogs() {
  updateStatus('Clear logs feature not implemented yet', 'info');
}

function viewLogs() {
  const serverUrl = document.getElementById('serverUrl').value;
  chrome.tabs.create({
    url: serverUrl.replace(':8788', ':8788') // Open server URL
  });
}

function updateStatus(message, type) {
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;
}

function checkStatus() {
  // Check if content script is active
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const tab = tabs[0];
    
    if (tab.url.includes('claude.ai') || tab.url.includes('chatgpt.com') || tab.url.includes('openai.com')) {
      updateStatus('✅ Extension active on this page', 'success');
      document.getElementById('extensionStatus').textContent = 'Active';
      
      // Try to get message count from content script
      chrome.tabs.sendMessage(tab.id, {action: 'getStats'}, function(response) {
        if (response && response.messageCount) {
          document.getElementById('messageCount').textContent = response.messageCount;
        }
      });
      
    } else {
      updateStatus('ℹ️ Navigate to ChatGPT or Claude to use logger', 'info');
      document.getElementById('extensionStatus').textContent = 'Inactive';
    }
  });
}