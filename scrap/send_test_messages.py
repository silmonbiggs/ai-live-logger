#!/usr/bin/env python3
"""
Send test messages to verify the duplicate logging fix
"""

import requests
import json
import time
import websocket

def send_test_messages():
    try:
        # Get tabs
        response = requests.get('http://localhost:9222/json')
        tabs = response.json()
        
        # Find Claude tab
        claude_tab = None
        for tab in tabs:
            if 'claude.ai' in tab.get('url', ''):
                claude_tab = tab
                break
                
        if not claude_tab:
            print("ERROR: No Claude tab found")
            return False
            
        # Connect to tab
        ws_url = claude_tab['webSocketDebuggerUrl']
        ws = websocket.create_connection(ws_url)
        print("Connected to Claude tab")
        
        # Enable runtime
        ws.send(json.dumps({"id": 1, "method": "Runtime.enable", "params": {}}))
        ws.recv()
        
        # Send first testmessage143
        print("Sending first testmessage143...")
        send_script = '''
        (function() {
            // Find send button and click it to send the message already in the input
            const sendBtn = document.querySelector('button[type="submit"], button[aria-label*="Send"], button:has([data-icon="send"])');
            if (sendBtn && !sendBtn.disabled) {
                sendBtn.click();
                console.log("FIRST MESSAGE SENT: testmessage143");
                return "First message sent";
            }
            return "Send button not found or disabled";
        })();
        '''
        
        ws.send(json.dumps({
            "id": 2,
            "method": "Runtime.evaluate",
            "params": {"expression": send_script}
        }))
        
        result = json.loads(ws.recv())
        print(f"First send result: {result.get('result', {}).get('value')}")
        
        # Wait for response
        print("Waiting 10 seconds for response...")
        time.sleep(10)
        
        # Send second identical message
        print("Sending second identical testmessage143...")
        second_send_script = '''
        (function() {
            const textarea = document.querySelector('textarea, [contenteditable="true"]');
            if (textarea) {
                const message = "testmessage143, respond okay143";
                textarea.value = message;
                textarea.textContent = message;
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
                
                // Wait a moment then click send
                setTimeout(() => {
                    const sendBtn = document.querySelector('button[type="submit"], button[aria-label*="Send"], button:has([data-icon="send"])');
                    if (sendBtn && !sendBtn.disabled) {
                        sendBtn.click();
                        console.log("SECOND MESSAGE SENT: testmessage143 (DUPLICATE TEST)");
                        return true;
                    }
                    return false;
                }, 500);
                
                return "Second message queued";
            }
            return "No textarea found";
        })();
        '''
        
        ws.send(json.dumps({
            "id": 3,
            "method": "Runtime.evaluate",
            "params": {"expression": second_send_script}
        }))
        
        result = json.loads(ws.recv())
        print(f"Second send result: {result.get('result', {}).get('value')}")
        
        print("\nBOTH MESSAGES SENT!")
        print("Now checking if the complete solution fixed the duplicate logging bug...")
        print("Both testmessage143 exchanges should appear in chat.log")
        
        ws.close()
        return True
        
    except Exception as e:
        print(f"ERROR: {e}")
        return False

if __name__ == "__main__":
    send_test_messages()