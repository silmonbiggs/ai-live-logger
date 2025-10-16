# ai-chat-live-logger.py — local sink with CORS + preflight for ChatGPT and Claude
from fastapi import FastAPI, Request
from fastapi.responses import PlainTextResponse, Response
from fastapi.middleware.cors import CORSMiddleware
import uvicorn, json
from pathlib import Path
from datetime import datetime

ROOT   = Path(__file__).parent
LOG    = ROOT / "chat.log"         # filtered conversation content
VERBOSE_LOG = ROOT / "chatverbose.log"  # unfiltered everything
RECENT = ROOT / "recent.ndjson"    # last 2 messages (ndjson)
MAX_LINES = 100
RECENT_N  = 2

app = FastAPI()

# Allow ChatGPT domains to call us from the browser
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],                # simple and permissive for localhost dev
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

def append_rolling(path: Path, item: dict, max_lines: int):
    lines = []
    if path.exists():
        lines = [ln for ln in path.read_text(encoding="utf-8").splitlines() if ln.strip()]
    lines.append(json.dumps(item, ensure_ascii=False))
    if len(lines) > max_lines:
        lines = lines[-max_lines:]
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")

def is_noise_content(content: str, platform: str, urls: list = None) -> bool:
    """Filter out UI noise, navigation elements, CSS, and other non-conversational content"""
    content_lower = content.lower().strip()
    urls = urls or []
    
    try:
        print(f"FILTER DEBUG: checking content='{content[:50]}...' len={len(content)}")
    except UnicodeEncodeError:
        print(f"FILTER DEBUG: checking content=[Unicode content] len={len(content)}")
    
    # Empty or very short content
    if len(content) < 3:
        return True
    
    # CSS/Styling content
    if any(css_pattern in content for css_pattern in [
        "@keyframes", "position: fixed", "z-index:", "rgba(", "transform:", 
        "animation:", "box-shadow:", "border-radius:", "opacity:", "background:",
        ".intercom-", "px;", "rem;", "vh;", "vw;", "%;"
    ]):
        return True
    
    # Claude greeting patterns - but allow Sonnet 4 greetings (check metadata)
    greeting_patterns = [
        "hi, i'm claude", "hello, i'm claude", "i'm claude", "how can i help you today",
        "what can i help you with today", "how may i assist you today", "hi there! how can i help"
    ]

    if any(greeting_pattern in content_lower for greeting_pattern in greeting_patterns):
        # Check if this is from Sonnet 4 - if so, allow it
        if hasattr(urls, '__iter__') and any('sonnet' in str(url).lower() for url in urls):
            print(f"FILTER DEBUG: allowing Sonnet 4 greeting: {content[:50]}...")
            return False

        print(f"FILTER DEBUG: blocking Claude greeting: {content[:50]}...")
        return True

    # Common UI navigation elements - be more specific to avoid false positives
    ui_noise_exact = [
        "all chats", "new chat", "retry", "share", "delete",
        "claude can make mistakes", "please double-check responses",
        "pending context request", "artifacts", "projects", "claude code",
        "starred", "chats projects artifacts", "recents",
        # Claude UI specific elements
        "test message confirmation share", "test message confirmation",
        "retry", "share", "confirmation", "message confirmation"
    ]
    
    # UI patterns that can appear anywhere in content
    ui_noise_patterns = [
        "chats projects artifacts", "claude can make mistakes",
        # Button and UI element patterns
        "retry", "confirmation share", "message confirmation"
    ]
    
    if content_lower in ui_noise_exact or any(pattern in content_lower for pattern in ui_noise_patterns):
        return True
    
    # Chat title patterns with URLs (these are likely chat sidebar titles)
    has_chat_url = any("claude.ai/chat/" in url for url in urls)
    if has_chat_url and len(content.split()) <= 6:
        return True
    
    # Fragment patterns (single words that are clearly UI fragments)
    # But exclude valid short responses like "okay27"
    single_word_ui = ["research", "sonnet", "writing", "method", "analysis", "review", "request"]
    if (len(content.split()) == 1 and content_lower in single_word_ui):
        return True
        
    # Allow valid short responses that match okay pattern
    import re
    if re.match(r'^okay\d+$', content_lower):
        print(f"FILTER DEBUG: allowing okay response: {content}")
        return False
    
    # Specific chat title patterns that repeat as noise
    chat_title_patterns = ["research sonnet 4", "j james", "j test"]
    if any(pattern in content_lower for pattern in chat_title_patterns):
        return True
    
    # Claude UI specific patterns (button text combinations)
    claude_ui_patterns = [
        r".*\s+retry$",        # anything ending with " Retry" (with space)
        r".*\s+share$",        # anything ending with " Share" (with space)  
        r"test\s+message\s+confirmation.*"  # test message confirmation variations
    ]
    
    import re
    for pattern in claude_ui_patterns:
        if re.match(pattern, content_lower):
            return True
    
    # Allow testmessage and okay responses - these are valid test content
    if content_lower.startswith('testmessage') or re.match(r'^okay\d+$', content_lower):
        print(f"FILTER DEBUG: allowing test content: {content}")
        return False  # Don't filter test messages
    
    return False

