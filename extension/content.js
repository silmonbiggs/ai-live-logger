// content.js - Router for ChatGPT Live Logger
// Detects platform and delegates to appropriate handler

(function() {
  'use strict';

  const ROUTER_NAME = '[LOGGER ROUTER]';
  console.log(`${ROUTER_NAME} Starting AI Chat Logger router...`);

  // Detect current platform
  const platform = detectPlatform();
  console.log(`${ROUTER_NAME} Detected platform: ${platform}`);

  function detectPlatform() {
    const hostname = window.location.hostname;
    if (hostname.includes('claude.ai')) return 'claude';
    if (hostname.includes('chatgpt.com') || hostname.includes('chat.openai.com')) return 'chatgpt';
    return 'unknown';
  }

  // Initialize the appropriate platform handler
  function initializePlatformHandler() {
    if (platform === 'unknown') {
      console.log(`${ROUTER_NAME} Unknown platform, not loading any handler`);
      return;
    }

    try {
      if (platform === 'chatgpt' && window.ChatGPTLoggerHandler) {
        console.log(`${ROUTER_NAME} Initializing ChatGPT handler`);
        window.ChatGPTLoggerHandler.init();
      } else if (platform === 'claude' && window.ClaudeLoggerHandler) {
        console.log(`${ROUTER_NAME} Initializing Claude handler`);
        window.ClaudeLoggerHandler.init();
      } else {
        console.error(`${ROUTER_NAME} Handler not found for platform: ${platform}`);
        console.log(`${ROUTER_NAME} Available handlers:`, {
          ChatGPTLoggerHandler: !!window.ChatGPTLoggerHandler,
          ClaudeLoggerHandler: !!window.ClaudeLoggerHandler,
          ChatGPTLoggerCommon: !!window.ChatGPTLoggerCommon
        });

        // Fallback - DISABLED for testing Enter key interference
        console.log(`${ROUTER_NAME} Fallback handler DISABLED for testing`);
        // initializeFallbackHandler();
      }
    } catch (e) {
      console.error(`${ROUTER_NAME} Error initializing ${platform} handler:`, e);
      console.log(`${ROUTER_NAME} Fallback handler DISABLED (error case) for testing`);
      // initializeFallbackHandler();
    }
  }

  // Fallback handler for when modular handlers fail
  function initializeFallbackHandler() {
    console.log(`${ROUTER_NAME} Using fallback handler for ${platform}`);

    // Basic message logging without complex signal processing
    let messageCount = 0;

    function sendMessage(role, text) {
      const payload = {
        id: `${platform}-${role}-${Date.now()}`,
        ts: new Date().toISOString(),
        platform: platform,
        convo: 'fallback-session',
        role: role,
        text: text,
        urls: [],
        metadata: {
          method: 'fallback_handler',
          artifacts: [],
          tools: [],
          streaming: false,
          messageLength: text.length
        }
      };

      try {
        chrome.runtime.sendMessage({ type: "LOG", payload }, (response) => {
          if (chrome.runtime.lastError) {
            console.error(`${ROUTER_NAME} Send error:`, chrome.runtime.lastError.message);
          } else if (response?.ok) {
            console.log(`${ROUTER_NAME} ✓ Fallback logged:`, role, text.slice(0, 50));
            messageCount++;
          }
        });
      } catch (e) {
        console.error(`${ROUTER_NAME} Fallback send exception:`, e);
      }
    }

    // Simple input detection
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        const activeElement = document.activeElement;
        if (activeElement && (activeElement.tagName === 'TEXTAREA' || activeElement.contentEditable === 'true')) {
          const text = (activeElement.innerText || activeElement.textContent || activeElement.value || '').trim();
          if (text && text.length > 2) {
            console.log(`${ROUTER_NAME} Fallback captured user input:`, text.slice(0, 50));
            sendMessage('user', text);
          }
        }
      }
    }, true);

    // Simple response detection
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const text = (node.innerText || node.textContent || '').trim();
            if (text && text.length > 10) {
              // Basic filtering - avoid obvious UI elements
              if (!text.includes('Retry') && !text.includes('Copy') && !text.includes('Share')) {
                console.log(`${ROUTER_NAME} Fallback captured response:`, text.slice(0, 50));
                sendMessage('assistant', text);
              }
            }
          }
        });
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
    console.log(`${ROUTER_NAME} Fallback handler initialized`);
  }

  // Wait for DOM to be ready
  function initialize() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initialize);
      return;
    }

    console.log(`${ROUTER_NAME} DOM ready, initializing platform handler`);

    // Give handlers time to load
    setTimeout(initializePlatformHandler, 100);
  }

  // Message handler for popup communication
  try {
    if (chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'getStats') {
          // Get stats from active handler
          let stats = {
            platform: platform,
            messageCount: 0,
            lastMessage: '',
            lastTime: 0
          };

          try {
            if (platform === 'chatgpt' && window.ChatGPTLoggerHandler) {
              stats.messageCount = window.ChatGPTLoggerHandler.messageCount || 0;
              stats.lastMessage = window.ChatGPTLoggerHandler.lastUserText || '';
            } else if (platform === 'claude' && window.ClaudeLoggerHandler) {
              stats.messageCount = window.ClaudeLoggerHandler.state?.stats?.cleanLogEntries || 0;
              stats.lastMessage = window.ClaudeLoggerHandler.lastUserText || '';
            }
          } catch (e) {
            console.error(`${ROUTER_NAME} Error getting stats:`, e);
          }

          sendResponse(stats);
        }
      });
    }
  } catch (e) {
    console.log(`${ROUTER_NAME} Runtime message handler not available`);
  }

  // Start initialization
  initialize();

  console.log(`${ROUTER_NAME} Router setup complete for ${platform} platform`);

})();