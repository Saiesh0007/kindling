# Kindling

**A gentle, shame-free task starter for brains that work differently.**

Kindling helps people experiencing task paralysis (common with ADHD and autism) take one tiny first step, or choose genuine rest, without alarms, streaks or guilt. It is a web app plus a Chrome/Edge extension, backed by a small local server that breaks tasks into micro-steps using retrieval over a library of coping strategies and an optional local LLM.

> Kindling does not diagnose ADHD, autism or any condition. Signals are treated as possible hints, a reason to gently ask, never proof of how someone feels.

Track: **LLMs & RAG (The Task Sequencer)**. Secondary: opt-in, on-device behaviour signals.

---

## Run it (Windows)

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
2. **Check-in:** click *Simulate signal*. One question, three equal-weight answers ("Yes", "Not now", "Pause for today"). In the extension this goes through the real background worker and shows a system notification.
3. **Energy:** tap the spoons. The 3D orb changes colour with energy. Pick 1 spoon and press *Help me start*: Kindling gently offers rest first.
4. **Brain-dump:** pick the example *"I'm so overwhelmed, my DSA coding assignment is huge and I can't start"*. Kindling notices the overwhelm, lowers the step count, validates, and shows **one** step.
5. **Smaller / Change / Skip:** every option is low-demand and penalty-free. *Strategy* shows which coping strategy was retrieved and why.
6. **Did it:** a spark burst and "You started. That counts." The win is saved to *Kind wins* (no streaks).
7. **Rest:** *Breathe with the orb* makes the 3D orb expand and contract for box breathing. "Welcome back. Rest counts."
8. **Safety:** typing something like "I want to die" routes to a calm support screen with the Tele-MANAS helpline (14416) instead of task steps.
9. **Settings:** dyslexia-friendly font, high contrast, reduced motion, pause for today, delete all data.

---

## Architecture

```
 USER'S DEVICE (browser)                         LOCAL SERVER (stateless, stores nothing)
 ┌───────────────────────────────┐               ┌──────────────────────────────────────┐
 │ Extension background worker   │               │ FastAPI  /api/sequence  /api/health  │
 │  • tab-switch counts (no URLs)│               │   │                                  │
 │  • idle → return detection    │               │   ├─ Guardrails: crisis + overwhelm  │
 │  • rule engine + cooldown     │               │   ├─ RAG: BM25 over strategies.json  │
 │        │ notification         │   HTTP JSON   │   │       + energy-fit re-ranking    │
 │        ▼                      │  task text +  │   ├─ LLM: Ollama (optional, local)   │
 │ React UI (web / side panel)   │ ◄──energy───► │   │   or built-in step writer        │
 │  • 3D scene (three.js / R3F)  │               │   └─ Tone filter (no "should/just")  │
 │  • IndexedDB, AES-GCM encrypt │               └──────────────────────────────────────┘
 └───────────────────────────────┘
```

| Layer | Tech | Why |
|---|---|---|
| UI | React 18, Vite, Tailwind, Framer Motion | Fast, accessible, smooth |
| 3D | three.js, @react-three/fiber, drei | Energy orb, breathing guide, celebration sparks |
| Local data | IndexedDB + WebCrypto AES-GCM (non-extractable key) | Personal data never leaves the device |
| Extension | Chrome MV3: sidePanel, idle, notifications, storage | `tabs.onActivated` gives a tab id only, no URL or content |
| Backend | Python FastAPI | Stateless and small |
| Retrieval | BM25 + energy-fit re-ranking over 18 curated strategies | Fully offline, no model download |
| LLM | Ollama (Llama 3.2 3B by default), optional | Free and private; built-in engine as fallback |
| Safety | Regex guardrails, tone softener, crisis handoff | Never guilt-trips; routes distress to real help |

## Privacy

- **Signals used:** tab-switch count per 5 minutes, idle-then-return, self-reported energy, and text the user chooses to type.
- **Never used:** webcam, microphone (except when the user presses *Say it instead*), keystrokes, URLs, page content, location.
- All signals are opt-in and off by default. Pause for today, or "Not now" (30-minute cooldown), at any time.
- Wins and settings are encrypted in IndexedDB. *Delete all my data* wipes everything in one tap.
- The server keeps no accounts and no chat logs, and nothing is used for training.

## Tests

```bat
cd backend
.venv\Scripts\python -m pytest -q
```

## Project layout

```
backend/app/main.py           API, static hosting of the web build
backend/app/rag.py            BM25 strategy retrieval
backend/app/sequencer.py      Ollama + built-in micro-step writer
backend/app/guardrails.py     tone softening, overwhelm + crisis detection
backend/app/data/strategies.json   the coping-strategy knowledge base
web/src/                      React app (screens, 3D scene, encrypted store)
extension/                    MV3 manifest + background signal watcher
```
