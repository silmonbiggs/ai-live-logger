#!/usr/bin/env python3
"""
Simple Chrome Debug Controller - ASCII only version
"""

import requests
import json
import time
import websocket
from pathlib import Path

class ChromeController:
    def __init__(self):
        self.debug_port = 9222
        self.ws = None
        self.message_id = 1
        
    def get_tabs(self):
        try:
            response = requests.get(f'http://localhost:{self.debug_port}/json')
            return response.json()
        except Exception as e:
            print(f"ERROR: Failed to get tabs: {e}")
            return []
    
    def find_claude_tab(self):
        tabs = self.get_tabs()
        for tab in tabs:
            if 'claude.ai' in tab.get('url', ''):
                print(f"SUCCESS: Found Claude tab")
                return tab
        print("No Claude tab found")
        return None
    
    def connect_to_tab(self, tab):
        ws_url = tab['webSocketDebuggerUrl']
        print(f"Connecting to: {ws_url}")
        
        try:
            self.ws = websocket.create_connection(ws_url)
            print("SUCCESS: Connected to Chrome DevTools")
            return True
        except Exception as e:
            print(f"ERROR: Failed to connect: {e}")
            return False
    
    def send_command(self, method, params=None):
        if not self.ws:
            return None
            
        command = {
            "id": self.message_id,
            "method": method,
            "params": params or {}
        }
        
        self.ws.send(json.dumps(command))
        self.message_id += 1
        
        response = json.loads(self.ws.recv())
        return response
    
    def inject_complete_solution(self):
        print("Loading complete solution...")
        
        solution_path = Path("C:/dev/chatgpt-live-logger/complete_solution_logger.js")
        if not solution_path.exists():
            print(f"ERROR: Complete solution not found at: {solution_path}")
            return False
            
        solution_code = solution_path.read_text(encoding='utf-8')
        print(f"Loaded {len(solution_code)} characters of solution code")
        
        # Enable runtime domain
        self.send_command("Runtime.enable")
        
        # Inject the code
        result = self.send_command("Runtime.evaluate", {
            "expression": solution_code,
            "includeCommandLineAPI": True
        })
        
        if result.get("error"):
            print(f"ERROR: Injection failed: {result['error']}")
            return False
            
        if result.get("result", {}).get("exceptionDetails"):
            exception = result["result"]["exceptionDetails"]
            print(f"ERROR: JavaScript exception: {exception}")
            return False
            
        print("SUCCESS: Complete solution injected!")
        return True

def main():
    print("Chrome Debug Controller Starting...")
    print("This will inject the complete solution to fix duplicate message logging")
    
    controller = ChromeController()
    
    # Find Claude tab
    tab = controller.find_claude_tab()
    if not tab:
        print("ERROR: No Claude tab found. Please open Claude in Chrome first.")
        return
    
    # Connect to tab
    if not controller.connect_to_tab(tab):
        print("ERROR: Could not connect to tab")
        return
    
    # Inject complete solution
    if not controller.inject_complete_solution():
        print("ERROR: Could not inject complete solution")
        return
    
    print("SUCCESS: Complete solution injected!")
    print("")
    print("Now test by typing 'testmessage143, respond okay143' TWICE")
    print("Both exchanges should appear in chat.log")
    print("Check console for '[ENHANCED USER DETECTION]' messages")
    
    input("Press Enter when done...")
    
    if controller.ws:
        controller.ws.close()

if __name__ == "__main__":
    main()