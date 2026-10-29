# Kindling

**A gentle, shame-free task starter for brains that work differently.**

Kindling helps people experiencing task paralysis (common with ADHD and autism) take one tiny first step, or choose genuine rest, without alarms, streaks or guilt. It runs as a Windows desktop app, a web app or a Chrome/Edge extension, backed by a small local server that breaks tasks into micro-steps using hybrid retrieval (meaning + keywords) over a library of coping strategies and an optional local LLM. An opt-in, on-device webcam lens can notice a possible stuck moment, and Kindling learns on the device which strategies help each person.

> Kindling does not diagnose ADHD, autism or any condition. Signals are treated as possible hints, a reason to gently ask, never proof of how someone feels.

Track: **LLMs & RAG (The Task Sequencer)**. Also: an on-device **Computer Vision & Edge AI** lens, and opt-in desktop and browser signals.

| | |
|---|---|
| **Windows installer** | [Kindling-Setup.exe](https://github.com/Saiesh0007/kindling/releases/latest/download/Kindling-Setup.exe) ([release notes](https://github.com/Saiesh0007/kindling/releases/latest)) |
| **Live web demo** | https://kindling-0gj7.onrender.com (free tier: the first visit after a quiet spell takes about a minute to wake up) |

---

## The problem

Task paralysis is an executive-function barrier, not laziness: people know exactly what to do and still cannot begin. Most productivity tools answer with more pressure (alarms, blockers, streaks, "overdue" badges). For someone already overloaded, each missed reminder adds shame, and shame makes the next start even harder.

Kindling is built to break that loop. It notices gently, asks once, and then offers **one tiny step** or **genuine rest**. Nothing is ever overdue, and saying "not now" is always fine.

## How it works

Kindling follows the same four stages every time: **notice → ask → help → learn**.

**1. Notice (optional, opt-in signals).** Every signal is off until the user turns it on, and each has its own switch.

| Signal | Where | What is measured | What is never read |
|---|---|---|---|
| App and tab hopping | Desktop app | How often the foreground window changes, or its title changes (a tab switch in any browser), in 5 minutes; 12+ switches is a hint | Stored or sent titles, app names, screen content: titles are only compared as short in-memory hashes, with digits ignored so counters like "(3) Inbox" don't count |
| Tab-hopping | Browser extension | Tab switches in 5 minutes | URLs, page content |
| Long pause, then return | Desktop app and extension | No keyboard or mouse for 3 minutes, then a return within 20 minutes (a locked screen is ignored) | Keystrokes |
| Focus lens | Desktop and web app (webcam) | Gaze stillness, blinks per minute and facial tension, each compared to the user's own 12-second calibration | Images or video: frames are analysed in memory and discarded |

The focus lens is designed to tell a relaxed viewer from someone frozen at a blinking cursor. A still gaze alone is not enough: the stuck score combines stillness (40%), fewer blinks than the user's normal (30%) and tension above their normal (30%), and a smile or relaxed face lowers it. Only a sustained pattern over the chosen window (30 seconds to 5 minutes) counts.

**2. Ask (one gentle check-in).** A signal never acts on its own; it only leads to a question: *"Looks like a tricky moment. Want a tiny nudge?"* with three equal-weight answers: **Yes**, **Not now** (a 30-minute quiet period) and **Pause for today**. The check-in shows why it asked. In the desktop app it arrives as a Windows notification when Kindling is in the tray.

**3. Help (the Task Sequencer).** The user picks their energy in "spoons" (1 to 5) and types or says what they are stuck on. Then the local server:

1. **Guardrails:** crisis wording goes to a calm support screen with the Tele-MANAS helpline (14416), never to task steps. Overwhelmed wording gets fewer, smaller steps.
2. **Hybrid retrieval (RAG)** over 18 curated neurodivergent coping strategies (`backend/app/data/strategies.json`): BM25 keyword matching plus meaning matching with a local all-MiniLM-L6-v2 embedding model, re-ranked by energy fit and by what has helped this user before.
3. **Step writer:** a local Llama 3.2 via Ollama writes microscopic steps from the chosen strategy, or the built-in writer does if no model is running. Low energy means fewer, smaller steps, and 1 spoon offers rest first.
4. **Tone filter:** removes guilt words such as "should", "just" and "lazy".

The user sees **one step at a time**, with *Did it*, *Smaller*, *Change* and *Skip*. Tapping *Strategy* explains the pick: meaning match %, matched words, task type, energy fit, and whether it helped before.

**4. Learn (on the device).** *Did it* raises a strategy's personal score and *Skip* or *Change* lowers it. Scores (−1 to 1) are stored encrypted on the device and sent with the next request to re-rank retrieval; the server uses them and forgets them. *Kind wins* logs starts and rests (no streaks) and shows *What seems to help you*.

---

## Desktop app (Windows)

Install with **`Kindling-Setup.exe`**. It bundles everything (server, strategy library, embedding model, web app), so it needs no Python, Node or internet. Windows SmartScreen may warn because the installer is not code-signed: choose *More info → Run anyway*.

What the desktop app adds:

- **Lives in the tray.** Closing the window keeps Kindling running; quit from the tray icon. The tray menu also has *Pause check-ins for today* and *Demo: send a check-in in 5 seconds*.
- **Start when I sign in** (opt-in, in onboarding and Settings): Kindling starts quietly in the tray each time you log in, a few seconds after the desktop appears, and shows a quiet "Kindling is ready in the tray" notice. The switch reads and writes the real Windows startup entry, so it always matches what will happen.
- **Live signals card** on Home: how many app and tab switches in the last 5 minutes (out of the 12 that prompt a check-in), the long-pause idle timer, and when check-ins are resting after a recent one or a "Not now".
- **System-wide signals**, all opt-in: *app and tab hopping* (how often the foreground window or its title changes in 5 minutes, so browser tab switches count without the extension; titles are compared as in-memory hashes, never stored or sent), *long pauses* (no keyboard or mouse for 3 to 20 minutes, then you return), and the *webcam lens*, which keeps working while Kindling is in the tray.
- **Windows notifications** for check-ins when the window is hidden, with a soft two-note chime instead of the Windows sound (switch it off in Settings). Clicking one opens Kindling with the check-in. Demo check-ins never start the 30-minute cooldown, so real signals keep working after a demo.
- **Offline voice brain-dump:** *Say it instead* uses Windows' built-in speech recognizer (System.Speech), so speech is recognised on the laptop and never recorded or sent. It stops after a quiet pause. Allow desktop apps under *Windows Settings → Privacy & security → Microphone*.
- **Rest with soothing sound:** soft rain, slow waves or a warm hum while any rest runs, with a volume slider. The sounds are generated in the app with the Web Audio API, so there are no audio files.
- **My report** (*Kind wins → My report*): tiny starts, steps, rests and check-ins for the last 7 days, 30 days or everything, a day-by-day chart, and which strategies seem to help. *Save as PDF* writes it wherever you choose. It is built on the device and never uploaded.
- **Local AI:** if [Ollama](https://ollama.com) is installed with `llama3.2:3b`, the desktop app uses it automatically, loads the model in the background and keeps it warm for 30 minutes.
- **Permissions:** the camera (video only) and notifications are granted to Kindling's own page only. If the lens says the camera can't start, allow desktop apps in *Windows Settings → Privacy & security → Camera*.

Run from source, or build the installer:

```bat
cd desktop
npm install
npm start            :: uses backend\.venv, so run start.bat once first
npm run dist         :: builds desktop\release\Kindling-Setup.exe
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

Kindling detects Ollama automatically, loads the model in the background and keeps it warm for 30 minutes. The chip at the top of the home screen turns green ("Local AI"). On an older laptop CPU a 3B model takes about 15 seconds to write steps, so the brain-dump screen says so while it works; *Smaller* always uses the instant built-in writer. Use another model with `set KINDLING_MODEL=qwen2.5:3b` before starting (a comma-separated list picks the first one installed).

### Load the extension

1. Run `npm run build:ext` in `web/` (start.bat does this).
2. Open `chrome://extensions` (or `edge://extensions`) and turn on **Developer mode**.
3. Click **Load unpacked** and pick the `extension/` folder.
4. Click the Kindling icon to open the side panel. Keep the server running: either `start.bat` (port 8000) or the desktop app (port 8765), which the extension finds automatically.

---

## Demo script (about 3 minutes)

1. **Onboarding:** consent first. Check-ins are off by default, and each signal is explained with its own toggle.
2. **Focus lens (Computer Vision, on-device):** in Settings turn on *Webcam focus lens* and choose *30 s (demo)*. On Home, the lens card calibrates to your normal face for about 12 s, then shows gaze stillness, blinks per minute and tension. Look relaxed or smile: "Looks settled. No nudge needed." Then stare at one spot, blink less and frown or press your lips for about 30 s: a check-in appears that explains *why* it asked. The camera pill at the top-left turns it off in one tap.
3. **Check-in:** or click *Simulate signal*. One question, three equal-weight answers ("Yes", "Not now", "Pause for today"). In the extension this goes through the real background worker and shows a system notification. In the desktop app, close the window (Kindling stays in the tray), then choose *Demo: send a check-in in 5 seconds* from the tray menu: a Windows notification appears, and clicking it opens the check-in.
4. **Desktop extras:** on Home the live signals card counts app and tab switches; switch a few browser tabs and watch it move. In *Kind wins → My report*, show the summary and *Save as PDF*.
5. **Energy:** tap the spoons. The 3D orb changes colour with energy. Pick 1 spoon and press *Help me start*: Kindling gently offers rest first.
6. **Brain-dump:** in the desktop app tap *Say it instead* and speak, or pick the example *"I'm so overwhelmed, my DSA coding assignment is huge and I can't start"*. Kindling notices the overwhelm, lowers the step count, validates, and shows **one** step.
7. **Smaller / Change / Skip:** every option is low-demand and penalty-free. *Strategy* shows which coping strategy was retrieved and **why**: meaning match %, matched words, task type, energy fit, and whether it helped this user before. Try a phrasing with no keywords, like *"I keep doomscrolling instead of revising"*: hybrid search still finds the transition ritual.
8. **Did it:** a spark burst and "You started. That counts." The win is saved to *Kind wins* (no streaks), and *What seems to help you* shows the strategies Kindling has learned to suggest more often.
9. **Rest:** choose *Soft rain*, then *Breathe with the orb*: the 3D orb expands and contracts for box breathing while the rain plays. "Welcome back. Rest counts."
10. **Safety:** typing something like "I want to die" routes to a calm support screen with the Tele-MANAS helpline (14416) instead of task steps.
11. **Settings:** dyslexia-friendly font, high contrast, reduced motion, pause for today, delete all data.

---

## Architecture

Everything runs on the user's laptop. In the desktop app, Electron starts the bundled server on `127.0.0.1:8765` and shows the same React UI in its own window; in the browser the server runs on port 8000.

```
 USER'S DEVICE (desktop app or browser)          LOCAL SERVER (stateless, stores nothing)
 ┌───────────────────────────────┐               ┌──────────────────────────────────────┐
 │ Signal watcher                │               │ FastAPI  /api/sequence  /api/health  │
 │  desktop: Electron tray app   │               │          /api/desktop/activity       │
 │   • app + tab switch counts   │               │   │                                  │
 │   • idle → return, lock-aware │               │   │                                  │
 │   • Windows notifications     │               │   │                                  │
 │  browser: extension worker    │               │   │                                  │
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
| Desktop | Electron (tray, start at login, notifications), PyInstaller-bundled server, NSIS installer | One offline installer; signals keep working in the tray |
| Extension | Chrome MV3: sidePanel, idle, notifications, storage | `tabs.onActivated` gives a tab id only, no URL or content |
| Backend | Python FastAPI | Stateless and small |
| Retrieval | Hybrid: BM25 + all-MiniLM-L6-v2 embeddings (fastembed, ONNX) + energy fit + personal feedback, over 18 curated strategies | Understands meaning, not only keywords; explainable; offline after one download; falls back to BM25 |
| Vision | MediaPipe Face Landmarker (WASM, in the browser): blink rate, gaze stillness, facial tension vs the user's own baseline | Edge AI: frames never leave the device; smiling/relaxed reads as "settled", not stuck |
| Personalisation | On-device done/skip counts per strategy, sent as scores with each request | Learns what helps this person; the server stores nothing |
| LLM | Ollama (Llama 3.2 3B by default), optional | Free and private; built-in engine as fallback |
| Safety | Regex guardrails, tone softener, crisis handoff | Never guilt-trips; routes distress to real help |

## Deployment

- **Windows installer:** `cd desktop && npm run dist`. `scripts/build-server.mjs` builds the web app, bundles the Python server, strategy library and embedding model with PyInstaller, and electron-builder wraps it all in an NSIS installer in `desktop/release/`.
- **Web (Render):** `render.yaml` deploys the `Dockerfile` as a free web service with a health check on `/api/health`, redeploying on every push to `main`. The Docker image builds the web app, installs the backend and bakes in the embedding model, so it needs no downloads at runtime.
- **Any Docker host:** `docker build -t kindling . && docker run -p 7860:7860 kindling`, then open http://localhost:7860.

## Privacy

- **Signals used:** tab-switch count (extension) or app and tab switch count (desktop) per 5 minutes, idle-then-return, self-reported energy, text the user chooses to type and, only if turned on, the webcam focus lens.
- **Webcam lens:** off by default, experimental, web and desktop app. Frames are analysed in memory by MediaPipe in the browser and discarded; only a few numbers per second are kept, in memory. No images, video or face data are stored or sent. It compares you to your own calibration, not a population norm, always shows a "camera on" pill, and only ever asks a question with its reasons.
- **Never used:** microphone (except while the user is using *Say it instead*; in the desktop app speech is recognised offline by Windows and never recorded), keystrokes, URLs, page content, app names, location. Window titles are never stored or sent; the desktop app only compares a short hash of the active window's title in memory to notice a tab switch.
- All signals are opt-in and off by default. Pause for today, or "Not now" (30-minute cooldown), at any time.
- Wins, check-ins and settings are encrypted in IndexedDB. *My report* is built from them on the device. *Delete all my data* wipes everything in one tap.
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
backend/app/desktop.py        app and tab switch counter (desktop app only)
backend/server.py             entry point for the bundled desktop server
backend/app/guardrails.py     tone softening, overwhelm + crisis detection
backend/app/data/strategies.json   the coping-strategy knowledge base
web/src/                      React app (screens, 3D scene, encrypted store)
web/src/lib/lens.js           on-device webcam focus lens (MediaPipe)
web/src/lib/sound.js          generated chime and rest soundscapes (Web Audio)
web/src/screens/Report.jsx    "My report": summary, chart, PDF / print
web/src/components/Signals.jsx   live signals card (desktop app)
extension/                    MV3 manifest + background signal watcher
desktop/main.js               Electron app: tray, start at login, signals, notifications
desktop/scripts/build-server.mjs   bundles the server with PyInstaller for the installer
```
