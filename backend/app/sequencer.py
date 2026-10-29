"""Turns a messy task description into microscopic, low-dopamine-threshold steps.

Two engines:
  * ollama   - a local LLM (free, private) prompted with the retrieved strategies
  * built-in - a deterministic writer that fills strategy templates, used when no
               LLM is running so the app always works offline
"""
import asyncio
import json
import os
import random
import re
import time

import httpx

from .guardrails import clean_step, soften
from .rag import TASK_TYPES, detect_task_types

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434")
# Models to try, in order: the first one installed in Ollama is used. KINDLING_MODEL overrides.
MODELS = [m.strip() for m in os.getenv("KINDLING_MODEL", "llama3.2:3b,llama3.2:1b").split(",") if m.strip()]
KEEP_ALIVE = "30m"  # keep the model loaded between requests

VERBS = {"coding": "work on the code", "essay": "write", "email": "write", "reading": "read",
         "exam": "revise", "cleaning": "tidy", "admin": "go through it"}
NOUNS = {"coding": "project", "essay": "document", "email": "email", "reading": "reading",
         "exam": "notes", "cleaning": "room", "admin": "form"}
FOLLOW_UPS = {
    "coding": ["Write one comment describing what the next bit of code will do", "Run the code once and read the first error, if any"],
    "essay": ["Write a heading for the first section", "Add one sentence under that heading, any quality"],
    "email": ["Write one sentence saying why you're writing", "Read it once, then press send or save as draft"],
    "reading": ["Write one word that sums up that paragraph", "Read the next paragraph, or stop here"],
    "exam": ["Check your answer against your notes", "Pick the next topic and write one fact from memory"],
    "cleaning": ["Put five more things away", "Take any rubbish out of that zone"],
    "admin": ["Fill in only the fields you already know", "Note down one question you need to ask"],
    "any": ["Do the next smallest physical action", "Pause and notice what you've already started"],
}
SMALLER = [
    "Only open the {thing}. That's the whole step",
    "Look at the {thing} for ten seconds, no action needed",
    "Move the {thing} somewhere you can see it",
    "Say out loud what the very first action would be",
]


OBJECTS = {
    "coding": ["assignment", "project", "app", "function", "bug", "website", "repo", "program"],
    "essay": ["essay", "report", "dissertation", "thesis", "paper", "article", "assignment", "draft"],
    "email": ["email", "message", "mail"],
    "reading": ["chapter", "textbook", "pages", "notes", "article", "paper"],
    "exam": ["exam", "test", "quiz", "midterm", "notes"],
    "cleaning": ["room", "laundry", "dishes", "desk", "kitchen"],
    "admin": ["form", "bill", "application", "documents", "fees"],
}
FILLER = {"my", "the", "a", "an", "this", "to", "need", "have", "finish", "start", "do", "write", "read", "for",
          "of", "reply", "on", "about", "clean", "pay", "revise", "some", "that", "i", "big", "huge"}


NOT_TOPICS = {"phone", "laptop", "computer", "it", "this", "that", "social media", "instagram", "youtube", "tiktok",
              "reddit", "netflix", "bed", "time", "me", "them", "him", "her"}
STOP_AFTER = r"due|by|before|tomorrow|today|tonight|and|but|instead|because|while|since|when|so|or|which|that|i|it's|but"


def _thing(text: str, types: list[str]) -> tuple[str, str]:
    """Best-effort guess at the object ('history essay') and topic ('french revolution')."""
    low = text.lower()
    topic = None
    for prep in ("on|about", "for"):
        pattern = rf"\b(?:{prep})\s+(?:my\s+|the\s+)?([a-z0-9][\w\s'-]{{2,40}}?)(?:\s+(?:{STOP_AFTER})\b|[.,!?]|$)"
        for m in re.finditer(pattern, low):
            cand = m.group(1).strip()
            if cand not in NOT_TOPICS and not cand.endswith("ing"):
                topic = cand
                break
        if topic:
            break
    for t in types:
        for kw in OBJECTS.get(t, []):
            mm = re.search(rf"\b([a-z']+\s)?{kw}\b", low)
            if mm:
                adj = (mm.group(1) or "").strip()
                thing = kw if adj in FILLER else f"{adj} {kw}"
                return thing, topic if topic and topic != thing else f"your {thing}"
    thing = NOUNS.get(types[0], "task") if types else "task"
    return thing, topic if topic and topic != thing else f"your {thing}"


def builtin_steps(text: str, energy: int, strategy: dict, mode: str, current: str | None) -> list[str]:
    types = detect_task_types(text)
    kind = types[0] if types else "any"
    thing, topic = _thing(text, types)
    fill = lambda s: s.format(thing=thing, topic=topic, verb=VERBS.get(kind, "work on it"), open=f"open the {thing}")
    if mode == "smaller":
        options = [fill(s) for s in SMALLER]
        options = [o for o in options if o != current] or options
        return [clean_step(random.choice(options))]
    first = fill(random.choice(strategy["first_steps"]))
    steps = [first]
    count = 1 if energy <= 1 else 2 if energy == 2 else 3
    steps += FOLLOW_UPS.get(kind, FOLLOW_UPS["any"])[: count - 1]
    return [clean_step(s) for s in steps]


