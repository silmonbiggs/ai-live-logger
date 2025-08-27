// Selenium automation for testing Claude logger extension
// This will finally let us interact with Claude programmatically!

const { Builder, By, until, Key } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const fs = require('fs');
const path = require('path');

class ClaudeTestAutomation {
    constructor() {
        this.driver = null;
        this.extensionPath = path.resolve(__dirname, '..', '..', 'extension');
        this.logPath = path.resolve(__dirname, '..', '..', 'server', 'chat.log');
        this.testCounter = 50; // Start from 50 to avoid conflicts with previous tests
    }

    async setup() {
        console.log('🚀 Setting up Chrome with extension...');
        
        // Chrome options with our extension loaded
        let options = new chrome.Options();
        options.addArguments(`--load-extension=${this.extensionPath}`);
        options.addArguments('--disable-web-security');
        options.addArguments('--allow-running-insecure-content');
        options.addArguments('--disable-blink-features=AutomationControlled');
        options.addArguments('--no-sandbox');
        options.addArguments('--disable-dev-shm-usage');
        options.addArguments('--disable-gpu');
        options.addArguments('--headless=false'); // Keep visible for debugging
        options.setUserPreferences({
            'profile.default_content_setting_values.notifications': 2
        });

        this.driver = await new Builder()
            .forBrowser('chrome')
            .setChromeOptions(options)
            .build();

        console.log('✅ Chrome started with extension loaded');
    }

    async navigateToClaude() {
        console.log('🌐 Navigating to Claude...');
        await this.driver.get('https://claude.ai');
        
        // Wait for page to load
        await this.driver.sleep(3000);
        console.log('✅ Claude loaded');
    }

    async findChatInput() {
        console.log('🔍 Looking for chat input...');
        
        const selectors = [
            'textarea[placeholder*="message"]',
            'textarea[placeholder*="Message"]', 
            'div[contenteditable="true"][role="textbox"]',
            'textarea[data-testid*="input"]',
            'textarea'
        ];

        for (const selector of selectors) {
            try {
                const element = await this.driver.findElement(By.css(selector));
                if (await element.isDisplayed()) {
                    console.log(`✅ Found input with selector: ${selector}`);
                    return element;
                }
            } catch (e) {
                // Try next selector
                continue;
            }
        }
        
        throw new Error('❌ Could not find chat input field');
    }

    async findSendButton() {
        console.log('🔍 Looking for send button...');
        
        const selectors = [
            'button[aria-label*="send"]',
            'button[data-testid*="send"]',
            'button[type="submit"]',
            'button svg[class*="send"]',
            'button:has(svg)'
        ];

        for (const selector of selectors) {
            try {
                const elements = await this.driver.findElements(By.css(selector));
                for (const element of elements) {
                    if (await element.isDisplayed()) {
                        console.log(`✅ Found send button with selector: ${selector}`);
                        return element;
                    }
                }
            } catch (e) {
                continue;
            }
        }
        
        // Fallback: try Enter key
        console.log('⚠️ Send button not found, will use Enter key');
        return null;
    }

    async sendMessage(message) {
        console.log(`📤 Sending message: "${message}"`);
        
        const input = await this.findChatInput();
        
        // Clear any existing content
        await input.clear();
        
        // Type the message
        await input.sendKeys(message);
        
        // Try to find and click send button
        const sendButton = await this.findSendButton();
        if (sendButton) {
            await sendButton.click();
        } else {
            // Use Enter key as fallback
            await input.sendKeys(Key.RETURN);
        }
        
        console.log('✅ Message sent');
        
        // Wait a moment for processing
        await this.driver.sleep(1000);
    }

    async waitForResponse(expectedText, timeoutMs = 15000) {
        console.log(`⏳ Waiting for response containing: "${expectedText}"`);
        
        try {
            // Wait for the expected text to appear anywhere on the page
            await this.driver.wait(
                until.elementLocated(By.xpath(`//*[contains(text(),'${expectedText}')]`)),
                timeoutMs
            );
            console.log('✅ Response received');
            return true;
        } catch (e) {
            console.log('⚠️ Response timeout or not found');
            return false;
        }
    }

    readChatLog() {
        try {
            const logContent = fs.readFileSync(this.logPath, 'utf8');
            if (logContent.trim() === '[]' || logContent.trim() === '') {
                return [];
            }
            
            // Parse NDJSON format
            const lines = logContent.trim().split('\n');
            return lines.map(line => {
                try {
                    return JSON.parse(line);
                } catch (e) {
                    return null;
                }
            }).filter(item => item !== null);
        } catch (e) {
            console.log('⚠️ Could not read chat.log:', e.message);
            return [];
        }
    }