@app.options("/log")
async def preflight():
    # FastAPI+CORS middleware will add the right headers; just return 204
    return Response(status_code=204)

@app.get("/log")
async def log_via_get(request: Request):
    """Handle GET requests for CORS bypass via Image or JSONP"""
    params = dict(request.query_params)
    
    # Extract data from query parameters
    item = {
        "ts": datetime.now().isoformat(timespec="seconds"),
        "platform": params.get("platform", "claude"),
        "role": params.get("role", "user"),
        "content": params.get("text", ""),
        "urls": [],
        "metadata": {
            "corsBarpass": True,
            "method": params.get("method", "get_bypass"),
            "timestamp": params.get("timestamp", "")
        }
    }
    
    # Process the message same as POST
    if item["content"]:
        print(f"CORS BYPASS: {item['platform']}-{item['role']} via {item['metadata']['method']}: '{item['content'][:30]}...'")
        
        # Apply same filtering logic as POST /log
        append_rolling(VERBOSE_LOG, item, MAX_LINES)
        append_rolling(RECENT, item, RECENT_N)
        append_rolling(LOG, item, MAX_LINES)  # For now, log everything from CORS bypass
    
    # Handle JSONP callback
    callback = params.get("callback")
    if callback:
        response_data = f'{callback}({{"status": "ok", "method": "jsonp"}})'
        return Response(content=response_data, media_type="application/javascript")
    else:
        # Regular response for image bypass
        return PlainTextResponse("ok")

