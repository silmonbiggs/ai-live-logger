// ChatGPT Live Logger - Background Service Worker (Simplified)

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updateBadge') {
    // Update extension badge with message count
    try {
      chrome.action.setBadgeText({
        text: message.count.toString(),
        tabId: sender.tab?.id
      });

      chrome.action.setBadgeBackgroundColor({
        color: '#00aa00'
      });
    } catch (error) {
      console.log('Badge update failed:', error);
    }
  } else if (message.type === 'LOG') {
    // Forward log message to local server
    console.log('Forwarding message to server:', message.payload.role, message.payload.text?.slice(0, 50));

    fetch('http://127.0.0.1:8788/log', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message.payload)
    })
    .then(response => response.json())
    .then(data => {
      sendResponse({ok: true, data});
    })
    .catch(error => {
      console.error('Server error:', error);
      sendResponse({ok: false, error: error.message});
    });

    return true; // Keep the message channel open for async response
  }

  // Always send a response to avoid errors
  sendResponse({status: 'ok'});
  return true;
});

console.log('ChatGPT Live Logger background service worker loaded');