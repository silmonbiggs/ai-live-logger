// content.js - unified logger for both user and assistant messages
(function () {
  "use strict";
  console.log("[ChatGPT Live Logger] content script starting...");

  // ----------------- utilities -----------------
  function normText(s) {
    if (!s) return "";
    // URL-aware text normalization - preserve URLs and special characters
    let text = String(s)
      .replace(/\u200B/g, "")     // Remove zero-width spaces
      .trim();
    
    // Preserve URLs by temporarily replacing them with placeholders
    const urlPattern = /https?:\/\/[^\s]+/g;
    const urls = [];
    text = text.replace(urlPattern, (match) => {
      urls.push(match);
      return `__URL_PLACEHOLDER_${urls.length - 1}__`;
    });
    
    // Normalize whitespace but preserve URL structure
    text = text.replace(/\s+/g, " ");
    
    // Restore URLs
    urls.forEach((url, index) => {
      text = text.replace(`__URL_PLACEHOLDER_${index}__`, url);
    });
    
    return text;
  }

  function extractUrlsFromNode(node) {
    const urls = [];
    
    // Extract from href attributes (most reliable)
    if (node.querySelectorAll) {
      const links = node.querySelectorAll('a[href]');
      links.forEach(link => {
        const href = link.href;
        if (href && href.startsWith('http')) {
          urls.push(href);
        }
      });
    }
    
    // Extract from text content as fallback
    const textContent = node.innerText || node.textContent || "";
    const urlMatches = textContent.match(/https?:\/\/[^\s]+/g);
    if (urlMatches) {
      urlMatches.forEach(url => {
        // Clean up potential trailing punctuation
        const cleanUrl = url.replace(/[.,;!?)]+$/, '');
        if (!urls.includes(cleanUrl)) {
          urls.push(cleanUrl);
        }
      });
    }
    
    return urls;
  }

  function isStreamingComplete(node) {
    // Check for indicators that streaming is complete
    if (!node) return false;
    
    // Look for stop/completion indicators
    const stopIndicators = node.querySelectorAll ? 
      node.querySelectorAll('[data-testid*="stop"], .stop-button, [aria-label*="stop"]') : [];
    
    // Check if there's a cursor or typing indicator
    const typingIndicators = node.querySelectorAll ? 
      node.querySelectorAll('.cursor, .typing, [class*="cursor"], [class*="typing"]') : [];
    
    // If we find stop buttons but no typing indicators, streaming is likely complete
    return stopIndicators.length === 0 && typingIndicators.length === 0;
  }

  function convoIdFromUrl() {
    try {
      const u = new URL(window.location.href);
      const parts = u.pathname.split("/").filter(Boolean);
      const cindex = parts.indexOf("c");
      if (cindex >= 0 && parts[cindex + 1]) return parts[cindex + 1];
      return parts.join("/") || u.pathname || "no-convo";
    } catch (e) {
      return "no-convo";
    }
  }

  // ----------------- send function -----------------
  function sendToBackground(payload) {
    console.log("[ChatGPT Live Logger] attempting to send:", payload.role, payload.text?.slice(0, 100));
    
    try {
      chrome.runtime.sendMessage({ type: "LOG", payload }, (response) => {
        if (chrome.runtime.lastError) {
          console.error("[ChatGPT Live Logger] send error:", chrome.runtime.lastError.message);
          
          // If extension context is invalidated, suggest page reload
          if (chrome.runtime.lastError.message.includes('context invalidated') || 
              chrome.runtime.lastError.message.includes('Extension context')) {
            console.error("[ChatGPT Live Logger] Extension context invalidated - please reload this ChatGPT tab");
            
            // Try to reconnect by reloading the content script
            setTimeout(() => {
              console.log("[ChatGPT Live Logger] Attempting to reinitialize...");
              location.reload();
            }, 2000);
          }
        } else if (response?.ok) {
          console.log("[ChatGPT Live Logger] sent successfully:", payload.role);
        } else {
          console.error("[ChatGPT Live Logger] server error:", response?.error);
        }
      });
    } catch (e) {
      console.error("[ChatGPT Live Logger] exception:", e.message);
      
      // If we can't even call chrome.runtime.sendMessage, the context is definitely broken
      if (e.message.includes('Extension context')) {
        console.error("[ChatGPT Live Logger] Extension context broken - reloading page in 2 seconds");
        setTimeout(() => location.reload(), 2000);
      }
    }
  }

  // ----------------- user input capture -----------------
  let lastUserText = "";
  let userInputActive = false;
  
  function captureUserText() {
    if (userInputActive) return; // prevent double-capture
    userInputActive = true;
    
    setTimeout(() => {
      try {
        // Try multiple selectors for the input field - updated for current ChatGPT interface
        const selectors = [
          'textarea[placeholder="Ask anything"]', // Specific to current ChatGPT
          'textarea[placeholder*="Ask"]',
          'div[contenteditable="true"]',
          'textarea[placeholder*="Message"]',
          'textarea[placeholder*="message"]',
          'textarea[data-id]',
          'textarea',
          '[role="textbox"]',
          'input[type="text"]',
          '[data-id*="root"]',
          '#prompt-textarea',
          '[data-testid*="input"]',
          '[data-testid*="prompt"]',
          '[id*="prompt"]',
          '[class*="prompt"]'
        ];
        
        let input = null;
        let foundElements = [];
        
        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          console.log(`[ChatGPT Live Logger] selector "${selector}" found ${elements.length} elements`);
          
          for (const el of elements) {
            foundElements.push({
              selector: selector,
              element: el,
              visible: el.offsetHeight > 0 && el.offsetWidth > 0,
              size: `${el.offsetWidth}x${el.offsetHeight}`,
              placeholder: el.placeholder || 'none',
              value: (el.value || el.innerText || el.textContent || '').slice(0, 50)
            });
            
            // Check if this element is likely the main input
            if (el.offsetHeight > 0 && el.offsetWidth > 100) { // Visible and reasonable size
              input = el;
              console.log(`[ChatGPT Live Logger] selected input with selector "${selector}"`);
              break;
            }
          }
          if (input) break;
        }
        
        // Enhanced debugging
        console.log("[ChatGPT Live Logger] all found elements:", foundElements);
        
        if (input) {
          const text = normText(input.innerText || input.textContent || input.value || "");
          console.log("[ChatGPT Live Logger] checking user input:", text.slice(0, 50));
          console.log("[ChatGPT Live Logger] input element:", {
            tagName: input.tagName,
            placeholder: input.placeholder,
            dataId: input.getAttribute('data-id'),
            testId: input.getAttribute('data-testid'),
            className: input.className
          });
          
          if (text && text !== lastUserText && text.length > 2) {
            lastUserText = text;
            const payload = {
              id: `user-${Date.now()}`,
              ts: new Date().toISOString(),
              convo: convoIdFromUrl(),
              role: "user",
              text: text,
              urls: []
            };
            console.log("[ChatGPT Live Logger] ✓ captured user input:", text.slice(0, 100));
            sendToBackground(payload);
          } else {
            console.log("[ChatGPT Live Logger] skipping - no new text or too short:", {
              hasText: !!text,
              length: text.length,
              isDuplicate: text === lastUserText,
              lastText: lastUserText.slice(0, 50)
            });
          }
        } else {
          console.log("[ChatGPT Live Logger] no suitable input field found");
          // Enhanced debug: log all potential inputs with details
          const allInputs = document.querySelectorAll('input, textarea, [contenteditable], [role="textbox"]');
          console.log("[ChatGPT Live Logger] found", allInputs.length, "input elements total");
          
          allInputs.forEach((el, i) => {
            console.log(`[ChatGPT Live Logger] input ${i}:`, {
              tagName: el.tagName,
              type: el.type,
              placeholder: el.placeholder,
              visible: el.offsetHeight > 0 && el.offsetWidth > 0,
              size: `${el.offsetWidth}x${el.offsetHeight}`,
              className: el.className,
              dataId: el.getAttribute('data-id'),
              testId: el.getAttribute('data-testid')
            });
          });
        }
      } catch (e) {
        console.error("[ChatGPT Live Logger] user capture error:", e);
      }
      
      userInputActive = false;
    }, 200); // Slightly longer delay to ensure input is ready
  }

  // Store user text as they type
  let currentUserText = "";
  
  function setupUserCapture() {
    console.log("[ChatGPT Live Logger] setting up user input capture");
    
    // Monitor input changes in real-time
    document.addEventListener('input', (e) => {
      const target = e.target;
      if (target && (target.tagName === 'TEXTAREA' || target.contentEditable === 'true')) {
        const text = normText(target.innerText || target.textContent || target.value || "");
        if (text.length > 2) {
          currentUserText = text;
          console.log("[ChatGPT Live Logger] user typing:", text.slice(0, 50));
        }
      }
    }, true);
    
    // Listen for Enter key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        console.log("[ChatGPT Live Logger] Enter pressed, current text:", currentUserText.slice(0, 100));
        
        // Use the text we've been tracking as user types
        if (currentUserText && currentUserText.length > 2 && currentUserText !== lastUserText) {
          lastUserText = currentUserText;
          const payload = {
            id: `user-${Date.now()}`,
            ts: new Date().toISOString(),
            convo: convoIdFromUrl(),
            role: "user",
            text: currentUserText,
            urls: []
          };
          console.log("[ChatGPT Live Logger] ✓ capturing user input from typing:", currentUserText.slice(0, 100));
          sendToBackground(payload);
          
          // Clear the stored text since it's been sent
          currentUserText = "";
        }
        
        // Also try to capture immediately from active element
        const activeElement = document.activeElement;
        if (activeElement && (activeElement.tagName === 'TEXTAREA' || activeElement.contentEditable === 'true')) {
          const immediateText = normText(activeElement.innerText || activeElement.textContent || activeElement.value || "");
          console.log("[ChatGPT Live Logger] immediate capture on Enter:", immediateText.slice(0, 100));
          
          if (immediateText && immediateText.length > 2 && immediateText !== lastUserText) {
            lastUserText = immediateText;
            const payload = {
              id: `user-${Date.now()}`,
              ts: new Date().toISOString(),
              convo: convoIdFromUrl(),
              role: "user",
              text: immediateText,
              urls: []
            };
            console.log("[ChatGPT Live Logger] ✓ immediate user capture successful:", immediateText.slice(0, 100));
            sendToBackground(payload);
          }
        }
        
        // Also try the delayed capture as backup
        setTimeout(captureUserText, 10);
      }
    }, true);
    
    // Also listen for form submissions
    document.addEventListener('submit', (e) => {
      console.log("[ChatGPT Live Logger] Form submitted, current text:", currentUserText.slice(0, 100));
      if (currentUserText && currentUserText.length > 2) {
        const payload = {
          id: `user-${Date.now()}`,
          ts: new Date().toISOString(),
          convo: convoIdFromUrl(),
          role: "user",
          text: currentUserText,
          urls: []
        };
        console.log("[ChatGPT Live Logger] ✓ capturing from form submit:", currentUserText.slice(0, 100));
        sendToBackground(payload);
        currentUserText = "";
      }
      captureUserText();
    }, true);

    // Listen for any button clicks
    document.addEventListener('click', (e) => {
      const button = e.target.closest('button');
      if (button) {
        const buttonText = (button.textContent || '').toLowerCase();
        const ariaLabel = (button.getAttribute('aria-label') || '').toLowerCase();
        const hasDataTestId = button.getAttribute('data-testid');
        const className = button.className;
        
        console.log("[ChatGPT Live Logger] button clicked:", {
          text: buttonText,
          ariaLabel: ariaLabel,
          testId: hasDataTestId,
          className: className,
          hasSvg: !!button.querySelector('svg'),
          type: button.type
        });
        
        // Enhanced button detection for current ChatGPT interface
        const isSendButton = (
          buttonText.includes('send') || 
          ariaLabel.includes('send') || 
          hasDataTestId === 'send-button' ||
          hasDataTestId && hasDataTestId.includes('send') ||
          button.type === 'submit' ||
          (buttonText === '' && button.querySelector('svg')) || // icon-only send buttons
          ariaLabel.includes('submit') ||
          className.includes('send') ||
          // Check if button is near an input field (likely send button)
          (buttonText === '' && button.closest('form'))
        );
        
        if (isSendButton) {
          console.log("[ChatGPT Live Logger] send button detected");
          captureUserText();
        }
      }
    }, true);
  }

  // ----------------- assistant message capture -----------------
  let lastAssistantText = "";
  let lastAssistantTime = 0;
  let assistantNodes = new Set();
  let pendingCaptures = new Map(); // For debouncing
  
  function cleanAssistantText(text) {
    // Remove conversation wrappers and summaries
    let cleaned = text;
    
    // Remove "You said: ... ChatGPT said:" patterns
    cleaned = cleaned.replace(/^.*?You said:.*?ChatGPT said:\s*/i, '');
    
    // Remove "ChatGPT" prefixes but preserve PLAY commands
    cleaned = cleaned.replace(/^ChatGPT\s+(?!PLAY)/i, '');
    
    // Remove various conversation artifacts but preserve media commands
    cleaned = cleaned.replace(/^(response|assistant|ai):\s*(?!PLAY|SEQUENCE|VOLUME|PAUSE|STOP)/i, '');
    
    // Remove fragments like "VideoPLAY" or other page artifacts
    cleaned = cleaned.replace(/^(Video|Audio|Media|Link)?PLAY(?!\s*:)/i, 'PLAY:');
    
    // Clean up malformed command starts - more aggressive
    cleaned = cleaned.replace(/^[A-Za-z]*?(PLAY\s*:)/i, '$1');
    cleaned = cleaned.replace(/^[A-Za-z]*?(STOP\s*ALL)/i, '$1');
    cleaned = cleaned.replace(/^[A-Za-z]*?(STOP)/i, '$1');
    cleaned = cleaned.replace(/^[A-Za-z]*?(PAUSE)/i, '$1');
    cleaned = cleaned.replace(/^[A-Za-z]*?(VOLUME\s*:)/i, '$1');
    
    // Remove link artifacts specifically
    cleaned = cleaned.replace(/^link\s*/i, '');
    cleaned = cleaned.replace(/^video\s*/i, '');
    
    // Remove generic page metadata that doesn't contain commands
    if (!cleaned.toUpperCase().includes('PLAY:') && 
        !cleaned.toUpperCase().includes('SEQUENCE:') && 
        !cleaned.toUpperCase().includes('VOLUME:')) {
      cleaned = cleaned.replace(/^[^:]*?(?:link|video|youtube)\s*/i, '');
    }
    
    return cleaned.trim();
  }

  function captureAssistantMessage(node, forceImmediate = false) {
    try {
      if (assistantNodes.has(node)) return; // already processed
      
      const nodeId = node.getAttribute('data-message-id') || `node-${Date.now()}-${Math.random()}`;
      
      // If not forcing immediate capture, implement debouncing for streaming content
      if (!forceImmediate) {
        // Clear any existing timeout for this node
        if (pendingCaptures.has(nodeId)) {
          clearTimeout(pendingCaptures.get(nodeId));
        }
        
        // Set a new timeout to capture after streaming likely completes
        const timeout = setTimeout(() => {
          captureAssistantMessage(node, true);
          pendingCaptures.delete(nodeId);
        }, 2500); // Increased wait time for better streaming completion detection
        
        pendingCaptures.set(nodeId, timeout);
        return;
      }
      
      // Mark as processed
      assistantNodes.add(node);
      
      // Clean up old nodes
      if (assistantNodes.size > 50) {
        const oldNodes = Array.from(assistantNodes).slice(0, 25);
        oldNodes.forEach(n => assistantNodes.delete(n));
      }
      
      const textContent = node.innerText || node.textContent || "";
      let text = normText(textContent);
      const urls = extractUrlsFromNode(node);
      
      console.log("[ChatGPT Live Logger] raw text:", text.slice(0, 100));
      
      // Clean up conversation artifacts
      text = cleanAssistantText(text);
      
      console.log("[ChatGPT Live Logger] cleaned text:", text.slice(0, 100));
      console.log("[ChatGPT Live Logger] URLs found:", urls.length, urls);
      
      // Only proceed if we have meaningful content
      if (!text || text.length < 3) {
        console.log("[ChatGPT Live Logger] skipping - insufficient content after cleaning");
        return;
      }
      
      // Skip if this looks like a conversation summary/wrapper or user instruction
      if (text.toLowerCase().includes('you said:') || 
          text.toLowerCase().includes('chatgpt said:') ||
          text.toLowerCase().includes('respond with') ||
          text.toLowerCase().includes('say exactly') ||
          text.toLowerCase().includes('(no quotes)') ||
          text.includes('"PLAY:') || // Instructions containing quoted commands
          text.includes("'PLAY:") || // Instructions with single quotes
          (text.length > 100 && !text.toUpperCase().includes('PLAY:') && !text.includes('https://'))) {
        console.log("[ChatGPT Live Logger] skipping - conversation wrapper or user instruction detected");
        return;
      }
      
      // Special handling for URLs that might be commands
      if (text.startsWith(': https://') || text.startsWith(': http://')) {
        console.log("[ChatGPT Live Logger] detected broken PLAY command, will capture anyway");
      }
      
      // Check if this is meaningful new content or enough time has passed for repeats
      const now = Date.now();
      const timeSinceLastCapture = now - lastAssistantTime;
      const isDuplicate = text === lastAssistantText;
      const allowRepeat = timeSinceLastCapture > 3000; // Allow repeats after 3 seconds
      
      if (text !== lastAssistantText || (isDuplicate && allowRepeat)) {
        // Additional check: make sure we're not capturing a fragment of a longer message
        const textHash = text.slice(0, 50); // Use first 50 chars as fingerprint
        if (lastAssistantText && lastAssistantText.includes(textHash) && text.length < lastAssistantText.length && !allowRepeat) {
          console.log("[ChatGPT Live Logger] skipping partial message capture");
          return;
        }
        
        if (isDuplicate && allowRepeat) {
          console.log("[ChatGPT Live Logger] allowing repeat message after", timeSinceLastCapture, "ms");
        }
        
        lastAssistantText = text;
        lastAssistantTime = now;
        
        // Clean up URLs - remove duplicates and fix formatting
        const cleanUrls = [...new Set(urls)].map(url => {
          // Remove leading and trailing quotes and punctuation
          let cleaned = url.replace(/^["']*/, '').replace(/["',;.!?)]+$/, '');
          // Handle escaped quotes
          cleaned = cleaned.replace(/\\"/g, '').replace(/\\'/g, '');
          return cleaned;
        }).filter(url => url && url.startsWith('http'));
        
        // Additional deduplication - remove URLs that are substrings of others
        const finalUrls = [];
        cleanUrls.forEach(url => {
          const isDuplicate = finalUrls.some(existing => 
            existing === url || existing.includes(url) || url.includes(existing)
          );
          if (!isDuplicate) {
            finalUrls.push(url);
          }
        });
        
        const payload = {
          id: `assistant-${Date.now()}`,
          ts: new Date().toISOString(),
          convo: convoIdFromUrl(),
          role: "assistant",
          text: text,
          urls: finalUrls
        };
        
        console.log("[ChatGPT Live Logger] captured clean assistant message:", text.slice(0, 100));
        console.log("[ChatGPT Live Logger] final URLs:", finalUrls);
        sendToBackground(payload);
      }
    } catch (e) {
      console.error("[ChatGPT Live Logger] error capturing assistant message:", e);
    }
  }

  // More aggressive DOM observation
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      // Check all added nodes
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          try {
            // Multiple strategies to find assistant messages
            
            // Strategy 1: Direct role attribute
            if (node.getAttribute && node.getAttribute('data-message-author-role') === 'assistant') {
              captureAssistantMessage(node); // Use debounced capture
            }
            
            // Strategy 2: Search within added node
            if (node.querySelector) {
              const assistantNodes = node.querySelectorAll('[data-message-author-role="assistant"]');
              assistantNodes.forEach(n => captureAssistantMessage(n)); // Use debounced capture
            }
            
            // Strategy 3: Look for message-like content that might be assistant responses
            if (node.querySelector) {
              const possibleMessages = node.querySelectorAll('div, p, span');
              possibleMessages.forEach(msg => {
                const text = normText(msg.innerText || msg.textContent || "");
                if (text.length > 20 && !text.toLowerCase().includes('user') && 
                    !msg.closest('[data-message-author-role="user"]')) {
                  // Only capture if it contains complete URLs or media commands
                  // Avoid partial captures like "VideoPLAY" or fragments
                  const hasCompleteCommand = (
                    (text.toUpperCase().includes('PLAY:') && text.includes('http')) ||
                    text.toUpperCase().includes('SEQUENCE:') || 
                    text.toUpperCase().includes('VOLUME:') ||
                    text.toUpperCase().includes('PAUSE') ||
                    text.toUpperCase().includes('STOP')
                  );
                  
                  // Avoid capturing fragments that look like "VideoPLAY" or partial URLs
                  const isFragment = (
                    text.includes('VideoPLAY') ||
                    text.includes('videoplay') ||
                    (text.includes('PLAY') && !text.includes('http') && !text.includes('PLAY:')) ||
                    (text.includes('http') && text.length < 30) || // Very short http fragments
                    text.match(/^[A-Za-z]+PLAY/) // Words directly attached to PLAY
                  );
                  
                  if (hasCompleteCommand && !isFragment) {
                    captureAssistantMessage(msg); // Use debounced capture
                  }
                }
              });
            }
          } catch (e) {
            // Ignore individual node errors
          }
        }
      }
      
      // Also check if existing content was modified (streaming updates)
      if (mutation.type === 'childList' || mutation.type === 'characterData') {
        const target = mutation.target;
        if (target && target.nodeType === Node.ELEMENT_NODE) {
          const assistantParent = target.closest ? target.closest('[data-message-author-role="assistant"]') : null;
          if (assistantParent) {
            captureAssistantMessage(assistantParent); // Use debounced capture for streaming updates
          }
        }
      }
    }
  });

  // ----------------- initialization -----------------
  function init() {
    console.log("[ChatGPT Live Logger] initializing...");
    
    try {
      // Start aggressive DOM observation
      observer.observe(document.body, { 
        childList: true, 
        subtree: true,
        characterData: true
      });
      console.log("[ChatGPT Live Logger] mutation observer started");
      
      // Set up user input capture
      setupUserCapture();
      console.log("[ChatGPT Live Logger] user input capture started");
      
      // Scan for existing messages
      const existingAssistant = document.querySelectorAll('[data-message-author-role="assistant"]');
      console.log("[ChatGPT Live Logger] found", existingAssistant.length, "existing assistant messages");
      existingAssistant.forEach(node => captureAssistantMessage(node, true)); // Force immediate for existing
      
      // Also scan for any message-like divs
      const allDivs = document.querySelectorAll('div');
      let potentialMessages = 0;
      allDivs.forEach(div => {
        const text = normText(div.innerText || div.textContent || "");
        if (text.length > 20) {
          potentialMessages++;
        }
      });
      console.log("[ChatGPT Live Logger] found", potentialMessages, "potential message divs");
      
      console.log("[ChatGPT Live Logger] initialization complete");
      
    } catch (e) {
      console.error("[ChatGPT Live Logger] initialization error:", e);
    }
  }

  // Test the extension communication immediately
  setTimeout(() => {
    console.log("[ChatGPT Live Logger] testing extension communication...");
    sendToBackground({
      id: `test-${Date.now()}`,
      ts: new Date().toISOString(),
      convo: "test",
      role: "system",
      text: "Extension loaded successfully - v2",
      urls: []
    });
  }, 1000);

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Additional periodic checks to catch messages we might have missed
  setInterval(() => {
    const assistantMessages = document.querySelectorAll('[data-message-author-role="assistant"]');
    assistantMessages.forEach(node => {
      if (!assistantNodes.has(node)) {
        console.log("[ChatGPT Live Logger] periodic scan found new assistant message");
        captureAssistantMessage(node, true); // Force immediate for periodic scans
      }
    });
    
    // Also periodically check for user input that might be ready to send
    const inputField = document.querySelector('textarea[placeholder*="Ask"]') || 
                      document.querySelector('div[contenteditable="true"]') ||
                      document.querySelector('textarea');
    if (inputField) {
      const text = normText(inputField.innerText || inputField.textContent || inputField.value || "");
      if (text && text.length > 2 && text !== lastUserText) {
        console.log("[ChatGPT Live Logger] periodic scan found unsent user text:", text.slice(0, 50));
        // Don't capture yet, just log that we found it
      }
    }
  }, 5000); // Reduced frequency since we have better real-time capture

  console.log("[ChatGPT Live Logger] content script loaded");
})();