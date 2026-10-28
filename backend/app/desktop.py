"""Desktop-only signal: how often the foreground window changes (app-hopping).

Runs only inside the Kindling desktop app (KINDLING_DESKTOP=1) on Windows, and only starts
once the desktop app first asks for it. Only window handles are compared: titles, app names
and screen content are never read. Timestamps are kept in memory for five minutes.
"""
import os
import sys
import threading
import time

ENABLED = os.environ.get("KINDLING_DESKTOP") == "1" and sys.platform == "win32"
WINDOW_S = 300

_switches: list[float] = []
_lock = threading.Lock()
_thread: threading.Thread | None = None


def _watch() -> None:
    import ctypes

    user32 = ctypes.windll.user32
    last = user32.GetForegroundWindow()
    while True:
        time.sleep(1)
        current = user32.GetForegroundWindow()
        if current and current != last:
            last = current
            now = time.monotonic()
            with _lock:
                _switches.append(now)
                while _switches and now - _switches[0] > WINDOW_S:
                    _switches.pop(0)


def activity() -> dict:
    global _thread
    if not ENABLED:
        return {"enabled": False, "switches": 0, "window_seconds": WINDOW_S}
    if _thread is None:
        _thread = threading.Thread(target=_watch, daemon=True)
        _thread.start()
    now = time.monotonic()
    with _lock:
        recent = sum(1 for t in _switches if now - t <= WINDOW_S)
    return {"enabled": True, "switches": recent, "window_seconds": WINDOW_S}
