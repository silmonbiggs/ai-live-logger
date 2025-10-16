// common.js - Shared utilities for ChatGPT Live Logger
// This module provides utilities used by both ChatGPT and Claude handlers

(function(window) {
  'use strict';

  const Common = {
    // Normalize text content - removes zero-width spaces, normalizes whitespace
    normText: function(s) {
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
    },

    // Extract URLs from DOM nodes (includes all links)
    extractUrlsFromNode: function(node) {
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
    },

    // Extract URLs only from text content (not DOM links)
    extractUrlsFromText: function(text) {
      const urls = [];
      const urlMatches = text.match(/https?:\/\/[^\s]+/g);
      if (urlMatches) {
        urlMatches.forEach(url => {
          // Clean up potential trailing punctuation
          const cleanUrl = url.replace(/[.,;!?)]+$/, '');

          // Filter out ChatGPT navigation/UI URLs
          if (!this.isChatGPTNavigationUrl(cleanUrl) && !urls.includes(cleanUrl)) {
            urls.push(cleanUrl);
          }
        });
      }
      return urls;
    },

    // Check if URL is ChatGPT navigation/UI (not content)
    isChatGPTNavigationUrl: function(url) {
      const chatgptNavPatterns = [
        /^https:\/\/chatgpt\.com\/c\/[a-f0-9-]+$/,           // Conversation links
        /^https:\/\/chatgpt\.com\/(library|gpts|codex)$/,   // Navigation sections
        /^https:\/\/chatgpt\.com\/g\/g-[a-zA-Z0-9-]+/,      // GPT links
        /^https:\/\/chatgpt\.com\/(#main)?$/,               // Home/main page
        /^https:\/\/sora\.chatgpt\.com/                     // Sora links
      ];

      return chatgptNavPatterns.some(pattern => pattern.test(url));
    },

    // Get conversation ID from URL
    convoIdFromUrl: function(platform) {
      try {
        const u = new URL(window.location.href);
        const parts = u.pathname.split("/").filter(Boolean);

        if (platform === 'chatgpt') {
          const cindex = parts.indexOf("c");
          if (cindex >= 0 && parts[cindex + 1]) return parts[cindex + 1];
          return parts.join("/") || u.pathname || "no-convo";
        } else if (platform === 'claude') {
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
    },

    // Detect platform from hostname
    detectPlatform: function() {
      const hostname = window.location.hostname;
      if (hostname.includes('claude.ai')) return 'claude';
      if (hostname.includes('chatgpt.com') || hostname.includes('chat.openai.com')) return 'chatgpt';
      return 'unknown';
    },

    // Tool usage detection for both platforms
    detectToolUsage: function(text, platform) {
      const tools = [];

      const toolPatterns = [
        /(?:used|using|calling)\s+(\w+)\s+tool/i,
        /\[Tool:\s*(\w+)\]/i,
        /```(\w+)\s*\n/i, // Code blocks
        /\*\*Tool Used:\*\*\s*(\w+)/i,
        /tool_calls?["']?:\s*["']?(\w+)/i
      ];

      // Platform-specific patterns
      if (platform === 'claude') {
        toolPatterns.push(
          /thinking/i,
          /computer_use/i,
          /bash/i,
          /python/i,
          /code_execution/i
        );
      } else if (platform === 'chatgpt') {
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
    },

    // Claude-specific artifact detection
    captureClaudeArtifacts: function(node) {
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
    },

    // Check if streaming is complete
    isStreamingComplete: function(node) {
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
    },

    // Send message to background script
    sendToBackground: function(payload, loggerName) {
      console.log(`${loggerName} attempting to send:`, payload.role, payload.text?.slice(0, 100));

      try {
        chrome.runtime.sendMessage({ type: "LOG", payload }, (response) => {
          if (chrome.runtime.lastError) {
            console.error(`${loggerName} send error:`, chrome.runtime.lastError.message);

            // If extension context is invalidated, suggest page reload
            if (chrome.runtime.lastError.message.includes('context invalidated') ||
                chrome.runtime.lastError.message.includes('Extension context')) {
              console.error(`${loggerName} Extension context invalidated - please reload this page`);

              // Try to reconnect by reloading the content script
              setTimeout(() => {
                console.log(`${loggerName} Attempting to reinitialize...`);
                location.reload();
              }, 2000);
            }
          } else if (response?.ok) {
            console.log(`${loggerName} sent successfully:`, payload.role);
          } else {
            console.error(`${loggerName} server error:`, response?.error);
          }
        });
      } catch (e) {
        console.error(`${loggerName} exception:`, e.message);

        // If we can't even call chrome.runtime.sendMessage, the context is definitely broken
        if (e.message.includes('Extension context')) {
          console.error(`${loggerName} Extension context broken - reloading page in 2 seconds`);
          setTimeout(() => location.reload(), 2000);
        }
      }
    },

    // Create standardized message payload
    createMessagePayload: function(platform, role, text, metadata = {}) {
      return {
        id: `${platform}-${role}-${Date.now()}`,
        ts: new Date().toISOString(),
        platform: platform,
        convo: this.convoIdFromUrl(platform),
        role: role,
        text: text,
        urls: this.extractUrlsFromText(text), // Extract URLs only from message text, not DOM
        metadata: {
          artifacts: metadata.artifacts || [],
          tools: metadata.tools || this.detectToolUsage(text, platform),
          streaming: metadata.streaming || false,
          messageLength: text.length,
          ...metadata
        }
      };
    },

    // Debounce utility for batching rapid updates
    debounce: function(func, wait) {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    }
  };

  // Expose Common utilities globally
  window.ChatGPTLoggerCommon = Common;

})(window);