// Comprehensive Claude Retransmission Test Suite
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const CLAUDE_TAB_ID = '728865D285FCF956CA4732911870216D';
const WS_URL = `ws://localhost:9222/devtools/page/${CLAUDE_TAB_ID}`;

// Read the enhanced analytics logger
const analyticsScript = fs.readFileSync(
  path.join(__dirname, 'enhanced_analytics_logger.js'), 
  'utf8'
);

class ClaudeRetransmissionTestSuite {
  constructor() {
    this.ws = null;
    this.currentPhase = null;
    this.testResults = {};
    this.messageId = 1;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      console.log('🔌 Connecting to Claude tab for comprehensive testing...');
      
      this.ws = new WebSocket(WS_URL);
      
      this.ws.on('open', () => {
        console.log('✅ Connected to Claude tab');
        resolve();
      });
      
      this.ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error.message);
        reject(error);
      });
      
      this.ws.on('message', (data) => {
        this.handleMessage(JSON.parse(data));
      });
    });
  }

  handleMessage(response) {
    if (response.error) {
      console.error(`❌ Command error [${response.id}]:`, response.error);
    } else if (response.result) {
      const result = response.result.value;
      if (result && typeof result === 'string' && result !== 'undefined') {
        console.log(`📋 Command result [${response.id}]:`, result);
      }
    }
  }

  async executeCommand(expression, description) {
    const message = {
      id: this.messageId++,
      method: 'Runtime.evaluate',
      params: {
        expression: expression,
        returnByValue: true
      }
    };
    
    console.log(`⚡ ${description}`);
    this.ws.send(JSON.stringify(message));
    
    // Wait for command to process
    await this.delay(1000);
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async initializeAnalytics() {
    console.log('🔧 Initializing enhanced analytics system...');
    
    // Clear any existing loggers
    await this.executeCommand(`
      if (typeof window.claudeAnalyticsAPI !== 'undefined') {
        window.claudeAnalyticsAPI.clearAnalytics();
        console.log('Cleared existing analytics');
      }
    `, 'Clearing existing analytics');
    
    // Inject enhanced analytics logger
    await this.executeCommand(analyticsScript, 'Injecting enhanced analytics logger');
    
    // Verify analytics is working
    await this.executeCommand(`
      if (typeof window.claudeAnalyticsAPI !== 'undefined') {
        'ANALYTICS_READY';
      } else {
        'ANALYTICS_FAILED';
      }
    `, 'Verifying analytics system');
    
    await this.delay(2000);
  }

  async sendTestMessage(message, testName) {
    const sendScript = `
      (function() {
        const testMessage = "${message}";
        console.log('📝 Sending test message:', testMessage);
        
        // Find input field
        const inputSelectors = [
          'textarea[placeholder*="message"]',
          'textarea[placeholder*="Message"]',
          '[contenteditable="true"]',
          'textarea',
          '[role="textbox"]'
        ];
        
        let input = null;
        for (const selector of inputSelectors) {
          const found = document.querySelector(selector);
          if (found && found.offsetHeight > 0 && found.offsetWidth > 100) {
            input = found;
            break;
          }
        }
        
        if (!input) {
          return 'NO_INPUT_FOUND';
        }
        
        // Clear and set message
        if (input.tagName === 'TEXTAREA') {
          input.value = '';
          input.focus();
          input.value = testMessage;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
          input.innerText = '';
          input.focus();
          input.innerText = testMessage;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
        
        // Send the message
        setTimeout(() => {
          const sendSelectors = [
            'button[aria-label*="send"]',
            'button[aria-label*="Send"]',
            'button[data-testid*="send"]',
            'button[type="submit"]',
            'button:has(svg)'
          ];
          
          let sendButton = null;
          for (const selector of sendSelectors) {
            try {
              const found = document.querySelector(selector);
              if (found && found.offsetHeight > 0 && !found.disabled) {
                sendButton = found;
                break;
              }
            } catch (e) {}
          }
          
          if (sendButton) {
            console.log('🚀 Sending via button click');
            sendButton.click();
          } else {
            console.log('⌨️ Sending via Enter key');
            input.dispatchEvent(new KeyboardEvent('keydown', {
              key: 'Enter',
              keyCode: 13,
              bubbles: true
            }));
          }
        }, 500);
        
        return 'MESSAGE_SENT';
      })();
    `;
    
    await this.executeCommand(sendScript, `Sending test message: ${message}`);
  }

  async startTest(testName) {
    console.log(`\n🧪 STARTING TEST: ${testName}`);
    console.log('=' .repeat(60));
    
    await this.executeCommand(`
      if (window.claudeAnalyticsAPI) {
        window.claudeAnalyticsAPI.startTest('${testName}');
      }
    `, `Starting test: ${testName}`);
  }

  async endTest(testName) {
    await this.executeCommand(`
      if (window.claudeAnalyticsAPI) {
        window.claudeAnalyticsAPI.endTest('${testName}');
      }
    `, `Ending test: ${testName}`);
    
    console.log(`✅ COMPLETED TEST: ${testName}`);
    console.log('=' .repeat(60));
  }

  async waitForResponse(timeoutMs = 15000) {
    console.log(`⏳ Waiting for Claude response (${timeoutMs/1000}s timeout)...`);
    await this.delay(timeoutMs);
  }

  async clearLogs() {
    console.log('🧹 Clearing server logs for clean test data...');
    
    try {
      // Clear the main log files
      fs.writeFileSync('C:\\dev\\chatgpt-live-logger\\server\\chat.log', '');
      fs.writeFileSync('C:\\dev\\chatgpt-live-logger\\server\\chatverbose.log', '');
      fs.writeFileSync('C:\\dev\\chatgpt-live-logger\\server\\recent.ndjson', '');
      
      // Create/clear analytics log
      fs.writeFileSync('C:\\dev\\chatgpt-live-logger\\server\\analytics.ndjson', '');
      
      console.log('✅ Server logs cleared');
    } catch (error) {
      console.log('⚠️  Could not clear logs:', error.message);
    }
  }

  async takeScreenshot(testName) {
    console.log(`📸 Taking screenshot for test: ${testName}`);
    
    try {
      const { execSync } = require('child_process');
      execSync('powershell -ExecutionPolicy Bypass -File "C:\\dev\\chatgpt-live-logger\\debug\\tools\\take_screenshot.ps1"');
      
      // Rename screenshot with test name
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const newName = `screenshot_${testName}_${timestamp}.png`;
      
      try {
        fs.renameSync('C:\\dev\\chatgpt-live-logger\\screen_capture.png', 
                     `C:\\dev\\chatgpt-live-logger\\debug\\screenshots\\${newName}`);
        console.log(`✅ Screenshot saved: ${newName}`);
      } catch (e) {
        // Directory might not exist, just note it
        console.log('📸 Screenshot taken (could not move to debug folder)');
      }
    } catch (error) {
      console.log('⚠️  Could not take screenshot:', error.message);
    }
  }

  // PHASE 1: Baseline Behavior Tests
  async runPhase1BaselineTests() {
    console.log('\n🎯 PHASE 1: BASELINE BEHAVIOR ANALYSIS');
    console.log('Testing basic conversation patterns to establish baseline');
    
    this.currentPhase = 'phase1';
    
    // Test 1: Fresh conversation start
    await this.startTest('baseline_fresh_start');
    await this.sendTestMessage('test1_fresh_start, respond ok1_fresh', 'baseline_fresh_start');
    await this.waitForResponse(10000);
    await this.takeScreenshot('baseline_fresh_start');
    await this.endTest('baseline_fresh_start');
    
    await this.delay(3000); // Pause between tests
    
    // Test 2: Immediate follow-up  
    await this.startTest('baseline_immediate_followup');
    await this.sendTestMessage('test2_immediate, respond ok2_immediate', 'baseline_immediate_followup');
    await this.waitForResponse(10000);
    await this.takeScreenshot('baseline_immediate_followup');
    await this.endTest('baseline_immediate_followup');
    
    await this.delay(3000);
    
    // Test 3: Sequential conversation
    await this.startTest('baseline_sequential_conversation');
    
    for (let i = 3; i <= 7; i++) {
      await this.sendTestMessage(`test${i}_seq, respond ok${i}_seq`, `baseline_sequential_${i}`);
      await this.waitForResponse(8000);
      await this.delay(2000); // Short pause between sequential messages
    }
    
    await this.takeScreenshot('baseline_sequential_conversation');
    await this.endTest('baseline_sequential_conversation');
    
    console.log('✅ PHASE 1 COMPLETE: Baseline behavior established');
  }

  // PHASE 2: Retransmission Trigger Tests  
  async runPhase2TriggerTests() {
    console.log('\n🎯 PHASE 2: RETRANSMISSION TRIGGER ANALYSIS');
    console.log('Testing scenarios that might trigger retransmissions');
    
    this.currentPhase = 'phase2';
    
    // Test 4: Page reload scenario (we'll simulate by refreshing analytics)
    await this.startTest('trigger_analytics_reset');
    
    // Reset analytics to simulate page state change
    await this.executeCommand(`
      if (window.claudeAnalyticsAPI) {
        window.claudeAnalyticsAPI.clearAnalytics();
        console.log('Analytics reset to simulate page reload effect');
      }
    `, 'Simulating page state reset');
    
    await this.delay(2000);
    await this.sendTestMessage('test_after_reset, respond ok_reset', 'trigger_analytics_reset');
    await this.waitForResponse(10000);
    await this.takeScreenshot('trigger_analytics_reset');
    await this.endTest('trigger_analytics_reset');
    
    await this.delay(5000); // Longer pause
    
    // Test 5: Long delay pattern
    await this.startTest('trigger_long_delay');
    console.log('⏰ Testing long delay scenario (30 second wait)...');
    await this.delay(30000); // 30 second delay
    
    await this.sendTestMessage('test_after_delay, respond ok_delay', 'trigger_long_delay');
    await this.waitForResponse(10000);
    await this.takeScreenshot('trigger_long_delay');
    await this.endTest('trigger_long_delay');
    
    await this.delay(3000);
    
    // Test 6: Rapid succession messages
    await this.startTest('trigger_rapid_succession');
    
    // Send 3 messages rapidly
    await this.sendTestMessage('rapid1, respond ok_rapid1', 'rapid1');
    await this.delay(1000);
    await this.sendTestMessage('rapid2, respond ok_rapid2', 'rapid2');  
    await this.delay(1000);
    await this.sendTestMessage('rapid3, respond ok_rapid3', 'rapid3');
    await this.waitForResponse(15000); // Longer wait for multiple responses
    
    await this.takeScreenshot('trigger_rapid_succession');
    await this.endTest('trigger_rapid_succession');
    
    console.log('✅ PHASE 2 COMPLETE: Trigger scenarios tested');
  }

  // PHASE 3: Content Pattern Tests
  async runPhase3ContentTests() {
    console.log('\n🎯 PHASE 3: CONTENT PATTERN ANALYSIS');
    console.log('Testing how different content types affect retransmission');
    
    this.currentPhase = 'phase3';
    
    // Test 7: Repeated content by user (ChurnRoom scenario)
    await this.startTest('content_repeated_commands');
    
    // Send same command multiple times (like ChurnRoom would)
    await this.sendTestMessage('PLAY: test.mp4, respond play_ok1', 'content_repeated_1');
    await this.waitForResponse(8000);
    await this.delay(2000);
    
    await this.sendTestMessage('PLAY: test.mp4, respond play_ok2', 'content_repeated_2');
    await this.waitForResponse(8000);
    await this.delay(2000);
    
    await this.sendTestMessage('PLAY: test.mp4, respond play_ok3', 'content_repeated_3');
    await this.waitForResponse(8000);
    
    await this.takeScreenshot('content_repeated_commands');
    await this.endTest('content_repeated_commands');
    
    await this.delay(3000);
    
    // Test 8: Long message pattern
    await this.startTest('content_long_message');
    
    const longMessage = 'This is a very long test message designed to test how Claude handles lengthy content that might trigger different retransmission patterns. '.repeat(5) + 'Please respond with ok_long_message.';
    
    await this.sendTestMessage(longMessage, 'content_long_message');
    await this.waitForResponse(10000);
    await this.takeScreenshot('content_long_message');
    await this.endTest('content_long_message');
    
    await this.delay(3000);
    
    // Test 9: Mixed command patterns (ChurnRoom simulation)
    await this.startTest('content_mixed_commands');
    
    await this.sendTestMessage('PLAY: song1.mp3, respond play1_ok', 'mixed_1');
    await this.waitForResponse(8000);
    await this.delay(1000);
    
    await this.sendTestMessage('VOLUME: 75, respond vol_ok', 'mixed_2');
    await this.waitForResponse(8000);
    await this.delay(1000);
    
    await this.sendTestMessage('SEQUENCE: song1, song2, respond seq_ok', 'mixed_3');
    await this.waitForResponse(8000);
    
    await this.takeScreenshot('content_mixed_commands');
    await this.endTest('content_mixed_commands');
    
    console.log('✅ PHASE 3 COMPLETE: Content patterns analyzed');
  }

  async generateReport() {
    console.log('\n📊 GENERATING COMPREHENSIVE ANALYSIS REPORT...');
    
    // Get analytics data from browser
    await this.executeCommand(`
      if (window.claudeAnalyticsAPI) {
        const analytics = window.claudeAnalyticsAPI.exportAnalytics();
        console.log('=== ANALYTICS SUMMARY ===');
        console.log('Total Transmissions:', analytics.summary.totalTransmissions);
        console.log('Total Duplicates:', analytics.summary.totalDuplicates); 
        console.log('Total Tests:', analytics.summary.totalTests);
        console.log('Session Duration:', (analytics.summary.sessionDuration / 1000).toFixed(1), 'seconds');
        
        // Save analytics to file
        JSON.stringify(analytics);
      } else {
        'NO_ANALYTICS';
      }
    `, 'Extracting analytics data');
    
    await this.delay(2000);
  }

  async runFullTestSuite() {
    try {
      console.log('🚀 STARTING COMPREHENSIVE CLAUDE RETRANSMISSION ANALYSIS');
      console.log('=' .repeat(80));
      
      await this.connect();
      await this.clearLogs();
      await this.initializeAnalytics();
      
      // Run all test phases
      await this.runPhase1BaselineTests();
      await this.runPhase2TriggerTests(); 
      await this.runPhase3ContentTests();
      
      await this.generateReport();
      
      console.log('\n🎉 COMPREHENSIVE ANALYSIS COMPLETE!');
      console.log('📋 Check server analytics.ndjson for detailed transmission data');
      console.log('📸 Screenshots saved for visual verification');
      
    } catch (error) {
      console.error('❌ Test suite failed:', error.message);
    } finally {
      if (this.ws) {
        this.ws.close();
      }
    }
  }
}

// Run the test suite
const testSuite = new ClaudeRetransmissionTestSuite();
testSuite.runFullTestSuite();