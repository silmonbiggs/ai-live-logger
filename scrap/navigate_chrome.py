#!/usr/bin/env python3
"""
Navigate Chrome to Claude and inject solution
"""

import requests
import json
import time
import websocket
from pathlib import Path

def navigate_to_claude_and_inject():
    try:
        # Get tabs
        response = requests.get('http://localhost:9222/json')
        tabs = response.json()
        
        # Use first available tab
        if not tabs:
            print("ERROR: No tabs available")
            return False
            
        tab = tabs[0]
        print(f"Using tab: {tab.get('title', 'Unknown')}")
        
        # Connect to tab
        ws_url = tab['webSocketDebuggerUrl']
        print(f"Connecting to: {ws_url}")
        
        ws = websocket.create_connection(ws_url)
        print("SUCCESS: Connected to Chrome DevTools")
        
        # Enable domains
        ws.send(json.dumps({"id": 1, "method": "Runtime.enable", "params": {}}))
        ws.recv()
        
        ws.send(json.dumps({"id": 2, "method": "Page.enable", "params": {}}))
        ws.recv()
        
        # Navigate to Claude
        claude_url = "https://claude.ai/chat/0492e8a7-a349-4261-939e-530061d55bef"
        ws.send(json.dumps({"id": 3, "method": "Page.navigate", "params": {"url": claude_url}}))
        result = json.loads(ws.recv())
        
        if result.get("error"):
            print(f"ERROR: Navigation failed: {result['error']}")
            return False
            
        print("SUCCESS: Navigated to Claude")
        time.sleep(5)  # Wait for page load
        
        # Load and inject complete solution
        solution_path = Path("C:/dev/chatgpt-live-logger/complete_solution_logger.js")
        if not solution_path.exists():
            print(f"ERROR: Complete solution not found")
            return False
            
        solution_code = solution_path.read_text(encoding='utf-8')
        print(f"Loaded {len(solution_code)} characters of solution code")
        
        # Inject the code
        ws.send(json.dumps({
            "id": 4, 
            "method": "Runtime.evaluate", 
            "params": {
                "expression": solution_code,
                "includeCommandLineAPI": True
            }
        }))
        
        result = json.loads(ws.recv())
        
        if result.get("error"):
            print(f"ERROR: Injection failed: {result['error']}")
            return False
            
        if result.get("result", {}).get("exceptionDetails"):
            exception = result["result"]["exceptionDetails"]
            print(f"ERROR: JavaScript exception: {exception}")
            return False
            
        print("SUCCESS: Complete solution injected!")
        
        # Test by sending a message
        print("Testing by sending testmessage143...")
        
        # Send first test message
        send_message_script = '''
        (function() {
            const textarea = document.querySelector('textarea, [contenteditable="true"]');
            if (textarea) {
                const message = "testmessage143, respond okay143";
                textarea.value = message;
                textarea.textContent = message;
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
                
                // Find send button and click
                setTimeout(() => {
                    const sendBtn = document.querySelector('button[type="submit"], button:has(svg)');
                    if (sendBtn) {
                        sendBtn.click();
                        console.log("SENT: First testmessage143");
                    }
                }, 100);
                
                // Send second identical message after delay
                setTimeout(() => {
                    textarea.value = message;
                    textarea.textContent = message;
                    textarea.dispatchEvent(new Event('input', { bubbles: true }));
                    
                    setTimeout(() => {
                        const sendBtn2 = document.querySelector('button[type="submit"], button:has(svg)');
                        if (sendBtn2) {
                            sendBtn2.click();
                            console.log("SENT: Second testmessage143 (should now be logged!)");
                        }
                    }, 100);
                }, 15000);
                
                return "Messages will be sent automatically";
            }
            return "No textarea found";
        })();
        '''
        
        ws.send(json.dumps({
            "id": 5,
            "method": "Runtime.evaluate",
            "params": {"expression": send_message_script}
        }))
        
        result = json.loads(ws.recv())
        print(f"Message sending result: {result.get('result', {}).get('value')}")
        
        print("\nSUCCESS: Test initiated!")
        print("Both testmessage143 exchanges should now appear in chat.log")
        print("Check for '[ENHANCED USER DETECTION]' messages in console")
        
        ws.close()
        return True
        
    except Exception as e:
        print(f"ERROR: {e}")
        return False

if __name__ == "__main__":
    navigate_to_claude_and_inject()