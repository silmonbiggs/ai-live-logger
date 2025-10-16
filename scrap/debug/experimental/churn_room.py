#!/usr/bin/env python3
"""
Churn Room - A unified system for LLM-directed multimedia experiences.
"""

import json
import time
import threading
import webbrowser
import re
import signal
import atexit
import os
import sys
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Union, Callable
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler


class OutputCapture:
    """Captures stdout/stderr to both console and file with real-time writing."""
    
    def __init__(self, log_file: str):
        self.log_file = Path(log_file)
        self.original_stdout = sys.stdout
        self.original_stderr = sys.stderr
        self.session_start = time.strftime("%Y-%m-%d %H:%M:%S")
        
        # Initialize the log file immediately
        try:
            with open(self.log_file, 'w', encoding='utf-8') as f:
                f.write("=== ChurnRoom Debug Output ===\n")
                f.write(f"Session started: {self.session_start}\n")
                f.write("=" * 50 + "\n\n")
            print(f"[DEBUG] Output capture initialized: {self.log_file}")
        except Exception as e:
            print(f"[DEBUG] Failed to initialize log file: {e}")
        
    def write(self, text):
        # Write to original stdout/stderr
        self.original_stdout.write(text)
        self.original_stdout.flush()
        
        # Write immediately to file with timestamp
        if text.strip():  # Only write non-empty lines
            try:
                timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
                log_line = f"[{timestamp}] {text}"
                with open(self.log_file, 'a', encoding='utf-8') as f:
                    f.write(log_line)
                    if not text.endswith('\n'):
                        f.write('\n')
                    f.flush()  # Force write to disk
            except Exception as e:
                # Don't print error to avoid recursion, just ignore
                pass
    
    def flush(self):
        self.original_stdout.flush()
    
    def save_to_file(self):
        """Add session end marker to file."""
        try:
            with open(self.log_file, 'a', encoding='utf-8') as f:
                f.write(f"\nSession ended: {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
                f.flush()
            print(f"Debug session completed: {self.log_file}")
        except Exception as e:
            print(f"Failed to finalize debug output: {e}")


# Initialize output capture
output_capture = OutputCapture("churn_room_py_dump.txt")
sys.stdout = output_capture
sys.stderr = output_capture

def take_debug_screenshot():
    """Take a screenshot for debugging purposes."""
    try:
        screenshot_path = Path("Capture.PNG")
        print(f"[DEBUG] Taking screenshot: {screenshot_path}")
        
        # Try multiple screenshot methods for maximum compatibility
        screenshot_taken = False
        
        # Method 1: Try PIL/Pillow (most reliable)
        try:
            from PIL import ImageGrab
            screenshot = ImageGrab.grab()
            # Ensure directory exists
            screenshot_path.parent.mkdir(parents=True, exist_ok=True)
            screenshot.save(screenshot_path)
            print(f"[DEBUG] Screenshot saved via PIL: {screenshot_path}")
            screenshot_taken = True
        except ImportError:
            print("[DEBUG] PIL not available for screenshot")
            print("[DEBUG] Install with: pip install Pillow")
        except Exception as e:
            print(f"[DEBUG] PIL screenshot failed: {e}")
            import traceback
            traceback.print_exc()
        
        # Method 2: Try pyautogui as fallback
        if not screenshot_taken:
            try:
                import pyautogui
                screenshot = pyautogui.screenshot()
                screenshot.save(screenshot_path)
                print(f"[DEBUG] Screenshot saved via pyautogui: {screenshot_path}")
                screenshot_taken = True
            except ImportError:
                print("[DEBUG] pyautogui not available for screenshot")
            except Exception as e:
                print(f"[DEBUG] pyautogui screenshot failed: {e}")
        
        # Method 3: Windows-specific fallback using win32gui
        if not screenshot_taken and os.name == 'nt':
            try:
                import win32gui
                import win32ui
                import win32con
                from ctypes import windll
                
                # Get screen dimensions
                user32 = windll.user32
                screensize = user32.GetSystemMetrics(0), user32.GetSystemMetrics(1)
                
                # Create device context
                hdesktop = win32gui.GetDesktopWindow()
                desktop_dc = win32gui.GetWindowDC(hdesktop)
                img_dc = win32ui.CreateDCFromHandle(desktop_dc)
                mem_dc = img_dc.CreateCompatibleDC()
                
                # Create bitmap
                screenshot_bmp = win32ui.CreateBitmap()
                screenshot_bmp.CreateCompatibleBitmap(img_dc, screensize[0], screensize[1])
                mem_dc.SelectObject(screenshot_bmp)
                
                # Copy screen to bitmap
                mem_dc.BitBlt((0, 0), screensize, img_dc, (0, 0), win32con.SRCCOPY)
                
                # Save bitmap
                bmpinfo = screenshot_bmp.GetInfo()
                bmpstr = screenshot_bmp.GetBitmapBits(True)
                
                # Convert to PIL Image and save
                try:
                    from PIL import Image
                    img = Image.frombuffer('RGB', (bmpinfo['bmWidth'], bmpinfo['bmHeight']), bmpstr, 'raw', 'BGRX', 0, 1)
                    img.save(screenshot_path)
                    print(f"[DEBUG] Screenshot saved via win32: {screenshot_path}")
                    screenshot_taken = True
                except ImportError:
                    print("[DEBUG] PIL not available for win32 screenshot conversion")
                
                # Cleanup
                mem_dc.DeleteDC()
                win32gui.DeleteObject(screenshot_bmp.GetHandle())
                win32gui.ReleaseDC(hdesktop, desktop_dc)
                
            except ImportError:
                print("[DEBUG] win32gui not available for screenshot")
            except Exception as e:
                print(f"[DEBUG] win32 screenshot failed: {e}")
        
        # Method 4: System command fallback (Windows)
        if not screenshot_taken and os.name == 'nt':
            try:
                import subprocess
                # Use built-in Windows screenshot tool
                subprocess.run([
                    'powershell', '-command',
                    f'Add-Type -AssemblyName System.Drawing; '
                    f'$bitmap = New-Object System.Drawing.Bitmap([System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Width, [System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Height); '
                    f'$graphics = [System.Drawing.Graphics]::FromImage($bitmap); '
                    f'$graphics.CopyFromScreen([System.Windows.Forms.Screen]::PrimaryScreen.Bounds.X, [System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Y, 0, 0, $bitmap.Size); '
                    f'$bitmap.Save("{screenshot_path.absolute()}"); '
                    f'$bitmap.Dispose(); $graphics.Dispose()'
                ], capture_output=True, check=True)
                print(f"[DEBUG] Screenshot saved via PowerShell: {screenshot_path}")
                screenshot_taken = True
            except Exception as e:
                print(f"[DEBUG] PowerShell screenshot failed: {e}")
        
        if not screenshot_taken:
            print("[DEBUG] All screenshot methods failed - no screenshot taken")
            return False
        
        return True
        
    except Exception as e:
        print(f"[DEBUG] Screenshot error: {e}")
        return False

def cleanup_output_capture():
    """Restore original stdout/stderr and save captured output."""
    global output_capture
    if output_capture:
        # Take debug screenshot before cleanup
        print("[DEBUG] Taking debug screenshot...")
        take_debug_screenshot()
        
        # Restore original streams
        sys.stdout = output_capture.original_stdout
        sys.stderr = output_capture.original_stderr
        # Save captured output to file
        output_capture.save_to_file()

# Register cleanup for program exit
atexit.register(cleanup_output_capture)

# Import Qt VLC Player
try:
    from qt_vlc_player import QtVLCPlayer, QT_AVAILABLE as QT_VLC_AVAILABLE
    if QT_VLC_AVAILABLE:
        from PyQt5 import QtWidgets, QtCore
        QT_AVAILABLE = True
    else:
        QtVLCPlayer = None
        QtWidgets = None
        QT_AVAILABLE = False
except ImportError:
    QtVLCPlayer = None
    QtWidgets = None
    QT_AVAILABLE = False
    print("Qt VLC Player not available - falling back to raw VLC")

try:
    import vlc
    print(f"[VLC] python-vlc module imported successfully")
    try:
        vlc_version = vlc.libvlc_get_version()
        if vlc_version:
            print(f"[VLC] VLC library version: {vlc_version.decode()}")
        else:
            print(f"[VLC] VLC library loaded but version unavailable")
    except Exception as ve:
        print(f"[VLC] VLC library access error: {ve}")
except ImportError as ie:
    vlc = None
    print(f"[VLC] python-vlc module not available: {ie}")
    print("[VLC] Install with: pip install python-vlc")
    print("[VLC] Also ensure VLC media player is installed on system")

try:
    import yt_dlp
except ImportError:
    yt_dlp = None
    print("yt-dlp not available - YouTube links will open in browser")

try:
    import tkinter as tk
    from tkinter import ttk
except ImportError:
    tk = None
    print("tkinter not available - no overlay captions")



@dataclass
class MediaSegment:
    """Represents a piece of media with timing and metadata."""
    url: str
    start: float = 0.0
    end: float = 0.0
    caption: str = ""
    volume: float = 1.0
    media_type: str = "unknown"
    
    def duration(self) -> float:
        return max(0, self.end - self.start) if self.end > self.start else 0


@dataclass 
class MediaCommand:
    """Represents a command from the LLM."""
    action: str
    segments: List[MediaSegment] = field(default_factory=list)
    params: Dict = field(default_factory=dict)


class MediaResolver:
    """Handles different media types and resolves URLs to playable streams."""
    
    VIDEO_EXTS = {".mp4", ".webm", ".mkv", ".mov", ".m4v", ".avi"}
    AUDIO_EXTS = {".mp3", ".wav", ".flac", ".m4a", ".ogg"}
    IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif"}
    
    # URL resolution cache for performance
    _stream_cache = {}
    _cache_timestamps = {}
    
    @staticmethod
    def classify_media(url: str) -> str:
        """Determine media type from URL."""
        parsed = urlparse(url)
        
        if "youtube.com/watch" in url or "youtu.be/" in url:
            return "youtube"
        
        if parsed.scheme == "file" or (not parsed.scheme and Path(url).exists()):
            path = Path(url)
            ext = path.suffix.lower()
            if ext in MediaResolver.VIDEO_EXTS:
                return "video"
            elif ext in MediaResolver.AUDIO_EXTS:
                return "audio"
            elif ext in MediaResolver.IMAGE_EXTS:
                return "image"
            return "file"
        
        ext = Path(parsed.path).suffix.lower()
        if ext in MediaResolver.VIDEO_EXTS:
            return "video"
        elif ext in MediaResolver.AUDIO_EXTS:
            return "audio"
        elif ext in MediaResolver.IMAGE_EXTS:
            return "image"
        
        return "web"
    
    @staticmethod
    def resolve_youtube_stream(url: str) -> Optional[str]:
        """Get direct stream URL from YouTube with caching."""
        if not yt_dlp:
            return None
        
        # Check cache first (cache expires after 5 minutes)
        import time
        now = time.time()
        if url in MediaResolver._stream_cache:
            cache_time = MediaResolver._cache_timestamps.get(url, 0)
            if now - cache_time < 300:  # 5 minutes
                print(f"[STREAM] ✓ Using cached URL for: {url[:50]}...")
                return MediaResolver._stream_cache[url]
        
        try:
            # Streamlined options for fast extraction with flexible format selection
            ydl_opts = {
                "quiet": True,
                "skip_download": True,
                "noplaylist": True,
                # More flexible format selection - prioritize smaller/lower quality for VLC performance
                "format": ("worst[height<=720][vcodec!=none]/worst[height<=1080][vcodec!=none]/"
                          "worst[vcodec!=none]/worst[ext=mp4]/worst"),
                "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "referer": "https://www.youtube.com/",
                "extractor_retries": 1,  # Limit retries for speed
                "fragment_retries": 1,
            }
            
            print(f"[STREAM] Resolving YouTube URL: {url[:50]}...")
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                stream_url = info.get("url")
                if stream_url:
                    # Cache the result
                    MediaResolver._stream_cache[url] = stream_url
                    MediaResolver._cache_timestamps[url] = now
                    
                    # Clean old cache entries
                    if len(MediaResolver._stream_cache) > 50:
                        oldest_urls = sorted(MediaResolver._cache_timestamps.items(), key=lambda x: x[1])[:10]
                        for old_url, _ in oldest_urls:
                            MediaResolver._stream_cache.pop(old_url, None)
                            MediaResolver._cache_timestamps.pop(old_url, None)
                    
                    print(f"[STREAM] ✓ Resolved and cached: {len(stream_url[:50])}+ chars")
                    return stream_url
                else:
                    print(f"[STREAM] ✗ No stream URL found")
                    return None
        except Exception as e:
            print(f"[STREAM] YouTube resolution failed: {e}")
            return None


class CaptionOverlay:
    """Manages overlay text display."""
    
    def __init__(self):
        self.current_window = None
        
    def show(self, text: str, duration_ms: int = 4000, position: str = "bottom-left"):
        """Display overlay text."""
        if not tk:
            print(f"CAPTION: {text}")
            return
            
        threading.Thread(target=self._show_window, 
                        args=(text, duration_ms, position), 
                        daemon=True).start()
    
    def _show_window(self, text: str, duration_ms: int, position: str):
        """Internal method to create and show the overlay window."""
        try:
            root = tk.Tk()
            root.overrideredirect(True)
            root.attributes("-topmost", True)
            # More visible styling with border
            root.configure(bg="#FFFF00")  # Bright yellow background
            
            label = tk.Label(
                root, 
                text=text, 
                fg="#000000",  # Black text
                bg="#FFFF00",  # Yellow background
                font=("Arial", 16, "bold"),
                wraplength=600,
                justify="center",
                padx=20,
                pady=15,
                relief="solid",
                borderwidth=3
            )
            label.pack()
            
            root.update_idletasks()
            w, h = root.winfo_width(), root.winfo_height()
            sw, sh = root.winfo_screenwidth(), root.winfo_screenheight()
            
            # Always center for maximum visibility
            x, y = (sw - w) // 2, (sh - h) // 2
                
            root.geometry(f"+{x}+{y}")
            root.after(duration_ms, root.destroy)
            root.mainloop()
            
        except Exception as e:
            print(f"Caption overlay error: {e}")


class MediaPlayer:
    """Handles actual media playback using Qt VLC Players."""
    
    def __init__(self, layout_manager=None, churn_room=None):
        # Use layout manager for positioning or fallback to defaults
        if layout_manager:
            self.layout_manager = layout_manager
            self.screen_width = layout_manager.screen_width
            self.screen_height = layout_manager.screen_height
        else:
            # Fallback for backwards compatibility
            self.screen_width, self.screen_height = self._get_screen_dimensions()
            self.layout_manager = None
        
        # Store reference to ChurnRoom for emergency controls
        self.churn_room = churn_room
        
        # Initialize Qt Application if needed
        self.qt_app = None
        self.qt_available_local = QT_AVAILABLE  # Store in instance variable to avoid scoping issues
        
        if self.qt_available_local and QtWidgets:
            try:
                # Force creation of new Qt application in main thread
                import sys
                import threading
                
                # Check if we're in the main thread
                if threading.current_thread() is threading.main_thread():
                    if not QtWidgets.QApplication.instance():
                        # Ensure we're creating Qt app with proper arguments
                        self.qt_app = QtWidgets.QApplication(sys.argv if sys.argv else [])
                        print("[QtVLC] Created Qt application in main thread")
                    else:
                        self.qt_app = QtWidgets.QApplication.instance()
                        print("[QtVLC] Using existing Qt application")
                else:
                    print("[QtVLC] Warning: Not in main thread - Qt players will be disabled")
                    self.qt_app = None
                    self.qt_available_local = False
                    
            except Exception as qt_error:
                print(f"[QtVLC] Qt application creation failed: {qt_error}")
                self.qt_app = None
                self.qt_available_local = False
        
        # Create Qt VLC players if available, otherwise fallback to raw VLC
        self.qt_player_1 = None
        self.qt_player_2 = None
        self.vlc_player = None
        self.vlc_player_2 = None
        self.vlc_instance = None
        self.vlc_instance_2 = None
        
        if self.qt_available_local and QtVLCPlayer and self.qt_app:
            try:
                print("[QtVLC] Attempting to create Qt VLC players...")
                # Try to create Qt VLC players - but don't fail completely if it doesn't work
                # We'll create them on-demand instead
                print("[QtVLC] Qt players will be created on first use (lazy initialization)")
                
            except Exception as e:
                print(f"[QtVLC] Qt setup failed: {e}")
                # Fall back to raw VLC
                self._create_fallback_vlc_players()
        else:
            print("[QtVLC] Qt VLC Player not available, using raw VLC fallback")
            self._create_fallback_vlc_players()
        
        # ALWAYS create fallback VLC players as backup, even if Qt is available
        # This ensures we have working VLC players when Qt can't be used (e.g., threading issues)
        print("[VLC] Creating backup fallback VLC players...")
        self._create_fallback_vlc_players()
        
        self.current_segment = None
        self.is_playing = False
        self.preloaded_segment = None
        self.active_player = 1  # Track which player is currently active (1 or 2)
        
        # Register cleanup for graceful shutdown
        atexit.register(self.emergency_cleanup)
        
        # Emergency close button state (for fallback mode)
        self.emergency_window = None
    
    def _ensure_qt_player(self, player_number: int) -> bool:
        """Ensure Qt VLC player exists, creating it if necessary."""
        try:
            # Check if we can use Qt at all
            if not self.qt_available_local or not self.qt_app:
                print(f"[QtVLC] Qt not available for player creation")
                return False
            
            # Check if we're in the main thread - Qt objects must be created there
            import threading
            if threading.current_thread() is not threading.main_thread():
                print(f"[QtVLC] Cannot create Qt player from non-main thread")
                return False
                
            from qt_vlc_player import QtVLCPlayer
            
            print(f"[QtVLC] Ensuring Qt player {player_number} exists...")
            
            # Check if player already exists and is valid
            existing_player = self.qt_player_1 if player_number == 1 else self.qt_player_2
            if existing_player and hasattr(existing_player, 'vlc_player'):
                print(f"[QtVLC] Qt player {player_number} already exists and is valid")
                return True
            
            # Create new player with error handling
            try:
                new_player = QtVLCPlayer(window_title=f"ChurnRoom Player {player_number}")
                
                # Connect signals
                new_player.playback_stopped.connect(self._on_qt_player_stopped)
                
                # Position the new player
                if self.layout_manager:
                    x_pos, y_pos, width, height = self.layout_manager.get_vlc_position()
                else:
                    x_pos, y_pos, width, height = 50, 50, 800, 600
                
                # Offset secondary player
                if player_number == 2:
                    x_pos += 30
                    y_pos += 30
                
                new_player.move(x_pos, y_pos)
                new_player.resize(width, height)
                
                # Assign to the correct slot
                if player_number == 1:
                    self.qt_player_1 = new_player
                else:
                    self.qt_player_2 = new_player
                
                print(f"[QtVLC] Successfully created Qt player {player_number}")
                return True
                
            except Exception as create_error:
                print(f"[QtVLC] Failed to create Qt player {player_number}: {create_error}")
                # Import traceback to show more details
                import traceback
                print(f"[QtVLC] Qt player creation traceback:")
                traceback.print_exc()
                return False
            
        except Exception as e:
            print(f"[QtVLC] Failed to ensure Qt player {player_number}: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def _create_fallback_vlc_players(self):
        """Create raw VLC players as fallback when Qt is not available."""
        # Use minimal VLC args to ensure it actually starts
        vlc_args = [
            "--quiet",                     # Suppress most output
            "--verbosity=0",               # Set verbosity to minimum
        ]
        
        if vlc:
            try:
                print(f"[VLC] Creating fallback VLC instance with args: {vlc_args}")
                print(f"[VLC] VLC version: {vlc.libvlc_get_version().decode() if vlc.libvlc_get_version else 'unknown'}")
                
                # Try multiple VLC instance creation methods
                self.vlc_instance = None
                
                # Method 1: With arguments
                try:
                    self.vlc_instance = vlc.Instance(vlc_args)
                    if self.vlc_instance:
                        print(f"[VLC] Primary VLC instance created successfully (with args)")
                    else:
                        print(f"[VLC] Method 1 failed: VLC.Instance(args) returned None")
                except Exception as e:
                    print(f"[VLC] Method 1 failed with exception: {e}")
                
                # Method 2: Without arguments (if method 1 failed)
                if not self.vlc_instance:
                    try:
                        print(f"[VLC] Trying VLC instance creation without arguments...")
                        self.vlc_instance = vlc.Instance()
                        if self.vlc_instance:
                            print(f"[VLC] Primary VLC instance created successfully (no args)")
                        else:
                            print(f"[VLC] Method 2 failed: VLC.Instance() returned None")
                    except Exception as e:
                        print(f"[VLC] Method 2 failed with exception: {e}")
                
                # Method 3: With specific minimal args (if method 2 failed)
                if not self.vlc_instance:
                    try:
                        print(f"[VLC] Trying VLC instance with minimal args...")
                        self.vlc_instance = vlc.Instance(['--intf', 'dummy'])
                        if self.vlc_instance:
                            print(f"[VLC] Primary VLC instance created successfully (minimal args)")
                        else:
                            print(f"[VLC] Method 3 failed: VLC.Instance(['--intf', 'dummy']) returned None")
                    except Exception as e:
                        print(f"[VLC] Method 3 failed with exception: {e}")
                
                # Create player if instance was successful
                if self.vlc_instance:
                    try:
                        self.vlc_player = self.vlc_instance.media_player_new()
                        if self.vlc_player:
                            print(f"[VLC] Primary fallback VLC player created successfully")
                        else:
                            print(f"[VLC] Failed to create primary fallback media player - VLC instance exists but player creation failed")
                            print(f"[VLC] This may indicate VLC library corruption or missing dependencies")
                    except Exception as e:
                        print(f"[VLC] Player creation failed with exception: {e}")
                else:
                    print(f"[VLC] All VLC instance creation methods failed")
                    print(f"[VLC] This indicates a fundamental VLC/python-vlc compatibility issue")
                
                # Create second instance for seamless switching
                self.vlc_instance_2 = vlc.Instance(vlc_args)
                if self.vlc_instance_2:
                    self.vlc_player_2 = self.vlc_instance_2.media_player_new()
                    if self.vlc_player_2:
                        print(f"[VLC] Secondary fallback VLC player created successfully")
                    else:
                        print(f"[VLC] Failed to create secondary fallback media player")
                else:
                    print(f"[VLC] Failed to create secondary fallback VLC instance")
                
                # Configure player event handling for fallback mode
                if self.vlc_player:
                    event_manager = self.vlc_player.event_manager()
                    event_manager.event_attach(vlc.EventType.MediaPlayerStopped, self._on_player_stopped)
                    event_manager.event_attach(vlc.EventType.MediaPlayerEndReached, self._on_player_end_reached)
                    event_manager.event_attach(vlc.EventType.MediaPlayerEncounteredError, self._on_player_error)
                
                if self.vlc_player_2:
                    event_manager_2 = self.vlc_player_2.event_manager()
                    event_manager_2.event_attach(vlc.EventType.MediaPlayerStopped, self._on_player_stopped)
                    event_manager_2.event_attach(vlc.EventType.MediaPlayerEndReached, self._on_player_end_reached)
                    event_manager_2.event_attach(vlc.EventType.MediaPlayerEncounteredError, self._on_player_error)
                    
            except Exception as e:
                print(f"[VLC] Error creating fallback VLC instances: {e}")
                import traceback
                traceback.print_exc()
        else:
            print(f"[VLC] VLC module not available for fallback")
    
    def _position_qt_players(self):
        """Position Qt VLC players on screen."""
        if not self.qt_player_1:
            return
        
        # Get positioning from layout manager or use defaults
        if self.layout_manager:
            x_pos, y_pos, width, height = self.layout_manager.get_vlc_position()
        else:
            # Position on left side of screen (opposite of ChatGPT)
            x_pos = 50
            y_pos = 50
            width = min(800, self.screen_width // 2 - 100)
            height = min(600, self.screen_height - 150)
        
        # Position primary player
        self.qt_player_1.move(x_pos, y_pos)
        self.qt_player_1.resize(width, height)
        
        # Position secondary player slightly offset
        if self.qt_player_2:
            self.qt_player_2.move(x_pos + 30, y_pos + 30)
            self.qt_player_2.resize(width, height)
        
        # Don't show the players yet - they'll be shown when needed
        print(f"[QtVLC] Positioned Qt players at ({x_pos}, {y_pos}), size ({width}x{height})")
        print(f"[QtVLC] Players ready but hidden until playback starts")
    
    def _on_qt_player_stopped(self):
        """Handle Qt VLC player stopped signal."""
        self.is_playing = False
        self.current_segment = None
        print("[QtVLC] Qt player stopped by user action")
    
    def _get_screen_dimensions(self):
        """Get screen dimensions for window positioning."""
        try:
            if tk:
                root = tk.Tk()
                root.withdraw()  # Hide the window
                width = root.winfo_screenwidth()
                height = root.winfo_screenheight()
                root.destroy()
                return width, height
            else:
                # Fallback dimensions
                return 1920, 1080
        except:
            return 1920, 1080
    
    def _on_player_stopped(self, event):
        """Handle raw VLC player stopped event (including window close)."""
        self.is_playing = False
        self.current_segment = None
        if self.churn_room:
            self.churn_room._is_vlc_playing = False  # Reset execution state
            self.churn_room._hide_emergency_button()
        print("[VLC] Raw player stopped by user action")
        # Force close VLC window after short delay
        threading.Thread(target=self._delayed_vlc_cleanup, daemon=True).start()
    
    def _on_player_end_reached(self, event):
        """Handle media playback completion."""
        self.is_playing = False
        self.current_segment = None
        if self.churn_room:
            self.churn_room._is_vlc_playing = False  # Reset execution state
            self.churn_room._hide_emergency_button()
        print("[VLC] Media playback completed - auto-closing VLC window")
        # Force close VLC window after short delay
        threading.Thread(target=self._delayed_vlc_cleanup, daemon=True).start()
    
    def _on_player_error(self, event):
        """Handle VLC player errors."""
        self.is_playing = False
        self.current_segment = None
        if self.churn_room:
            self.churn_room._is_vlc_playing = False  # Reset execution state
            self.churn_room._hide_emergency_button()
        print("[VLC] Player error encountered - closing VLC window")
        # Force close VLC window after short delay
        threading.Thread(target=self._delayed_vlc_cleanup, daemon=True).start()
    
    def _delayed_vlc_cleanup(self):
        """Close VLC windows after a short delay."""
        try:
            import time
            time.sleep(1)  # Give VLC time to process the stop event
            
            print("[VLC CLEANUP] Attempting to close VLC windows...")
            
            # Try to close VLC windows using multiple methods
            self._close_vlc_windows_forcefully()
            
        except Exception as e:
            print(f"[VLC CLEANUP] Error during cleanup: {e}")
    
    def _close_vlc_windows_forcefully(self):
        """Force close VLC windows using multiple methods."""
        try:
            closed_count = 0
            
            # Method 1: Use Windows API to find and close VLC windows
            if os.name == 'nt':
                try:
                    import win32gui
                    import win32con
                    
                    def close_vlc_window(hwnd, windows):
                        if win32gui.IsWindowVisible(hwnd):
                            class_name = win32gui.GetClassName(hwnd)
                            window_text = win32gui.GetWindowText(hwnd)
                            
                            # Look for VLC windows
                            if (class_name == "Qt5QWindowIcon" or 
                                "vlc" in class_name.lower() or
                                "VLC media player" in window_text):
                                
                                print(f"[VLC CLEANUP] Closing VLC window: '{window_text}' (class: {class_name})")
                                win32gui.PostMessage(hwnd, win32con.WM_CLOSE, 0, 0)
                                windows.append(hwnd)
                        return True
                    
                    vlc_windows = []
                    win32gui.EnumWindows(close_vlc_window, vlc_windows)
                    closed_count += len(vlc_windows)
                    
                except ImportError:
                    print("[VLC CLEANUP] win32gui not available for window closure")
            
            # Method 2: Use subprocess to kill VLC processes
            try:
                import subprocess
                
                # List VLC processes
                if os.name == 'nt':
                    result = subprocess.run(['tasklist', '/FI', 'IMAGENAME eq vlc.exe'], 
                                          capture_output=True, text=True, check=False)
                    if 'vlc.exe' in result.stdout:
                        # Kill VLC processes
                        kill_result = subprocess.run(['taskkill', '/F', '/IM', 'vlc.exe'], 
                                                   capture_output=True, text=True, check=False)
                        if kill_result.returncode == 0:
                            print("[VLC CLEANUP] Killed VLC processes via taskkill")
                            closed_count += 1
                        else:
                            print(f"[VLC CLEANUP] Taskkill failed: {kill_result.stderr}")
                else:
                    # Unix/Linux
                    subprocess.run(['pkill', 'vlc'], check=False)
                    print("[VLC CLEANUP] Killed VLC processes via pkill")
                    closed_count += 1
                    
            except Exception as proc_error:
                print(f"[VLC CLEANUP] Process kill method failed: {proc_error}")
            
            if closed_count > 0:
                print(f"[VLC CLEANUP] Successfully closed {closed_count} VLC instances")
            else:
                print("[VLC CLEANUP] No VLC windows found to close")
                
        except Exception as e:
            print(f"[VLC CLEANUP] Error in forceful window closure: {e}")
    
    def _position_vlc_window(self):
        """Position VLC window to not obscure ChatGPT."""
        # Position window on the LEFT side of screen, leaving right side for ChatGPT
        x_pos = 50  # Left side of screen
        y_pos = 50
        
        if self.vlc_player and os.name == 'nt':  # Windows only
            try:
                import time
                time.sleep(0.5)  # Give VLC time to create window
                
                try:
                    import win32gui
                    import win32con
                    
                    def enum_windows_callback(hwnd, windows):
                        if win32gui.IsWindowVisible(hwnd):
                            window_text = win32gui.GetWindowText(hwnd)
                            class_name = win32gui.GetClassName(hwnd)
                            # Look for VLC windows by class name or window text
                            if ('VLC' in window_text or 'vlc' in class_name.lower() or 
                                'Qt5QWindowIcon' in class_name or 'QWidget' in class_name):
                                windows.append((hwnd, window_text, class_name))
                        return True
                    
                    windows = []
                    win32gui.EnumWindows(enum_windows_callback, windows)
                    
                    for hwnd, title, class_name in windows:
                        # Position window on LEFT side of screen and bring to front
                        width = min(800, self.screen_width // 2 - 100)
                        height = min(600, self.screen_height - 150)
                        
                        # First, set as topmost to force it above other windows
                        win32gui.SetWindowPos(hwnd, win32con.HWND_TOPMOST, 
                                            x_pos, y_pos, width, height, 
                                            win32con.SWP_SHOWWINDOW)
                        
                        # Remove topmost flag but keep it in front
                        win32gui.SetWindowPos(hwnd, win32con.HWND_NOTOPMOST,
                                            0, 0, 0, 0,
                                            win32con.SWP_NOMOVE | win32con.SWP_NOSIZE | win32con.SWP_SHOWWINDOW)
                        
                        # Use safer positioning without SetForegroundWindow
                        win32gui.BringWindowToTop(hwnd)
                        win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)
                        
                        print(f"[VLC] Positioned window: {title} at ({x_pos}, {y_pos})")
                        
                except ImportError:
                    print("[VLC] pywin32 not available for window positioning")
                    
            except Exception as e:
                print(f"[VLC] Could not position window: {e}")
    
    def _open_browser_positioned(self, url: str, segment: MediaSegment = None):
        """Open browser in a positioned window that doesn't obscure ChatGPT."""
        try:
            import subprocess
            import os
            
            # Get position from layout manager if available
            if self.layout_manager:
                x_pos, y_pos, width, height = self.layout_manager.get_browser_position()
            else:
                # Fallback positioning
                x_pos = self.screen_width // 2 + 10
                y_pos = 10
                width = self.screen_width // 2 - 50
                height = self.screen_height - 100
            
            if os.name == 'nt':  # Windows
                # Try to open Chrome with specific positioning
                chrome_paths = [
                    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
                    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
                    os.path.expanduser(r"~\AppData\Local\Google\Chrome\Application\chrome.exe")
                ]
                
                chrome_path = None
                for path in chrome_paths:
                    if os.path.exists(path):
                        chrome_path = path
                        break
                
                if chrome_path:
                    # Use layout manager positioning if available, otherwise use left side positioning
                    if self.layout_manager:
                        layout_x, layout_y, layout_w, layout_h = self.layout_manager.get_browser_position()
                        video_x, video_y, video_width, video_height = layout_x, layout_y, layout_w, layout_h
                        print(f"[BROWSER] Using layout manager position: ({video_x}, {video_y}), size ({video_width}x{video_height})")
                    else:
                        # Fallback: Calculate position for left side (opposite of ChatGPT on right)
                        video_width = min(800, self.screen_width // 2 - 100)  # Left half minus margins
                        video_height = min(600, self.screen_height - 150)
                        video_x = 50  # Far left side of screen
                        video_y = 50
                        print(f"[BROWSER] Using fallback left positioning: ({video_x}, {video_y}), size ({video_width}x{video_height})")
                        print(f"[BROWSER] Screen dimensions: {self.screen_width}x{self.screen_height}")
                    
                    # Create a simple HTML page that auto-closes after duration
                    import tempfile
                    import os
                    
                    # Create temp HTML file that redirects to video but auto-closes
                    temp_dir = tempfile.mkdtemp(prefix="chrome_video_")
                    html_file = os.path.join(temp_dir, "timed_video.html")
                    
                    duration_ms = int(segment.duration() * 1000) if segment and segment.duration() > 0 else 5000
                    
                    html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <title>ChurnRoom Timed Video</title>
    <style>
        body {{ margin: 0; padding: 0; background: #000; }}
        iframe {{ width: 100vw; height: 100vh; border: none; }}
        #countdown {{ position: fixed; top: 10px; right: 10px; color: red; font-size: 24px; font-weight: bold; z-index: 1000; }}
    </style>
</head>
<body>
    <div id="countdown"></div>
    <iframe src="{url}" allowfullscreen></iframe>
    <script>
        let timeLeft = {duration_ms};
        const countdown = document.getElementById('countdown');
        
        const timer = setInterval(() => {{
            timeLeft -= 100;
            const seconds = Math.ceil(timeLeft / 1000);
            countdown.textContent = seconds > 0 ? seconds + 's' : 'CLOSING...';
            
            if (timeLeft <= 0) {{
                clearInterval(timer);
                window.close();
                // Fallback: try to close parent window if this doesn't work
                setTimeout(() => {{
                    try {{ 
                        window.top.close(); 
                        window.parent.close();
                    }} catch(e) {{}}
                }}, 100);
            }}
        }}, 100);
        
        // Keyboard shortcut to close manually
        document.addEventListener('keydown', (e) => {{
            if (e.key === 'Escape') {{
                window.close();
            }}
        }});
    </script>
</body>
</html>
"""
                    
                    with open(html_file, 'w', encoding='utf-8') as f:
                        f.write(html_content)
                    
                    # Use file:// URL to open our HTML wrapper
                    file_url = f"file:///{html_file.replace(os.sep, '/')}"
                    
                    # Simpler Chrome command without temp profile (which seems to cause issues)
                    cmd = [
                        chrome_path,
                        "--new-window",
                        f"--window-position={video_x},{video_y}",
                        f"--window-size={video_width},{video_height}",
                        "--no-first-run",
                        "--no-default-browser-check",
                        "--disable-session-crashed-bubble",
                        "--start-windowed",
                        file_url
                    ]
                    
                    print(f"[BROWSER] Chrome command: {' '.join(cmd[:4])}...")  # Show first few args
                    process = subprocess.Popen(cmd, shell=False)
                    print(f"[BROWSER] Opened Chrome with HTML wrapper at ({video_x}, {video_y}), size ({video_width}x{video_height})")
                    print(f"[BROWSER] JavaScript timer will auto-close window after {duration_ms/1000} seconds")
                    print(f"[BROWSER] HTML file: {html_file}")
                    
                    # Check if process actually started
                    time.sleep(0.5)  # Give Chrome time to start
                    if process.poll() is None:
                        print(f"[BROWSER] Chrome process {process.pid} is running")
                    else:
                        print(f"[BROWSER] WARNING: Chrome process {process.pid} exited immediately with code {process.returncode}")
                    
                    # Force positioning using Windows API after Chrome starts
                    if os.name == 'nt':
                        threading.Thread(
                            target=self._force_chrome_position_by_title,
                            args=(video_x, video_y, video_width, video_height),
                            daemon=True
                        ).start()
                    
                    # Aggressive positioning enforcement since Chrome ignores initial positioning
                    if os.name == 'nt':
                        threading.Thread(
                            target=self._enforce_chrome_positioning_aggressive, 
                            args=(process.pid, video_x, video_y, video_width, video_height), 
                            daemon=True
                        ).start()
                    
                    return
            
            # Fallback: open in new window (better than new tab)
            webbrowser.open(url, new=1)  # new=1 opens in new window
            print(f"[BROWSER] Opened in new browser window (fallback)")
            
        except Exception as e:
            print(f"[BROWSER] Error opening positioned browser: {e}")
            # Final fallback
            webbrowser.open(url, new=1)
    
    def _enforce_chrome_positioning(self, process_pid, x_pos, y_pos, width, height):
        """Enforce Chrome window positioning using Windows API."""
        try:
            import time
            time.sleep(1.5)  # Give Chrome time to fully load
            
            try:
                import win32gui
                import win32con
                import win32process
                
                def enum_windows_callback(hwnd, windows):
                    if win32gui.IsWindowVisible(hwnd):
                        try:
                            # Get process ID of window
                            _, window_pid = win32process.GetWindowThreadProcessId(hwnd)
                            if window_pid == process_pid:
                                window_text = win32gui.GetWindowText(hwnd)
                                class_name = win32gui.GetClassName(hwnd)
                                # Look for Chrome main windows
                                if ('Chrome' in class_name or 'chrome' in window_text.lower() or 
                                    class_name == 'Chrome_WidgetWin_1'):
                                    windows.append((hwnd, window_text, class_name))
                        except:
                            pass  # Ignore permission errors
                    return True
                
                windows = []
                win32gui.EnumWindows(enum_windows_callback, windows)
                
                for hwnd, title, class_name in windows:
                    try:
                        # Force window to be restored (not maximized/minimized)
                        win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)
                        time.sleep(0.1)
                        
                        # Set position and size
                        win32gui.SetWindowPos(
                            hwnd, win32con.HWND_TOP, 
                            x_pos, y_pos, width, height, 
                            win32con.SWP_SHOWWINDOW
                        )
                        
                        # Ensure it's not maximized
                        win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)
                        
                        print(f"[BROWSER] Enforced positioning for Chrome window: {title}")
                        break  # Only position the first matching window
                        
                    except Exception as e:
                        print(f"[BROWSER] Could not position Chrome window {title}: {e}")
                        
            except ImportError:
                print("[BROWSER] pywin32 not available for Chrome positioning enforcement")
                
        except Exception as e:
            print(f"[BROWSER] Error enforcing Chrome positioning: {e}")
    
    def _enforce_chrome_positioning_aggressive(self, process_pid, x_pos, y_pos, width, height):
        """Aggressively enforce Chrome window positioning with multiple attempts."""
        try:
            import time
            
            # Multiple positioning attempts as Chrome loads
            for attempt in range(5):  # Try 5 times over 3 seconds
                time.sleep(0.6)  # Wait between attempts
                
                try:
                    import win32gui
                    import win32con
                    import win32process
                    
                    def find_chrome_windows(hwnd, windows):
                        if win32gui.IsWindowVisible(hwnd):
                            try:
                                _, window_pid = win32process.GetWindowThreadProcessId(hwnd)
                                if window_pid == process_pid:
                                    class_name = win32gui.GetClassName(hwnd)
                                    window_text = win32gui.GetWindowText(hwnd)
                                    # Chrome main window classes
                                    if (class_name == 'Chrome_WidgetWin_1' or 
                                        'Chrome' in class_name or
                                        'chrome' in window_text.lower()):
                                        windows.append(hwnd)
                            except:
                                pass
                        return True
                    
                    windows = []
                    win32gui.EnumWindows(find_chrome_windows, windows)
                    
                    for hwnd in windows:
                        try:
                            # Get current window state
                            placement = win32gui.GetWindowPlacement(hwnd)
                            
                            # Force restore if maximized/minimized
                            if placement[1] != win32con.SW_NORMAL:
                                win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)
                                time.sleep(0.1)
                            
                            # Get current position
                            rect = win32gui.GetWindowRect(hwnd)
                            current_x, current_y, current_right, current_bottom = rect
                            current_width = current_right - current_x
                            current_height = current_bottom - current_y
                            
                            # Only reposition if significantly different from target
                            if (abs(current_x - x_pos) > 50 or abs(current_y - y_pos) > 50 or
                                abs(current_width - width) > 100 or abs(current_height - height) > 100):
                                
                                # Force new position and size, bring to front aggressively
                                win32gui.SetWindowPos(
                                    hwnd, 
                                    win32con.HWND_TOPMOST,  # Temporarily topmost
                                    x_pos, y_pos, width, height,
                                    win32con.SWP_SHOWWINDOW
                                )
                                
                                # Multiple techniques to force it to front
                                try:
                                    # Method 1: Show and restore
                                    win32gui.ShowWindow(hwnd, win32con.SW_SHOW)
                                    win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)
                                    
                                    # Method 2: Bring to foreground
                                    win32gui.BringWindowToTop(hwnd)
                                    
                                    # Method 3: Set as foreground (may require thread attachment)
                                    current_thread = win32process.GetCurrentThreadId()
                                    try:
                                        target_thread, _ = win32process.GetWindowThreadProcessId(hwnd)
                                        win32process.AttachThreadInput(current_thread, target_thread, True)
                                        win32gui.SetForegroundWindow(hwnd)
                                        win32process.AttachThreadInput(current_thread, target_thread, False)
                                    except:
                                        # Fallback if thread attachment fails
                                        win32gui.SetForegroundWindow(hwnd)
                                    
                                    # Method 4: Flash window to get attention
                                    import win32api
                                    win32api.FlashWindow(hwnd, True)
                                    
                                except Exception as flash_error:
                                    print(f"[BROWSER] Flash/focus error: {flash_error}")
                                
                                # Remove topmost flag but keep it in front
                                win32gui.SetWindowPos(
                                    hwnd,
                                    win32con.HWND_NOTOPMOST,
                                    0, 0, 0, 0,
                                    win32con.SWP_NOMOVE | win32con.SWP_NOSIZE | win32con.SWP_SHOWWINDOW
                                )
                                
                                print(f"[BROWSER] Attempt {attempt + 1}: Repositioned Chrome from ({current_x},{current_y}) to ({x_pos},{y_pos})")
                            else:
                                # Position is good, but still bring to front aggressively
                                try:
                                    # Use same aggressive front-bringing techniques
                                    win32gui.SetWindowPos(hwnd, win32con.HWND_TOPMOST, 0, 0, 0, 0,
                                                        win32con.SWP_NOMOVE | win32con.SWP_NOSIZE | win32con.SWP_SHOWWINDOW)
                                    
                                    win32gui.BringWindowToTop(hwnd)
                                    win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)
                                    
                                    # Thread attachment for foreground
                                    current_thread = win32process.GetCurrentThreadId()
                                    try:
                                        target_thread, _ = win32process.GetWindowThreadProcessId(hwnd)
                                        win32process.AttachThreadInput(current_thread, target_thread, True)
                                        win32gui.SetForegroundWindow(hwnd)
                                        win32process.AttachThreadInput(current_thread, target_thread, False)
                                    except:
                                        win32gui.SetForegroundWindow(hwnd)
                                    
                                    # Flash and remove topmost
                                    import win32api
                                    win32api.FlashWindow(hwnd, True)
                                    win32gui.SetWindowPos(hwnd, win32con.HWND_NOTOPMOST, 0, 0, 0, 0,
                                                        win32con.SWP_NOMOVE | win32con.SWP_NOSIZE | win32con.SWP_SHOWWINDOW)
                                    
                                    print(f"[BROWSER] Attempt {attempt + 1}: Chrome position good, aggressively brought to front")
                                except Exception as e:
                                    print(f"[BROWSER] Attempt {attempt + 1}: Position good but front-bring failed: {e}")
                                break  # Position is good, stop trying
                            
                        except Exception as e:
                            print(f"[BROWSER] Attempt {attempt + 1}: Error repositioning window: {e}")
                    
                    if not windows:
                        print(f"[BROWSER] Attempt {attempt + 1}: No Chrome windows found yet")
                        
                except ImportError:
                    print("[BROWSER] pywin32 not available for aggressive positioning")
                    break
                    
        except Exception as e:
            print(f"[BROWSER] Error in aggressive Chrome positioning: {e}")
    
    def _force_chrome_position_by_title(self, x: int, y: int, width: int, height: int):
        """Force Chrome window position by finding window with ChurnRoom title."""
        try:
            import time
            time.sleep(2)  # Give Chrome more time to fully load
            
            try:
                import win32gui
                import win32con
                
                def find_chrome_window(hwnd, windows):
                    if win32gui.IsWindowVisible(hwnd):
                        window_text = win32gui.GetWindowText(hwnd)
                        class_name = win32gui.GetClassName(hwnd)
                        
                        # Look for Chrome window with our title or archive.org in title
                        if (class_name == "Chrome_WidgetWin_1" and 
                            ("ChurnRoom" in window_text or "archive.org" in window_text or "Elephants Dream" in window_text)):
                            windows.append(hwnd)
                    return True
                
                # Find Chrome windows
                windows = []
                win32gui.EnumWindows(find_chrome_window, windows)
                
                if windows:
                    # Move the first matching window
                    hwnd = windows[0]
                    current_title = win32gui.GetWindowText(hwnd)
                    print(f"[BROWSER FORCE] Found Chrome window: '{current_title}'")
                    
                    # Force position
                    win32gui.SetWindowPos(hwnd, win32con.HWND_TOP, x, y, width, height, 
                                        win32con.SWP_SHOWWINDOW | win32con.SWP_NOACTIVATE)
                    print(f"[BROWSER FORCE] Moved Chrome window to ({x}, {y}), size ({width}x{height})")
                    
                    # Verify position
                    rect = win32gui.GetWindowRect(hwnd)
                    actual_x, actual_y, actual_right, actual_bottom = rect
                    actual_width = actual_right - actual_x
                    actual_height = actual_bottom - actual_y
                    print(f"[BROWSER FORCE] Actual position: ({actual_x}, {actual_y}), size ({actual_width}x{actual_height})")
                else:
                    print(f"[BROWSER FORCE] No Chrome window found with ChurnRoom/archive.org title")
                    
            except ImportError:
                print("[BROWSER FORCE] win32gui not available for forced positioning")
                print("[BROWSER FORCE] Install with: pip install pywin32")
                print("[BROWSER FORCE] Falling back to multiple positioning attempts...")
                
                # Fallback: Try launching Chrome with more aggressive positioning
                self._try_alternative_chrome_positioning(x, y, width, height)
                
        except Exception as e:
            print(f"[BROWSER FORCE] Error in forced Chrome positioning: {e}")
    
    def _try_alternative_chrome_positioning(self, x: int, y: int, width: int, height: int):
        """Alternative Chrome positioning using subprocess and multiple attempts."""
        try:
            import subprocess
            import time
            
            print(f"[BROWSER ALT] Attempting alternative positioning to ({x}, {y})")
            
            # Method: Use Windows 'nircmd' if available, or create a PowerShell script
            try:
                # Try PowerShell approach to move windows
                ps_script = f"""
                Add-Type -AssemblyName System.Windows.Forms
                $processes = Get-Process chrome -ErrorAction SilentlyContinue
                foreach ($process in $processes) {{
                    if ($process.MainWindowTitle -like "*archive.org*" -or 
                        $process.MainWindowTitle -like "*ChurnRoom*" -or
                        $process.MainWindowTitle -like "*Elephants Dream*") {{
                        Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class Win32 {{ [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags); }}'
                        [Win32]::SetWindowPos($process.MainWindowHandle, 0, {x}, {y}, {width}, {height}, 0x0040)
                        Write-Host "Moved window: $($process.MainWindowTitle)"
                        break
                    }}
                }}
                """
                
                result = subprocess.run(['powershell', '-Command', ps_script], 
                                      capture_output=True, text=True, timeout=5)
                
                if result.returncode == 0:
                    print(f"[BROWSER ALT] PowerShell positioning attempt completed")
                    if result.stdout.strip():
                        print(f"[BROWSER ALT] PowerShell output: {result.stdout.strip()}")
                else:
                    print(f"[BROWSER ALT] PowerShell positioning failed: {result.stderr}")
                    
            except subprocess.TimeoutExpired:
                print(f"[BROWSER ALT] PowerShell positioning timed out")
            except Exception as ps_error:
                print(f"[BROWSER ALT] PowerShell positioning error: {ps_error}")
                
        except Exception as e:
            print(f"[BROWSER ALT] Alternative positioning failed: {e}")
    
    def _monitor_browser_process(self, process_pid: int, duration: float):
        """Monitor what happens to the browser process."""
        try:
            import time
            import subprocess
            
            print(f"[BROWSER MONITOR] Monitoring process {process_pid} for {duration} seconds...")
            
            for i in range(int(duration)):
                time.sleep(1)
                
                # Check if process still exists
                if os.name == 'nt':
                    check_result = subprocess.run(['tasklist', '/FI', f'PID eq {process_pid}'], 
                                                capture_output=True, text=True, check=False)
                    if str(process_pid) in check_result.stdout:
                        print(f"[BROWSER MONITOR] T+{i+1}s: Process {process_pid} still running")
                    else:
                        print(f"[BROWSER MONITOR] T+{i+1}s: Process {process_pid} NO LONGER EXISTS!")
                        
                        # List all Chrome processes to see what's happening
                        chrome_result = subprocess.run(['tasklist', '/FI', 'IMAGENAME eq chrome.exe'], 
                                                     capture_output=True, text=True, check=False)
                        chrome_count = chrome_result.stdout.count('chrome.exe')
                        print(f"[BROWSER MONITOR] {chrome_count} Chrome processes still running")
                        break
            
            print(f"[BROWSER MONITOR] Monitoring complete for process {process_pid}")
            
        except Exception as e:
            print(f"[BROWSER MONITOR] Error monitoring process {process_pid}: {e}")
    
    def _close_browser_after_duration(self, process_pid: int, duration: float):
        """Close browser window after specified duration."""
        try:
            import time
            print(f"[BROWSER TIMER] Waiting {duration} seconds before closing browser PID {process_pid}...")
            time.sleep(duration)
            
            if os.name == 'nt':  # Windows
                try:
                    import subprocess
                    
                    # First, try to close the specific process
                    result1 = subprocess.run(['taskkill', '/F', '/PID', str(process_pid)], 
                                           capture_output=True, check=False, text=True)
                    print(f"[BROWSER TIMER] Attempted to close browser process {process_pid}: exit code {result1.returncode}")
                    if result1.returncode != 0:
                        print(f"[BROWSER TIMER] Taskkill failed: {result1.stderr.strip()}")
                    
                    # Check if the specific process is still running
                    check_result = subprocess.run(['tasklist', '/FI', f'PID eq {process_pid}'], 
                                                capture_output=True, text=True, check=False)
                    if str(process_pid) in check_result.stdout:
                        print(f"[BROWSER TIMER] WARNING: Process {process_pid} is still running!")
                    else:
                        print(f"[BROWSER TIMER] Process {process_pid} successfully terminated")
                    
                    # Get list of all Chrome processes for monitoring
                    result2 = subprocess.run(['tasklist', '/FI', 'IMAGENAME eq chrome.exe', '/FO', 'CSV'], 
                                           capture_output=True, text=True, check=False)
                    
                    if result2.returncode == 0:
                        chrome_lines = [line for line in result2.stdout.split('\n') if 'chrome.exe' in line]
                        chrome_count = len(chrome_lines)
                        print(f"[BROWSER TIMER] Found {chrome_count} Chrome processes still running")
                        
                        # If there are Chrome processes, try more aggressive cleanup
                        if chrome_count > 0:
                            print(f"[BROWSER TIMER] Chrome processes: {[line.split(',')[1].strip('\"') for line in chrome_lines[:3]]}")  # Show first 3 PIDs
                            
                            # Try to kill Chrome processes with archive.org in command line
                            aggressive_result = subprocess.run(['wmic', 'process', 'where', 'name="chrome.exe"', 'get', 'processid,commandline', '/format:csv'], 
                                                             capture_output=True, text=True, check=False)
                            if aggressive_result.returncode == 0:
                                for line in aggressive_result.stdout.split('\n'):
                                    if 'archive.org' in line and 'chrome.exe' in line:
                                        # Extract PID from line
                                        parts = line.split(',')
                                        if len(parts) >= 3:
                                            try:
                                                archive_pid = parts[-1].strip()
                                                if archive_pid.isdigit():
                                                    kill_result = subprocess.run(['taskkill', '/F', '/PID', archive_pid], 
                                                                               capture_output=True, check=False)
                                                    print(f"[BROWSER TIMER] Killed archive.org Chrome PID {archive_pid}: exit code {kill_result.returncode}")
                                            except:
                                                pass
                    else:
                        print(f"[BROWSER TIMER] Failed to list Chrome processes: {result2.stderr}")
                    
                    print(f"[BROWSER TIMER] Browser cleanup completed after {duration}s")
                    
                except Exception as e:
                    print(f"[BROWSER TIMER] Failed to close browser process {process_pid}: {e}")
            else:
                try:
                    import signal
                    os.kill(process_pid, signal.SIGTERM)
                    print(f"[BROWSER TIMER] Closed browser process {process_pid} after {duration}s")
                except Exception as e:
                    print(f"[BROWSER TIMER] Failed to close browser process {process_pid}: {e}")
                    
        except Exception as e:
            print(f"[BROWSER TIMER] Error in browser timer: {e}")
    
    def preload_segment(self, segment: MediaSegment):
        """Preload a segment for seamless switching."""
        if not self.vlc_player_2 or segment.media_type not in ("video", "audio"):
            return False
        
        try:
            url = segment.url
            if not segment.url.startswith(("http", "file://")):
                url = Path(segment.url).absolute().as_uri()
            
            opts = [f":start-time={segment.start}"]
            if segment.end > segment.start:
                opts.append(f":stop-time={segment.end}")
            
            media = self.vlc_instance_2.media_new(url, *opts)
            self.vlc_player_2.set_media(media)
            self.vlc_player_2.audio_set_volume(int(segment.volume * 100))
            
            # Prepare but don't play
            self.vlc_player_2.set_pause(True)
            result = self.vlc_player_2.play()
            if result == 0:
                time.sleep(0.1)  # Brief wait to ensure media is loaded
                self.vlc_player_2.set_pause(True)  # Keep paused
                self.preloaded_segment = segment
                print(f"[PRELOAD] ✓ Preloaded: {segment.url}")
                return True
            
        except Exception as e:
            print(f"[PRELOAD] Error preloading: {e}")
        
        return False
    
    def switch_to_preloaded(self) -> bool:
        """Switch to preloaded segment seamlessly."""
        if not self.preloaded_segment or not self.vlc_player_2:
            return False
        
        try:
            # Stop current player
            current_player = self.vlc_player if self.active_player == 1 else self.vlc_player_2
            next_player = self.vlc_player_2 if self.active_player == 1 else self.vlc_player
            
            if current_player:
                current_player.stop()
            
            # Start preloaded segment
            next_player.set_pause(False)
            
            # Switch active player reference
            self.active_player = 2 if self.active_player == 1 else 1
            self.current_segment = self.preloaded_segment
            self.preloaded_segment = None
            self.is_playing = True
            
            print(f"[SWITCH] ✓ Seamlessly switched to: {self.current_segment.url}")
            
            # Position window for the newly active player
            threading.Thread(target=self._position_vlc_window, daemon=True).start()
            
            return True
            
        except Exception as e:
            print(f"[SWITCH] Error switching: {e}")
            return False
        
    def play_segment(self, segment: MediaSegment) -> bool:
        """Play a media segment."""
        print(f"Playing: {segment.url} ({segment.start}-{segment.end}s)")
        print(f"[DEBUG] Media type: {segment.media_type}")
        print(f"[DEBUG] VLC available: {vlc is not None}")
        print(f"[DEBUG] VLC player available: {self.vlc_player is not None}")
        
        if segment.media_type == "youtube":
            # Try VLC with new minimal Qt interface that preserves window frame
            stream_url = MediaResolver.resolve_youtube_stream(segment.url)
            if stream_url and self._play_vlc(stream_url, segment):
                print(f"[VLC] Successfully playing in VLC with window controls")
                return True
            else:
                # Browser fallback
                print(f"[BROWSER] VLC failed, using browser fallback")
                self._open_browser_positioned(segment.url, segment)
                return True
                
        elif segment.media_type in ("video", "audio"):
            print(f"[DEBUG] Handling video/audio segment")
            url = segment.url
            if not segment.url.startswith(("http", "file://")):
                url = Path(segment.url).absolute().as_uri()
                print(f"[DEBUG] Converted to file URI: {url}")
            else:
                print(f"[DEBUG] Using URL as-is: {url}")
            
            print(f"[DEBUG] About to call _play_vlc()")
            result = self._play_vlc(url, segment)
            print(f"[DEBUG] _play_vlc() returned: {result}")
            
            # If VLC fails, fallback to browser for HTTP URLs
            if not result:
                if segment.url.startswith(("http://", "https://")):
                    print(f"[FALLBACK] Qt/VLC failed (result={result}), triggering browser fallback")
                    self._open_browser_positioned(segment.url, segment)
                    print(f"[FALLBACK] Browser fallback initiated for: {segment.url}")
                    return True
                else:
                    print(f"[ERROR] Local file playback failed and no browser fallback available")
                    return False
            
            return result
            
        elif segment.media_type in ("image", "web"):
            # Open in positioned browser window
            self._open_browser_positioned(segment.url, segment)
            return True
            
        return False
    
    def _play_vlc(self, url: str, segment: MediaSegment) -> bool:
        """Play media using Qt VLC Player or fallback to raw VLC."""
        # Check if we're in main thread for Qt players
        import threading
        in_main_thread = threading.current_thread() is threading.main_thread()
        
        # Try Qt VLC Player first (only if in main thread)
        if self.qt_available_local and self.qt_app and in_main_thread:
            print(f"[VLC] Attempting Qt VLC playback...")
            return self._play_qt_vlc(url, segment)
        elif self.qt_available_local and not in_main_thread:
            print(f"[VLC] Skipping Qt VLC (not in main thread) - using fallback")
        
        # Fallback to raw VLC
        if self.vlc_player:
            print(f"[VLC] Using raw VLC fallback...")
            return self._play_raw_vlc(url, segment)
        else:
            print(f"[VLC] No VLC player available (Qt available: {self.qt_available_local}, Qt app: {self.qt_app is not None}, Raw VLC: {self.vlc_player is not None})")
            return False
    
    def _play_qt_vlc(self, url: str, segment: MediaSegment) -> bool:
        """Play media using Qt VLC Player with seamless switching support."""
        print(f"[QtVLC] Attempting to play: {url}")
        
        # Prevent concurrent VLC execution
        if not self.churn_room:
            print(f"[QtVLC] No ChurnRoom reference - cannot check execution lock")
            return False
            
        with self.churn_room._vlc_execution_lock:
            if self.churn_room._is_vlc_playing:
                print(f"[QtVLC] Already playing - skipping duplicate command")
                return False
                
            # Mark as playing to prevent concurrent instances
            self.churn_room._is_vlc_playing = True
        
        try:
            # Use the currently inactive player to avoid stopping current playback abruptly
            current_qt_player = self.qt_player_1 if self.active_player == 1 else self.qt_player_2
            
            # Check if player exists and is still valid, or create on first use
            if not current_qt_player or not hasattr(current_qt_player, 'vlc_player'):
                print(f"[QtVLC] Qt player {self.active_player} needs initialization...")
                success = self._ensure_qt_player(self.active_player)
                if not success:
                    print(f"[QtVLC] Failed to initialize Qt player {self.active_player}")
                    self.churn_room._is_vlc_playing = False  # Reset state on failure
                    return False
                current_qt_player = self.qt_player_1 if self.active_player == 1 else self.qt_player_2
            
            print(f"[QtVLC] Using Qt player {self.active_player}")
            
            # Ensure we're on the main thread for Qt operations
            def show_and_play():
                try:
                    # Stop any current playback
                    current_qt_player.stop()
                    
                    # Set volume
                    current_qt_player.set_volume(int(segment.volume * 100))
                    
                    # Show window first, then play
                    current_qt_player.show()
                    current_qt_player.raise_()
                    current_qt_player.activateWindow()
                    
                    # Brief delay to ensure window is ready
                    if self.qt_app:
                        self.qt_app.processEvents()
                    
                    # Play media with timing
                    success = current_qt_player.play_media(url, segment.start, segment.end)
                    
                    if success:
                        print(f"[QtVLC] Play successful - Qt player window shown")
                        return True
                    else:
                        print(f"[QtVLC] Play failed - media could not start")
                        return False
                        
                except Exception as e:
                    print(f"[QtVLC] Error in show_and_play: {e}")
                    return False
            
            # Execute on main thread if we have Qt app
            if self.qt_app and QtCore:
                # Try to execute immediately on main thread
                try:
                    result = show_and_play()
                    if result:
                        self.current_segment = segment
                        self.is_playing = True
                        print(f"[QtVLC] Successfully started playback")
                        
                        # Show emergency STOP button for Qt VLC too
                        if segment.start > 0 or segment.end > 0:  # Only for timed playback
                            if self.churn_room:
                                threading.Thread(target=self.churn_room._create_emergency_button, daemon=True).start()
                        
                        return True
                    else:
                        print(f"[QtVLC] Qt playback failed - will trigger fallback")
                        self.churn_room._is_vlc_playing = False  # Reset state on failure
                        return False
                except Exception as play_error:
                    print(f"[QtVLC] Qt playback exception: {play_error}")
                    self.churn_room._is_vlc_playing = False  # Reset state on exception
                    return False
            else:
                # No Qt app available
                print(f"[QtVLC] No Qt application available - will trigger fallback")
                self.churn_room._is_vlc_playing = False  # Reset state on no Qt
                return False
                
        except Exception as e:
            print(f"[QtVLC] Qt VLC playback error: {e}")
            self.churn_room._is_vlc_playing = False  # Reset state on exception
            import traceback
            traceback.print_exc()
            return False
    
    def _play_raw_vlc(self, url: str, segment: MediaSegment) -> bool:
        """Fallback method for raw VLC playback."""
        print(f"[VLC] Using raw VLC fallback for: {url}")
        
        # Prevent concurrent VLC execution
        if not self.churn_room:
            print(f"[VLC] No ChurnRoom reference - cannot check execution lock")
            return False
            
        with self.churn_room._vlc_execution_lock:
            if self.churn_room._is_vlc_playing:
                print(f"[VLC] Already playing - skipping duplicate command")
                return False
                
            # Mark as playing to prevent concurrent instances
            self.churn_room._is_vlc_playing = True
            
        try:
            # Use the currently inactive player to avoid stopping current playback abruptly
            current_player = self.vlc_player if self.active_player == 1 else self.vlc_player_2
            current_instance = self.vlc_instance if self.active_player == 1 else self.vlc_instance_2
            
            print(f"[VLC] Using raw player {self.active_player}")
            
            if not current_player or not current_instance:
                print(f"[VLC] Raw player or instance is None")
                return False
            
            current_player.stop()
            
            opts = [f":start-time={segment.start}"]
            if segment.end > segment.start:
                opts.append(f":stop-time={segment.end}")
            
            print(f"[VLC] Creating media with URL: {url}")
            print(f"[VLC] Media options: {opts}")
            
            media = current_instance.media_new(url, *opts)
            if not media:
                print(f"[VLC] Failed to create media object")
                self.churn_room._is_vlc_playing = False  # Reset state on failure
                return False
            
            current_player.set_media(media)
            current_player.audio_set_volume(int(segment.volume * 100))
            
            print(f"[VLC] Calling play()...")
            result = current_player.play()
            print(f"[VLC] Play() returned: {result}")
            
            if result == 0:
                self.current_segment = segment
                self.is_playing = True
                
                print(f"[VLC] Raw play successful, positioning window...")
                # Position window to not obscure ChatGPT
                threading.Thread(target=self._position_vlc_window, daemon=True).start()
                
                # Show emergency close button for raw VLC
                if self.churn_room:
                    threading.Thread(target=self.churn_room._create_emergency_button, daemon=True).start()
                
                return True
            else:
                print(f"[VLC] Raw play failed with code: {result}")
                self.churn_room._is_vlc_playing = False  # Reset state on failure
                return False
            
        except Exception as e:
            print(f"[VLC] Raw VLC playback error: {e}")
            self.churn_room._is_vlc_playing = False  # Reset state on exception
            import traceback
            traceback.print_exc()
            return False
    
    def pause(self):
        """Pause current playback."""
        if self.qt_player_1 and self.active_player == 1:
            self.qt_player_1.pause()
        elif self.qt_player_2 and self.active_player == 2:
            self.qt_player_2.pause()
        elif self.vlc_player:
            self.vlc_player.pause()
        self.is_playing = False
    
    def stop(self):
        """Stop current playback."""
        if self.qt_player_1:
            self.qt_player_1.stop()
            self.qt_player_1.hide()
        if self.qt_player_2:
            self.qt_player_2.stop()
            self.qt_player_2.hide()
        if self.vlc_player:
            self.vlc_player.stop()
        if self.vlc_player_2:
            self.vlc_player_2.stop()
        
        self.is_playing = False
        self.current_segment = None
        self._hide_emergency_button()
    
    def set_volume(self, volume: float):
        """Set playback volume (0.0 to 1.0)."""
        volume_percent = int(volume * 100)
        if self.qt_player_1:
            self.qt_player_1.set_volume(volume_percent)
        if self.qt_player_2:
            self.qt_player_2.set_volume(volume_percent)
        if self.vlc_player:
            self.vlc_player.audio_set_volume(volume_percent)
        if self.vlc_player_2:
            self.vlc_player_2.audio_set_volume(volume_percent)
    
    def stop_all(self):
        """Stop all VLC instances and clean up."""
        try:
            # Stop Qt VLC players
            if self.qt_player_1:
                self.qt_player_1.stop()
                self.qt_player_1.close()
                print("[QtVLC] Qt player 1 stopped and closed")
            if self.qt_player_2:
                self.qt_player_2.stop()
                self.qt_player_2.close()
                print("[QtVLC] Qt player 2 stopped and closed")
            
            # Stop raw VLC players (fallback)
            if self.vlc_player:
                self.vlc_player.stop()
                self.vlc_player.release()
            if self.vlc_player_2:
                self.vlc_player_2.stop()
                self.vlc_player_2.release()
            if self.vlc_instance:
                self.vlc_instance.release()
            if self.vlc_instance_2:
                self.vlc_instance_2.release()
            
            self.is_playing = False
            self.current_segment = None
            self.preloaded_segment = None
            self._hide_emergency_button()
            print("[VLC] All instances stopped and released")
        except Exception as e:
            print(f"[VLC] Cleanup error: {e}")
            # Force kill any remaining VLC processes on Windows
            if os.name == 'nt':
                try:
                    os.system('taskkill /f /im vlc.exe 2>nul')
                    print("[VLC] Force killed VLC processes")
                except:
                    pass
    
    def emergency_cleanup(self):
        """Emergency cleanup called by atexit."""
        print("[VLC] Emergency cleanup triggered")
        
        # Hide emergency button
        self._hide_emergency_button()
        
        try:
            # Cleanup Qt VLC players
            if self.qt_player_1:
                self.qt_player_1.stop()
                self.qt_player_1.close()
            if self.qt_player_2:
                self.qt_player_2.stop()
                self.qt_player_2.close()
            
            # Cleanup raw VLC players (fallback)
            if self.vlc_player:
                self.vlc_player.stop()
                self.vlc_player.release()
            if self.vlc_player_2:
                self.vlc_player_2.stop()
                self.vlc_player_2.release()
            if self.vlc_instance:
                self.vlc_instance.release()
            if self.vlc_instance_2:
                self.vlc_instance_2.release()
        except:
            pass
        
        # Force kill VLC on Windows if still running
        if os.name == 'nt':
            try:
                os.system('taskkill /f /im vlc.exe 2>nul')
            except:
                pass


class CommandParser:
    """Parses LLM commands into MediaCommand objects."""
    
    @staticmethod
    def split_multiple_commands(text: str) -> List[str]:
        """Split text containing multiple commands into individual commands."""
        commands = []
        keywords = ['VOLUME:', 'PLAY:', 'OVERLAY:', 'CAPTION:', 'PAUSE:', 'STOP:', 'STOP ALL:', 'SEQUENCE:']
        
        # Handle broken PLAY commands that start with ": https://" or bare URLs
        if text.startswith(': https://') or text.startswith(': http://'):
            # Fix the broken command by adding "PLAY" prefix
            text = 'PLAY' + text
            print(f"Fixed broken PLAY command: {text}")
        elif (text.startswith('https://') or text.startswith('http://')) and not text.upper().startswith(('PLAY:', 'SEQUENCE:', 'VOLUME:')):
            # Handle bare URLs - add PLAY: prefix
            if any(domain in text for domain in ['youtube.com', 'youtu.be', 'vimeo.com', 'archive.org']):
                text = 'PLAY: ' + text
                print(f"Added PLAY prefix to bare URL: {text}")
        
        positions = []
        for keyword in keywords:
            pos = 0
            while True:
                pos = text.upper().find(keyword, pos)
                if pos == -1:
                    break
                positions.append((pos, keyword))
                pos += len(keyword)
        
        positions.sort()
        
        for i, (pos, keyword) in enumerate(positions):
            start = pos
            if i + 1 < len(positions):
                end = positions[i + 1][0]
            else:
                end = len(text)
            
            command_text = text[start:end].strip()
            if command_text:
                commands.append(command_text)
        
        return commands if commands else [text]
    
    @staticmethod
    def parse_command(text: str) -> Optional[MediaCommand]:
        """Parse a command string from the LLM."""
        text = text.strip()
        
        text = re.sub(r'^response\s*', '', text, flags=re.IGNORECASE)
        text = re.sub(r'^ChatGPT\s*', '', text, flags=re.IGNORECASE)
        text = re.sub(r'^\d+\s*/\s*\d+\s*', '', text)
        text = text.strip()
        
        # Skip if this looks like a conversation summary/wrapper or example content
        skip_phrases = [
            "example.mp4", "example.jpg", "cheatsheet", "format guide", "syntax rules", 
            "use normalized values", "may be decimal", "chain items with", "file://path",
            "you said:", "chatgpt said:", "user:", "assistant:", "example", "placeholder"
        ]
        
        if any(phrase in text.lower() for phrase in skip_phrases):
            print(f"Skipping text with example/wrapper phrase: {text[:50]}")
            return None
        
        # Also skip if it looks like conversational wrapper text
        if len(text) > 50 and not any(cmd in text.upper() for cmd in ['PLAY:', 'SEQUENCE:', 'VOLUME:', 'PAUSE', 'STOP']):
            if any(phrase in text.lower() for phrase in ["said:", "chatgpt", "user", "conversation"]):
                print(f"Skipping conversational wrapper: {text[:50]}")
                return None
        
        if text.upper().startswith("PLAY:"):
            return CommandParser._parse_play_command(text[5:].strip())
        elif text.upper().startswith("PAUSE") and len(text.split()) <= 2:
            return MediaCommand(action="PAUSE")
        elif text.upper().startswith("STOP ALL"):
            return MediaCommand(action="STOP_ALL")
        elif text.upper().startswith("STOP") and len(text.split()) <= 2:
            return MediaCommand(action="STOP")
        elif text.upper().startswith("VOLUME:"):
            try:
                volume_text = text[7:].strip().split()[0]
                volume = float(volume_text)
                if 0.0 <= volume <= 1.0:
                    return MediaCommand(action="VOLUME", params={"volume": volume})
            except (ValueError, IndexError):
                print(f"Invalid volume command: {text}")
                return None
        elif text.upper().startswith("CAPTION:"):
            caption_text = text[8:].strip()
            if caption_text and not any(phrase in caption_text.lower() for phrase in ["example", "your caption here"]):
                return MediaCommand(action="CAPTION", params={"text": caption_text})
        elif text.upper().startswith("OVERLAY:"):
            overlay_text = text[8:].strip()
            if overlay_text and not any(phrase in overlay_text.lower() for phrase in ["example", "your overlay here"]):
                return MediaCommand(action="OVERLAY", params={"text": overlay_text})
        elif text.upper().startswith("SEQUENCE:"):
            return CommandParser._parse_sequence_command(text[9:].strip())
        
        return None
    
    @staticmethod
    def _clean_url(url: str) -> str:
        """Clean URL by removing quotes, whitespace, and other artifacts."""
        if not url:
            return url
            
        # Remove leading and trailing whitespace
        cleaned = url.strip()
        
        # Remove leading and trailing quotes (single and double)
        cleaned = cleaned.strip('"\'')
        
        # Handle escaped quotes
        cleaned = cleaned.replace('\\"', '').replace("\\'", '')
        
        # Remove trailing punctuation that might have been captured
        cleaned = cleaned.rstrip('.,;!?)')
        
        return cleaned
    
    @staticmethod
    def _parse_play_command(text: str) -> MediaCommand:
        """Parse a PLAY command."""
        parts = text.split()
        if not parts:
            return MediaCommand(action="PLAY")
        
        url = parts[0]
        
        # Clean URL - remove quotes and other artifacts
        url = CommandParser._clean_url(url)
        
        if any(placeholder in url.lower() for placeholder in [
            "<url", "file://path", "example.mp4", "example.jpg", "abc", "def", "filename.mp4", "your_file"
        ]):
            print(f"Skipping placeholder URL: {url}")
            return MediaCommand(action="PLAY")
        
        original_url = url
        
        # Validate original URL first
        is_valid, confidence = CommandParser._validate_url(url)
        print(f"URL validation: {url[:50]}... -> valid: {is_valid}, confidence: {confidence:.2f}")
        
        # If confidence is low, try repair
        if confidence < 0.6:
            repaired_url = CommandParser._repair_url(url)
            if repaired_url != url:
                is_valid_repaired, confidence_repaired = CommandParser._validate_url(repaired_url)
                print(f"Repaired URL validation: {repaired_url[:50]}... -> valid: {is_valid_repaired}, confidence: {confidence_repaired:.2f}")
                
                # Use repaired URL if it's better
                if confidence_repaired > confidence:
                    url = repaired_url
                    is_valid, confidence = is_valid_repaired, confidence_repaired
                    print(f"Using repaired URL: {original_url} -> {url}")
        
        # Final validation check
        if not is_valid or confidence < 0.3:
            print(f"URL failed validation (confidence: {confidence:.2f}): {url}")
            return MediaCommand(action="PLAY")
        
        # Additional fallback check for file existence or basic URL structure
        if not (url.startswith(("http://", "https://", "file://")) or Path(url).exists()):
            print(f"URL does not meet basic requirements: {url}")
            return MediaCommand(action="PLAY")
        
        start, end = CommandParser._extract_timing(text)
        
        caption = ""
        if "CAPTION:" in text.upper():
            caption_start = text.upper().find("CAPTION:") + 8
            caption = text[caption_start:].strip()
            if caption.startswith('"') and caption.endswith('"'):
                caption = caption[1:-1]
        
        segment = MediaSegment(
            url=url,
            start=start,
            end=end,
            caption=caption,
            media_type=MediaResolver.classify_media(url)
        )
        
        return MediaCommand(action="PLAY", segments=[segment])
    
    @staticmethod
    def _repair_url(url: str) -> str:
        """Attempt to repair corrupted URLs from text extraction."""
        original = url
        
        # Handle completely mangled URLs (no punctuation at all)
        if "http" in url and "://" not in url and "." not in url:
            url = CommandParser._repair_mangled_url(url)
        
        # Handle missing protocol separators
        if url.startswith("http") and "://" not in url:
            if url.startswith("https"):
                url = "https://" + url[5:]
            elif url.startswith("http"):
                url = "http://" + url[4:]
        
        # Common domain repairs
        url = url.replace("wikimediaorg", "wikimedia.org")
        url = url.replace("wikipediacommons", "wikipedia/commons")
        url = url.replace("httpstatusdogscom", "httpstatusdogs.com")
        url = url.replace("youtubecom", "youtube.com")
        url = url.replace("wwwyoutube", "www.youtube")
        
        if "uploadwikimediaorg" in url:
            url = url.replace("uploadwikimediaorg", "upload.wikimedia.org")
        
        if "wikimedia.org" in url and "/wikipedia/commons" not in url:
            url = url.replace("wikimedia.orgwikipedia", "wikimedia.org/wikipedia")
        
        if "/commons" in url and "/commons/" not in url:
            for i in range(10):
                url = url.replace(f"/commons{i}", f"/commons/{i}")
            url = url.replace("/commonsa", "/commons/a")
        
        if "httpstatusdogs.com" in url and "/img/" not in url:
            url = url.replace("httpstatusdogs.comimg", "httpstatusdogs.com/img/")
        
        # Fix missing file extensions
        if not url.endswith((".jpg", ".png", ".gif", ".webp", ".mp4", ".webm")):
            if "jpg" in url[-10:] and not url.endswith(".jpg"):
                url = url.replace("jpg", ".jpg")
            elif "png" in url[-10:] and not url.endswith(".png"):
                url = url.replace("png", ".png")
            elif "gif" in url[-10:] and not url.endswith(".gif"):
                url = url.replace("gif", ".gif")
        
        if original != url:
            print(f"[URL Repair] {original} -> {url}")
        
        return url
    
    @staticmethod
    def _repair_mangled_url(mangled: str) -> str:
        """Repair completely mangled URLs that lost all punctuation."""
        # Pattern: httpswwwyoutubecomwatchvQohH89Eu5iM
        # Should become: https://www.youtube.com/watch?v=QohH89Eu5iM
        
        result = mangled
        
        # Handle YouTube URLs specifically (most common case)
        if "youtube" in result.lower() and "watch" in result.lower():
            # Pattern: httpswwwyoutubecomwatchvID or httpyoutubecomwatchvID
            if result.startswith(("httpswwwyoutubecom", "httpyoutubecom")):
                if result.startswith("httpswwwyoutubecom"):
                    video_part = result[18:]  # Remove "httpswwwyoutubecom"
                    protocol = "https://"
                else:
                    video_part = result[14:]  # Remove "httpyoutubecom"
                    protocol = "http://"
                
                if video_part.startswith("watchv"):
                    video_id = video_part[6:]  # Remove "watchv"
                    result = f"{protocol}www.youtube.com/watch?v={video_id}"
                    print(f"[YouTube URL Repair] {mangled} -> {result}")
                    return result
        
        # Handle general domain patterns
        common_repairs = [
            # YouTube variations
            ("httpswwwyoutubecom", "https://www.youtube.com/"),
            ("httpyoutubecom", "http://youtube.com/"),
            ("wwwyoutubecom", "www.youtube.com/"),
            
            # Other common domains
            ("httpswww", "https://www."),
            ("httpwww", "http://www."),
            ("httpsgithubcom", "https://github.com/"),
            ("httpgithubcom", "http://github.com/"),
            
            # Generic patterns
            ("httpscom", "https://"),
            ("httpcom", "http://"),
        ]
        
        for pattern, replacement in common_repairs:
            if result.lower().startswith(pattern.lower()):
                remaining = result[len(pattern):]
                result = replacement + remaining
                break
        
        # Try to restore common URL patterns
        if "watchv" in result and "youtube" in result:
            result = result.replace("watchv", "watch?v=")
        
        print(f"[Mangled URL Repair] {mangled} -> {result}")
        return result
    
    @staticmethod
    def _validate_url(url: str) -> tuple:
        """Validate URL and return (is_valid, confidence_score)."""
        if not url:
            return False, 0.0
        
        confidence = 0.0
        
        # Basic URL structure checks
        if url.startswith(("http://", "https://")):
            confidence += 0.4
        elif url.startswith("http"):
            confidence += 0.1  # Missing :// but has http
        
        # Domain validation
        if "." in url:
            confidence += 0.3
        
        # Known good domains
        good_domains = ["youtube.com", "youtu.be", "github.com", "archive.org", "vimeo.com"]
        for domain in good_domains:
            if domain in url.lower():
                confidence += 0.2
                break
        
        # YouTube specific validation
        if "youtube" in url.lower():
            if "watch?v=" in url:
                confidence += 0.3
            elif "watchv" in url:
                confidence += 0.1  # Partially mangled but recoverable
        
        # File extension validation for media
        media_extensions = [".mp4", ".webm", ".mkv", ".mov", ".m4v", ".avi", ".mp3", ".wav", ".flac"]
        if any(ext in url.lower() for ext in media_extensions):
            confidence += 0.2
        
        # Penalize suspicious patterns
        if len(url) > 500:  # Extremely long URLs are suspicious
            confidence -= 0.2
        
        if url.count("http") > 1:  # Multiple http instances
            confidence -= 0.3
        
        # Check for completely mangled (no dots, no slashes after protocol)
        if "http" in url and "://" not in url and "." not in url:
            confidence = max(0.1, confidence)  # Very low confidence but might be recoverable
        
        # Final validation attempt
        try:
            from urllib.parse import urlparse
            parsed = urlparse(url)
            if parsed.scheme and parsed.netloc:
                confidence += 0.2
                is_valid = True
            else:
                is_valid = False
        except:
            is_valid = False
        
        # If we have reasonable confidence, consider it potentially valid
        if confidence >= 0.6:
            is_valid = True
        elif confidence >= 0.3:
            is_valid = True  # Might be repairable
        
        return is_valid, min(1.0, confidence)
    
    @staticmethod
    def _parse_sequence_command(text: str) -> MediaCommand:
        """Parse a SEQUENCE command."""
        segments = []
        parts = text.split(" -> ")
        
        for part in parts:
            part = part.strip()
            if part.startswith("pause("):
                continue
            
            if "(" in part and part.endswith(")"):
                filename, timing = part.split("(", 1)
                timing = timing[:-1]
                start, end = CommandParser._extract_timing(timing)
                
                segment = MediaSegment(
                    url=filename.strip(),
                    start=start,
                    end=end,
                    media_type=MediaResolver.classify_media(filename.strip())
                )
                segments.append(segment)
        
        return MediaCommand(action="SEQUENCE", segments=segments)
    
    @staticmethod
    def _extract_timing(text: str) -> tuple:
        """Extract start and end times from text."""
        timing_pattern = r'\((\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*s?\)'
        match = re.search(timing_pattern, text)
        if match:
            return float(match.group(1)), float(match.group(2))
        
        csv_pattern = r',(\d+(?:\.\d+)?),(\d+(?:\.\d+)?)'
        match = re.search(csv_pattern, text)
        if match:
            return float(match.group(1)), float(match.group(2))
        
        if "youtube.com" in text or "youtu.be" in text:
            try:
                parsed = urlparse(text)
                query_params = parse_qs(parsed.query)
                if 't' in query_params:
                    timestamp = CommandParser._parse_youtube_timestamp(query_params['t'][0])
                    return timestamp, 0.0
            except:
                pass
        
        return 0.0, 0.0
    
    @staticmethod
    def _parse_youtube_timestamp(timestamp_str: str) -> float:
        """Parse YouTube timestamp formats."""
        if timestamp_str.isdigit():
            return float(timestamp_str)
        
        pattern = r'(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?'
        match = re.match(pattern, timestamp_str)
        if match:
            hours = int(match.group(1) or 0)
            minutes = int(match.group(2) or 0)
            seconds = int(match.group(3) or 0)
            return hours * 3600 + minutes * 60 + seconds
        
        return 0.0


class WindowLayoutManager:
    """Manages window positioning and layout preferences."""
    
    def __init__(self):
        self.screen_width, self.screen_height = self._get_screen_dimensions()
        self.layout_config = self._load_layout_config()
    
    def _get_screen_dimensions(self):
        """Get screen dimensions."""
        try:
            if tk:
                root = tk.Tk()
                root.withdraw()
                width = root.winfo_screenwidth()
                height = root.winfo_screenheight()
                root.destroy()
                return width, height
            else:
                return 1920, 1080
        except:
            return 1920, 1080
    
    def _load_layout_config(self):
        """Load layout configuration from file or use defaults."""
        config_path = Path("window_layout.json")
        
        # Calculate safer window dimensions
        safe_width = max(800, min(1000, self.screen_width // 2 - 100))
        safe_height = max(600, min(800, self.screen_height - 200))
        browser_x = 50  # LEFT side for browser fallback
        browser_width = max(600, min(900, self.screen_width // 2 - 100))
        
        default_config = {
            "vlc_position": {"x": 50, "y": 50},
            "vlc_size": {"width": safe_width, "height": safe_height},
            "browser_position": {"x": browser_x, "y": 50},
            "browser_size": {"width": browser_width, "height": safe_height},
            "chatgpt_side": "right"  # "left" or "right" - ChatGPT on RIGHT, VLC/browser on LEFT
        }
        
        try:
            if config_path.exists():
                with open(config_path, 'r') as f:
                    loaded_config = json.load(f)
                default_config.update(loaded_config)
        except Exception as e:
            print(f"[LAYOUT] Could not load config, using defaults: {e}")
        
        return default_config
    
    def get_vlc_args(self):
        """Get VLC arguments - minimal set that actually works."""
        config = self.layout_config
        
        # Start with ONLY the known working args
        args = [
            "--intf=qt",                    # Qt interface with controls (KNOWN WORKING)
            # Removed all other args to test if basic Qt works
        ]
        
        print(f"[VLC] Testing minimal args: {args}")
        return args
    
    def get_browser_position(self):
        """Get browser window position and size."""
        config = self.layout_config
        return (
            config['browser_position']['x'],
            config['browser_position']['y'],
            config['browser_size']['width'],
            config['browser_size']['height']
        )
    
    def get_vlc_position(self):
        """Get VLC/Qt player window position and size."""
        config = self.layout_config
        return (
            config['vlc_position']['x'],
            config['vlc_position']['y'],
            config['vlc_size']['width'],
            config['vlc_size']['height']
        )


class ChurnRoom:
    """Main churner that coordinates all components."""
    
    def __init__(self, chat_log_path: str = "chat.log"):
        self.chat_log_path = Path(chat_log_path)
        self.layout_manager = WindowLayoutManager()
        self.player = MediaPlayer(self.layout_manager, self)
        self.caption_overlay = CaptionOverlay()
        self.command_queue = []
        self.processed_commands = set()
        self.processed_urls = set()
        self.url_play_history = {}  # Track when URLs were last played
        self.is_running = False
        self.last_log_mtime = 0
        self._processing_lock = threading.Lock()  # Prevent simultaneous processing
        self._last_processing_time = 0  # Prevent rapid successive processing
        self._vlc_execution_lock = threading.Lock()  # Prevent concurrent VLC instances
        self._is_vlc_playing = False  # Track VLC playback state
        self.emergency_control = None  # System tray emergency control
        self.hotkey_control = None  # Global hotkey emergency control
        self.vlc_controller = None  # Simple VLC control window
        
        self.observer = Observer()
        self.observer.schedule(
            ChatLogHandler(self), 
            str(self.chat_log_path.parent), 
            recursive=False
        )
        
        # Register signal handlers for graceful shutdown
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)
        atexit.register(self.cleanup)
    
    def start(self):
        """Start the churner."""
        self.is_running = True
        # Clear old state
        self.processed_urls.clear()
        self.url_play_history.clear()
        if hasattr(self, 'command_timestamps'):
            self.command_timestamps.clear()
        
        self.observer.start()
        print(f"Churn Room started, watching {self.chat_log_path}")
        print("Cleared previous command/URL history")
        
        threading.Thread(target=self._process_commands, daemon=True).start()
        
        try:
            while self.is_running:
                time.sleep(0.1)
        except KeyboardInterrupt:
            self.stop()
    
    def stop(self):
        """Stop the churner."""
        self.is_running = False
        try:
            self.observer.stop()
            self.observer.join()
        except:
            pass
        self.player.stop_all()
        print("Churn Room stopped")
    
    def cleanup(self):
        """Cleanup method called by atexit."""
        print("[CLEANUP] ChurnRoom cleanup triggered")
        self.stop()
        # Ensure output capture is saved
        cleanup_output_capture()
    
    def _signal_handler(self, signum, frame):
        """Handle Ctrl+C and other signals."""
        print(f"\n[SIGNAL] Received signal {signum}, shutting down gracefully...")
        self.stop()
        # Ensure output capture is saved before exit
        cleanup_output_capture()
        exit(0)
    
    def handle_chat_update(self):
        """Process new chat log entries."""
        # Prevent simultaneous processing of the same file change
        if not self._processing_lock.acquire(blocking=False):
            print("[DEBUG] Skipping duplicate file change event")
            return
            
        try:
            # Prevent rapid successive processing (minimum 1 second gap)
            import time
            current_time = time.time()
            if current_time - self._last_processing_time < 1.0:
                print("[DEBUG] Skipping rapid file change - too soon after last processing")
                return
                
            if not self.chat_log_path.exists():
                return
            
            mtime = self.chat_log_path.stat().st_mtime
            if mtime == self.last_log_mtime:
                return
                
            self._last_processing_time = current_time
            self.last_log_mtime = mtime
            
            with open(self.chat_log_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
            
            processed_commands = set()
            
            import datetime
            thirty_seconds_ago = datetime.datetime.now() - datetime.timedelta(seconds=30)
            
            print(f"Processing {len(lines)} log entries...")
            
            for line in reversed(lines[-20:]):  # Check more recent entries
                try:
                    entry = json.loads(line.strip())
                    if entry.get('role') == 'assistant':
                        
                        timestamp_str = entry.get('ts', '')
                        try:
                            timestamp = datetime.datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                            if timestamp < thirty_seconds_ago:
                                continue
                        except (ValueError, TypeError):
                            continue
                        
                        content = entry.get('content', '').strip()
                        print(f"Processing entry: {content[:100]}...")
                        
                        # Create command hash and check for recent duplicates only
                        command_hash = hash(content)
                        
                        # Check if this exact command was processed recently (within 3 seconds)
                        # Remove old hashes from this session's processed_commands
                        current_time = datetime.datetime.now()
                        if not hasattr(self, 'command_timestamps'):
                            self.command_timestamps = {}
                        
                        # Clean up old timestamps (older than 3 seconds)
                        old_hashes = [h for h, ts in self.command_timestamps.items() 
                                     if (current_time - ts).total_seconds() > 3]
                        for old_hash in old_hashes:
                            self.command_timestamps.pop(old_hash, None)
                            processed_commands.discard(old_hash)
                        
                        # Check if this command was processed very recently
                        if command_hash in processed_commands:
                            last_time = self.command_timestamps.get(command_hash)
                            if last_time and (current_time - last_time).total_seconds() < 3:
                                print(f"Skipping recent duplicate command (within 3s)")
                                continue
                        
                        # Record this command's timestamp
                        self.command_timestamps[command_hash] = current_time
                        
                        # More flexible command detection - handle broken PLAY commands
                        has_command = (
                            any(content.upper().startswith(cmd) for cmd in 
                                ['PLAY:', 'PAUSE', 'STOP', 'VOLUME:', 'OVERLAY:', 'SEQUENCE:']) or
                            any(f" {cmd}" in content.upper() for cmd in 
                                ['PLAY:', 'PAUSE', 'STOP', 'VOLUME:', 'OVERLAY:', 'SEQUENCE:']) or
                            'PLAY:' in content.upper() or
                            # Handle broken PLAY commands missing the "PLAY" part
                            (content.startswith(': https://') and 'youtube.com' in content) or
                            (content.startswith(': http://') and any(domain in content for domain in ['youtube', 'vimeo', 'archive'])) or
                            # Handle bare URLs that should be PLAY commands
                            (content.startswith('https://') and any(domain in content for domain in ['youtube.com', 'youtu.be', 'vimeo.com', 'archive.org'])) or
                            (content.startswith('http://') and any(domain in content for domain in ['youtube.com', 'youtu.be', 'vimeo.com', 'archive.org']))
                        )
                        
                        if has_command:
                            print(f"Found command in: {content}")
                            
                            commands = CommandParser.split_multiple_commands(content)
                            print(f"Split into {len(commands)} commands: {[cmd[:50]+'...' for cmd in commands]}")
                            
                            for cmd_text in commands:
                                print(f"Parsing command: {cmd_text[:100]}")
                                command = CommandParser.parse_command(cmd_text)
                                
                                if command:
                                    print(f"Successfully parsed command: {command.action}")
                                    
                                    if command.action == "PLAY" and command.segments:
                                        url = command.segments[0].url
                                        
                                        # Normalize URL for deduplication
                                        normalized_url = CommandParser._clean_url(url)
                                        
                                        # Smart deduplication - check if this URL was played recently
                                        import datetime
                                        now = datetime.datetime.now()
                                        
                                        if normalized_url in self.url_play_history:
                                            last_played = self.url_play_history[normalized_url]
                                            time_since_play = (now - last_played).total_seconds()
                                            
                                            # If same URL played within last 3 seconds, check if new command has better timing info
                                            if time_since_play < 3:
                                                current_segment = command.segments[0]
                                                has_timing = current_segment.start > 0 or current_segment.end > 0
                                                
                                                if has_timing:
                                                    print(f"[DEDUP] Allowing URL replay with timing info: {normalized_url[:50]}... ({current_segment.start}-{current_segment.end}s)")
                                                else:
                                                    print(f"[DEDUP] Skipping recently played URL (played {time_since_play:.1f}s ago): {normalized_url[:50]}...")
                                                    continue
                                        
                                        # Update play history with normalized URL  
                                        if normalized_url in self.url_play_history:
                                            print(f"[REPLAY] Allowing URL replay after {time_since_play:.1f}s: {normalized_url[:50]}...")
                                        else:
                                            print(f"[NEW] Added URL to queue: {normalized_url}")
                                        self.url_play_history[normalized_url] = now
                                    
                                    if command.action == "PLAY" and (not command.segments or command.segments[0].url == ""):
                                        print(f"[SKIP] Empty URL in PLAY command")
                                        continue
                                    
                                    processed_commands.add(command_hash)
                                    self.command_queue.append(command)
                                    print(f"[QUEUE] Queued command: {command.action} - {cmd_text[:50]}...")
                                else:
                                    print(f"Failed to parse command: {cmd_text[:100]}")
                            break
                        else:
                            print(f"No commands found in: {content[:100]}")
                            
                except json.JSONDecodeError as e:
                    print(f"JSON decode error: {e}")
                    continue
                    
        except Exception as e:
            print(f"Chat log processing error: {e}")
        finally:
            # Always release the lock
            self._processing_lock.release()
    
    def _process_commands(self):
        """Process queued commands."""
        while self.is_running:
            if self.command_queue:
                command = self.command_queue.pop(0)
                self._execute_command(command)
            time.sleep(0.1)
    
    def _execute_command(self, command: MediaCommand):
        """Execute a media command."""
        
        # For PLAY commands, check if VLC is already playing
        if command.action == "PLAY" and command.segments:
            with self._vlc_execution_lock:
                if self._is_vlc_playing:
                    print(f"[EXEC] VLC already playing - skipping duplicate PLAY command")
                    return
                # Mark as playing to prevent concurrent instances
                self._is_vlc_playing = True
        
        print(f"[EXEC] Executing: {command.action}")
        
        if command.action == "PLAY" and command.segments:
            segment = command.segments[0]
            print(f"[PLAY] Playing segment: {segment.url}")
            print(f"[PLAY] Media type: {segment.media_type}")
            print(f"[PLAY] Timing: {segment.start}-{segment.end}s")
            
            if segment.caption:
                print(f"[CAPTION] Caption: {segment.caption}")
                self.caption_overlay.show(segment.caption)
            
            success = self.player.play_segment(segment)
            if success:
                print(f"[SUCCESS] Playback started successfully")
            else:
                print(f"[ERROR] Playback failed")
                self._is_vlc_playing = False  # Reset state on failure
            
        elif command.action == "PAUSE":
            print(f"[PAUSE] Pausing playback")
            self.player.pause()
            
        elif command.action == "STOP":
            print(f"[STOP] Stopping playback")
            self.player.stop()
            
        elif command.action == "STOP_ALL":
            print(f"[STOP ALL] Stopping all VLC instances")
            self.player.stop_all()
            
        elif command.action == "VOLUME":
            volume = command.params.get("volume", 1.0)
            print(f"[VOLUME] Setting volume to {volume}")
            self.player.set_volume(volume)
            
        elif command.action == "CAPTION":
            text = command.params.get("text", "")
            print(f"[CAPTION] Showing caption: {text}")
            self.caption_overlay.show(text)
            
        elif command.action == "OVERLAY":
            text = command.params.get("text", "")
            print(f"[OVERLAY] Showing overlay: {text}")
            self.caption_overlay.show(text)
            
        elif command.action == "SEQUENCE":
            print(f"[SEQUENCE] Playing sequence with {len(command.segments)} segments")
            
            for i, segment in enumerate(command.segments):
                print(f"[SEQUENCE] Part {i+1}/{len(command.segments)}: {segment.url}")
                
                # Preload next segment for seamless switching
                if i + 1 < len(command.segments):
                    next_segment = command.segments[i + 1]
                    if next_segment.media_type in ("video", "audio"):
                        threading.Thread(
                            target=self.player.preload_segment, 
                            args=(next_segment,), 
                            daemon=True
                        ).start()
                        print(f"[SEQUENCE] Preloading next: {next_segment.url}")
                
                if segment.caption:
                    print(f"[CAPTION] Sequence caption: {segment.caption}")
                    self.caption_overlay.show(segment.caption)
                
                success = self.player.play_segment(segment)
                if not success:
                    print(f"[ERROR] Sequence part {i+1} failed")
                    continue
                
                if segment.duration() > 0:
                    print(f"[WAIT] Waiting {segment.duration()}s for segment to complete")
                    time.sleep(segment.duration())
                else:
                    # Brief pause for segments without explicit duration
                    time.sleep(0.5)
        
        else:
            print(f"[ERROR] Unknown command action: {command.action}")

    def _create_emergency_button(self):
        """Create a big red STOP button overlay on the VLC window."""
        try:
            import tkinter as tk
        except ImportError:
            print("[Emergency] tkinter not available - no STOP button overlay")
            return
            
        if hasattr(self, 'emergency_window') and self.emergency_window:
            return
        
        # Start simple, familiar VLC control window
        self._start_simple_vlc_control()
        
        # Also start emergency controls as fallbacks
        self._start_emergency_tray()
        self._start_emergency_hotkeys()
        
        # Skip the complex overlay - use the simple control window instead
        return

    def _hide_emergency_button(self):
        """Hide the emergency controls."""
        if hasattr(self, 'vlc_controller') and self.vlc_controller:
            try:
                self.vlc_controller.stop()
                self.vlc_controller = None
                print("[CONTROL] Emergency controls hidden")
            except Exception as e:
                print(f"[CONTROL] Error hiding emergency controls: {e}")

    def _start_simple_vlc_control(self):
        """Start simple, familiar VLC control window."""
        try:
            from simple_vlc_control import SimpleVLCController
            if not self.vlc_controller:
                self.vlc_controller = SimpleVLCController(self)
                success = self.vlc_controller.start()
                if success:
                    print("[CONTROL] Simple VLC control window started - look for it in bottom-right corner")
                else:
                    print("[CONTROL] Could not start simple VLC control window")
        except ImportError:
            print("[CONTROL] Simple VLC control module not available")
        except Exception as e:
            print(f"[CONTROL] Error starting simple VLC control: {e}")

    def _start_emergency_tray(self):
        """Start system tray emergency control as a fallback."""
        try:
            from emergency_control import EmergencyVLCControl
            if not self.emergency_control:
                self.emergency_control = EmergencyVLCControl(self)
                success = self.emergency_control.start()
                if success:
                    print("[Emergency] System tray emergency control started - look for red stop icon in tray")
                else:
                    print("[Emergency] Could not start system tray control")
        except ImportError:
            print("[Emergency] Emergency control module not available")
        except Exception as e:
            print(f"[Emergency] Error starting tray control: {e}")

    def _start_emergency_hotkeys(self):
        """Start global hotkey emergency control as another fallback."""
        try:
            from global_hotkeys import GlobalHotkeyControl
            if not self.hotkey_control:
                self.hotkey_control = GlobalHotkeyControl(self)
                success = self.hotkey_control.start()
                if success:
                    print("[Emergency] Global hotkeys started - Ctrl+Shift+S will emergency stop VLC")
                else:
                    print("[Emergency] Could not start global hotkeys")
        except ImportError:
            print("[Emergency] Global hotkey module not available")
        except Exception as e:
            print(f"[Emergency] Error starting hotkeys: {e}")

    def _stop_emergency_controls(self):
        """Stop all emergency control methods."""
        if self.vlc_controller:
            try:
                self.vlc_controller.stop()
                self.vlc_controller = None
            except Exception as e:
                print(f"[CONTROL] Error stopping simple VLC control: {e}")
        
        if self.emergency_control:
            try:
                self.emergency_control.stop()
                self.emergency_control = None
            except Exception as e:
                print(f"[Emergency] Error stopping tray control: {e}")
        
        if self.hotkey_control:
            try:
                self.hotkey_control.stop()
                self.hotkey_control = None
            except Exception as e:
                print(f"[Emergency] Error stopping hotkeys: {e}")


class ChatLogHandler(FileSystemEventHandler):
    """Handles chat log file changes."""
    
    def __init__(self, churner: ChurnRoom):
        self.churner = churner
    
    def on_modified(self, event):
        if event.is_directory:
            return
        if Path(event.src_path) == self.churner.chat_log_path:
            self.churner.handle_chat_update()


def test_url_repair():
    """Test the URL repair functionality with problematic URLs from chat log."""
    print("Testing URL repair functionality...")
    print("=" * 50)
    
    test_cases = [
        # From actual chat log
        "httpswwwyoutubecomwatchvQohH89Eu5iM",
        "PLAY httpswwwyoutubecomwatchvQohH89Eu5iM",
        "https://www.youtube.com/watch?v=QohH89Eu5iM",  # Good URL for comparison
        
        # Additional test cases
        "httpyoutubecomwatchvABC123",
        "httpswwwgithubcomuser/repo",
        "completely_broken_not_a_url",
        "httpsgooglecom",
    ]
    
    for test_url in test_cases:
        print(f"\nTesting: {test_url}")
        
        # Test validation
        is_valid, confidence = CommandParser._validate_url(test_url)
        print(f"  Original - Valid: {is_valid}, Confidence: {confidence:.2f}")
        
        # Test repair
        repaired = CommandParser._repair_url(test_url)
        if repaired != test_url:
            is_valid_repaired, confidence_repaired = CommandParser._validate_url(repaired)
            print(f"  Repaired: {repaired}")
            print(f"  Repaired - Valid: {is_valid_repaired}, Confidence: {confidence_repaired:.2f}")
        
        # Test full command parsing
        command_text = f"PLAY: {test_url}"
        command = CommandParser.parse_command(command_text)
        if command and command.segments:
            print(f"  Final URL: {command.segments[0].url}")
            print(f"  Media Type: {command.segments[0].media_type}")
        else:
            print(f"  Command parsing failed")
    
    print("\n" + "=" * 50)
    print("URL repair testing complete!")


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "--test-urls":
        test_url_repair()
        sys.exit(0)
    
    churner = ChurnRoom("chat.log")
    
    print("Churn room ready!")
    print("The LLM can now use commands like:")
    print("  PLAY: https://youtube.com/watch?v=abc (30-45s) CAPTION: Notice the lighting")
    print("  PLAY: /path/to/movie.mp4 (120.5-135.2s)")
    print("  SEQUENCE: Jaws.mp4(45-60) -> Aliens.mp4(200-215) -> Jaws.mp4(61-75)")
    print("  VOLUME: 0.5")
    print("  OVERLAY: This is where the tension builds...")
    print()
    print("To test URL repair functionality, run: python churn_room.py --test-urls")
    print("Press Ctrl+C to stop gracefully")
    print()
    
    try:
        churner.start()
    except KeyboardInterrupt:
        print("\nShutdown initiated by user")
    except Exception as e:
        print(f"\nUnexpected error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        churner.stop()
        print("Clean shutdown completed")
        # Ensure debug output is saved
        cleanup_output_capture()