#!/usr/bin/env python3
"""
Check what's actually running in the Chrome console
"""

import requests
import json
import websocket

def check_injection():
    try:
        response = requests.get('http://localhost:9222/json')
        tabs = response.json()
        
        claude_tab = None
        for tab in tabs:
            if 'claude.ai' in tab.get('url', ''):
                claude_tab = tab
                break
                
        if not claude_tab:
            print("No Claude tab found")
            return
            
        ws = websocket.create_connection(claude_tab['webSocketDebuggerUrl'])
        ws.send(json.dumps({"id": 1, "method": "Runtime.enable", "params": {}}))
        ws.recv()
        
        # Check what's actually running
        check_script = '''
        console.log("=== CHECKING INJECTION STATUS ===");
        console.log("window.signalProcessingLogger:", typeof window.signalProcessingLogger);
        console.log("window.enhancedUserDetection:", typeof window.enhancedUserDetection);
        console.log("window.genuineUserInputs:", typeof window.genuineUserInputs);
        
        if (window.signalProcessingLogger) {
            console.log("Signal processing logger state:", window.signalProcessingLogger.getState());
        }
        
        if (window.enhancedUserDetection) {
            console.log("Enhanced user detection stats:", window.enhancedUserDetection.getStats());
        }
        
        // Check if we have the enhanced logger
        const loggers = document.querySelectorAll('*');
        let found = false;
        for (let el of loggers) {
            if (el.textContent && el.textContent.includes('ENHANCED USER DETECTION')) {
                found = true;
                break;
            }
        }
        console.log("Enhanced detection found in DOM:", found);
        
        "Injection check complete";
        '''
        
        ws.send(json.dumps({
            "id": 2,
            "method": "Runtime.evaluate",
            "params": {"expression": check_script}
        }))
        
        result = json.loads(ws.recv())
        print(f"Check result: {result}")
        
        ws.close()
        
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    check_injection()