@app.post("/log")
async def log_msg(req: Request):
    data = await req.json()
    item = {
        "ts": datetime.now().isoformat(timespec="seconds"),
        "platform": data.get("platform", "unknown"),
        "role": data.get("role", "assistant"),
        "content": data.get("text", ""),
        "urls": data.get("urls", []),
        "metadata": data.get("metadata", {}),
    }
    
    # Check for recent duplicates (within last 5 seconds)
    if LOG.exists():
        recent_lines = []
        try:
            lines = LOG.read_text(encoding="utf-8").splitlines()
            # Check last 50 entries for duplicates (increased from 5 to catch longer-term repeats)
            for line in lines[-50:]:
                if line.strip():
                    recent_item = json.loads(line)
                    recent_lines.append(recent_item)
        except:
            pass
        
        # Check if this is a duplicate of recent content with stricter rules
        current_time = datetime.fromisoformat(item["ts"])
        for recent in recent_lines:
            try:
                recent_time = datetime.fromisoformat(recent["ts"])
                time_diff = (current_time - recent_time).total_seconds()
                
                # Much stricter duplicate detection for assistant messages
                duplicate_window = 2 if item["role"] == "assistant" else 5  # 2 seconds for assistant, 5 for user
                
                # If same content within time window, skip
                if (time_diff <= duplicate_window and 
                    recent["role"] == item["role"] and 
                    recent["content"] == item["content"] and
                    recent.get("platform") == item.get("platform")):
                    print(f"DUPLICATE BLOCKED: {item['platform']}-{item['role']} '{item['content'][:30]}...' (same as {time_diff:.1f}s ago)")
                    return PlainTextResponse("ok")
                    
                # Additional check: block identical assistant responses within 30 seconds
                if (item["role"] == "assistant" and 
                    recent["role"] == "assistant" and
                    recent["content"] == item["content"] and
                    time_diff <= 30):
                    print(f"DUPLICATE ASSISTANT BLOCKED: '{item['content'][:30]}...' (repeat within {time_diff:.1f}s)")
                    return PlainTextResponse("ok")
                    
            except:
                continue
        
        # J-PREFIX DEDUPLICATION: Block messages with J-prefix if we expect a clean version
        # This fixes the dual-logger issue where we get "Jtestmessage110" followed by "testmessage110"
        if (item["content"].startswith('J') and 
            item["role"] == "user" and
            len(item["content"]) > 10):  # Only check longer messages to avoid blocking single "J"
            
            # Check if this looks like a J-prefixed duplicate (starts with J + testmessage pattern)
            clean_content = item["content"][1:]  # Remove the J
            if "testmessage" in clean_content or "respond" in clean_content:
                print(f"J-PREFIX BLOCKED: Blocking J-prefixed message '{item['content'][:30]}...' - expecting clean version")
                return PlainTextResponse("ok")
        
        # CLEAN VERSION DEDUPLICATION: If clean version comes after J-prefix, remove the J-prefixed entry
        if recent_lines and item["role"] == "user":
            last_recent = recent_lines[-1]
            try:
                # Check if last message is same role, platform, and content with J prefix
                if (last_recent["role"] == item["role"] and 
                    last_recent.get("platform") == item.get("platform") and
                    last_recent["content"].startswith('J') and
                    last_recent["content"][1:] == item["content"]):
                    
                    print(f"CLEAN VERSION RECEIVED: Replacing J-prefixed '{last_recent['content'][:30]}...' with clean '{item['content'][:30]}...'")
                    
                    # Remove the J-prefixed entry from the end of the log file
                    if LOG.exists():
                        try:
                            lines = LOG.read_text(encoding="utf-8").splitlines()
                            if lines:
                                # Remove last line (the J-prefixed duplicate)
                                lines = lines[:-1]
                                LOG.write_text('\n'.join(lines) + '\n' if lines else '', encoding="utf-8")
                                print(f"REMOVED J-PREFIX ENTRY: '{last_recent['content'][:30]}...'")
                        except Exception as e:
                            print(f"ERROR removing J-prefix duplicate: {e}")
                            
            except Exception as e:
                print(f"ERROR in clean version deduplication: {e}")
        
        # ENHANCED: Check for long-term duplicates in entire recent history (stronger duplicate detection)
        # This catches historical retransmissions while allowing legitimate repeats
        duplicate_content_map = {}
        for recent in recent_lines:
            try:
                # Build map of ALL message content (both user and assistant) for duplicate detection
                if recent.get("platform") == item.get("platform"):
                    content = recent["content"]
                    role = recent["role"]
                    key = f"{role}:{content}"  # Include role to separate user/assistant namespaces
                    if key not in duplicate_content_map:
                        duplicate_content_map[key] = recent
            except Exception as e:
                print(f"ENHANCED DEBUG: Error processing recent item: {e}")
                continue
        
        print(f"ENHANCED DEBUG: Checking {len(recent_lines)} recent entries for duplicates of '{item.get('content', '')[:30]}...'")
        print(f"ENHANCED DEBUG: Found {len(duplicate_content_map)} unique messages in history")
        
        # Check if we've seen this exact content from this role before
        current_key = f"{item['role']}:{item['content']}"
        if (current_key in duplicate_content_map and
            duplicate_content_map[current_key]["ts"] != item["ts"]):
            
            first_occurrence = duplicate_content_map[current_key]
            first_occurrence_time = datetime.fromisoformat(first_occurrence["ts"])
            current_time = datetime.fromisoformat(item["ts"])
            time_since_first = (current_time - first_occurrence_time).total_seconds()
            
            # Check if this message is marked as historical
            is_historical = item.get("metadata", {}).get("signalProcessing", {}).get("isHistorical", False)
            first_was_historical = first_occurrence.get("metadata", {}).get("signalProcessing", {}).get("isHistorical", False)
            
            # ENHANCED LOGIC: Handle historical vs non-historical duplicates differently
            if is_historical:
                # Historical messages are always blocked if duplicated
                print(f"ENHANCED DUPLICATE BLOCKED: '{item['content'][:30]}...' (historical retransmission, first seen at {first_occurrence['ts']}, {time_since_first:.1f}s ago)")
                return PlainTextResponse("ok")
            elif not is_historical and time_since_first < 10:
                # Non-historical duplicates within 10 seconds are blocked (too fast to be legitimate)
                print(f"ENHANCED DUPLICATE BLOCKED: '{item['content'][:30]}...' (duplicate within {time_since_first:.1f}s, too fast to be legitimate)")
                return PlainTextResponse("ok")
            elif not is_historical and time_since_first >= 10:
                # Non-historical duplicates after 10+ seconds are legitimate repeats (allow)
                print(f"LEGITIMATE REPEAT ALLOWED: '{item['content'][:30]}...' (non-historical repeat after {time_since_first:.1f}s)")
            else:
                # For assistant messages, check for conversational echoes
                if item["role"] == "assistant":
                    # Check if this might be a legitimate assistant echo of a recent user message
                    is_legitimate_echo = False
                    for recent in recent_lines[-10:]:  # Check last 10 messages for user echo
                        try:
                            if (recent["role"] == "user" and 
                                recent.get("platform") == item.get("platform")):
                                recent_time = datetime.fromisoformat(recent["ts"])
                                time_since_user = (current_time - recent_time).total_seconds()
                                
                                # If user said something similar within last 30 seconds, this might be an echo
                                if (time_since_user <= 30 and 
                                    (recent["content"] == item["content"] or 
                                     recent["content"].lower() in item["content"].lower())):
                                    is_legitimate_echo = True
                                    print(f"ECHO ALLOWED: Assistant echoing recent user message '{item['content'][:30]}...' from {time_since_user:.1f}s ago")
                                    break
                        except:
                            continue
                    
                    # Block non-historical assistant duplicates that aren't legitimate echoes and are old
                    if not is_legitimate_echo and time_since_first > 60:
                        print(f"ENHANCED DUPLICATE BLOCKED: '{item['content'][:30]}...' (first seen at {first_occurrence['ts']}, {time_since_first:.1f}s ago, not an echo)")
                        return PlainTextResponse("ok")
                    elif not is_legitimate_echo:
                        print(f"RECENT REPEAT ALLOWED: '{item['content'][:30]}...' (first seen {time_since_first:.1f}s ago)")
            
        # Also allow legitimate assistant echo pattern within 30 seconds of user message with similar content
        elif item["role"] == "assistant":
            for recent in recent_lines[-5:]:  # Check last 5 messages for immediate echo pattern
                try:
                    if (recent["role"] == "user" and 
                        recent.get("platform") == item.get("platform")):
                        recent_time = datetime.fromisoformat(recent["ts"])
                        current_time = datetime.fromisoformat(item["ts"])
                        time_since_user = (current_time - recent_time).total_seconds()
                        
                        # Check if this is an exact user input echo (Claude UI pattern)
                        if (time_since_user <= 10 and 
                            recent["content"].strip() == item["content"].strip()):
                            print(f"USER INPUT ECHO DETECTED: Assistant exactly echoing user input '{item['content'][:30]}...' from {time_since_user:.1f}s ago - MARKING AS NOISE")
                            # Mark as signal noise to filter from chat.log
                            item["metadata"]["isSignalNoise"] = True
                            item["metadata"]["signalProcessingFilter"] = ["user_input_echo"]
                            break
                        # If user said something similar (but not exact) within last 30 seconds, allow as conversational echo
                        elif (time_since_user <= 30 and 
                            recent["content"].lower() in item["content"].lower()):
                            print(f"CONVERSATIONAL ECHO ALLOWED: Assistant echoing user '{item['content'][:30]}...' from {time_since_user:.1f}s ago")
                            break
                except:
                    continue
    
    # Check for streaming prefix captures that should be removed
    platform = item.get("platform", "unknown")
    content = item.get("content", "")
    urls = item.get("urls", [])
    metadata = item.get("metadata", {})

    # Prefix filtering: remove premature captures within 5-second window
    if item["role"] == "assistant" and LOG.exists():
        try:
            lines = LOG.read_text(encoding="utf-8").splitlines()
            current_time = datetime.fromisoformat(item["ts"])

            # Look for recent assistant messages from same platform/conversation that might be prefixes
            for line in lines[-20:]:  # Check last 20 entries
                if line.strip():
                    recent_item = json.loads(line)
                    if (recent_item["role"] == "assistant" and
                        recent_item.get("platform") == platform):

                        recent_time = datetime.fromisoformat(recent_item["ts"])
                        time_diff = (current_time - recent_time).total_seconds()

                        # Check within 5-second window for prefix relationships
                        if 0 < time_diff <= 5:
                            recent_content = recent_item["content"]

                            # If current content is longer and recent is a prefix, remove the recent one
                            if (len(content) > len(recent_content) and
                                content.startswith(recent_content) and
                                len(recent_content) >= 3):  # Don't remove very short content

                                print(f"PREFIX FILTER: Removing premature capture '{recent_content}' (prefix of '{content}')")

                                # Remove the prefix entry from the log file
                                updated_lines = []
                                for log_line in lines:
                                    if log_line.strip():
                                        try:
                                            log_item = json.loads(log_line)
                                            # Skip the line that matches the prefix we want to remove
                                            if not (log_item["ts"] == recent_item["ts"] and
                                                   log_item["content"] == recent_content):
                                                updated_lines.append(log_line)
                                        except:
                                            updated_lines.append(log_line)  # Keep malformed lines

                                # Write back the filtered log
                                if updated_lines:
                                    LOG.write_text("\n".join(updated_lines) + "\n", encoding="utf-8")
                                else:
                                    LOG.write_text("", encoding="utf-8")

                                break  # Only remove one prefix per new message
        except Exception as e:
            print(f"PREFIX FILTER ERROR: {e}")

    # Check for Claude name-prefixed user input echoes (e.g. "Jtestmessage" echoing "testmessage")
    if item["role"] == "assistant" and platform == "claude" and LOG.exists():
        try:
            lines = LOG.read_text(encoding="utf-8").splitlines()
            current_time = datetime.fromisoformat(item["ts"])

            # Look for recent user messages that this might be echoing
            for line in lines[-10:]:  # Check last 10 entries
                if line.strip():
                    recent_item = json.loads(line)
                    if (recent_item["role"] == "user" and
                        recent_item.get("platform") == "claude"):

                        recent_time = datetime.fromisoformat(recent_item["ts"])
                        time_diff = (current_time - recent_time).total_seconds()

                        # Check within 30 seconds for name-prefixed echo (include same timestamp)
                        if 0 <= time_diff <= 30:
                            user_content = recent_item["content"]

                            # Check if assistant content is user content with single char prefix
                            if (len(content) == len(user_content) + 1 and
                                content[1:] == user_content and
                                len(user_content) >= 10):  # Only for substantial content

                                print(f"NAME PREFIX ECHO BLOCKED: Assistant echoing user input '{user_content}' with prefix '{content[0]}'")
                                return PlainTextResponse("ok")

        except Exception as e:
            print(f"NAME PREFIX FILTER ERROR: {e}")

    # Check if content should be filtered
    
    # Check for signal processing filter decision
    signal_processing = metadata.get("signalProcessing", {})
    is_signal_noise = signal_processing.get("filtered", False) or metadata.get("isSignalNoise", False)
    signal_filters = signal_processing.get("filteredBy", []) or metadata.get("signalProcessingFilter", [])
    
    print(f"SIGNAL DEBUG: metadata.signalProcessing={signal_processing}")
    print(f"SIGNAL DEBUG: filtered={signal_processing.get('filtered', 'missing')}, is_signal_noise={is_signal_noise}")
    
    print(f"BEFORE FILTER: calling is_noise_content for content length {len(content)}")
    is_content_noise = is_noise_content(content, platform, urls)
    
    # Combine content noise and signal processing noise
    is_noise = is_content_noise or is_signal_noise
    
    print(f"AFTER FILTER: content_noise={is_content_noise}, signal_noise={is_signal_noise}, final_noise={is_noise}")
    
    if is_signal_noise:
        print(f"SIGNAL PROCESSING FILTER: '{content[:30]}...' blocked by {signal_filters}")
    
    # Debug logging
    if len(content) > 100:
        print(f"DEBUG: long content ({len(content)} chars): {content[:50]}... -> is_noise={is_noise}")
    if urls:
        print(f"DEBUG: content with URLs: '{content[:30]}...' urls={urls} -> is_noise={is_noise}")
    
    # Always log to verbose log (everything)
    append_rolling(VERBOSE_LOG, item, MAX_LINES)
    append_rolling(RECENT, item, RECENT_N)
    
    # Only log to filtered log if not noise (content noise OR signal noise)
    if not is_noise:
        append_rolling(LOG, item, MAX_LINES)
    
    # Enhanced logging with platform and metadata info
    metadata = item.get("metadata", {})
    tools = metadata.get("tools", [])
    artifacts = metadata.get("artifacts", [])
    
    log_details = f"logged: {platform}-{item['role']} chars:{len(content)} content:'{content[:30]}...'"
    if tools:
        log_details += f" tools:{','.join(tools)}"
    if artifacts:
        log_details += f" artifacts:{len(artifacts)}"
    if is_noise:
        log_details += " [FILTERED - not in chat.log]"
    else:
        log_details += " [SAVED to chat.log]"
    
    print(log_details)
    return PlainTextResponse("ok")

