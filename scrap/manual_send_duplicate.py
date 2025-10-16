#!/usr/bin/env python3
"""
Manually send a duplicate testmessage143 to definitively test the fix
"""

import requests
import json
import time
import websocket

def manual_duplicate_test():
    try:
        response = requests.get('http://localhost:9222/json')
        tabs = response.json()
        
        claude_tab = None
        for tab in tabs:
            if 'claude.ai' in tab.get('url', ''):
                claude_tab = tab
                break
                
        if not claude_tab:
            print("ERROR: No Claude tab found")
            return False
            
        ws = websocket.create_connection(claude_tab['webSocketDebuggerUrl'])
        ws.send(json.dumps({"id": 1, "method": "Runtime.enable", "params": {}}))
        ws.recv()
        
        print("SENDING DUPLICATE testmessage143 to test the fix...")
        
        duplicate_script = '''
        (function() {
            console.log("🧪 TESTING DUPLICATE MESSAGE FIX");
            
            // Clear and type the duplicate message
            const textarea = document.querySelector('textarea[placeholder*="Message"], [contenteditable="true"]');
            if (textarea) {
                // Clear first
                textarea.value = "";
                textarea.textContent = "";
                
                // Type the exact same message
                const duplicateMessage = "testmessage143, respond okay143";
                textarea.value = duplicateMessage;
                textarea.textContent = duplicateMessage;
                
                // Trigger events
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
                textarea.dispatchEvent(new Event('change', { bubbles: true }));
                
                console.log("✅ Duplicate message typed: " + duplicateMessage);
                
                // Find and click send button
                setTimeout(() => {
                    const sendBtn = document.querySelector('button[type="submit"], button[aria-label*="Send"]');
                    if (sendBtn && !sendBtn.disabled) {
                        sendBtn.click();
                        console.log("🚀 DUPLICATE MESSAGE SENT! This should now be logged (BUG FIX TEST)");
                        return true;
                    } else {
                        console.log("❌ Send button not available");
                        return false;
                    }
                }, 200);
                
                return "Duplicate message queued";
            } else {
                console.log("❌ No textarea found");
                return "No textarea";
            }
        })();
        '''
        
        ws.send(json.dumps({
            "id": 2,
            "method": "Runtime.evaluate",
            "params": {"expression": duplicate_script}
        }))
        
        result = json.loads(ws.recv())
        print(f"Duplicate send result: {result.get('result', {}).get('value')}")
        
        print("\n🎯 DUPLICATE TEST COMPLETE!")
        print("If the bug is fixed, this second testmessage143 should appear in chat.log")
        print("Check console for '[ENHANCED USER DETECTION]' messages")
        
        ws.close()
        return True
        
    except Exception as e:
        print(f"ERROR: {e}")
        return False

if __name__ == "__main__":
    manual_duplicate_test()