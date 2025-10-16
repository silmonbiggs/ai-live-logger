// JavaScript to inject into Claude's browser console for testing
// This simulates the extension sending test messages to the logging server

console.log("🧪 Starting Claude Test Message Injection...");

// Simulate sending a test message to the logging server
async function sendTestMessage(messageNum) {
  const paddedNum = messageNum.toString().padStart(2, '0');
  const testMessage = `testmessage ${paddedNum}, respond okay ${paddedNum}`;
  
  console.log(`📤 Sending test user message: "${testMessage}"`);
  
  try {
    // Simulate user message
    const userPayload = {
      type: "LOG",
      payload: {
        id: `claude-user-test-${Date.now()}`,
        ts: new Date().toISOString(),
        platform: "claude",
        convo: "test-conversation",
        role: "user",
        text: testMessage,
        urls: [],
        metadata: {
          artifacts: [],
          tools: [],
          streaming: false,
          messageLength: testMessage.length
        }
      }
    };
    
    // Send user message via fetch (simulating extension background script)
    const userResponse = await fetch('http://127.0.0.1:8788/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userPayload.payload)
    });
    
    if (userResponse.ok) {
      console.log(`✅ User message ${paddedNum} logged successfully`);
    } else {
      console.error(`❌ Failed to log user message ${paddedNum}`);
    }
    
    // Wait a bit, then simulate Claude's response
    setTimeout(async () => {
      const responseText = `okay${paddedNum}`;
      console.log(`📤 Sending test assistant response: "${responseText}"`);
      
      const assistantPayload = {
        type: "LOG",
        payload: {
          id: `claude-assistant-test-${Date.now()}`,
          ts: new Date().toISOString(),
          platform: "claude",
          convo: "test-conversation",
          role: "assistant", 
          text: responseText,
          urls: [],
          metadata: {
            artifacts: [],
            tools: [],
            streaming: false,
            messageLength: responseText.length
          }
        }
      };
      
      const assistantResponse = await fetch('http://127.0.0.1:8788/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assistantPayload.payload)
      });
      
      if (assistantResponse.ok) {
        console.log(`✅ Assistant response ${paddedNum} logged successfully`);
      } else {
        console.error(`❌ Failed to log assistant response ${paddedNum}`);
      }
    }, 1000);
    
  } catch (error) {
    console.error(`❌ Error sending test message ${paddedNum}:`, error);
  }
}

// Send a sequence of test messages
async function sendTestSequence() {
  console.log("🚀 Starting test message sequence...");
  
  for (let i = 40; i <= 44; i++) {
    await sendTestMessage(i);
    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds between messages
  }
  
  console.log("✅ Test sequence complete!");
}

// Run the test
sendTestSequence();