@app.post("/diagnostic")
async def log_diagnostic(req: Request):
    """Endpoint for receiving raw diagnostic data from Claude transmission analysis"""
    data = await req.json()
    diagnostic_item = {
        "ts": datetime.now().isoformat(timespec="seconds"),
        "type": data.get("type", "diagnostic"),
        "timestamp": data.get("timestamp"),
        "elementSignature": data.get("elementSignature"),
        "conversationContext": data.get("conversationContext"),
        "transmissionType": data.get("transmissionType")
    }
    
    # Log diagnostic data to separate file
    diagnostic_path = ROOT / "diagnostic.ndjson"
    append_rolling(diagnostic_path, diagnostic_item, 1000)  # Keep more diagnostic entries
    
    # Enhanced console output for diagnostic data
    element = diagnostic_item.get("elementSignature", {})
    text_preview = element.get("textPreview", "")[:50] if element else ""
    
    print(f"🔍 DIAGNOSTIC: {diagnostic_item['transmissionType']} - '{text_preview}' (len:{element.get('textLength', 0) if element else 0})")
    
    return PlainTextResponse("ok")

@app.post("/analytics")
async def log_analytics(req: Request):
    """Enhanced analytics endpoint for comprehensive retransmission analysis"""
    data = await req.json()
    analytics_item = {
        "ts": datetime.now().isoformat(timespec="seconds"),
        "sessionTime": data.get("sessionTime"),
        "type": data.get("type"),
        "testPhase": data.get("testPhase"),
        "url": data.get("url"),
        "conversationId": data.get("conversationId"),
        "data": data.get("data")
    }
    
    # Log analytics to separate file  
    analytics_path = ROOT / "analytics.ndjson"
    append_rolling(analytics_path, analytics_item, 2000)  # Keep extensive analytics
    
    # Enhanced console output for analytics
    event_type = analytics_item.get("type", "unknown")
    test_phase = analytics_item.get("testPhase", "none")
    
    if event_type == "transmission":
        transmission_data = analytics_item.get("data", {})
        role = transmission_data.get("role", "unknown")
        is_duplicate = transmission_data.get("isDuplicate", False)
        text_preview = transmission_data.get("text", "")[:50]
        
        dup_flag = " [DUPLICATE]" if is_duplicate else ""
        print(f"ANALYTICS [{test_phase}]: {role} transmission - '{text_preview}'{dup_flag}")
        
    elif event_type == "duplicate_detected":
        dup_data = analytics_item.get("data", {})
        pattern = dup_data.get("duplicateInfo", {}).get("pattern", "unknown")
        text_preview = dup_data.get("text", "")[:50]
        print(f"DUPLICATE PATTERN [{test_phase}]: {pattern} - '{text_preview}'")
        
    elif event_type == "conversation_event":
        event_details = analytics_item.get("data", {})
        event_subtype = event_details.get("eventType", "unknown")
        print(f"CONVERSATION EVENT [{test_phase}]: {event_subtype}")
        
    elif event_type == "test_start":
        test_name = analytics_item.get("data", {}).get("testName", "unknown")
        print(f"TEST START: {test_name}")
        
    elif event_type == "test_end":
        test_data = analytics_item.get("data", {})
        test_name = test_data.get("testName", "unknown")
        transmission_count = test_data.get("transmissionCount", 0)
        duplicate_count = test_data.get("duplicateCount", 0)
        print(f"TEST END: {test_name} ({transmission_count} transmissions, {duplicate_count} duplicates)")
    
    return PlainTextResponse("ok")

@app.get("/health")
async def health():
    return PlainTextResponse("ok")

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8788)