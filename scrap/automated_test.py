#!/usr/bin/env python3
"""
Automated Test Suite for ChatGPT Live Logger
Tests user input detection, log monitoring, and debug capabilities
"""

import subprocess
import time
import json
import requests
from pathlib import Path
from datetime import datetime
import os

class AutomatedTester:
    def __init__(self):
        self.server_dir = Path("C:/dev/chatgpt-live-logger/server")
        self.debug_dir = Path("C:/dev/chatgpt-live-logger/debug")
        self.debug_dir.mkdir(exist_ok=True)
        
        self.chat_log = self.server_dir / "chat.log"
        self.verbose_log = self.server_dir / "chatverbose.log" 
        self.recent_log = self.server_dir / "recent.ndjson"
        self.server_url = "http://localhost:8788"
        
        self.test_results = []
        
    def log(self, message, level="INFO"):
        """Enhanced logging with levels"""
        timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]
        
        # Clean message of problematic Unicode characters
        clean_message = message.encode('ascii', 'ignore').decode('ascii')
        print(f"[{timestamp}] {level}: {clean_message}")
        
        # Also save to test log
        test_log = self.debug_dir / "test_results.log"
        with open(test_log, "a", encoding="utf-8") as f:
            f.write(f"[{timestamp}] {level}: {clean_message}\n")
    
    def take_screenshot(self, name):
        """Take screenshot using PowerShell"""
        timestamp = datetime.now().strftime("%H%M%S")
        filename = f"{timestamp}_{name}.png"
        screenshot_path = self.debug_dir / filename
        
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
                                  capture_output=True, text=True, timeout=10)
            if result.returncode == 0:
                self.log(f"Screenshot saved: {filename}")
                return screenshot_path
            else:
                self.log(f"Screenshot failed: {result.stderr}", "ERROR")
                return None
        except Exception as e:
            self.log(f"Screenshot error: {e}", "ERROR")
            return None
    
    def clear_all_logs(self):
        """Clear all log files for clean testing"""
        self.log("Clearing all log files...")
        
        for log_file in [self.chat_log, self.verbose_log, self.recent_log]:
            if log_file.exists():
                try:
                    log_file.write_text("")
                    self.log(f"Cleared {log_file.name}")
                except Exception as e:
                    self.log(f"Failed to clear {log_file.name}: {e}", "ERROR")
    
    def read_all_logs(self):
        """Read contents of all log files"""
        logs = {}
        
        for name, path in [("chat", self.chat_log), ("verbose", self.verbose_log), ("recent", self.recent_log)]:
            try:
                if path.exists():
                    content = path.read_text(encoding="utf-8").strip()
                    if content:
                        logs[name] = [line for line in content.split('\n') if line.strip()]
                    else:
                        logs[name] = []
                else:
                    logs[name] = []
            except Exception as e:
                self.log(f"Error reading {name}.log: {e}", "ERROR")
                logs[name] = []
                
        return logs
    
    def dump_log_status(self):
        """Dump current status of all logs"""
        logs = self.read_all_logs()
        self.log("=== LOG STATUS ===")
        
        for name, lines in logs.items():
            self.log(f"{name}.log: {len(lines)} entries")
            
            # Show recent entries
            if lines:
                for i, line in enumerate(lines[-3:], 1):
                    try:
                        data = json.loads(line)
                        role = data.get('role', '?')
                        content = data.get('content', '')[:50]
                        self.log(f"  {i}. [{role}] {content}...")
                    except:
                        self.log(f"  {i}. {line[:50]}...")
        
        return logs
    
    def check_server_status(self):
        """Check if server is running and healthy"""
        try:
            response = requests.get(f"{self.server_url}/health", timeout=3)
            if response.status_code == 200:
                self.log("✅ Server is healthy")
                return True
            else:
                self.log(f"❌ Server unhealthy: {response.status_code}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Server connection failed: {e}", "ERROR")
            return False
    
    def send_test_message(self, message, role="user"):
        """Send a test message to server"""
        payload = {
            "platform": "claude",
            "role": role,
            "text": message,
            "urls": [],
            "metadata": {
                "test": True,
                "timestamp": datetime.now().isoformat(),
                "testId": f"auto_test_{int(time.time())}"
            }
        }
        
        try:
            response = requests.post(f"{self.server_url}/log", json=payload, timeout=5)
            if response.status_code == 200:
                self.log(f"✅ Test message sent: '{message[:30]}...'")
                return True
            else:
                self.log(f"❌ Test message failed: {response.status_code}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Test message error: {e}", "ERROR")
            return False
    
    def launch_auto_injector(self):
        """Launch the auto injection system"""
        self.log("Launching auto injector...")
        
        try:
            injector_path = Path("C:/dev/chatgpt-live-logger/auto_inject.py")
            if injector_path.exists():
                subprocess.Popen(["python", str(injector_path)], 
                               cwd=str(injector_path.parent))
                self.log("✅ Auto injector launched")
                return True
            else:
                self.log("❌ Auto injector not found", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Failed to launch auto injector: {e}", "ERROR")
            return False
    
    def run_duplicate_message_test(self):
        """Test the core functionality - duplicate message detection"""
        self.log("=== RUNNING DUPLICATE MESSAGE TEST ===")
        
        # Clear logs for clean test
        self.clear_all_logs()
        time.sleep(1)
        
        # Take initial screenshot
        self.take_screenshot("test_start")
        
        # Send first message
        test_msg = f"testmessage{int(time.time())}, respond okay{int(time.time())}"
        self.log(f"Sending first message: {test_msg}")
        
        if not self.send_test_message(test_msg):
            self.log("❌ First message failed", "ERROR")
            return False
        
        # Wait and check logs
        time.sleep(2)
        logs_after_first = self.dump_log_status()
        
        # Send assistant response
        response_msg = test_msg.split("respond ")[1] if "respond " in test_msg else "okay_test"
        self.log(f"Sending assistant response: {response_msg}")
        self.send_test_message(response_msg, "assistant")
        
        time.sleep(2)
        self.dump_log_status()
        
        # Wait for realistic delay (15+ seconds)
        self.log("Waiting 15 seconds for realistic delay...")
        time.sleep(15)
        
        # Send IDENTICAL second message
        self.log(f"Sending IDENTICAL second message: {test_msg}")
        if not self.send_test_message(test_msg):
            self.log("❌ Second message failed", "ERROR")
            return False
        
        # Send second assistant response  
        time.sleep(2)
        self.send_test_message(response_msg, "assistant")
        
        # Check final logs
        time.sleep(2)
        final_logs = self.dump_log_status()
        
        # Analyze results
        chat_entries = len(final_logs.get('chat', []))
        verbose_entries = len(final_logs.get('verbose', []))
        
        self.log("=== TEST RESULTS ===")
        self.log(f"Chat log entries: {chat_entries}")
        self.log(f"Verbose log entries: {verbose_entries}")
        
        # Expected: 4 entries in chat.log (2 user, 2 assistant)
        # This is the core test - if we get 4, the fix worked!
        if chat_entries >= 4:
            self.log("✅ SUCCESS: Both duplicate exchanges logged!", "SUCCESS") 
            result = "SUCCESS"
        elif chat_entries == 2:
            self.log("❌ FAILURE: Only first exchange logged (original bug)", "ERROR")
            result = "ORIGINAL_BUG"
        else:
            self.log(f"❌ UNEXPECTED: {chat_entries} entries (expected 4)", "ERROR")
            result = "UNEXPECTED"
        
        # Take final screenshot
        self.take_screenshot("test_end")
        
        return result == "SUCCESS"
    
    def run_comprehensive_test_suite(self):
        """Run the complete test suite"""
        self.log("🚀 STARTING COMPREHENSIVE TEST SUITE")
        
        # Test 1: Server health
        self.log("\n=== TEST 1: Server Health ===")
        if not self.check_server_status():
            self.log("❌ ABORTING: Server is not running", "ERROR")
            return False
        
        # Test 2: Basic logging
        self.log("\n=== TEST 2: Basic Logging ===")
        self.clear_all_logs()
        self.send_test_message("basic_test_message")
        time.sleep(1)
        logs = self.read_all_logs()
        
        if len(logs.get('chat', [])) > 0:
            self.log("✅ Basic logging works")
        else:
            self.log("❌ Basic logging failed", "ERROR")
            return False
        
        # Test 3: Launch auto injector (for manual testing)
        self.log("\n=== TEST 3: Auto Injector ===")
        self.launch_auto_injector()
        
        # Wait for user to navigate and inject scripts
        self.log("⏳ Waiting 30 seconds for manual script injection...")
        self.log("   Please navigate to claude.ai and check the auto-injector page")
        time.sleep(30)
        
        # Test 4: Duplicate message test
        self.log("\n=== TEST 4: Duplicate Message Test ===")
        success = self.run_duplicate_message_test()
        
        # Final summary
        self.log("\n=== FINAL SUMMARY ===")
        if success:
            self.log("🎉 ALL TESTS PASSED! User input detection is working!")
        else:
            self.log("❌ TESTS FAILED! User input detection needs debugging")
        
        # Save test report
        self.save_test_report(success)
        
        return success
    
    def save_test_report(self, success):
        """Save detailed test report"""
        report_path = self.debug_dir / f"test_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        logs = self.read_all_logs()
        
        report = {
            "timestamp": datetime.now().isoformat(),
            "success": success,
            "server_healthy": self.check_server_status(),
            "log_counts": {name: len(entries) for name, entries in logs.items()},
            "logs": logs,
            "test_results": self.test_results
        }
        
        with open(report_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        
        self.log(f"Test report saved: {report_path}")

if __name__ == "__main__":
    tester = AutomatedTester()
    
    try:
        tester.run_comprehensive_test_suite()
    except KeyboardInterrupt:
        tester.log("Test interrupted by user", "WARNING")
    except Exception as e:
        tester.log(f"Test failed with exception: {e}", "ERROR")