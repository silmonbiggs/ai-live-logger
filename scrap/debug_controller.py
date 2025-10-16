#!/usr/bin/env python3
"""
Automated Debug Controller for ChatGPT Live Logger
Handles Chrome automation, script injection, screenshot capture, and log monitoring
"""

import subprocess
import time
import json
import requests
from pathlib import Path
from datetime import datetime
import os
import sys

class DebugController:
    def __init__(self):
        self.server_dir = Path("C:/dev/chatgpt-live-logger/server")
        self.chat_log = self.server_dir / "chat.log"
        self.verbose_log = self.server_dir / "chatverbose.log" 
        self.recent_log = self.server_dir / "recent.ndjson"
        self.server_url = "http://localhost:8788"
        self.debug_dir = Path("C:/dev/chatgpt-live-logger/debug")
        self.debug_dir.mkdir(exist_ok=True)
        
        # Chrome debugging setup
        self.chrome_debug_port = 9222
        self.chrome_process = None
        
    def log(self, message):
        """Debug logging with timestamp"""
        timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]
        print(f"[{timestamp}] DEBUG: {message}")
        
    def check_server_health(self):
        """Check if server is running"""
        try:
            response = requests.get(f"{self.server_url}/health", timeout=2)
            return response.status_code == 200
        except:
            return False
            
    def clear_logs(self):
        """Clear all log files"""
        self.log("Clearing all log files...")
        for log_file in [self.chat_log, self.verbose_log, self.recent_log]:
            if log_file.exists():
                log_file.write_text("")
                self.log(f"Cleared {log_file.name}")
                
    def read_logs(self):
        """Read current log contents"""
        logs = {}
        for name, path in [("chat", self.chat_log), ("verbose", self.verbose_log), ("recent", self.recent_log)]:
            if path.exists():
                content = path.read_text().strip()
                logs[name] = content.split('\n') if content else []
            else:
                logs[name] = []
        return logs
        
    def dump_logs(self):
        """Dump current log status"""
        logs = self.read_logs()
        self.log("=== LOG STATUS ===")
        for name, lines in logs.items():
            self.log(f"{name}.log: {len(lines)} entries")
            if lines:
                for i, line in enumerate(lines[-3:], 1):  # Last 3 entries
                    try:
                        data = json.loads(line)
                        self.log(f"  {i}. [{data.get('role', '?')}] {data.get('content', '')[:50]}...")
                    except:
                        self.log(f"  {i}. {line[:50]}...")
                        
    def start_chrome_debug(self):
        """Start Chrome with debugging enabled"""
        chrome_cmd = [
            "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
            "--remote-debugging-port=9222",
            "--user-data-dir=C:\\temp\\chrome-debug",
            "--no-first-run",
            "--no-default-browser-check",
            "https://claude.ai"
        ]
        
        self.log("Starting Chrome with debugging enabled...")
        try:
            self.chrome_process = subprocess.Popen(chrome_cmd, 
                                                 stdout=subprocess.DEVNULL, 
                                                 stderr=subprocess.DEVNULL)
            time.sleep(3)  # Let Chrome start
            self.log("Chrome started successfully")
            return True
        except Exception as e:
            self.log(f"Failed to start Chrome: {e}")
            return False
            
    def get_chrome_tabs(self):
        """Get list of Chrome tabs"""
        try:
            response = requests.get(f"http://localhost:{self.chrome_debug_port}/json", timeout=2)
            return response.json()
        except Exception as e:
            self.log(f"Failed to get Chrome tabs: {e}")
            return []
            
    def find_claude_tab(self):
        """Find Claude.ai tab"""
        tabs = self.get_chrome_tabs()
        for tab in tabs:
            if 'claude.ai' in tab.get('url', ''):
                return tab
        return None
        
    def inject_script_via_cdp(self, tab_id, script_content):
        """Inject JavaScript via Chrome DevTools Protocol"""
        try:
            ws_url = f"ws://localhost:{self.chrome_debug_port}/devtools/page/{tab_id}"
            # For now, we'll use a simpler approach with CDP HTTP API
            
            cdp_payload = {
                "id": 1,
                "method": "Runtime.evaluate", 
                "params": {
                    "expression": script_content,
                    "returnByValue": True
                }
            }
            
            # Note: We need a WebSocket connection for this to work properly
            # For now, let's create a PowerShell script to handle this
            return self.inject_via_powershell(script_content)
            
        except Exception as e:
            self.log(f"CDP injection failed: {e}")
            return False
            
    def inject_via_powershell(self, script_content):
        """Use PowerShell to inject script into Chrome"""
        ps_script = f'''
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.SendKeys]::SendWait("^+i")
Start-Sleep -Milliseconds 1000
[System.Windows.Forms.SendKeys]::SendWait("^l")
Start-Sleep -Milliseconds 500
[System.Windows.Forms.SendKeys]::SendWait("console.log('Script injection starting...')")
[System.Windows.Forms.SendKeys]::SendWait("{{ENTER}}")
'''
        
        try:
            subprocess.run(["powershell", "-Command", ps_script], check=True, capture_output=True)
            time.sleep(2)
            return True
        except Exception as e:
            self.log(f"PowerShell injection failed: {e}")
            return False
            
    def take_screenshot(self, filename=None):
        """Take screenshot of current screen"""
        if not filename:
            filename = f"debug_screenshot_{datetime.now().strftime('%H%M%S')}.png"
            
        screenshot_path = self.debug_dir / filename
        
        # Use PowerShell for screenshot
        ps_script = f'''
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
$bitmap.Save("{screenshot_path}")
$graphics.Dispose()
$bitmap.Dispose()
'''
        
        try:
            result = subprocess.run(["powershell", "-Command", ps_script], 
                                  capture_output=True, text=True)
            if result.returncode == 0:
                self.log(f"Screenshot saved: {screenshot_path}")
                return screenshot_path
            else:
                self.log(f"Screenshot failed: {result.stderr}")
                return None
        except Exception as e:
            self.log(f"Screenshot error: {e}")
            return None
            
    def send_test_message(self, message):
        """Send a test message directly to server"""
        payload = {
            "platform": "claude",
            "role": "user", 
            "text": message,
            "urls": [],
            "metadata": {
                "debug": True,
                "timestamp": datetime.now().isoformat()
            }
        }
        
        try:
            response = requests.post(f"{self.server_url}/log", json=payload, timeout=5)
            self.log(f"Test message sent: {response.status_code}")
            return response.status_code == 200
        except Exception as e:
            self.log(f"Failed to send test message: {e}")
            return False
            
    def monitor_logs_for_changes(self, duration=30):
        """Monitor logs for changes over a duration"""
        self.log(f"Monitoring logs for {duration} seconds...")
        
        initial_logs = self.read_logs()
        initial_counts = {name: len(lines) for name, lines in initial_logs.items()}
        
        time.sleep(duration)
        
        final_logs = self.read_logs()
        final_counts = {name: len(lines) for name, lines in final_logs.items()}
        
        changes = {}
        for name in initial_counts:
            change = final_counts[name] - initial_counts[name]
            if change > 0:
                changes[name] = change
                self.log(f"LOG CHANGE: {name}.log +{change} entries")
                
        return changes
        
    def run_debug_cycle(self):
        """Run a complete debug cycle"""
        self.log("=== STARTING DEBUG CYCLE ===")
        
        # Check server
        if not self.check_server_health():
            self.log("❌ Server is not running!")
            return False
            
        self.log("✅ Server is healthy")
        
        # Clear logs for clean test
        self.clear_logs()
        
        # Take initial screenshot
        self.take_screenshot("01_initial_state.png")
        
        # Start Chrome if needed
        claude_tab = self.find_claude_tab()
        if not claude_tab:
            self.log("No Claude tab found, starting Chrome...")
            if not self.start_chrome_debug():
                return False
            time.sleep(5)
            claude_tab = self.find_claude_tab()
            
        if claude_tab:
            self.log(f"Found Claude tab: {claude_tab['title']}")
            self.take_screenshot("02_claude_tab_found.png")
        else:
            self.log("❌ Could not find Claude tab")
            return False
            
        # Send test message to verify server
        self.send_test_message("debug_test_message_" + str(int(time.time())))
        
        # Check logs
        time.sleep(1)
        self.dump_logs()
        
        self.log("=== DEBUG CYCLE COMPLETE ===")
        return True
        
    def cleanup(self):
        """Clean up resources"""
        if self.chrome_process:
            self.chrome_process.terminate()
            self.log("Chrome process terminated")

if __name__ == "__main__":
    controller = DebugController()
    
    try:
        controller.run_debug_cycle()
    except KeyboardInterrupt:
        controller.log("Interrupted by user")
    finally:
        controller.cleanup()