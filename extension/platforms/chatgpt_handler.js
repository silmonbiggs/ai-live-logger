// chatgpt_handler.js - ChatGPT-specific logging handler
// Handles ChatGPT conversation capture with ChatGPT-specific DOM patterns and timing

(function(window) {
  'use strict';

  const LOGGER_NAME = '[CHATGPT HANDLER]';

  const ChatGPTHandler = {
    // ChatGPT-specific configuration
    config: {
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
        '[data-message-author-role="assistant"]',
        '[data-message-id]', // Modern ChatGPT uses message IDs
        '[data-testid*="conversation-turn"]',
        '[role="presentation"] [data-message-author-role="assistant"]',
        '.prose',
        '[data-testid*="response"]',
        '.markdown',
        '[class*="group"][class*="text-"] > div', // Common ChatGPT message container pattern
        '[data-testid*="message"]'
      ],
      sendButtonSelectors: [
        'button[aria-label*="send"]',
        'button[data-testid*="send"]',
        'button[type="submit"]'
      ],
      streamingDelay: 2500
    },

    // Internal state
    lastUserText: "",
    lastAssistantText: "",
    recentAssistantMessages: [], // Buffer of last 20 assistant messages for duplicate detection
    currentUserText: "",
    userInputActive: false,
    assistantNodes: new Set(),
    pendingCaptures: new Map(),
    extensionStartTime: Date.now(),

    // Initialize ChatGPT handler
    init: function() {
      console.log(`${LOGGER_NAME} Initializing ChatGPT handler...`);
      this.setupUserCapture();
      this.setupResponseDetection();

      // Test connection after initialization
      setTimeout(() => {
        this.sendTestMessage();
      }, 2000);

      console.log(`${LOGGER_NAME} ChatGPT handler initialized`);
    },

    // Send test message to verify connection
    sendTestMessage: function() {
      const payload = window.ChatGPTLoggerCommon.createMessagePayload(
        'chatgpt',
        'user',
        `extension_test_chatgpt_${Date.now()}`
      );
      window.ChatGPTLoggerCommon.sendToBackground(payload, LOGGER_NAME);
    },

    // Set up user input capture for ChatGPT
    setupUserCapture: function() {
      console.log(`${LOGGER_NAME} Setting up ChatGPT user input capture`);

      // Monitor input changes in real-time
      document.addEventListener('input', (e) => {
        const target = e.target;
        if (target && (target.tagName === 'TEXTAREA' || target.contentEditable === 'true')) {
          const text = window.ChatGPTLoggerCommon.normText(target.innerText || target.textContent || target.value || "");
          if (text.length > 2) {
            this.currentUserText = text;
            console.log(`${LOGGER_NAME} User typing:`, text.slice(0, 50));
          }
        }
      }, true);

      // Listen for Enter key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          this.handleUserInput();
        }
      }, true);

      // Listen for button clicks
      document.addEventListener('click', (e) => {
        const button = e.target.closest('button');
        if (button && this.isSendButton(button)) {
          console.log(`${LOGGER_NAME} Send button clicked`);
          setTimeout(() => this.captureUserText(), 200);
        }
      }, true);

      // Listen for form submissions
      document.addEventListener('submit', (e) => {
        console.log(`${LOGGER_NAME} Form submitted`);
        this.handleUserInput();
      }, true);
    },

    // Handle user input from various triggers
    handleUserInput: function() {
      console.log(`${LOGGER_NAME} Handling user input, current text:`, this.currentUserText.slice(0, 100));

      // Use tracked text from typing
      if (this.currentUserText && this.currentUserText.length > 2 && this.currentUserText !== this.lastUserText) {
        this.logUserMessage(this.currentUserText);
        this.currentUserText = "";
      }

      // Also try immediate capture from active element as backup
      const activeElement = document.activeElement;
      if (activeElement && (activeElement.tagName === 'TEXTAREA' || activeElement.contentEditable === 'true')) {
        const immediateText = window.ChatGPTLoggerCommon.normText(
          activeElement.innerText || activeElement.textContent || activeElement.value || ""
        );

        if (immediateText && immediateText.length > 2 && immediateText !== this.lastUserText) {
          this.logUserMessage(immediateText);
        }
      }

      // Fallback to selector-based capture
      setTimeout(() => this.captureUserText(), 10);
    },

    // Capture user text using selectors
    captureUserText: function() {
      if (this.userInputActive) return;
      this.userInputActive = true;

      setTimeout(() => {
        try {
          let input = null;

          for (const selector of this.config.userInputSelectors) {
            const elements = document.querySelectorAll(selector);
            for (const el of elements) {
              if (el.offsetHeight > 0 && el.offsetWidth > 100) {
                input = el;
                break;
              }
            }
            if (input) break;
          }

          if (input) {
            const text = window.ChatGPTLoggerCommon.normText(
              input.innerText || input.textContent || input.value || ""
            );

            if (text && text !== this.lastUserText && text.length > 2) {
              this.logUserMessage(text);
            }
          }
        } catch (e) {
          console.error(`${LOGGER_NAME} User capture error:`, e);
        }

        this.userInputActive = false;
      }, 200);
    },

    // Log user message
    logUserMessage: function(text) {
      this.lastUserText = text;
      const payload = window.ChatGPTLoggerCommon.createMessagePayload('chatgpt', 'user', text);
      console.log(`${LOGGER_NAME} ✓ Captured user input:`, text.slice(0, 100));
      window.ChatGPTLoggerCommon.sendToBackground(payload, LOGGER_NAME);
    },

    // Check if button is a send button
    isSendButton: function(button) {
      const buttonText = (button.textContent || '').toLowerCase();
      const ariaLabel = (button.getAttribute('aria-label') || '').toLowerCase();
      const hasDataTestId = button.getAttribute('data-testid');

      return (
        buttonText.includes('send') ||
        ariaLabel.includes('send') ||
        hasDataTestId === 'send-button' ||
        (hasDataTestId && hasDataTestId.includes('send')) ||
        button.type === 'submit' ||
        (buttonText === '' && button.querySelector('svg')) || // icon-only send buttons
        ariaLabel.includes('submit')
      );
    },

    // Set up assistant response detection for ChatGPT
    setupResponseDetection: function() {
      console.log(`${LOGGER_NAME} Setting up ChatGPT response detection`);

      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              this.processNewNode(node);
            }
          });

          // Also check modified nodes for streaming updates
          if (mutation.type === 'childList' || mutation.type === 'characterData') {
            this.checkForUpdatedResponses(mutation.target);
          }
        });
      });

      // Observe the main content area
      const targetNode = document.querySelector('main') || document.body;
      observer.observe(targetNode, {
        childList: true,
        subtree: true,
        characterData: true
      });

      console.log(`${LOGGER_NAME} ChatGPT response detection setup complete`);
    },

    // Process newly added nodes
    processNewNode: function(node) {
      // Skip ChatGPT placeholder nodes that get replaced during streaming
      if (node.id && node.id.includes('placeholder-')) {
        console.log(`${LOGGER_NAME} Skipping placeholder node:`, node.id);
        return;
      }

      // Check if node contains assistant message indicators
      const hasAssistantMarker = this.config.assistantSelectors.some(selector => {
        return node.matches && node.matches(selector) ||
               (node.querySelector && node.querySelector(selector));
      });

      if (hasAssistantMarker) {
        console.log(`${LOGGER_NAME} Found assistant message node`);
        this.captureAssistantMessage(node);
      }
    },

    // Check for updated responses (streaming)
    checkForUpdatedResponses: function(target) {
      if (!target || target.nodeType !== Node.ELEMENT_NODE) return;

      // Check if this target or its parent contains assistant content
      const assistantContainer = target.closest(this.config.assistantSelectors.join(','));
      if (assistantContainer && !this.assistantNodes.has(assistantContainer)) {
        this.captureAssistantMessage(assistantContainer, false, true); // Mark as streaming update
      }
    },

    // Capture assistant message from ChatGPT
    captureAssistantMessage: function(node, forceImmediate = false, isStreamingUpdate = false) {
      try {
        const textContent = node.innerText || node.textContent || "";
        let text = window.ChatGPTLoggerCommon.normText(textContent);

        console.log(`${LOGGER_NAME} Processing node - ID: ${node.id || 'none'}, Class: ${node.className || 'none'}, Text: "${text}"`);

        // Skip empty or very short content
        if (!text || text.length < 3) {
          console.log(`${LOGGER_NAME} Skipping - empty or too short (${text.length} chars)`);
          return;
        }

        // Skip if already processed this node
        if (this.assistantNodes.has(node) && !isStreamingUpdate) {
          console.log(`${LOGGER_NAME} Skipping - already processed this node`);
          return;
        }

        // Skip obvious UI noise
        if (this.isUINoiseContent(text, node)) {
          console.log(`${LOGGER_NAME} Filtering UI noise:`, text.slice(0, 50));
          return;
        }

        // Skip ChatGPT thinking/processing messages
        if (this.isThinkingNoise(text)) {
          console.log(`${LOGGER_NAME} Filtering thinking noise:`, text.slice(0, 50));
          return;
        }

        // Skip ChatGPT echo/repetition messages
        if (this.isEchoNoise(text)) {
          console.log(`${LOGGER_NAME} Filtering echo noise:`, text.slice(0, 50));
          return;
        }

        // Skip ChatGPT feedback/comparison UI messages
        if (this.isFeedbackNoise(text)) {
          console.log(`${LOGGER_NAME} Filtering feedback noise:`, text.slice(0, 50));
          return;
        }

        // Skip content that appeared too soon after extension start (avoid capturing stale content)
        const timeSinceExtensionStart = Date.now() - this.extensionStartTime;
        if (timeSinceExtensionStart < 10000 && !forceImmediate) {
          console.log(`${LOGGER_NAME} Skipping potential stale content during startup`);
          this.assistantNodes.add(node);
          return;
        }

        // Skip if this looks like a streaming placeholder or incomplete response
        if (text.trim().endsWith('ChatGPT said:') || text.trim() === 'ChatGPT said:') {
          console.log(`${LOGGER_NAME} Skipping incomplete streaming response placeholder`);
          return;
        }

        const nodeId = `chatgpt-${Date.now()}-${text.slice(0, 20)}`;

        // For streaming content, implement debouncing
        if (!forceImmediate && isStreamingUpdate) {
          if (this.pendingCaptures.has(nodeId)) {
            clearTimeout(this.pendingCaptures.get(nodeId));
          }

          this.pendingCaptures.set(nodeId, setTimeout(() => {
            this.finalizeAssistantMessage(node, text, nodeId);
          }, this.config.streamingDelay));

          return;
        }

        // Immediate capture
        this.finalizeAssistantMessage(node, text, nodeId);

      } catch (e) {
        console.error(`${LOGGER_NAME} Assistant capture error:`, e);
      }
    },

    // Finalize and send assistant message
    finalizeAssistantMessage: function(node, text, nodeId) {
      // Clean up pending captures
      this.pendingCaptures.delete(nodeId);

      // Clean the assistant text (remove "ChatGPT said:" prefixes, etc.)
      const cleanedText = this.cleanAssistantText(text);

      // Check against recent message history for duplicates
      if (this.isDuplicateInRecentHistory(cleanedText)) {
        console.log(`${LOGGER_NAME} Skipping duplicate from recent history:`, cleanedText.slice(0, 50));
        return;
      }

      // Add to recent history buffer (maintain last 20 messages)
      this.addToRecentHistory(cleanedText);
      this.lastAssistantText = cleanedText;
      this.assistantNodes.add(node);

      // Create payload with ChatGPT-specific metadata
      const payload = window.ChatGPTLoggerCommon.createMessagePayload('chatgpt', 'assistant', cleanedText, {
        artifacts: [], // ChatGPT doesn't have artifacts like Claude
        streaming: true,
        urls: window.ChatGPTLoggerCommon.extractUrlsFromText(cleanedText)
      });

      console.log(`${LOGGER_NAME} ✓ Captured assistant response:`, cleanedText.slice(0, 100));
      window.ChatGPTLoggerCommon.sendToBackground(payload, LOGGER_NAME);
    },

    // ChatGPT-specific UI noise detection
    isUINoiseContent: function(text, node) {
      const textLower = text.toLowerCase();

      // REMOVED: ChatGPT said filter - sometimes contains real content that cleanAssistantText() will handle
      // Example: "ChatGPT said: okay172" contains the real response "okay172"

      // Allow content from markdown/prose containers (real message content)
      if (node && node.className && node.className.includes('markdown')) {
        console.log(`${LOGGER_NAME} Allowing content from markdown container:`, text.slice(0, 50));
        return false; // This is real content
      }

      if (node && node.className && node.className.includes('prose')) {
        console.log(`${LOGGER_NAME} Allowing content from prose container:`, text.slice(0, 50));
        return false; // This is real content
      }

      if (node && node.className && node.className.includes('text-token-text-primary')) {
        console.log(`${LOGGER_NAME} Allowing content from text-token-text-primary container:`, text.slice(0, 50));
        return false; // This is real content
      }

      // Common UI elements that should be filtered
      const uiPatterns = [
        /^(copy|regenerate|share|edit|retry)$/i,
        /^(thumbs up|thumbs down)$/i,
        /^(stop generating|continue|show more)$/i,
        /^\d+\/\d+$/, // Page indicators
        /^(new chat|clear chat)$/i,
        /^(like|dislike)$/i,
        /^(read aloud)$/i
      ];

      if (uiPatterns.some(pattern => pattern.test(text))) {
        return true;
      }

      // Check if in obvious UI containers (but be more specific)
      if (node && node.closest) {
        // Only filter if it's actually in UI chrome, not message content
        const uiContainers = [
          'button:not([data-message-author-role])', // Exclude message buttons
          'nav',
          'header:not([data-message-author-role])', // Exclude message headers
          '[class*="header"]:not([data-message-author-role])',
          '[class*="nav"]:not([data-message-author-role])',
          '[class*="sidebar"]',
          '[class*="toolbar"]'
        ];

        if (uiContainers.some(selector => node.closest(selector))) {
          return true;
        }
      }

      // If it's longer than a few words, it's probably not UI noise
      // COMMENTED OUT: This was blocking legitimate short responses like "okay163", "yes", "no"
      // if (text.length > 20) {
      //   return false;
      // }

      return false;
    },

    // Clean assistant text for ChatGPT
    cleanAssistantText: function(text) {
      // ChatGPT-specific cleaning (less aggressive than Claude)
      let cleaned = text;

      // Remove ChatGPT said: prefix
      cleaned = cleaned.replace(/^ChatGPT said:\s*/i, '');

      // Remove any conversation metadata
      cleaned = cleaned.replace(/^(ChatGPT|GPT-\d+):\s*/i, '');

      return cleaned.trim();
    },

    // Check if message is duplicate in recent history buffer
    isDuplicateInRecentHistory: function(newText) {
      // Check exact match
      if (this.recentAssistantMessages.includes(newText)) {
        return true;
      }

      // Check for "ChatGPT said:" prefix variations against all recent messages
      for (const recentText of this.recentAssistantMessages) {
        if (this.isDuplicateWithPrefix(newText, recentText)) {
          return true;
        }
      }

      return false;
    },

    // Add message to recent history buffer (maintain last 20)
    addToRecentHistory: function(text) {
      this.recentAssistantMessages.push(text);

      // Keep only last 20 messages
      if (this.recentAssistantMessages.length > 20) {
        this.recentAssistantMessages.shift(); // Remove oldest
      }
    },

    // Check if two messages are duplicates where one has "ChatGPT said:" prefix
    isDuplicateWithPrefix: function(newText, lastText) {
      // If the new text starts with "ChatGPT said:" and the remainder matches lastText
      const chatGPTSaidMatch = newText.match(/^ChatGPT said:\s*(.*)/i);
      if (chatGPTSaidMatch && chatGPTSaidMatch[1].trim() === lastText.trim()) {
        return true;
      }

      // If the last text starts with "ChatGPT said:" and the remainder matches newText
      const lastChatGPTSaidMatch = lastText.match(/^ChatGPT said:\s*(.*)/i);
      if (lastChatGPTSaidMatch && lastChatGPTSaidMatch[1].trim() === newText.trim()) {
        return true;
      }

      return false;
    },

    // Check if text is ChatGPT thinking/processing noise
    isThinkingNoise: function(text) {
      const thinkingPatterns = [
        /^ChatGPT said:\s*Thinking\s*Skip?$/i,
        /^ChatGPT said:\s*Thought for .* Skip?$/i,
        /^Thinking\s*Skip?$/i,
        /^Thought for .* Skip?$/i
      ];

      return thinkingPatterns.some(pattern => pattern.test(text.trim()));
    },

    // Check if text is ChatGPT echo/repetition noise
    isEchoNoise: function(text) {
      const echoPatterns = [
        /^You said:/i,
        /^ChatGPT said:\s*You said:/i
      ];

      return echoPatterns.some(pattern => pattern.test(text.trim()));
    },

    // Check if text is ChatGPT UI feedback/comparison interface
    isFeedbackNoise: function(text) {
      const feedbackPatterns = [
        /response do you prefer\?/i,
        /which response do you prefer/i,
        /You're giving feedback on a new version/i,
        /ChatGPT Response \d+/i,
        /Responses may take a moment to load/i
      ];

      return feedbackPatterns.some(pattern => pattern.test(text.trim()));
    }
  };

  // Expose ChatGPT handler globally
  window.ChatGPTLoggerHandler = ChatGPTHandler;

})(window);