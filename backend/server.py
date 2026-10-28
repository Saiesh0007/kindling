"""Entry point for the desktop app's bundled server. Listens on 127.0.0.1 only."""
import os
import sys

if getattr(sys, "frozen", False):  # running from the PyInstaller bundle
    base = sys._MEIPASS
    os.environ.setdefault("KINDLING_DIST", os.path.join(base, "web_dist"))
    os.environ.setdefault("KINDLING_MODELS", os.path.join(base, "models"))

import uvicorn  # noqa: E402

from app.main import app  # noqa: E402

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=int(os.environ.get("KINDLING_PORT", "8765")), log_level="warning")
