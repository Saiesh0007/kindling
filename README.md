# Kindling

**A gentle, shame-free task starter for brains that work differently.**

Kindling helps people experiencing task paralysis (common with ADHD and autism) take one tiny first step, or choose genuine rest, without alarms, streaks or guilt. It runs as a Windows desktop app, a web app or a Chrome/Edge extension, backed by a small local server that breaks tasks into micro-steps using hybrid retrieval (meaning + keywords) over a library of coping strategies and an optional local LLM. An opt-in, on-device webcam lens can notice a possible stuck moment, and Kindling learns on the device which strategies help each person.

> Kindling does not diagnose ADHD, autism or any condition. Signals are treated as possible hints, a reason to gently ask, never proof of how someone feels.

Track: **LLMs & RAG (The Task Sequencer)**. Also: an on-device **Computer Vision & Edge AI** lens, and opt-in desktop and browser signals.

Live web demo: https://kindling-0gj7.onrender.com (free tier: the first visit after a quiet spell takes about a minute to wake up).

---

## Desktop app (Windows)

Install with **`Kindling Setup 1.2.0.exe`**. It bundles everything (server, strategy library, embedding model, web app), so it needs no Python, Node or internet. Windows SmartScreen may warn because the installer is not code-signed: choose *More info → Run anyway*.

What the desktop app adds:

- **Lives in the tray.** Closing the window keeps Kindling running; quit from the tray icon. The tray menu also has *Pause check-ins for today* and *Demo: send a check-in in 5 seconds*.
- **Start when I sign in** (opt-in, in onboarding and Settings): Kindling starts quietly in the tray each time you log in.
- **System-wide signals**, all opt-in: *app-hopping* (how often the foreground window changes in 5 minutes; window handles only, never titles or app names), *long pauses* (no keyboard or mouse for 3 to 20 minutes, then you return), and the *webcam lens*, which keeps working while Kindling is in the tray.
- **Windows notifications** for check-ins when the window is hidden. Clicking one opens Kindling with the check-in.
- **Permissions:** the camera (video only) and notifications are granted to Kindling's own page only. If the lens says the camera can't start, allow desktop apps in *Windows Settings → Privacy & security → Camera*.

Run from source, or build the installer:

```bat
cd desktop
npm install
npm start            :: uses backend\.venv, so run start.bat once first
npm run dist         :: builds desktop\release\Kindling Setup 1.2.0.exe
```

## Run it in the browser (Windows)

Double-click **`start.bat`**, or:

```bat
cd backend
py -3.11 -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
cd ..\web
npm install
npm run build
npm run build:ext
cd ..\backend
.venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Open **http://127.0.0.1:8000**. Use `127.0.0.1`, not `localhost`: on Windows, `localhost` tries IPv6 first and adds about 2 s to every request.

Requirements: Python 3.11 or 3.12, Node 18+. Everything is free and open-source.

The first run needs internet once: it installs packages and downloads the small embedding model (about 90 MB, into `backend/.models`). After that Kindling works fully offline. To pre-download on a new laptop: `backend\.venv\Scripts\python -m app.prefetch` (from `backend/`).

### Optional: local AI (free, private)

Without a model, Kindling uses its **built-in engine**, which fills retrieved strategies with your task's details. It is fast, deterministic and works offline. To have a local LLM write the steps instead:

```bat
winget install Ollama.Ollama
ollama pull llama3.2:3b
```

Kindling detects Ollama automatically. The chip at the top of the home screen turns green ("Local AI"). Use another model with `set KINDLING_MODEL=qwen2.5:3b` before starting.

### Load the extension

1. Run `npm run build:ext` in `web/` (start.bat does this).
2. Open `chrome://extensions` (or `edge://extensions`) and turn on **Developer mode**.
3. Click **Load unpacked** and pick the `extension/` folder.
4. Click the Kindling icon to open the side panel. Keep the server running.

---

## Demo script (about 3 minutes)

1. **Onboarding:** consent first. Check-ins are off by default, and each signal is explained with its own toggle.
2. **Focus lens (Computer Vision, on-device):** in Settings turn on *Webcam focus lens* and choose *30 s (demo)*. On Home, the lens card calibrates to your normal face for about 12 s, then shows gaze stillness, blinks per minute and tension. Look relaxed or smile: "Looks settled. No nudge needed." Then stare at one spot, blink less and frown or press your lips for about 30 s: a check-in appears that explains *why* it asked. The camera pill at the top-left turns it off in one tap.
3. **Check-in:** or click *Simulate signal*. One question, three equal-weight answers ("Yes", "Not now", "Pause for today"). In the extension this goes through the real background worker and shows a system notification.
4. **Energy:** tap the spoons. The 3D orb changes colour with energy. Pick 1 spoon and press *Help me start*: Kindling gently offers rest first.
5. **Brain-dump:** pick the example *"I'm so overwhelmed, my DSA coding assignment is huge and I can't start"*. Kindling notices the overwhelm, lowers the step count, validates, and shows **one** step.
6. **Smaller / Change / Skip:** every option is low-demand and penalty-free. *Strategy* shows which coping strategy was retrieved and **why**: meaning match %, matched words, task type, energy fit, and whether it helped this user before. Try a phrasing with no keywords, like *"I keep doomscrolling instead of revising"*: hybrid search still finds the transition ritual.
7. **Did it:** a spark burst and "You started. That counts." The win is saved to *Kind wins* (no streaks), and *What seems to help you* shows the strategies Kindling has learned to suggest more often.
8. **Rest:** *Breathe with the orb* makes the 3D orb expand and contract for box breathing. "Welcome back. Rest counts."
9. **Safety:** typing something like "I want to die" routes to a calm support screen with the Tele-MANAS helpline (14416) instead of task steps.
10. **Settings:** dyslexia-friendly font, high contrast, reduced motion, pause for today, delete all data.

