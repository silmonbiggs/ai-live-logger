# AI Chat Live Logger - Test Plan v2.0.0

## 🎯 Test Objectives
1. Verify multi-platform functionality (ChatGPT + Claude)
2. Validate enhanced metadata capture
3. Ensure backward compatibility
4. Test artifact and tool detection
5. Verify platform-specific optimizations

## 📋 Pre-Test Setup

### Prerequisites
- Chrome browser with developer mode enabled
- Python 3.7+ with FastAPI and uvicorn installed
- Access to both ChatGPT and Claude accounts

### Setup Steps
1. Start the local server
2. Load extension in Chrome
3. Clear any existing log files for clean testing

## 🧪 Test Cases

### 1. Server & Extension Setup Tests

#### 1.1 Server Startup
- **Action**: Start `python server/chatgpt-live-logger.py`
- **Expected**: Server runs on localhost:8788 without errors
- **Validation**: Health endpoint responds correctly

#### 1.2 Extension Loading
- **Action**: Load extension in Chrome developer mode
- **Expected**: Extension loads without errors in both ChatGPT and Claude domains
- **Validation**: Extension appears in chrome://extensions/

### 2. Platform Detection Tests

#### 2.1 ChatGPT Platform Detection
- **Action**: Navigate to chatgpt.com or chat.openai.com
- **Expected**: Console shows "AI Chat Logger - CHATGPT" messages
- **Validation**: Platform detection works correctly

#### 2.2 Claude Platform Detection
- **Action**: Navigate to claude.ai
- **Expected**: Console shows "AI Chat Logger - CLAUDE" messages
- **Validation**: Platform detection works correctly

### 3. Basic Functionality Tests

#### 3.1 ChatGPT User Input Capture
- **Action**: Type and send message in ChatGPT
- **Expected**: User message logged with platform="chatgpt"
- **Test Messages**:
  - "Hello, this is a test message"
  - "Can you help me with Python?"
  - "What is 2+2?"

#### 3.2 ChatGPT Assistant Response Capture
- **Action**: Receive response from ChatGPT
- **Expected**: Assistant message logged with platform="chatgpt"
- **Validation**: Response captured with correct metadata

#### 3.3 Claude User Input Capture
- **Action**: Type and send message in Claude
- **Expected**: User message logged with platform="claude"
- **Test Messages**:
  - "Hello Claude, this is a test"
  - "Write a simple Python function"
  - "Explain quantum computing"

#### 3.4 Claude Assistant Response Capture
- **Action**: Receive response from Claude
- **Expected**: Assistant message logged with platform="claude"
- **Validation**: Response captured with correct metadata

### 4. Enhanced Features Tests

#### 4.1 Claude Artifact Detection
- **Action**: Ask Claude to create code or documents
- **Test Prompts**:
  - "Write a Python script to calculate fibonacci numbers"
  - "Create a simple HTML page"
  - "Write a bash script to list files"
- **Expected**: Artifacts captured in metadata.artifacts array
- **Validation**: Artifact content, language, and type detected

#### 4.2 Tool Usage Detection
- **Action**: Trigger tool usage scenarios
- **ChatGPT Tests**:
  - Ask for web search
  - Request image generation
  - Use code interpreter
- **Claude Tests**:
  - Ask for code execution
  - Request computer use features
- **Expected**: Tools detected in metadata.tools array

#### 4.3 URL Extraction
- **Action**: Send/receive messages with URLs
- **Test Cases**:
  - "Check out https://github.com/anthropics/claude-code"
  - Request Claude to provide links
- **Expected**: URLs extracted and cleaned in urls array

### 5. Streaming & Performance Tests

#### 5.1 Streaming Response Handling
- **Action**: Ask for long responses that stream
- **Test Prompts**:
  - "Write a detailed explanation of machine learning (500+ words)"
  - "Create a comprehensive tutorial on Python"
- **Expected**: 
  - Partial responses not logged prematurely
  - Final complete response captured
  - Platform-specific streaming delays respected

#### 5.2 Duplicate Prevention
- **Action**: Send identical messages within 5 seconds
- **Expected**: Second message skipped with "duplicate" log message
- **Validation**: Platform-aware duplicate detection

### 6. Metadata Validation Tests

#### 6.1 Log Format Validation
- **Action**: Check log files after various interactions
- **Expected Structure**:
```json
{
  "ts": "timestamp",
  "platform": "chatgpt|claude",
  "role": "user|assistant",
  "content": "message text",
  "urls": ["array of urls"],
  "metadata": {
    "artifacts": ["array"],
    "tools": ["array"],
    "streaming": "boolean",
    "messageLength": "number"
  }
}
```

#### 6.2 Server Processing
- **Action**: Monitor server console output
- **Expected**: Enhanced logging showing platform, tools, artifacts
- **Format**: `logged: platform-role chars:X tools:Y artifacts:Z`

### 7. Edge Cases & Error Handling

#### 7.1 Platform Switching
- **Action**: Switch between ChatGPT and Claude tabs
- **Expected**: Platform detection updates correctly for each tab

#### 7.2 Extension Reload
- **Action**: Reload extension while conversations are active
- **Expected**: Clean reconnection without errors

#### 7.3 Server Restart
- **Action**: Restart server while extension is active
- **Expected**: Extension handles reconnection gracefully

#### 7.4 Invalid Domains
- **Action**: Navigate to unsupported domains
- **Expected**: Platform detection returns "unknown", no errors

## 📊 Success Criteria

### ✅ Must Pass
- [ ] Platform detection works for both ChatGPT and Claude
- [ ] User input captured on both platforms
- [ ] Assistant responses captured on both platforms
- [ ] Enhanced metadata includes platform field
- [ ] Server processes messages without errors
- [ ] Log format matches specification

### ⭐ Should Pass
- [ ] Artifact detection works on Claude
- [ ] Tool usage detection works on both platforms
- [ ] Streaming delays are appropriate per platform
- [ ] URL extraction works correctly
- [ ] Duplicate prevention functions properly

### 🎯 Nice to Have
- [ ] Performance is smooth on both platforms
- [ ] Error handling is graceful
- [ ] Console logs are helpful for debugging

## 🐛 Bug Tracking Template

When issues are found:

```
**Issue**: Brief description
**Platform**: ChatGPT | Claude | Both
**Severity**: High | Medium | Low
**Steps to Reproduce**: 
1. Step 1
2. Step 2
3. Step 3
**Expected**: What should happen
**Actual**: What actually happened
**Logs**: Relevant console/server logs
**Fix Applied**: Description of fix
```

## 📝 Test Execution Log

| Test Case | Status | Notes | Issues Found |
|-----------|--------|-------|--------------|
| 1.1 Server Startup | | | |
| 1.2 Extension Loading | | | |
| 2.1 ChatGPT Detection | | | |
| 2.2 Claude Detection | | | |
| 3.1 ChatGPT User Input | | | |
| 3.2 ChatGPT Assistant | | | |
| 3.3 Claude User Input | | | |
| 3.4 Claude Assistant | | | |
| 4.1 Artifact Detection | | | |
| 4.2 Tool Usage | | | |
| 4.3 URL Extraction | | | |
| 5.1 Streaming | | | |
| 5.2 Duplicates | | | |
| 6.1 Log Format | | | |
| 6.2 Server Processing | | | |

---

**Ready to begin testing!** 🚀