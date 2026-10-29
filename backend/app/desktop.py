"""Desktop-only signal: app and tab hopping.

Runs only inside the Kindling desktop app (KINDLING_DESKTOP=1) on Windows, and only starts
once the desktop app first asks for it. Windows reports two events to an out-of-process hook:

  * the foreground window changed      -> an app switch
  * the foreground window's title changed -> a tab switch (any browser, no extension needed)

To spot a tab change, the title is reduced to a short hash in memory (digits removed, so
counters like "(3) Inbox" or "45%" don't count) and compared with the previous hash. Titles,
app names and screen content are never stored or sent. Timestamps are kept for five minutes.
"""
import hashlib
import os
import re
import sys
import threading
import time

ENABLED = os.environ.get("KINDLING_DESKTOP") == "1" and sys.platform == "win32"
WINDOW_S = 300
THRESHOLD = 12  # app + tab switches in WINDOW_S that count as a possible stuck moment
TAB_GAP_S = 1.5  # one tab switch at most per 1.5 s, so a page loading in steps counts once

EVENT_SYSTEM_FOREGROUND = 0x0003
EVENT_OBJECT_NAMECHANGE = 0x800C
WINEVENT_OUTOFCONTEXT = 0x0000

_apps: list[float] = []
_tabs: list[float] = []
_lock = threading.Lock()
_thread: threading.Thread | None = None


def _record(times: list[float], now: float) -> None:
    with _lock:
        times.append(now)
        while times and now - times[0] > WINDOW_S:
            times.pop(0)


def _watch() -> None:
    import ctypes
    from ctypes import wintypes

    user32 = ctypes.windll.user32
    user32.SetWinEventHook.restype = wintypes.HANDLE
    Proc = ctypes.WINFUNCTYPE(None, wintypes.HANDLE, wintypes.DWORD, wintypes.HWND,
                              wintypes.LONG, wintypes.LONG, wintypes.DWORD, wintypes.DWORD)

    def title_hash(hwnd):
        n = user32.GetWindowTextLengthW(hwnd)
        if n <= 0:
            return None
        buf = ctypes.create_unicode_buffer(n + 1)
        user32.GetWindowTextW(hwnd, buf, n + 1)
        text = re.sub(r"[\d\s]+", "", buf.value)
        return hashlib.blake2s(text.encode(), digest_size=8).digest() if text else None

    state = {"hwnd": user32.GetForegroundWindow(), "title": None, "last_tab": 0.0}
    state["title"] = title_hash(state["hwnd"]) if state["hwnd"] else None

    def on_event(_hook, event, hwnd, id_object, id_child, _thread_id, _time):
        if not hwnd or id_object != 0 or id_child != 0:  # whole windows only, not controls
            return
        now = time.monotonic()
        if event == EVENT_SYSTEM_FOREGROUND:
            if hwnd != state["hwnd"]:
                state["hwnd"], state["title"] = hwnd, title_hash(hwnd)
                _record(_apps, now)
        elif hwnd == state["hwnd"]:
            current = title_hash(hwnd)
            if current and current != state["title"]:
                state["title"] = current
                if now - state["last_tab"] >= TAB_GAP_S:
                    state["last_tab"] = now
                    _record(_tabs, now)

    proc = Proc(on_event)  # keep a reference: Windows calls it for as long as the hook lives
    for event in (EVENT_SYSTEM_FOREGROUND, EVENT_OBJECT_NAMECHANGE):
        user32.SetWinEventHook(event, event, 0, proc, 0, 0, WINEVENT_OUTOFCONTEXT)
    msg = wintypes.MSG()
    while user32.GetMessageW(ctypes.byref(msg), 0, 0, 0) > 0:  # hooks are delivered via this loop
        user32.TranslateMessage(ctypes.byref(msg))
        user32.DispatchMessageW(ctypes.byref(msg))


def _count(times: list[float], now: float) -> int:
    with _lock:
        return sum(1 for t in times if now - t <= WINDOW_S)


def activity() -> dict:
    global _thread
    if not ENABLED:
        return {"enabled": False, "switches": 0, "tabs": 0, "threshold": THRESHOLD, "window_seconds": WINDOW_S}
    if _thread is None:
        _thread = threading.Thread(target=_watch, daemon=True)
        _thread.start()
    now = time.monotonic()
    return {"enabled": True, "switches": _count(_apps, now), "tabs": _count(_tabs, now),
            "threshold": THRESHOLD, "window_seconds": WINDOW_S}
