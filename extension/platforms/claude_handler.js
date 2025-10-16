// claude_handler.js - Claude-specific logging handler with signal processing
// Handles Claude's complex DOM mutations, conversation history retransmissions, and UI quirks

(function(window) {
  'use strict';

  const LOGGER_NAME = '[CLAUDE HANDLER]';

  const ClaudeHandler = {
    // Model-specific configurations
    modelConfigs: {
      'sonnet-4': {
        userInputSelectors: [
          'textarea[placeholder*="message"]',
          'textarea[placeholder*="Message"]',
          'textarea[data-testid*="input"]',
          'div[contenteditable="true"][role="textbox"]',
          'textarea[aria-label*="message"]',
          '[data-cy="chat-input"]',
          '.chat-input textarea',
          '[data-testid="chat-input"]',
          'textarea[placeholder*="Reply"]',
          'textarea',
          '[role="textbox"]'
        ],
        assistantSelectors: [
          // Sonnet 4 specific selectors based on DOM analysis
          'div.font-claude-response p.whitespace-normal.break-words',
          'div[class*="font-claude-response"] p[class*="whitespace-normal"]',
          'div.standard-markdown p.whitespace-normal.break-words',
          'div[class*="standard-markdown"] p[class*="whitespace-normal"]',

          // Parent container approaches for Sonnet 4
          'div.font-claude-response p',
          'div[class*="font-claude-response"] p',
          'div[class*="leading-"] p.whitespace-normal',

          // Generic fallbacks
          'p.whitespace-normal.break-words',
          'main p',
          'div > p'
        ],
        parentContainerSelectors: [
          'div.font-claude-response',
          'div[class*="font-claude-response"]',
          'div.standard-markdown',
          'div[class*="standard-markdown"]'
        ],
        sendButtonSelectors: [
          'button[aria-label*="send"]',
          'button[data-testid*="send"]',
          'button[type="submit"]',
          '.send-button'
        ],
        streamingDelay: 3000,
        filterRules: {
          // More lenient echo detection for Sonnet 4
          allowGreetingEchoes: true,
          echoCharacterThreshold: 3, // Allow more leading characters
          temporalWindow: 5000 // Shorter temporal window
        }
      },
      'opus-4.1': {
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
          // Current working Opus 4.1 selectors
          'p.whitespace-normal.break-words',
          'div.standard-markdown p',
          '.standard-markdown p',
          'div[class*="standard-markdown"] p',
          'div[class*="grid-cols-1"][class*="grid"] p',

          // Legacy selectors (keeping for compatibility)
          '[data-role="assistant"]',
          '[data-message-role="assistant"]',
          '.message-assistant',
          '.claude-message',
          '[data-testid*="assistant"]',
          '.response-message',
          '[data-testid*="message"][data-role*="assistant"]',
          '.message[data-role="assistant"]',
          'div[data-testid^="message-content"]',
          'div[role="article"]:not([class*="header"]):not([class*="button"])',
          'main div[class*="prose"]:not([class*="header"]):not([class*="nav"])',
          'div[class*="message-content"]',
          'article:not([class*="header"]):not([class*="nav"])',
          'div[class*="message"]',
          'div > p',
          'main div:not([class*="input"]):not([class*="button"]):not([class*="header"])'
        ],
        parentContainerSelectors: [
          'div[role="article"]',
          'main div[class*="prose"]',
          'div[class*="message-content"]'
        ],
        sendButtonSelectors: [
          'button[aria-label*="send"]',
          'button[data-testid*="send"]',
          'button[type="submit"]',
          '.send-button'
        ],
        streamingDelay: 3000,
        filterRules: {
          // Current working filter rules for Opus
          allowGreetingEchoes: false,
          echoCharacterThreshold: 2,
          temporalWindow: 3000
        }
      },
      'unknown': {
        // Generic fallback configuration
        userInputSelectors: [
          'textarea[placeholder*="message"]',
          'textarea',
          '[role="textbox"]'
        ],
        assistantSelectors: [
          'p.whitespace-normal.break-words',
          'main p',
          'div > p'
        ],
        parentContainerSelectors: ['main', 'div'],
        sendButtonSelectors: ['button[type="submit"]'],
        streamingDelay: 3000,
        filterRules: {
          allowGreetingEchoes: true,
          echoCharacterThreshold: 2,
          temporalWindow: 3000
        }
      }
    },

    // Get current model configuration
    get config() {
      return this.modelConfigs[this.detectedModel] || this.modelConfigs['unknown'];
    },

    // Signal processing state for Claude's complex behavior
    state: {
      // Message tracking for duplicate detection
      processedMessages: new Map(),
      messageSequence: [],
      conversationHistory: [],

      // Signal processing buffers
      velocityBuffer: [],
      hashBuffer: [],
      temporalWindow: [],

      // User interaction tracking
      lastUserInteraction: 0,
      sessionStart: Date.now(),

      // Enhanced user send detection
      userSendTracking: {
        awaitingResponse: false,
        responseToContent: null,
        userSentAt: 0,
        seenUserMessageInStream: false,
        genuineResponseCaptured: false,
        responseWindow: 15000
      },

      // Filter statistics
      stats: {
        totalMessages: 0,
        filteredByVelocity: 0,
        filteredByTemporal: 0,
        filteredByEcho: 0,
        filteredByAutocorrelation: 0,
        preservedByContext: 0,
        cleanLogEntries: 0,
        verboseLogEntries: 0
      }
    },

    // Signal processing filter configuration
    filterConfig: {
      velocityThreshold: 25, // Messages per second threshold (increased for Claude streaming)
      velocityWindow: 1000, // 1 second window
      conversationWindow: 300000, // 5 minutes
      userActivityWindow: 120000, // 2 minutes
      hashBufferSize: 20,
      patternThreshold: 3,
      musicalCommandWindow: 60000, // For ChurnRoom use case
      legitimateRepeatWindow: 30000,
      persistenceThreshold: 500
    },

    // Internal state
    lastUserText: "",
    lastAssistantText: "",
    currentUserText: "",
    recentUserMessages: [], // Buffer of last 20 user messages for echo detection
    userInputActive: false,
    assistantNodes: new Set(),
    pendingCaptures: new Map(),
    extensionStartTime: Date.now(),
    conversationBaseline: new Set(),

    // Model detection state
    detectedModel: 'unknown',
    modelDetectionAttempts: 0,
    maxDetectionAttempts: 10,

    // Initialize Claude handler
    init: function() {
      console.log(`${LOGGER_NAME} Initializing Claude handler with model detection...`);

      // Initialize signal processing
      this.state.sessionStart = Date.now();

      // Detect model first
      this.detectClaudeModel();

      this.establishConversationBaseline();
      this.setupUserCapture();
      this.setupResponseDetection();

      // Test connection after initialization
      setTimeout(() => {
        this.sendTestMessage();
      }, 2000);

      console.log(`${LOGGER_NAME} Claude handler initialized successfully for model: ${this.detectedModel}`);
    },

    // Detect Claude model type
    detectClaudeModel: function() {
      console.log(`${LOGGER_NAME} Attempting to detect Claude model...`);

      // Look for model indicators in the UI
      const modelIndicators = [
        { text: 'Sonnet 4', model: 'sonnet-4' },
        { text: 'Claude Sonnet 4', model: 'sonnet-4' },
        { text: 'Opus 4.1', model: 'opus-4.1' },
        { text: 'Claude Opus 4.1', model: 'opus-4.1' },
        { text: 'Haiku', model: 'haiku' },
        { text: 'Claude Haiku', model: 'haiku' }
      ];

      let detectedModel = 'unknown';

      // Check various UI locations for model names
      const searchSelectors = [
        // Bottom right model indicator (common location)
        '[class*="model"], [class*="claude"]',
        // Conversation title or header areas
        'h1, h2, h3, header, [role="heading"]',
        // Settings or dropdown areas
        '[data-testid*="model"], [data-testid*="claude"]',
        // Any text content that might contain model info
        'span, div, p'
      ];

      for (const selector of searchSelectors) {
        try {
          const elements = document.querySelectorAll(selector);
          for (const element of elements) {
            const text = element.textContent || '';
            for (const indicator of modelIndicators) {
              if (text.includes(indicator.text)) {
                detectedModel = indicator.model;
                console.log(`${LOGGER_NAME} ✓ Detected model: ${detectedModel} from "${text}"`);
                break;
              }
            }
            if (detectedModel !== 'unknown') break;
          }
          if (detectedModel !== 'unknown') break;
        } catch (e) {
          // Ignore selector errors
        }
      }

      this.detectedModel = detectedModel;
      this.modelDetectionAttempts++;

      if (detectedModel === 'unknown' && this.modelDetectionAttempts < this.maxDetectionAttempts) {
        // Retry detection after a delay
        setTimeout(() => this.detectClaudeModel(), 1000);
      }

      return detectedModel;
    },

    // Establish baseline of existing conversation content
    establishConversationBaseline: function() {
      console.log(`${LOGGER_NAME} Establishing conversation baseline...`);
      try {
        this.config.assistantSelectors.forEach(selector => {
          const messages = document.querySelectorAll(selector);
          messages.forEach(msg => {
            const text = this.extractCleanText(msg);
            if (text && text.length > 3) {
              this.conversationBaseline.add(text);
              console.log(`${LOGGER_NAME} Baseline message:`, text.slice(0, 50));
            }
          });
        });
        console.log(`${LOGGER_NAME} Baseline established with ${this.conversationBaseline.size} existing messages`);
      } catch (e) {
        console.error(`${LOGGER_NAME} Error establishing baseline:`, e);
      }
    },

    // Extract clean text avoiding phantom DOM elements (fixes "J" prefix issue)
    extractCleanText: function(element) {
      if (element.children.length === 0) {
        return window.ChatGPTLoggerCommon.normText(element.textContent || '');
      }

      let text = '';
      const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: function(node) {
            const parent = node.parentElement;
            if (!parent) return NodeFilter.FILTER_SKIP;

            const style = window.getComputedStyle(parent);
            if (style.display === 'none' || style.visibility === 'hidden') {
              return NodeFilter.FILTER_SKIP;
            }

            // Skip buttons, icons, and UI elements (enhanced for Claude's action buttons)
            if (parent.matches('button, svg, [role="button"], .icon, [class*="icon"], [data-testid*="button"], [aria-label*="button"]')) {
              return NodeFilter.FILTER_SKIP;
            }

            // Skip Claude's specific action buttons and controls
            if (parent.closest('button, [role="button"], [data-testid*="action"], [class*="action-"], [class*="toolbar"], nav, header, [class*="controls"]')) {
              return NodeFilter.FILTER_SKIP;
            }

            // Skip if text looks like UI button text (Write, Strategize, Create, Learn, etc.)
            const textContent = node.textContent || '';
            if (/^(Write|Strategize|Create|Learn|From\s+Drive|Publish|Share|Copy|Edit|Delete)$/i.test(textContent.trim())) {
              return NodeFilter.FILTER_SKIP;
            }

            return NodeFilter.FILTER_ACCEPT;
          }
        }
      );

      let node;
      while (node = walker.nextNode()) {
        text += node.textContent;
      }

      return window.ChatGPTLoggerCommon.normText(text);
    },

    // Send test message
    sendTestMessage: function() {
      const payload = window.ChatGPTLoggerCommon.createMessagePayload(
        'claude',
        'user',
        `extension_test_claude_${Date.now()}`
      );
      window.ChatGPTLoggerCommon.sendToBackground(payload, LOGGER_NAME);
    },

    // Set up user input capture for Claude
    setupUserCapture: function() {
      console.log(`${LOGGER_NAME} Setting up Claude user input capture with input clearing detection`);

      // State for input clearing detection
      this.inputState = {
        lastContent: '',
        hasContent: false,
        currentInput: null
      };

      // Enhanced user send detection to handle duplicates
      this.onUserSendMessage = (text) => {
        console.log(`${LOGGER_NAME} 🎯 USER SEND DETECTED:`, text.slice(0, 50));

        const timestamp = Date.now();
        this.state.lastUserInteraction = timestamp;
        this.state.userSendTracking.awaitingResponse = true;
        this.state.userSendTracking.userSentAt = timestamp;
        this.state.userSendTracking.responseToContent = text;

        this.logUserMessage(text);
      };

      // Completely non-interfering input monitoring using polling
      this.startInputPolling();

      // Keep button click detection as backup
      document.addEventListener('click', (e) => {
        const button = e.target.closest('button');
        if (button && this.isSendButton(button)) {
          console.log(`${LOGGER_NAME} Send button clicked`);
          // Don't capture here - let input clearing detection handle it
        }
      }, false);
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
              this.onUserSendMessage(text);
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

      // Add to recent user messages buffer for echo detection
      this.addToUserMessageBuffer(text);

      const payload = window.ChatGPTLoggerCommon.createMessagePayload('claude', 'user', text, {
        claudeModel: this.detectedModel,
        processingPipeline: this.detectedModel === 'sonnet-4' ? 'sonnet-4' :
                            this.detectedModel === 'opus-4.1' ? 'opus-4.1' : 'generic'
      });
      console.log(`${LOGGER_NAME} ✓ Captured user input (${this.detectedModel}):`, text.slice(0, 100));
      window.ChatGPTLoggerCommon.sendToBackground(payload, LOGGER_NAME);
    },

    // Check if element is a Claude input field
    isClaudeInputField: function(element) {
      if (!element) return false;

      // Check if it matches our input selectors
      for (const selector of this.config.userInputSelectors) {
        try {
          if (element.matches && element.matches(selector)) {
            // Additional check - make sure it's visible and sizeable
            if (element.offsetHeight > 0 && element.offsetWidth > 100) {
              return true;
            }
          }
        } catch (e) {
          // Ignore selector errors
        }
      }
      return false;
    },

    // Get content from input element
    getInputContent: function(element) {
      if (!element) return '';

      const text = element.innerText || element.textContent || element.value || '';
      return window.ChatGPTLoggerCommon.normText(text);
    },

    // Start non-interfering input polling
    startInputPolling: function() {
      console.log(`${LOGGER_NAME} Starting non-interfering input polling`);

      setInterval(() => {
        // Find active input field
        let activeInput = null;
        for (const selector of this.config.userInputSelectors) {
          const elements = document.querySelectorAll(selector);
          for (const el of elements) {
            if (el.offsetHeight > 0 && el.offsetWidth > 100) {
              activeInput = el;
              break;
            }
          }
          if (activeInput) break;
        }

        if (activeInput) {
          const currentContent = this.getInputContent(activeInput);

          if (currentContent.length > 2) {
            // Store content and track that input has content
            this.inputState.lastContent = currentContent;
            this.inputState.hasContent = true;
            this.inputState.currentInput = activeInput;
            this.currentUserText = currentContent;
          } else if (this.inputState.hasContent && currentContent.length === 0) {
            // Input just cleared! Message was sent
            console.log(`${LOGGER_NAME} 🚀 INPUT CLEARED - MESSAGE SENT:`, this.inputState.lastContent.slice(0, 50));
            this.onUserSendMessage(this.inputState.lastContent);

            // Reset state
            this.inputState.hasContent = false;
            this.inputState.lastContent = '';
            this.inputState.currentInput = null;
            this.currentUserText = "";
          }
        }
      }, 100); // Poll every 100ms - frequent enough to catch clearing
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
        (buttonText === '' && button.querySelector('svg'))
      );
    },

    // Set up assistant response detection with debounced streaming completion
    setupResponseDetection: function() {
      console.log(`${LOGGER_NAME} Setting up Claude response detection with debounced streaming`);

      // Debounce storage for pending messages
      const pendingMessages = new Map();
      const DEBOUNCE_DELAY = 5; // 5ms debounce for diagnostic testing

      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          // Handle new nodes (element additions)
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              this.handleNodeWithDebounce(node, pendingMessages, DEBOUNCE_DELAY);
            }
          });

          // Handle character data changes (text content updates) - CRITICAL for Claude
          if (mutation.type === 'characterData' || mutation.type === 'childList') {
            const target = mutation.target;
            if (target.nodeType === Node.TEXT_NODE && target.parentElement) {
              // Text node changed - check parent element
              this.handleNodeWithDebounce(target.parentElement, pendingMessages, DEBOUNCE_DELAY);
            } else if (target.nodeType === Node.ELEMENT_NODE) {
              // Element changed - check it directly
              this.handleNodeWithDebounce(target, pendingMessages, DEBOUNCE_DELAY);
            }
          }
        });
      });

      // Observe the main content area - enhanced to catch Claude's text updates
      const targetNode = document.querySelector('main') || document.body;
      observer.observe(targetNode, {
        childList: true,
        subtree: true,
        characterData: true  // CRITICAL: Claude adds response text via character data updates
      });

      console.log(`${LOGGER_NAME} 🔍 Observing DOM changes on:`, targetNode.tagName, 'with characterData detection enabled');

      // Expose debounce state for debugging
      this.debouncedCapture = {
        getPendingMessages: () => Array.from(pendingMessages.entries()).map(([key, data]) => ({
          key,
          text: data.originalText.slice(0, 50),
          age: Date.now() - data.timestamp
        })),
        clearPending: () => {
          pendingMessages.forEach(data => clearTimeout(data.timer));
          pendingMessages.clear();
          console.log(`${LOGGER_NAME} 🧹 Cleared all pending debounced messages`);
        }
      };

      console.log(`${LOGGER_NAME} Debounced response detection setup complete (${DEBOUNCE_DELAY}ms delay)`);
    },

    // Handle new nodes with debouncing to prevent fragments
    handleNodeWithDebounce: function(node, pendingMessages, DEBOUNCE_DELAY) {
      try {
        const text = this.extractCleanText(node);

        if (!text || text.length < 3) return;

        console.log(`${LOGGER_NAME} 🔄 DEBOUNCE: Detected content "${text.slice(0, 30)}..." - setting up ${DEBOUNCE_DELAY}ms timer`);

        // Create unique key for this message location
        const messageKey = `${text.slice(0, 50)}-${node.className}-${node.tagName}`;

        // Clear any existing timer for this message
        if (pendingMessages.has(messageKey)) {
          clearTimeout(pendingMessages.get(messageKey).timer);
        }

        // Set new debounce timer
        const timer = setTimeout(() => {
          console.log(`${LOGGER_NAME} ⏰ DEBOUNCE COMPLETE: Processing "${text.slice(0, 30)}..." after ${DEBOUNCE_DELAY}ms`);

          // Re-extract text in case it changed during debounce period
          const finalText = this.extractCleanText(node);
          if (finalText && finalText.length > 0) {
            // Apply signal processing to final settled content
            this.processNewNode(node, finalText, {
              debounced: true,
              debounceDelay: DEBOUNCE_DELAY,
              originalText: text,
              finalText: finalText,
              textChanged: text !== finalText
            });
          }

          // Clean up
          pendingMessages.delete(messageKey);
        }, DEBOUNCE_DELAY);

        // Store the pending message
        pendingMessages.set(messageKey, {
          timer: timer,
          node: node,
          originalText: text,
          timestamp: Date.now()
        });

      } catch (error) {
        console.error(`${LOGGER_NAME} Error in debounced handler:`, error);
      }
    },

    // Process newly added nodes with model-specific processing
    processNewNode: function(node, overrideText = null, context = {}) {
      const text = overrideText || this.extractCleanText(node);

      if (!text || text.length < 3) return;

      console.log(`${LOGGER_NAME} 🔍 PROCESSING (${this.detectedModel}): "${text.slice(0, 50)}..." ${context.debounced ? '[DEBOUNCED]' : '[IMMEDIATE]'}`);

      // Route to model-specific processing
      switch(this.detectedModel) {
        case 'sonnet-4':
          this.processSonnetResponse(node, text, context);
          break;
        case 'opus-4.1':
          this.processOpusResponse(node, text, context);
          break;
        default:
          this.processGenericResponse(node, text, context);
          break;
      }
    },

    // Sonnet 4 specific processing pipeline
    processSonnetResponse: function(node, text, context) {
      const timestamp = Date.now();

      // More lenient filtering for Sonnet 4
      console.log(`${LOGGER_NAME} 🎵 SONNET-4: Processing "${text.slice(0, 50)}..." (length: ${text.length})`);
      console.log(`${LOGGER_NAME} 🎵 SONNET-4: Node info - tag: ${node.tagName}, class: "${node.className}", parent: "${node.parentElement?.tagName}"`);

      // Check if this looks like actual response content vs UI elements
      // Priority: Check for response-specific DOM structure
      const hasResponseStructure = node.closest('p[class*="whitespace-normal"], div[class*="standard-markdown"], main p');

      if (!hasResponseStructure) {
        // Check broader containers only if not in obvious response structure
        const parentContainer = node.closest('div.font-claude-response, div[class*="font-claude-response"], [role="article"], main [data-testid*="message"], main [class*="message"], main div, [data-testid*="conversation"], [class*="conversation"]');
        if (!parentContainer) {
          console.log(`${LOGGER_NAME} 🎵 SONNET-4: Not response content - no response structure or containers found`);
          return;
        }
      }

      console.log(`${LOGGER_NAME} 🎵 SONNET-4: Content passed container check - response structure: ${!!hasResponseStructure}`);

      // Extra check: ensure we're not in action buttons area
      if (node.closest('[class*="action"], [class*="toolbar"], [class*="controls"], button, [role="button"]')) {
        console.log(`${LOGGER_NAME} 🎵 SONNET-4: Skipping action button/control area`);
        return;
      }

      // Apply reduced signal processing for Sonnet 4
      if (!this.passesVelocityFilter(text, timestamp)) return;
      if (!this.passesTemporalFilter(text, timestamp)) return;

      // Skip autocorrelation for Sonnet (too aggressive)
      // Apply model-specific echo filter
      if (!this.passesEchoFilter(text, timestamp)) return;

      // More permissive contextual preservation
      const isPreserved = this.shouldPreserveByContext(text, timestamp) ||
                          this.isSonnetSpecificContent(text);

      if (isPreserved || this.isNewMessage(text, timestamp)) {
        console.log(`${LOGGER_NAME} 🎵 SONNET-4: Capturing response`);
        this.captureAssistantMessage(node, text, context);
      }
    },

    // Opus 4.1 specific processing pipeline (current working version)
    processOpusResponse: function(node, text, context) {
      const timestamp = Date.now();

      console.log(`${LOGGER_NAME} 🔮 OPUS-4.1: Processing "${text.slice(0, 30)}..."`);

      // Apply full signal processing filters for Opus
      if (!this.passesVelocityFilter(text, timestamp)) return;
      if (!this.passesTemporalFilter(text, timestamp)) return;
      if (!this.passesAutocorrelationFilter(text, timestamp)) return;
      if (!this.passesEchoFilter(text, timestamp)) return;

      const isPreserved = this.shouldPreserveByContext(text, timestamp);

      if (isPreserved || this.isNewMessage(text, timestamp)) {
        console.log(`${LOGGER_NAME} 🔮 OPUS-4.1: Capturing response`);
        this.captureAssistantMessage(node, text, context);
      }
    },

    // Generic response processing for unknown models
    processGenericResponse: function(node, text, context) {
      const timestamp = Date.now();

      console.log(`${LOGGER_NAME} ❓ GENERIC: Processing "${text.slice(0, 30)}..."`);

      // Conservative filtering for unknown models
      if (!this.passesVelocityFilter(text, timestamp)) return;
      if (!this.passesEchoFilter(text, timestamp)) return;

      if (this.isNewMessage(text, timestamp)) {
        console.log(`${LOGGER_NAME} ❓ GENERIC: Capturing response`);
        this.captureAssistantMessage(node, text, context);
      }
    },

    // Check if content is Sonnet-specific and should be preserved
    isSonnetSpecificContent: function(text) {
      // More permissive content rules for Sonnet 4
      const textLower = text.toLowerCase();

      // Allow common Sonnet responses that might be filtered elsewhere
      if (textLower.includes('how can i help') ||
          textLower.includes('what would you like') ||
          textLower.includes('feel free to') ||
          text.length > 50) { // Longer responses are likely legitimate
        return true;
      }

      return false;
    },

    // Velocity filter - detect bulk message dumps
    passesVelocityFilter: function(text, timestamp) {
      this.state.velocityBuffer.push(timestamp);

      // Keep only recent timestamps
      const cutoff = timestamp - this.filterConfig.velocityWindow;
      this.state.velocityBuffer = this.state.velocityBuffer.filter(t => t > cutoff);

      if (this.state.velocityBuffer.length > this.filterConfig.velocityThreshold) {
        console.log(`${LOGGER_NAME} ⚡ VELOCITY FILTER: Bulk dump detected (${this.state.velocityBuffer.length} msgs/sec)`);
        this.state.stats.filteredByVelocity++;
        return false;
      }

      return true;
    },

    // Temporal filter - check conversation context
    passesTemporalFilter: function(text, timestamp) {
      const timeSinceUserInteraction = timestamp - this.state.lastUserInteraction;

      // If no recent user interaction and message wasn't in baseline, it's suspicious
      if (timeSinceUserInteraction > this.filterConfig.userActivityWindow &&
          this.state.lastUserInteraction > 0 &&
          !this.conversationBaseline.has(text)) {
        console.log(`${LOGGER_NAME} ⏰ TEMPORAL FILTER: No recent user activity (${timeSinceUserInteraction}ms)`);
        this.state.stats.filteredByTemporal++;
        return false;
      }

      return true;
    },

    // Autocorrelation filter - detect repeated patterns
    passesAutocorrelationFilter: function(text, timestamp) {
      const hash = this.simpleHash(text);
      this.state.hashBuffer.push(hash);

      // Keep only recent hashes
      if (this.state.hashBuffer.length > this.filterConfig.hashBufferSize) {
        this.state.hashBuffer.shift();
      }

      // Count how many recent hashes match old patterns
      const oldHashes = this.state.hashBuffer.slice(0, -3); // Exclude last 3
      const recentHashes = this.state.hashBuffer.slice(-3); // Last 3

      let patternMatches = 0;
      recentHashes.forEach(recentHash => {
        if (oldHashes.includes(recentHash)) {
          patternMatches++;
        }
      });

      if (patternMatches >= this.filterConfig.patternThreshold) {
        console.log(`${LOGGER_NAME} 🔄 AUTOCORR FILTER: Pattern repeat detected (${patternMatches} matches)`);
        this.state.stats.filteredByAutocorrelation++;
        return false;
      }

      return true;
    },

    // Echo filter - detect exact duplicates and user message echoes with leading characters
    passesEchoFilter: function(text, timestamp) {
      const filterRules = this.config.filterRules || {};

      // Check for exact duplicates
      if (this.state.processedMessages.has(text)) {
        const lastSeen = this.state.processedMessages.get(text);
        const timeDiff = timestamp - lastSeen;

        // Allow recent echoes (legitimate conversation patterns)
        if (timeDiff < this.filterConfig.legitimateRepeatWindow) {
          return true;
        }

        console.log(`${LOGGER_NAME} 🔁 ECHO FILTER: Duplicate message (${timeDiff}ms ago)`);
        this.state.stats.filteredByEcho++;
        return false;
      }

      // Model-specific echo detection
      if (this.isUserMessageEcho(text, filterRules)) {
        console.log(`${LOGGER_NAME} 🔁 ECHO FILTER: User message echo with leading character (${this.detectedModel}):`, text.slice(0, 50));
        this.state.stats.filteredByEcho++;
        return false;
      }

      this.state.processedMessages.set(text, timestamp);
      return true;
    },

    // Contextual preservation - allow legitimate repeats
    shouldPreserveByContext: function(text, timestamp) {
      // Preserve musical commands for ChurnRoom
      if (text.toUpperCase().includes('PLAY:') ||
          text.toUpperCase().includes('STOP') ||
          text.toUpperCase().includes('VOLUME:')) {
        console.log(`${LOGGER_NAME} 🎵 CONTEXT PRESERVE: Musical command`);
        this.state.stats.preservedByContext++;
        return true;
      }

      // Preserve legitimate conversational repeats
      if (this.state.userSendTracking.awaitingResponse &&
          timestamp - this.state.userSendTracking.userSentAt < this.filterConfig.legitimateRepeatWindow) {
        console.log(`${LOGGER_NAME} 💬 CONTEXT PRESERVE: Legitimate response`);
        this.state.stats.preservedByContext++;
        return true;
      }

      return false;
    },

    // Check if message is genuinely new
    isNewMessage: function(text, timestamp) {
      // Not in baseline and recent user activity
      return !this.conversationBaseline.has(text) &&
             (timestamp - this.state.lastUserInteraction) < this.filterConfig.userActivityWindow;
    },

    // Simple hash function for pattern detection
    simpleHash: function(str) {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      return hash;
    },

    // Capture assistant message from Claude
    captureAssistantMessage: function(node, text, context = {}) {
      try {
        // Skip if already processed this node
        if (this.assistantNodes.has(node)) {
          return;
        }

        // Skip obvious UI noise
        if (this.isUINoiseContent(text, node)) {
          console.log(`${LOGGER_NAME} Filtering UI noise:`, text.slice(0, 50));
          return;
        }

        this.assistantNodes.add(node);

        // Update state
        this.state.userSendTracking.genuineResponseCaptured = true;
        this.state.stats.cleanLogEntries++;

        // Create payload with Claude-specific metadata including model info
        const payload = window.ChatGPTLoggerCommon.createMessagePayload('claude', 'assistant', text, {
          artifacts: window.ChatGPTLoggerCommon.captureClaudeArtifacts(node),
          streaming: !context.debounced, // If debounced, streaming is complete
          urls: window.ChatGPTLoggerCommon.extractUrlsFromNode(node),
          debounced: context.debounced || false,
          debounceDelay: context.debounceDelay || 0,
          textChanged: context.textChanged || false,
          claudeModel: this.detectedModel, // Add detected model to metadata
          processingPipeline: this.detectedModel === 'sonnet-4' ? 'sonnet-4' :
                              this.detectedModel === 'opus-4.1' ? 'opus-4.1' : 'generic'
        });

        const debugInfo = context.debounced ?
          `[DEBOUNCED after ${context.debounceDelay}ms]` :
          '[IMMEDIATE]';

        console.log(`${LOGGER_NAME} ✓ Captured assistant response ${debugInfo}:`, text.slice(0, 100));
        window.ChatGPTLoggerCommon.sendToBackground(payload, LOGGER_NAME);

      } catch (e) {
        console.error(`${LOGGER_NAME} Assistant capture error:`, e);
      }
    },

    // Claude-specific UI noise detection
    isUINoiseContent: function(text, node) {
      const textLower = text.toLowerCase();

      // Allow short valid Claude responses (like "okay27", "okay28")
      if (text.length < 10 && text.match(/^okay\d+$/i)) {
        // Check if it's not in a button or navigation
        if (node && node.closest && (node.closest('button') || node.closest('nav') ||
            node.closest('[class*="nav"]') || node.closest('[class*="sidebar"]'))) {
          return true;
        }
        return false; // Allow it if it passes checks
      }

      // Standard UI noise patterns
      const uiPatterns = [
        /\w+\s+(retry|share)$/i,
        /test message confirmation/i,
        /message confirmation/i,
        /^(yes|no|retry|share)$/i,
        /^Thinking/i,  // Catch all messages starting with "Thinking"
        /^Gathering/i, // Catch all messages starting with "Gathering"
        /^ArtifactsArtifacts$/i,
        /^Artifacts$/i
      ];

      if (uiPatterns.some(pattern => pattern.test(text))) {
        return true;
      }

      // Check if in UI containers
      if (node && node.closest) {
        const uiContainers = [
          'button', 'nav', 'header', '[class*="header"]',
          '[class*="nav"]', '[class*="sidebar"]'
        ];

        if (uiContainers.some(selector => node.closest(selector))) {
          return true;
        }
      }

      return false;
    },

    // Add user message to buffer for echo detection
    addToUserMessageBuffer: function(text) {
      this.recentUserMessages.push(text);

      // Keep only last 20 messages
      if (this.recentUserMessages.length > 20) {
        this.recentUserMessages.shift(); // Remove oldest
      }
    },

    // Check if assistant message is echoing a recent user message with model-specific rules
    isUserMessageEcho: function(assistantText, filterRules = {}) {
      const echoCharacterThreshold = filterRules.echoCharacterThreshold || 2;
      const allowGreetingEchoes = filterRules.allowGreetingEchoes || false;

      // Skip greeting echo detection for models that allow it
      if (allowGreetingEchoes && (assistantText.toLowerCase().includes('hello') ||
                                  assistantText.toLowerCase().includes('hi there') ||
                                  assistantText.toLowerCase().includes('how can i help'))) {
        return false;
      }

      for (const userMessage of this.recentUserMessages) {
        // Check for exact match (assistant echoing user input exactly)
        if (assistantText === userMessage) {
          return true;
        }

        // Check if assistantText is a user message with leading characters (model-specific threshold)
        if (assistantText.length > userMessage.length &&
            assistantText.length <= userMessage.length + echoCharacterThreshold) {

          // Try removing characters up to the threshold
          for (let i = 1; i <= echoCharacterThreshold; i++) {
            const withoutChars = assistantText.substring(i);
            if (withoutChars === userMessage) {
              return true;
            }
          }
        }
      }

      return false;
    }
  };

  // Expose Claude handler globally
  window.ClaudeLoggerHandler = ClaudeHandler;

})(window);