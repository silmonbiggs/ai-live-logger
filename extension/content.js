// content.js - unified logger for ChatGPT and Claude user and assistant messages
(function () {
  "use strict";
  
  // Platform detection
  const PLATFORM = detectPlatform();
  const LOGGER_NAME = `[AI Chat Logger - ${PLATFORM.toUpperCase()}]`;
  console.log(`${LOGGER_NAME} content script starting...`);
  
  function detectPlatform() {
    const hostname = window.location.hostname;
    if (hostname.includes('claude.ai')) return 'claude';
    if (hostname.includes('chatgpt.com') || hostname.includes('chat.openai.com')) return 'chatgpt';
    return 'unknown';
  }

  // ----------------- platform configurations -----------------
  const PLATFORM_CONFIG = {
    chatgpt: {
      userInputSelectors: [
        'textarea[placeholder="Ask anything"]',
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
      ],
      assistantSelectors: [
        '[data-message-author-role="assistant"]'
      ],
      sendButtonSelectors: [
        'button[aria-label*="send"]',
        'button[data-testid*="send"]',
        'button[type="submit"]'
      ],
      streamingDelay: 2500
    },
    claude: {
      userInputSelectors: [
        'textarea[placeholder*="message"]',
        'textarea[placeholder*="Message"]',
        'textarea[data-testid*="input"]',
        'div[contenteditable="true"][role="textbox"]',
        'textarea[aria-label*="message"]',
        '[data-cy="chat-input"]',
        '.chat-input textarea',
        '[data-testid="chat-input"]',
        'textarea[placeholder*="Ask"]',
        'textarea[placeholder*="ask"]',
        'textarea',
        '[role="textbox"]'
      ],
      assistantSelectors: [
        '[data-role="assistant"]',
        '[data-message-role="assistant"]',
        '.message-assistant',
        '.claude-message',
        '[data-testid*="assistant"]',
        '.response-message',
        '[data-testid*="message"][data-role*="assistant"]',
        '.message[data-role="assistant"]',
        // More specific Claude selectors to avoid UI noise
        'div[data-testid^="message-content"]',
        'div[role="article"]:not([class*="header"]):not([class*="button"])',
        // Only target actual message content areas
        'main div[class*="prose"]:not([class*="header"]):not([class*="nav"])',
        // Avoid broad selectors that catch UI elements
        'div[class*="message-content"]',
        'article:not([class*="header"]):not([class*="nav"])',
        // Add back some broader selectors for Claude responses (filtered by isUINoiseContent)
        'div[class*="message"]',
        'div > p',
        'main div:not([class*="input"]):not([class*="button"]):not([class*="header"])'
      ],
      sendButtonSelectors: [
        'button[aria-label*="send"]',
        'button[data-testid*="send"]',
        'button[type="submit"]',
        '.send-button'
      ],
      streamingDelay: 3000
    }
  };
  
  const CONFIG = PLATFORM_CONFIG[PLATFORM] || PLATFORM_CONFIG.chatgpt;
  
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
      
      if (PLATFORM === 'chatgpt') {
        const cindex = parts.indexOf("c");
        if (cindex >= 0 && parts[cindex + 1]) return parts[cindex + 1];
        return parts.join("/") || u.pathname || "no-convo";
      } else if (PLATFORM === 'claude') {
        // Claude typically uses /chat/[id] structure
        const chatIndex = parts.indexOf("chat");
        if (chatIndex >= 0 && parts[chatIndex + 1]) return parts[chatIndex + 1];
        // Fallback to last path segment if it looks like an ID
        const lastPart = parts[parts.length - 1];
        if (lastPart && lastPart.length > 10) return lastPart;
        return parts.join("/") || u.pathname || "no-convo";
      }
      
      return parts.join("/") || u.pathname || "no-convo";
    } catch (e) {
      return "no-convo";
    }
  }
  
  // Claude-specific artifact detection
  function captureClaudeArtifacts(node) {
    if (PLATFORM !== 'claude') return [];
    
    const artifacts = [];
    const artifactSelectors = [
      '[data-testid*="artifact"]',
      '.artifact-container',
      '[class*="artifact"]',
      '.code-block',
      '.preview-container'
    ];
    
    artifactSelectors.forEach(selector => {
      const elements = node.querySelectorAll ? node.querySelectorAll(selector) : [];
      elements.forEach(element => {
        const content = element.innerText || element.textContent || '';
        if (content.trim().length > 10) {
          artifacts.push({
            type: 'artifact',
            content: content.trim(),
            language: element.getAttribute('data-language') || 'unknown',
            selector: selector
          });
        }
      });
    });
    
    return artifacts;
  }
  
  // Tool usage detection for both platforms
  function detectToolUsage(text) {
    const tools = [];
    
    const toolPatterns = [
      /(?:used|using|calling)\s+(\w+)\s+tool/i,
      /\[Tool:\s*(\w+)\]/i,
      /```(\w+)\s*\n/i, // Code blocks
      /\*\*Tool Used:\*\*\s*(\w+)/i,
      /tool_calls?["']?:\s*["']?(\w+)/i
    ];
    
    // Claude-specific patterns
    if (PLATFORM === 'claude') {
      toolPatterns.push(
        /thinking/i,
        /computer_use/i,
        /bash/i,
        /python/i,
        /code_execution/i
      );
    }
    
    // ChatGPT-specific patterns
    if (PLATFORM === 'chatgpt') {
      toolPatterns.push(
        /web_search/i,
        /dall_e/i,
        /code_interpreter/i,
        /browser/i
      );
    }
    
    toolPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        const tool = matches[1] || matches[0].toLowerCase();
        if (!tools.includes(tool)) {
          tools.push(tool);
        }
      }
    });
    
    return tools;
  }

  // ----------------- send function -----------------
  function sendToBackground(payload) {
    console.log(`${LOGGER_NAME} attempting to send:`, payload.role, payload.text?.slice(0, 100));
    
    try {
      chrome.runtime.sendMessage({ type: "LOG", payload }, (response) => {
        if (chrome.runtime.lastError) {
          console.error(`${LOGGER_NAME} send error:`, chrome.runtime.lastError.message);
          
          // If extension context is invalidated, suggest page reload
          if (chrome.runtime.lastError.message.includes('context invalidated') || 
              chrome.runtime.lastError.message.includes('Extension context')) {
            console.error(`${LOGGER_NAME} Extension context invalidated - please reload this ${PLATFORM} tab`);
            
            // Try to reconnect by reloading the content script
            setTimeout(() => {
              console.log(`${LOGGER_NAME} Attempting to reinitialize...`);
              location.reload();
            }, 2000);
          }
        } else if (response?.ok) {
          console.log(`${LOGGER_NAME} sent successfully:`, payload.role);
        } else {
          console.error(`${LOGGER_NAME} server error:`, response?.error);
        }
      });
    } catch (e) {
      console.error(`${LOGGER_NAME} exception:`, e.message);
      
      // If we can't even call chrome.runtime.sendMessage, the context is definitely broken
      if (e.message.includes('Extension context')) {
        console.error(`${LOGGER_NAME} Extension context broken - reloading page in 2 seconds`);
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
        // Use platform-specific selectors
        const selectors = CONFIG.userInputSelectors;
        
        let input = null;
        let foundElements = [];
        
        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          console.log(`${LOGGER_NAME} selector "${selector}" found ${elements.length} elements`);
          
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
              console.log(`${LOGGER_NAME} selected input with selector "${selector}"`);
              break;
            }
          }
          if (input) break;
        }
        
        // Enhanced debugging
        console.log(`${LOGGER_NAME} all found elements:`, foundElements);
        
        if (input) {
          const text = normText(input.innerText || input.textContent || input.value || "");
          console.log(`${LOGGER_NAME} checking user input:`, text.slice(0, 50));
          console.log(`${LOGGER_NAME} input element:`, {
            tagName: input.tagName,
            placeholder: input.placeholder,
            dataId: input.getAttribute('data-id'),
            testId: input.getAttribute('data-testid'),
            className: input.className
          });
          
          if (text && text !== lastUserText && text.length > 2) {
            lastUserText = text;
            const payload = {
              id: `${PLATFORM}-user-${Date.now()}`,
              ts: new Date().toISOString(),
              platform: PLATFORM,
              convo: convoIdFromUrl(),
              role: "user",
              text: text,
              urls: [],
              metadata: {
                artifacts: [],
                tools: detectToolUsage(text),
                streaming: false,
                messageLength: text.length
              }
            };
            console.log(`${LOGGER_NAME} ✓ captured user input:`, text.slice(0, 100));
            recordUserInteraction(); // Track that user just interacted
            sendToBackground(payload);
          } else {
            console.log(`${LOGGER_NAME} skipping - no new text or too short:`, {
              hasText: !!text,
              length: text.length,
              isDuplicate: text === lastUserText,
              lastText: lastUserText.slice(0, 50)
            });
          }
        } else {
          console.log(`${LOGGER_NAME} no suitable input field found`);
          // Enhanced debug: log all potential inputs with details
          const allInputs = document.querySelectorAll('input, textarea, [contenteditable], [role="textbox"]');
          console.log(`${LOGGER_NAME} found`, allInputs.length, "input elements total");
          
          allInputs.forEach((el, i) => {
            console.log(`${LOGGER_NAME} input ${i}:`, {
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
        console.error(`${LOGGER_NAME} user capture error:`, e);
      }
      
      userInputActive = false;
    }, 200); // Slightly longer delay to ensure input is ready
  }

  // Store user text as they type
  let currentUserText = "";
  let extensionStartTime = Date.now(); // Track when extension started
  
  function setupUserCapture() {
    console.log(`${LOGGER_NAME} setting up user input capture`);
    
    // Monitor input changes in real-time
    document.addEventListener('input', (e) => {
      const target = e.target;
      console.log(`${LOGGER_NAME} input event on:`, target.tagName, target.contentEditable, target.placeholder?.slice(0, 30));
      if (target && (target.tagName === 'TEXTAREA' || target.contentEditable === 'true')) {
        const text = normText(target.innerText || target.textContent || target.value || "");
        console.log(`${LOGGER_NAME} input text captured:`, text.slice(0, 50));
        if (text.length > 2) {
          currentUserText = text;
          console.log(`${LOGGER_NAME} user typing:`, text.slice(0, 50));
        }
      }
    }, true);
    
    // Listen for Enter key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        console.log(`${LOGGER_NAME} Enter pressed, current text:`, currentUserText.slice(0, 100));
        
        // Use the text we've been tracking as user types
        if (currentUserText && currentUserText.length > 2 && currentUserText !== lastUserText) {
          lastUserText = currentUserText;
          const payload = {
            id: `${PLATFORM}-user-${Date.now()}`,
            ts: new Date().toISOString(),
            platform: PLATFORM,
            convo: convoIdFromUrl(),
            role: "user",
            text: currentUserText,
            urls: [],
            metadata: {
              artifacts: [],
              tools: detectToolUsage(currentUserText),
              streaming: false,
              messageLength: currentUserText.length
            }
          };
          console.log(`${LOGGER_NAME} ✓ capturing user input from typing:`, currentUserText.slice(0, 100));
          sendToBackground(payload);
          
          // Clear the stored text since it's been sent
          currentUserText = "";
        }
        
        // Also try to capture immediately from active element
        const activeElement = document.activeElement;
        if (activeElement && (activeElement.tagName === 'TEXTAREA' || activeElement.contentEditable === 'true')) {
          const immediateText = normText(activeElement.innerText || activeElement.textContent || activeElement.value || "");
          console.log(`${LOGGER_NAME} immediate capture on Enter:`, immediateText.slice(0, 100));
          
          if (immediateText && immediateText.length > 2 && immediateText !== lastUserText) {
            lastUserText = immediateText;
            const payload = {
              id: `${PLATFORM}-user-${Date.now()}`,
              ts: new Date().toISOString(),
              platform: PLATFORM,
              convo: convoIdFromUrl(),
              role: "user",
              text: immediateText,
              urls: [],
              metadata: {
                artifacts: [],
                tools: detectToolUsage(immediateText),
                streaming: false,
                messageLength: immediateText.length
              }
            };
            console.log(`${LOGGER_NAME} ✓ immediate user capture successful:`, immediateText.slice(0, 100));
            sendToBackground(payload);
          }
        }
        
        // Also try the delayed capture as backup
        setTimeout(captureUserText, 10);
      }
    }, true);
    
    // Also listen for form submissions
    document.addEventListener('submit', (e) => {
      console.log(`${LOGGER_NAME} Form submitted, current text:`, currentUserText.slice(0, 100));
      if (currentUserText && currentUserText.length > 2) {
        const payload = {
          id: `${PLATFORM}-user-${Date.now()}`,
          ts: new Date().toISOString(),
          platform: PLATFORM,
          convo: convoIdFromUrl(),
          role: "user",
          text: currentUserText,
          urls: [],
          metadata: {
            artifacts: [],
            tools: detectToolUsage(currentUserText),
            streaming: false,
            messageLength: currentUserText.length
          }
        };
        console.log(`${LOGGER_NAME} ✓ capturing from form submit:`, currentUserText.slice(0, 100));
        sendToBackground(payload);
        currentUserText = "";
      }
      captureUserText();
    }, true);

    // Listen for any button clicks
    document.addEventListener('click', (e) => {
      console.log(`${LOGGER_NAME} click detected on:`, e.target.tagName, e.target.textContent?.slice(0, 50));
      const button = e.target.closest('button');
      if (button) {
        console.log(`${LOGGER_NAME} button click detected:`, button.textContent?.slice(0, 50));
        const buttonText = (button.textContent || '').toLowerCase();
        const ariaLabel = (button.getAttribute('aria-label') || '').toLowerCase();
        const hasDataTestId = button.getAttribute('data-testid');
        const className = button.className;
        
        console.log(`${LOGGER_NAME} button clicked:`, {
          text: buttonText,
          ariaLabel: ariaLabel,
          testId: hasDataTestId,
          className: className,
          hasSvg: !!button.querySelector('svg'),
          type: button.type
        });
        
        // Enhanced button detection for both ChatGPT and Claude interfaces
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
          console.log(`${LOGGER_NAME} send button detected`);
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
  
  // Conversation state tracking to distinguish historical vs new content
  let conversationState = {
    lastKnownMessageCount: 0,
    lastUserInteraction: 0,
    sequentialMessages: new Map(), // Track message sequence positions
    baseline: new Set() // Messages that existed when extension loaded
  };
  
  // Establish baseline of existing conversation content
  function establishConversationBaseline() {
    console.log(`${LOGGER_NAME} establishing conversation baseline...`);
    try {
      CONFIG.assistantSelectors.forEach(selector => {
        const messages = document.querySelectorAll(selector);
        messages.forEach(msg => {
          const text = (msg.innerText || msg.textContent || '').trim();
          if (text && text.length > 3) {
            conversationState.baseline.add(text);
            console.log(`${LOGGER_NAME} baseline message:`, text.slice(0, 50));
          }
        });
      });
      conversationState.lastKnownMessageCount = conversationState.baseline.size;
      console.log(`${LOGGER_NAME} baseline established with ${conversationState.baseline.size} existing messages`);
    } catch (e) {
      console.error(`${LOGGER_NAME} error establishing baseline:`, e);
    }
  }
  
  // Check if a message appears to be new (not in baseline, after user interaction)
  function isNewMessage(text, timestamp) {
    // If message was in baseline, it's historical
    if (conversationState.baseline.has(text)) {
      console.log(`${LOGGER_NAME} message is in baseline (historical):`, text.slice(0, 50));
      return false;
    }
    
    // CRITICAL: If we've seen this exact text recently in our processed set, it's a duplicate
    // This should be the primary check to prevent duplicates
    if (window.processedMessageTexts && window.processedMessageTexts.has(text)) {
      const lastProcessed = window.processedMessageTexts.get(text);
      const timeSinceLastProcessed = timestamp - lastProcessed;
      console.log(`${LOGGER_NAME} DUPLICATE detected - message already processed ${timeSinceLastProcessed}ms ago:`, text.slice(0, 50));
      return false;
    }
    
    // Also check Claude message history with longer timeframe
    if (window.claudeMessageHistory && window.claudeMessageHistory.length > 0) {
      const recentDuplicate = window.claudeMessageHistory.find(msg => 
        msg.text === text && 
        msg.role === 'assistant' && 
        (timestamp - msg.timestamp) < 300000  // 5 minutes window
      );
      if (recentDuplicate) {
        const timeSinceDuplicate = timestamp - recentDuplicate.timestamp;
        console.log(`${LOGGER_NAME} DUPLICATE detected in history (${timeSinceDuplicate}ms ago):`, text.slice(0, 50));
        return false;
      }
    }
    
    // If no recent user interaction, treat with suspicion (but allow if very recent)
    const timeSinceUserInteraction = timestamp - conversationState.lastUserInteraction;
    if (timeSinceUserInteraction > 120000 && conversationState.lastUserInteraction > 0) {  // Extended to 2 minutes
      console.log(`${LOGGER_NAME} message appears without recent user interaction (${timeSinceUserInteraction}ms):`, text.slice(0, 50));
      return false;
    }
    
    return true;
  }
  
  // Update user interaction timestamp when user sends messages
  function recordUserInteraction() {
    conversationState.lastUserInteraction = Date.now();
    console.log(`${LOGGER_NAME} user interaction recorded at:`, conversationState.lastUserInteraction);
  }
  
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

  function isUINoiseContent(text, node) {
    // Early UI noise detection
    const textLower = text.toLowerCase();
    
    // Allow short valid Claude responses (like "okay27", "okay28") BUT only if they're truly new
    if (text.length < 10 && text.match(/^okay\d+$/i)) {
      // This looks like a valid Claude response, check if it's not in a button or navigation
      if (node && node.closest && (node.closest('button') || node.closest('nav') || node.closest('[class*="nav"]') || node.closest('[class*="sidebar"]'))) {
        console.log(`${LOGGER_NAME} rejecting okay response in UI element:`, text);
        return true;
      }
      // Additional check: if this is in a chat history area vs active message
      if (node && node.closest && node.closest('[class*="history"]')) {
        console.log(`${LOGGER_NAME} rejecting okay response in chat history:`, text);
        return true;
      }
      return false; // Allow it if it passes all checks
    }
    
    // Button text patterns
    if (text.match(/\w+\s+(retry|share)$/i)) return true;
    
    // UI header patterns
    if (textLower.includes('test message confirmation')) return true;
    if (textLower.includes('message confirmation')) return true;
    
    // Very short responses that are likely UI elements (but not valid responses)
    if (text.length < 10 && text.match(/^(yes|no|retry|share)$/i)) return true;
    
    // Check if this looks like user input being reflected in UI
    if (text.includes('testmessage') && text.includes('respond')) {
      // Only reject if it's in a UI element, not a legitimate user message
      if (node && node.closest && (node.closest('button') || node.closest('[class*="input"]'))) {
        return true;
      }
    }
    
    // Check if the element has button-like characteristics
    if (node && node.closest && node.closest('button')) return true;
    
    // Check if in a navigation or header area
    if (node && node.closest && (node.closest('nav') || node.closest('header') || node.closest('[class*="header"]') || node.closest('[class*="sidebar"]'))) return true;
    
    return false;
  }

  function captureAssistantMessage(node, forceImmediate = false) {
    try {
      // Create a more robust node identifier
      const textContent = node.innerText || node.textContent || "";
      let text = normText(textContent);
      
      // Create a unique identifier combining node and text
      const nodeIdentifier = `${node.tagName}-${text.slice(0, 50)}-${text.length}`;
      
      if (assistantNodes.has(node)) {
        console.log(`${LOGGER_NAME} node already processed:`, nodeIdentifier.slice(0, 50));
        return; // already processed
      }
      
      // Also check for duplicate content across different nodes
      if (text.length > 0 && window.processedMessageTexts && window.processedMessageTexts.has(text)) {
        const lastProcessed = window.processedMessageTexts.get(text);
        const timeSinceLastProcessed = Date.now() - lastProcessed;
        console.log(`${LOGGER_NAME} duplicate text content already processed ${timeSinceLastProcessed}ms ago:`, text.slice(0, 50));
        assistantNodes.add(node); // Mark node as processed to avoid future checks
        return;
      }
      
      const nodeId = node.getAttribute('data-message-id') || nodeIdentifier;
      
      // Skip capturing existing content when extension first loads (avoid capturing stale responses)
      const timeSinceExtensionStart = Date.now() - extensionStartTime;
      if (timeSinceExtensionStart < 30000 && !forceImmediate) {
        console.log(`${LOGGER_NAME} skipping potential stale content during extension startup (${timeSinceExtensionStart}ms since start)`);
        assistantNodes.add(node); // Mark as processed to avoid future capture
        return;
      }
      
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
      
      // Initialize processed texts tracking
      if (typeof window.processedMessageTexts === 'undefined') {
        window.processedMessageTexts = new Set();
      }
      
      // Clean up old nodes and texts
      if (assistantNodes.size > 50) {
        const oldNodes = Array.from(assistantNodes).slice(0, 25);
        oldNodes.forEach(n => assistantNodes.delete(n));
      }
      
      if (window.processedMessageTexts.size > 200) {
        // Clean old entries based on timestamp (keep entries from last 10 minutes)
        const tenMinutesAgo = Date.now() - 600000;
        const entries = Array.from(window.processedMessageTexts.entries());
        window.processedMessageTexts.clear();
        entries.forEach(([text, timestamp]) => {
          if (timestamp > tenMinutesAgo) {
            window.processedMessageTexts.set(text, timestamp);
          }
        });
        console.log(`${LOGGER_NAME} cleaned old processed texts, kept ${window.processedMessageTexts.size} recent entries`);
      }
      
      // Early filtering for UI noise
      if (isUINoiseContent(text, node)) {
        console.log(`${LOGGER_NAME} skipping UI noise:`, text.slice(0, 50));
        return;
      }
      
      const urls = extractUrlsFromNode(node);
      const artifacts = captureClaudeArtifacts(node);
      const tools = detectToolUsage(text);
      
      console.log(`${LOGGER_NAME} raw text:`, text.slice(0, 100));
      
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
      
      // New conversation-state-aware duplicate detection
      const now = Date.now();
      
      // Use the new message detection logic
      if (!isNewMessage(text, now)) {
        console.log(`${LOGGER_NAME} message determined to be historical/duplicate - skipping`);
        return;
      }
      
      // Additional check for very recent duplicates (streaming protection)
      const timeSinceLastCapture = now - lastAssistantTime;
      if (text === lastAssistantText && timeSinceLastCapture < 2000) {
        console.log(`${LOGGER_NAME} too recent duplicate - likely streaming artifact:`, timeSinceLastCapture);
        return;
      }
      
      console.log(`${LOGGER_NAME} ✓ NEW assistant message passed all checks:`, text.slice(0, 50));
      
      if (text !== lastAssistantText || timeSinceLastCapture > 30000) {
        // Additional check: make sure we're not capturing a fragment of a longer message
        const textHash = text.slice(0, 50); // Use first 50 chars as fingerprint
        if (lastAssistantText && lastAssistantText.includes(textHash) && text.length < lastAssistantText.length && timeSinceLastCapture < 30000) {
          console.log(`${LOGGER_NAME} skipping partial message capture`);
          return;
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
          id: `${PLATFORM}-assistant-${Date.now()}`,
          ts: new Date().toISOString(),
          platform: PLATFORM,
          convo: convoIdFromUrl(),
          role: "assistant",
          text: text,
          urls: finalUrls,
          metadata: {
            artifacts: artifacts,
            tools: tools,
            streaming: !forceImmediate,
            messageLength: text.length
          }
        };
        
        // Add to history tracking
        window.claudeMessageHistory.push({
          text: text,
          role: 'assistant',
          timestamp: now
        });
        
        // Add to processed texts map with timestamp
        window.processedMessageTexts.set(text, now);
        
        // Keep history manageable
        if (window.claudeMessageHistory.length > 50) {
          window.claudeMessageHistory = window.claudeMessageHistory.slice(-25);
        }
        
        console.log(`${LOGGER_NAME} ✓ CAPTURED assistant message:`, text.slice(0, 100));
        console.log(`${LOGGER_NAME} final URLs:`, finalUrls);
        console.log(`${LOGGER_NAME} artifacts:`, payload.metadata.artifacts.length);
        console.log(`${LOGGER_NAME} tools:`, payload.metadata.tools);
        sendToBackground(payload);
      }
    } catch (e) {
      console.error(`${LOGGER_NAME} error capturing assistant message:`, e);
    }
  }

  // More aggressive DOM observation
  const observer = new MutationObserver((mutations) => {
    // Skip processing during extension startup to avoid capturing stale content
    const timeSinceExtensionStart = Date.now() - extensionStartTime;
    if (timeSinceExtensionStart < 30000) {
      console.log(`${LOGGER_NAME} skipping mutation processing during extension startup (${timeSinceExtensionStart}ms)`);
      return;
    }
    
    for (const mutation of mutations) {
      // Check all added nodes
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          try {
            // Multiple strategies to find assistant messages using platform-specific selectors
            
            // Strategy 1: Direct role attribute check
            if (node.getAttribute) {
              for (const selector of CONFIG.assistantSelectors) {
                const attrMatch = selector.match(/\[([^=]+)="([^"]+)"\]/);
                if (attrMatch && node.getAttribute(attrMatch[1]) === attrMatch[2]) {
                  captureAssistantMessage(node);
                  break;
                }
              }
            }
            
            // Strategy 2: Search within added node using platform selectors
            if (node.querySelector) {
              CONFIG.assistantSelectors.forEach(selector => {
                const assistantNodes = node.querySelectorAll(selector);
                assistantNodes.forEach(n => captureAssistantMessage(n));
              });
            }
            
            // Strategy 3: Disabled - too aggressive and causes UI noise capture
            // Rely on more specific selectors in Strategy 1 and 2 only
          } catch (e) {
            // Ignore individual node errors
          }
        }
      }
      
      // Also check if existing content was modified (streaming updates)
      if (mutation.type === 'childList' || mutation.type === 'characterData') {
        const target = mutation.target;
        if (target && target.nodeType === Node.ELEMENT_NODE) {
          // Check if target is within any assistant message using platform selectors
          let assistantParent = null;
          if (target.closest) {
            for (const selector of CONFIG.assistantSelectors) {
              assistantParent = target.closest(selector);
              if (assistantParent) break;
            }
          }
          if (assistantParent) {
            captureAssistantMessage(assistantParent); // Use debounced capture for streaming updates
          }
        }
      }
    }
  });

  // ----------------- initialization -----------------
  function init() {
    console.log(`${LOGGER_NAME} initializing for ${PLATFORM}...`);
    
    try {
      // Start aggressive DOM observation
      observer.observe(document.body, { 
        childList: true, 
        subtree: true,
        characterData: true
      });
      console.log(`${LOGGER_NAME} mutation observer started`);
      
      // Set up user input capture
      setupUserCapture();
      console.log(`${LOGGER_NAME} user input capture started`);
      
      // Initialize global tracking structures with timestamps
      if (typeof window.processedMessageTexts === 'undefined') {
        window.processedMessageTexts = new Map(); // Changed to Map to store timestamps
      }
      if (typeof window.claudeMessageHistory === 'undefined') {
        window.claudeMessageHistory = [];
      }
      
      // Establish baseline of existing conversation content
      establishConversationBaseline();
      
      // Skip scanning existing messages to avoid capturing stale content
      let existingAssistant = [];
      CONFIG.assistantSelectors.forEach(selector => {
        const nodes = document.querySelectorAll(selector);
        existingAssistant.push(...Array.from(nodes));
      });
      console.log(`${LOGGER_NAME} found`, existingAssistant.length, "existing assistant messages (skipping capture to avoid stale content)");
      // Mark existing nodes as processed without capturing them
      existingAssistant.forEach(node => assistantNodes.add(node));
      
      // Also scan for any message-like divs
      const allDivs = document.querySelectorAll('div');
      let potentialMessages = 0;
      allDivs.forEach(div => {
        const text = normText(div.innerText || div.textContent || "");
        if (text.length > 20) {
          potentialMessages++;
        }
      });
      console.log(`${LOGGER_NAME} found`, potentialMessages, "potential message divs");
      
      console.log(`${LOGGER_NAME} initialization complete`);
      
    } catch (e) {
      console.error(`${LOGGER_NAME} initialization error:`, e);
    }
  }

  // Test the extension communication immediately
  setTimeout(() => {
    console.log(`${LOGGER_NAME} testing extension communication...`);
    sendToBackground({
      id: `${PLATFORM}-test-${Date.now()}`,
      ts: new Date().toISOString(),
      platform: PLATFORM,
      convo: "test",
      role: "system",
      text: `Extension loaded successfully for ${PLATFORM} - v2.0.0`,
      urls: [],
      metadata: {
        artifacts: [],
        tools: [],
        streaming: false,
        messageLength: 0
      }
    });
  }, 1000);

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // DISABLED: Periodic scanning causes duplicate captures of old messages
  // Relying solely on mutation observer for new content detection
  console.log(`${LOGGER_NAME} periodic scanning disabled - using mutation observer only for better accuracy`);

  console.log(`${LOGGER_NAME} content script loaded`);
})();