SYSTEM = """You are Kindling, a gentle executive-function companion for neurodivergent people (ADHD, autism) experiencing task paralysis.
Rules:
- Never imply laziness. Never use the words should, must, just, simply, lazy, failure, or mention deadlines.
- Steps are instructions to the user: second person, verb first, in the order they are done, at most 12 words each.
- Each step takes under 5 minutes and needs almost no willpower. The first step is the smallest and is based on the strategy.
- Energy is on a 1-5 scale. Energy 1 -> exactly 1 step that is extremely tiny. Energy 2 -> 2 steps. Energy 3-5 -> 3 steps.
- message: one warm, validating sentence to the user, at most 15 words. No exclamation marks.
- Do not diagnose anything.
Respond ONLY with JSON, steps as plain strings:
{"message": "That sounds heavy. Let's make the start tiny.", "steps": ["Open the document", "Write one rough sentence"]}"""


_available = {"value": False, "checked": 0.0, "task": None, "warm": None, "model": None}


def model() -> str | None:
    """The Ollama model in use, or None when no local model is available."""
    return _available["model"] if _available["value"] else None


async def _probe() -> bool:
    try:
        async with httpx.AsyncClient(timeout=1.0) as c:
            r = await c.get(f"{OLLAMA_URL}/api/tags")
            names = {m["name"] for m in r.json().get("models", [])}
            chosen = next((m for m in MODELS if m in names or f"{m}:latest" in names), None)
    except httpx.TimeoutException:
        # Ollama is running but busy (it answers slowly while generating): keep what we knew.
        _available["checked"] = time.monotonic()
        return _available["value"]
    except Exception:
        chosen = None
    if chosen and (not _available["value"] or chosen != _available["model"]):
        _available["model"] = chosen
        _available["warm"] = asyncio.create_task(_warm(chosen))  # keep a reference until it finishes
    _available.update(value=bool(chosen), checked=time.monotonic())
    return bool(chosen)


async def _warm(name: str) -> None:
    """Load the model into memory as soon as Ollama is found, so the first real request
    doesn't spend its timeout loading weights on a CPU."""
    try:
        async with httpx.AsyncClient(timeout=120) as c:
            await c.post(f"{OLLAMA_URL}/api/generate", json={"model": name, "prompt": "", "keep_alive": KEEP_ALIVE})
    except Exception:
        pass


async def llm_available(wait: bool = False) -> bool:
    """Is the local model running? Cached; stale entries refresh in the background so a
    stopped Ollama never slows a request down."""
    if wait or not _available["checked"]:
        return await _probe()
    if time.monotonic() - _available["checked"] > 10 and not (_available["task"] and not _available["task"].done()):
        _available["task"] = asyncio.create_task(_probe())
    return _available["value"]


def _step_text(step) -> str:
    """Small models sometimes return a step as an object, or as an object encoded in a string,
    e.g. '{"title": "Open your notes", "description": "..."}'. Keep just the step's text."""
    if isinstance(step, str) and step.strip().startswith("{"):
        try:
            step = json.loads(step)
        except ValueError:
            return ""
    if isinstance(step, dict):
        step = next((step[k] for k in ("step", "text", "title", "action", "description") if isinstance(step.get(k), str)), "")
    return step.strip() if isinstance(step, str) else ""


async def llm_steps(text: str, energy: int, strategy: dict, mode: str, current: str | None) -> tuple[str, list[str]] | None:
    user = {
        "task": text,
        "energy": energy,
        "strategy": {"title": strategy["title"], "how": strategy["summary"]},
    }
    if mode == "smaller" and current:
        user["instruction"] = f"The user found this step too big: \"{current}\". Give exactly 1 step that is much smaller."
    elif mode == "change" and current:
        user["instruction"] = f"The user wants a different approach than: \"{current}\". Use the new strategy."
    try:
        async with httpx.AsyncClient(timeout=45) as c:  # a 3B model on an older laptop CPU takes 15-20 s
            r = await c.post(f"{OLLAMA_URL}/api/chat", json={
                "model": _available["model"], "stream": False, "format": "json", "keep_alive": KEEP_ALIVE,
                "options": {"temperature": 0.4, "num_predict": 160},
                "messages": [{"role": "system", "content": SYSTEM}, {"role": "user", "content": json.dumps(user)}],
            })
            data = json.loads(r.json()["message"]["content"])
        raw = data.get("steps", [])
        limit = 1 if mode == "smaller" or energy <= 1 else 2 if energy == 2 else 3  # small models drift
        steps = [clean_step(t) for t in map(_step_text, raw if isinstance(raw, list) else [raw]) if t][:limit]
        if not steps:
            return None
        return soften(str(data.get("message", ""))), steps
    except Exception:
        return None
