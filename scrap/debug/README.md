# Debug Directory

This directory contains development and debugging tools for the ChatGPT Live Logger project. These tools were essential for building and maintaining the system's duplicate detection and logging capabilities.

## Directory Structure

### `/tests/` - Test Automation Scripts
- **`test-automation.js`** - Main Selenium WebDriver automation for systematic testing
- **`test_*_detection.js`** - Various duplicate detection test scripts
- **`test_extension_resilience.js`** - Extension stability and error handling tests
- **`test_claude_extension.js`** - Claude-specific functionality tests
- **`claude_test_input.html`** - Test interface for Claude interactions
- **`test_platform_detection.html`** - Platform detection testing page

### `/tools/` - Development Utilities
- **`analyze_logs.js`** - Log analysis and duplicate detection verification
- **`claude_debug.js`** - Claude DOM inspection and debugging
- **`claude_dom_inspector.js`** - Real-time Claude interface analysis
- **`diagnose_extension_state.js`** - Extension health and state diagnostics
- **`debug_*_selectors.js`** - DOM selector debugging tools
- **`inject_test_*.js`** - Test message injection utilities
- **`force_extension_reload*.js`** - Extension reload utilities
- **`take_screenshot.ps1`** - Screenshot capture for debugging

### `/docs/` - Development Documentation
- **`DEBUGGING_RESUME.md`** - Complete debugging session resume guide
- **`TESTING_SUMMARY.md`** - Testing methodology and results
- **`TEST_PLAN.md`** - Comprehensive testing strategy
- **`SOLUTION_SUMMARY.md`** - Technical solution overview

### `/experimental/` - Experimental Features
- **`churn_room.py`** - Experimental ChurnRoom AI interaction prototype
- **`churn_room_py_dump.txt`** - Development notes and code samples

## Key Tools for Common Tasks

### Testing the System
```bash
# Run full automation test suite
node debug/tests/test-automation.js

# Test duplicate detection specifically  
node debug/tests/test_enhanced_server_detection.js

# Test extension resilience
node debug/tests/test_extension_resilience.js
```

### Debugging Issues
```bash
# Analyze current logs for duplicates
node debug/tools/analyze_logs.js

# Inspect Claude DOM structure
node debug/tools/claude_dom_inspector.js

# Check extension state
node debug/tools/diagnose_extension_state.js

# Take screenshot for visual debugging
powershell debug/tools/take_screenshot.ps1
```

### Development History

This project went through extensive debugging to solve duplicate message detection issues:

1. **Initial Problem**: Claude conversations were being logged with massive duplicate messages
2. **Root Cause**: Claude sends complete conversation history with each update, invisible to users
3. **Solution**: Multi-layered duplicate detection with conversation state tracking
4. **Result**: Clean conversation logs that match user experience

The tools in this directory enabled systematic debugging and automated testing that was crucial for solving the duplicate detection challenge.

## Using Debug Tools

Most tools are self-contained Node.js scripts. Run them from the project root:

```bash
cd /path/to/chatgpt-live-logger
node debug/tests/test-automation.js
node debug/tools/analyze_logs.js
```

Some tools may require the server to be running on localhost:8788.

## Path Updates

If you move files or change the project structure, you may need to update paths in:
- `debug/tests/test-automation.js` (extension path reference)
- Any scripts that reference server files or logs