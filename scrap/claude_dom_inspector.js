// Claude DOM Inspector - Diagnose user input detection issues
// Copy this script into Claude's F12 console to diagnose the UI structure

(function() {
  'use strict';
  
  const INSPECTOR_NAME = '[CLAUDE DOM INSPECTOR]';
  console.log(`${INSPECTOR_NAME} Starting Claude UI analysis...`);
  
  // Test server connection first
  function testServerConnection() {
    console.log(`${INSPECTOR_NAME} Testing server connection...`);
    
    fetch('http://localhost:8788/health', {
      method: 'GET',
      mode: 'cors'
    })
    .then(response => {
      if (response.ok) {
        console.log(`${INSPECTOR_NAME} ✅ Server connection successful`);
      } else {
        console.log(`${INSPECTOR_NAME} ❌ Server responded with error: ${response.status}`);
      }
    })
    .catch(error => {
      console.log(`${INSPECTOR_NAME} ❌ CORS/Connection error: ${error.message}`);
      console.log(`${INSPECTOR_NAME} This explains why scripts aren't working!`);
    });
  }
  
  // Analyze input elements
  function analyzeInputElements() {
    console.log(`${INSPECTOR_NAME} === INPUT ELEMENT ANALYSIS ===`);
    
    const inputSelectors = [
      'input',
      'textarea', 
      '[contenteditable="true"]',
      '[contenteditable=""]',
      '[role="textbox"]',
      'div[contenteditable]'
    ];
    
    inputSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        console.log(`${INSPECTOR_NAME} Found ${elements.length} elements matching "${selector}"`);
        elements.forEach((el, i) => {
          console.log(`${INSPECTOR_NAME}   ${i+1}. Tag: ${el.tagName}, Classes: ${el.className}, ID: ${el.id}`);
          console.log(`${INSPECTOR_NAME}      Content: "${el.textContent?.slice(0, 50) || el.value?.slice(0, 50) || 'empty'}"`);
        });
      } else {
        console.log(`${INSPECTOR_NAME} No elements found for "${selector}"`);
      }
    });
  }
  
  // Analyze send buttons
  function analyzeSendButtons() {
    console.log(`${INSPECTOR_NAME} === SEND BUTTON ANALYSIS ===`);
    
    const buttonSelectors = [
      'button',
      '[role="button"]',
      'button[aria-label*="send"]',
      'button[aria-label*="Send"]',
      'button[type="submit"]',
      'button svg',
      '[data-testid*="send"]'
    ];
    
    buttonSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        console.log(`${INSPECTOR_NAME} Found ${elements.length} buttons matching "${selector}"`);
        elements.forEach((el, i) => {
          const ariaLabel = el.getAttribute('aria-label') || '';
          const title = el.getAttribute('title') || '';
          const disabled = el.disabled ? 'DISABLED' : 'enabled';
          console.log(`${INSPECTOR_NAME}   ${i+1}. ${el.tagName}: "${ariaLabel || title || el.textContent?.slice(0, 30) || 'no text'}" [${disabled}]`);
        });
      }
    });
  }
  
  // Test event detection
  function testEventDetection() {
    console.log(`${INSPECTOR_NAME} === TESTING EVENT DETECTION ===`);
    
    // Try to find the active input element
    const activeElement = document.activeElement;
    console.log(`${INSPECTOR_NAME} Active element:`, activeElement);
    
    if (activeElement) {
      console.log(`${INSPECTOR_NAME} Active element tag: ${activeElement.tagName}`);
      console.log(`${INSPECTOR_NAME} Active element classes: ${activeElement.className}`);
      console.log(`${INSPECTOR_NAME} Active element contenteditable: ${activeElement.contentEditable}`);
      
      // Test event listeners
      console.log(`${INSPECTOR_NAME} Adding test event listeners...`);
      
      const testEvents = ['input', 'keydown', 'keyup', 'change', 'paste'];
      testEvents.forEach(eventType => {
        activeElement.addEventListener(eventType, (e) => {
          console.log(`${INSPECTOR_NAME} 🎯 ${eventType} event detected on ${e.target.tagName}`);
        });
      });
    }
    
    // Test click detection on all buttons
    document.addEventListener('click', (e) => {
      if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
        console.log(`${INSPECTOR_NAME} 🎯 Button click detected:`, e.target);
      }
    }, true);
  }
  
  // Find message containers
  function analyzeMessageContainers() {
    console.log(`${INSPECTOR_NAME} === MESSAGE CONTAINER ANALYSIS ===`);
    
    const messageSelectors = [
      '[data-message-author-role]',
      '[data-message-id]', 
      'article',
      '[role="article"]',
      '.message',
      '.chat-message',
      '[data-testid*="message"]'
    ];
    
    messageSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        console.log(`${INSPECTOR_NAME} Found ${elements.length} message containers matching "${selector}"`);
        elements.slice(-3).forEach((el, i) => {
          const role = el.getAttribute('data-message-author-role') || 'unknown';
          const content = el.textContent?.slice(0, 50) || 'empty';
          console.log(`${INSPECTOR_NAME}   Recent ${i+1}. [${role}] "${content}..."`);
        });
      }
    });
  }
  
  // Main diagnostic function
  function runDiagnostics() {
    console.log(`${INSPECTOR_NAME} 🔍 STARTING CLAUDE UI DIAGNOSTICS`);
    
    testServerConnection();
    
    setTimeout(() => {
      analyzeInputElements();
      analyzeSendButtons();
      analyzeMessageContainers();
      testEventDetection();
      
      console.log(`${INSPECTOR_NAME} === DIAGNOSTIC SUMMARY ===`);
      console.log(`${INSPECTOR_NAME} 1. Check server connection results above`);
      console.log(`${INSPECTOR_NAME} 2. Note which input/button selectors found elements`);
      console.log(`${INSPECTOR_NAME} 3. Type in Claude's input and watch for event messages`);
      console.log(`${INSPECTOR_NAME} 4. Click send button and watch for click events`);
      
    }, 1000);
  }
  
  // Expose for manual testing
  window.claudeDiagnostics = {
    runDiagnostics,
    testServerConnection,
    analyzeInputElements,
    analyzeSendButtons,
    analyzeMessageContainers,
    testEventDetection
  };
  
  // Auto-run diagnostics
  runDiagnostics();
  
})();