    analyzeDuplicates(messages) {
        const contentCounts = {};
        const duplicates = [];
        
        messages.forEach((msg, index) => {
            const content = msg.content;
            if (contentCounts[content]) {
                contentCounts[content].push(index);
                if (contentCounts[content].length === 2) {
                    duplicates.push(content);
                }
            } else {
                contentCounts[content] = [index];
            }
        });
        
        return { contentCounts, duplicates };
    }

    async runTest(testMessage, expectedResponse) {
        console.log(`\n🧪 Running test: ${testMessage} -> ${expectedResponse}`);
        
        // Record initial log state
        const initialMessages = this.readChatLog();
        const initialCount = initialMessages.length;
        
        // Send test message
        await this.sendMessage(testMessage);
        
        // Wait for Claude to respond
        const responseReceived = await this.waitForResponse(expectedResponse);
        
        if (!responseReceived) {
            console.log('❌ Test failed - no response received');
            return false;
        }
        
        // Wait for extension to process
        await this.driver.sleep(3000);
        
        // Check log for results
        const finalMessages = this.readChatLog();
        const newMessages = finalMessages.slice(initialCount);
        
        console.log(`📊 Log analysis:`);
        console.log(`   Initial messages: ${initialCount}`);
        console.log(`   New messages: ${newMessages.length}`);
        
        const { duplicates } = this.analyzeDuplicates(newMessages);
        
        if (duplicates.length > 0) {
            console.log(`❌ Found ${duplicates.length} duplicate messages:`);
            duplicates.forEach(dup => console.log(`   - "${dup}"`));
            return false;
        } else {
            console.log('✅ No duplicates found!');
            return true;
        }
    }

    async runFullTestSuite() {
        console.log('\n🎯 Starting comprehensive test suite...');
        
        const tests = [
            [`testmessage${this.testCounter}, respond okay${this.testCounter}`, `okay${this.testCounter}`],
            [`testmessage${this.testCounter + 1}, respond okay${this.testCounter + 1}`, `okay${this.testCounter + 1}`],
            [`testmessage${this.testCounter + 2}, respond okay${this.testCounter + 2}`, `okay${this.testCounter + 2}`]
        ];
        
        let passedTests = 0;
        
        for (const [message, expected] of tests) {
            const result = await this.runTest(message, expected);
            if (result) {
                passedTests++;
            }
            
            // Wait between tests
            await this.driver.sleep(2000);
        }
        
        console.log(`\n📊 Test Results: ${passedTests}/${tests.length} tests passed`);
        
        if (passedTests === tests.length) {
            console.log('🎉 All tests passed! Duplicate detection is working!');
        } else {
            console.log('⚠️ Some tests failed. Duplicate detection needs work.');
        }
        
        return passedTests === tests.length;
    }

    async takeScreenshot(filename) {
        try {
            const screenshot = await this.driver.takeScreenshot();
            fs.writeFileSync(filename, screenshot, 'base64');
            console.log(`📸 Screenshot saved: ${filename}`);
        } catch (e) {
            console.log('⚠️ Could not take screenshot:', e.message);
        }
    }

    async cleanup() {
        if (this.driver) {
            await this.driver.quit();
            console.log('🧹 Browser closed');
        }
    }
}

// Main execution
async function main() {
    const tester = new ClaudeTestAutomation();
    
    try {
        await tester.setup();
        await tester.navigateToClaude();
        
        // Take initial screenshot
        await tester.takeScreenshot('claude-loaded.png');
        
        // Wait for manual login if needed
        console.log('\n⚠️  If you need to log in to Claude, please do so now...');
        console.log('Press Enter when ready to continue...');
        
        // Wait for user input (if needed)
        // For now, let's assume we're logged in
        await tester.driver.sleep(5000);
        
        // Run the test suite
        const success = await tester.runFullTestSuite();
        
        // Take final screenshot
        await tester.takeScreenshot('test-complete.png');
        
        if (success) {
            console.log('\n🎉 SUCCESS: Automated testing is working! No more manual testing needed!');
        } else {
            console.log('\n🔧 Some issues found - but now we can debug them systematically!');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        await tester.takeScreenshot('error-screenshot.png');
    } finally {
        await tester.cleanup();
    }
}

// Export for use as module
module.exports = ClaudeTestAutomation;

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}