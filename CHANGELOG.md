# Changelog

## [2.0.0] - 2025-01-21

### 🎉 Major Release: Multi-Platform Support

#### ✨ New Features
- **Claude AI Support**: Full support for claude.ai alongside existing ChatGPT support
- **Platform Auto-Detection**: Automatically detects whether user is on ChatGPT or Claude
- **Enhanced Metadata Tracking**: Captures artifacts, tool usage, and platform information
- **Claude Artifacts**: Detects and logs Claude's artifact content (code, documents, etc.)
- **Tool Usage Detection**: Identifies when AI models use tools or execute code
- **Platform-Aware Logging**: Distinguishes between ChatGPT and Claude messages in logs

#### 🔧 Technical Improvements
- **Multi-Platform Architecture**: Modular configuration system for different platforms
- **Enhanced Selectors**: Platform-specific DOM selectors for reliable message capture
- **Improved Streaming**: Platform-specific streaming delays (ChatGPT: 2.5s, Claude: 3.0s)
- **Better Error Handling**: Platform-aware error messages and debugging
- **Enhanced Duplicate Detection**: Platform-aware duplicate prevention

#### 📝 Breaking Changes
- **Log Format**: Added `platform` field and `metadata` object to all logged messages
- **Extension Name**: Changed from "ChatGPT Live Logger" to "AI Chat Live Logger"
- **Message IDs**: Now prefixed with platform (e.g., `claude-user-1234567890`)

#### 🔄 Updated Components

##### Extension (`extension/`)
- **manifest.json**: 
  - Added claude.ai permissions
  - Updated extension name and description
  - Version bumped to 2.0.0
- **content.js**: 
  - Complete rewrite with platform detection
  - Added Claude-specific selectors and capture logic
  - Enhanced metadata collection
  - Improved logging with platform awareness
- **bg.js**: No changes (remains compatible)

##### Server (`server/`)
- **chatgpt-live-logger.py**:
  - Enhanced to handle platform field
  - Added metadata processing
  - Improved duplicate detection with platform awareness
  - Better logging output with platform, tools, and artifacts info

#### 📚 Documentation
- **README.md**: Completely updated for multi-platform support
- **CHANGELOG.md**: New file documenting all changes
- **test_platform_detection.html**: Added test file for platform detection

#### 🔧 Log Format Changes

**Before (v1.x):**
```json
{
  "ts": "2024-01-01T12:00:00",
  "role": "user|assistant",
  "content": "message content",
  "urls": ["https://example.com"]
}
```

**After (v2.0.0):**
```json
{
  "ts": "2024-01-01T12:00:00",
  "platform": "chatgpt|claude",
  "role": "user|assistant",
  "content": "message content",
  "urls": ["https://example.com"],
  "metadata": {
    "artifacts": [],
    "tools": [],
    "streaming": false,
    "messageLength": 150
  }
}
```

#### 🎯 Supported Platforms
- **ChatGPT**: chatgpt.com, chat.openai.com
- **Claude**: claude.ai
- **Platform Detection**: Automatic based on domain

#### ⚙️ Installation & Usage
1. Load updated extension in Chrome (supports both platforms now)
2. Run server: `python server/chatgpt-live-logger.py`
3. Use ChatGPT or Claude - both will be automatically logged with platform detection

#### 🔄 Migration Guide
- **Existing logs**: Will continue to work, but won't have platform/metadata fields
- **Extension**: Remove old version and install new v2.0.0
- **Server**: No changes needed - backward compatible

---

## [1.0.8] - Previous Release
### Features
- ChatGPT conversation logging
- Real-time streaming capture
- URL extraction
- Duplicate prevention
- Basic metadata tracking