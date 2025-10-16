#!/usr/bin/env python3
"""
Chrome Debug Controller - Directly inject and test the complete solution
This will finally fix the ChatGPT Live Logger duplicate message bug
"""

import requests
import json
import time
import websocket
import threading
from pathlib import Path

class ChromeController:
    def __init__(self):
        self.debug_port = 9222
        self.ws = None
        self.message_id = 1
        
    def get_tabs(self):
        """Get list of Chrome tabs"""
        try:
            response = requests.get(f'http://localhost:{self.debug_port}/json')
            return response.json()
        except Exception as e:
            print(f"ERROR: Failed to get tabs: {e}")
            return []
    
    def find_claude_tab(self):
        """Find Claude tab or create new one"""
        tabs = self.get_tabs()
        
        # Look for existing Claude tab
        for tab in tabs:
            if 'claude.ai' in tab.get('url', ''):
                print(f"✅ Found existing Claude tab: {tab['title']}")
                return tab
        
        # Create new tab with Claude
        try:
            response = requests.put(f'http://localhost:{self.debug_port}/json/new?claude.ai')
            new_tab = response.json()
            print(f"✅ Created new Claude tab: {new_tab}")
            time.sleep(2)  # Wait for tab to load
            return new_tab
        except Exception as e:
            print(f"❌ Failed to create Claude tab: {e}")
            return None
    
    def connect_to_tab(self, tab):
        """Connect to tab via WebSocket"""
        ws_url = tab['webSocketDebuggerUrl']
        print(f"🔌 Connecting to: {ws_url}")
        
        try:
            self.ws = websocket.create_connection(ws_url)
            print("✅ Connected to Chrome DevTools")
            return True
        except Exception as e:
            print(f"❌ Failed to connect: {e}")
            return False
    
    def send_command(self, method, params=None):
        """Send command to Chrome DevTools"""
        if not self.ws:
            return None
            
        command = {
            "id": self.message_id,
            "method": method,
            "params": params or {}
        }
        
        self.ws.send(json.dumps(command))
        self.message_id += 1
        
        # Wait for response
        response = json.loads(self.ws.recv())
        return response
    
    def navigate_to_claude(self):
        """Navigate to Claude conversation"""
        print("🚀 Navigating to Claude...")
        
        # Enable runtime domain
        self.send_command("Runtime.enable")
        self.send_command("Page.enable")
        
        # Navigate to Claude
        claude_url = "https://claude.ai/chat/0492e8a7-a349-4261-939e-530061d55bef"
        result = self.send_command("Page.navigate", {"url": claude_url})
        
        if result.get("error"):
            print(f"❌ Navigation failed: {result['error']}")
            return False
            
        print("✅ Navigated to Claude")
        time.sleep(5)  # Wait for page load
        return True
    
    def inject_complete_solution(self):
        """Inject the complete solution JavaScript"""
        print("🔧 Loading complete solution...")
        
        # Read the complete solution
        solution_path = Path("C:/dev/chatgpt-live-logger/complete_solution_logger.js")
        if not solution_path.exists():
            print(f"❌ Complete solution not found at: {solution_path}")
            return False
            
        solution_code = solution_path.read_text(encoding='utf-8')
        print(f"📄 Loaded {len(solution_code)} characters of solution code")
        
        # Inject the code
        result = self.send_command("Runtime.evaluate", {
            "expression": solution_code,
            "includeCommandLineAPI": True
        })
        
        if result.get("error"):
            print(f"❌ Injection failed: {result['error']}")
            return False
            
        if result.get("result", {}).get("exceptionDetails"):
            exception = result["result"]["exceptionDetails"]
            print(f"❌ JavaScript exception: {exception}")
            return False
            
        print("✅ Complete solution injected successfully!")
        return True
    
    def test_duplicate_message_fix(self):
        """Test the fix by sending duplicate messages"""
        print("🧪 Testing duplicate message fix...")
        
        test_message = "testmessage143, respond okay143"
        
        # First message
        print(f"📝 Sending first message: {test_message}")
        self.send_claude_message(test_message)
        
        # Wait 15 seconds
        print("⏱️  Waiting 15 seconds...")
        time.sleep(15)
        
        # Second identical message  
        print(f"📝 Sending identical message: {test_message}")
        self.send_claude_message(test_message)
        
        print("✅ Test messages sent - check chat.log for BOTH exchanges")
    
    def send_claude_message(self, message):
        """Send a message to Claude"""
        # Find the input textarea
        find_input = """
        document.querySelector('textarea[placeholder*="Message"], textarea[data-testid*="message"], [contenteditable="true"]')
        """
        
        result = self.send_command("Runtime.evaluate", {"expression": find_input})
        
        if not result.get("result", {}).get("objectId"):
            print("❌ Could not find Claude input field")
            return False
        
        # Type the message
        type_script = f"""
        var input = document.querySelector('textarea[placeholder*="Message"], textarea[data-testid*="message"], [contenteditable="true"]');
        if (input) {{
            input.value = '{message}';
            input.textContent = '{message}';
            
            // Trigger input events
            input.dispatchEvent(new Event('input', {{ bubbles: true }}));
            input.dispatchEvent(new Event('change', {{ bubbles: true }}));
            
            // Find and click send button
            var sendBtn = document.querySelector('button[data-testid*="send"], button[type="submit"], button:has(svg)');
            if (sendBtn) {{
                sendBtn.click();
                console.log('✅ Message sent: {message}');
                true;
            }} else {{
                console.log('❌ Send button not found');
                false;
            }}
        }} else {{
            console.log('❌ Input field not found');
            false;
        }}
        """
        
        result = self.send_command("Runtime.evaluate", {"expression": type_script})
        return result.get("result", {}).get("value") == True

def main():
    print("Starting Chrome Debug Controller...")
    print("This will finally fix the duplicate message logging bug!")
    
    controller = ChromeController()
    
    # Find Claude tab
    tab = controller.find_claude_tab()
    if not tab:
        print("ERROR: Could not find or create Claude tab")
        return
    
    # Connect to tab
    if not controller.connect_to_tab(tab):
        print("ERROR: Could not connect to tab")
        return
    
    # Navigate to Claude conversation
    if not controller.navigate_to_claude():
        print("ERROR: Could not navigate to Claude")
        return
    
    # Inject complete solution
    if not controller.inject_complete_solution():
        print("ERROR: Could not inject complete solution")
        return
    
    print("SUCCESS: Setup complete! Ready to test...")
    
    # Test the fix
    input("Press Enter to test the duplicate message fix...")
    controller.test_duplicate_message_fix()
    
    print("\nTest completed! Check:")
    print("1. Chrome console should show '[ENHANCED USER DETECTION]' messages")
    print("2. chat.log should contain BOTH testmessage143 exchanges")
    print("3. No more 'J' prefix bug")
    
    # Keep connection alive
    input("Press Enter to close...")
    
    if controller.ws:
        controller.ws.close()

if __name__ == "__main__":
    main()