---

## Architecture

```
 USER'S DEVICE (browser)                         LOCAL SERVER (stateless, stores nothing)
 ┌───────────────────────────────┐               ┌──────────────────────────────────────┐
 │ Extension background worker   │               │ FastAPI  /api/sequence  /api/health  │
 │  • tab-switch counts (no URLs)│               │   │                                  │
 │  • idle → return detection    │               │   ├─ Guardrails: crisis + overwhelm  │
 │  • rule engine + cooldown     │               │   ├─ Hybrid RAG over strategies.json │
 │        │ notification         │               │   │   BM25 keywords + MiniLM meaning │
 │        ▼                      │   HTTP JSON   │   │   + energy fit + your feedback   │
 │ React UI (web / side panel)   │  task text,   │   ├─ LLM: Ollama (optional, local)   │
 │  • 3D scene (three.js / R3F)  │ ◄─energy, ──► │   │   or built-in step writer        │
 │  • Focus lens: MediaPipe face │  feedback     │   └─ Tone filter (no "should/just")  │
 │    landmarks in WASM, frames  │  scores       └──────────────────────────────────────┘
 │    never leave the browser    │
 │  • IndexedDB, AES-GCM encrypt │
 │  • strategy feedback learning │
 └───────────────────────────────┘
```

| Layer | Tech | Why |
|---|---|---|
| UI | React 18, Vite, Tailwind, Framer Motion | Fast, accessible, smooth |
| 3D | three.js, @react-three/fiber, drei | Energy orb, breathing guide, celebration sparks |
| Local data | IndexedDB + WebCrypto AES-GCM (non-extractable key) | Personal data never leaves the device |
| Extension | Chrome MV3: sidePanel, idle, notifications, storage | `tabs.onActivated` gives a tab id only, no URL or content |
| Backend | Python FastAPI | Stateless and small |
| Retrieval | Hybrid: BM25 + all-MiniLM-L6-v2 embeddings (fastembed, ONNX) + energy fit + personal feedback, over 18 curated strategies | Understands meaning, not only keywords; explainable; offline after one download; falls back to BM25 |
| Vision | MediaPipe Face Landmarker (WASM, in the browser): blink rate, gaze stillness, facial tension vs the user's own baseline | Edge AI: frames never leave the device; smiling/relaxed reads as "settled", not stuck |
| Personalisation | On-device done/skip counts per strategy, sent as scores with each request | Learns what helps this person; the server stores nothing |
| LLM | Ollama (Llama 3.2 3B by default), optional | Free and private; built-in engine as fallback |
| Safety | Regex guardrails, tone softener, crisis handoff | Never guilt-trips; routes distress to real help |

## Privacy

- **Signals used:** tab-switch count (extension) or app-switch count (desktop) per 5 minutes, idle-then-return, self-reported energy, text the user chooses to type and, only if turned on, the webcam focus lens.
- **Webcam lens:** off by default, experimental, web and desktop app. Frames are analysed in memory by MediaPipe in the browser and discarded; only a few numbers per second are kept, in memory. No images, video or face data are stored or sent. It compares you to your own calibration, not a population norm, always shows a "camera on" pill, and only ever asks a question with its reasons.
- **Never used:** microphone (except when the user presses *Say it instead*), keystrokes, URLs, page content, window titles, app names, location.
- All signals are opt-in and off by default. Pause for today, or "Not now" (30-minute cooldown), at any time.
- Wins and settings are encrypted in IndexedDB. *Delete all my data* wipes everything in one tap.
- The server keeps no accounts and no chat logs, and nothing is used for training.

## Tests

```bat
cd backend
.venv\Scripts\python -m pytest -q
.venv\Scripts\python -m tests.retrieval_eval
```

The retrieval evaluation compares keyword-only and hybrid search on 30 everyday phrasings (top-1: 77% keyword, 80% hybrid; top-3: 87% vs 90%). It is a small in-house set and the scoring was tuned after looking at its failures, so treat it as indicative.

## Project layout

```
backend/app/main.py           API, static hosting of the web build
backend/app/rag.py            hybrid strategy retrieval (BM25 + embeddings + feedback)
backend/app/semantic.py       local MiniLM embeddings via fastembed
backend/app/sequencer.py      Ollama + built-in micro-step writer
backend/app/desktop.py        app-switch counter (desktop app only)
backend/server.py             entry point for the bundled desktop server
backend/app/guardrails.py     tone softening, overwhelm + crisis detection
backend/app/data/strategies.json   the coping-strategy knowledge base
web/src/                      React app (screens, 3D scene, encrypted store)
web/src/lib/lens.js           on-device webcam focus lens (MediaPipe)
extension/                    MV3 manifest + background signal watcher
desktop/main.js               Electron app: tray, start at login, signals, notifications
desktop/scripts/build-server.mjs   bundles the server with PyInstaller for the installer
```
