# ChatGPT Live Logger - Chrome Extension

## Installation Instructions

1. **Build the extension:**
   - Ensure all files are in the `extension/` folder
   - Create simple icons (16x16, 48x48, 128x128 PNG files)

2. **Load in Chrome:**
   - Open `chrome://extensions/`
   - Enable "Developer mode" (top right)
   - Click "Load unpacked"
   - Select the `extension/` folder
   - Extension should appear in toolbar

3. **Start the server:**
   ```bash
   cd server
   python ai-live-logger.py
   ```

4. **Configure the extension:**
   - Click extension icon in toolbar
   - Verify server URL (default: http://localhost:8788)
   - Click "Test Connection" to verify

5. **Use:**
   - Navigate to claude.ai or chatgpt.com
   - Extension automatically starts logging
   - Badge shows message count
   - Duplicate messages are properly logged

## Features

✅ **Automatic injection** - No more F12 console copy/paste
✅ **Cross-platform** - Works on ChatGPT and Claude
✅ **Duplicate detection** - Solves the original bug
✅ **CORS bypass** - Uses proven no-cors method
✅ **Visual feedback** - Badge counter and popup status
✅ **Configurable** - Adjustable server URL
✅ **Fallback methods** - Multiple logging approaches

## Extension Structure

- `manifest.json` - Extension configuration
- `content.js` - Main logging script (injected into pages)
- `background.js` - Service worker for badge updates
- `popup.html/js` - Extension popup interface
- `icons/` - Extension icons (16, 48, 128px)

## Testing

1. Open ChatGPT or Claude
2. Extension badge should show green
3. Type a message, wait for response
4. Wait 15+ seconds, type the **same message** again
5. Check `chat.log` - both exchanges should appear
6. Badge count should increment with each message

## Advantages over F12 Console Method

✅ **Persistent** - Survives page reloads
✅ **Automatic** - No manual script injection
✅ **User-friendly** - Simple on/off toggle
✅ **Reliable** - No CSP or CORS issues
✅ **Updatable** - Can be updated like any extension
✅ **Distributable** - Can be shared easily

The Chrome extension solves all the manual injection problems and provides a clean, professional solution for the duplicate message logging issue.