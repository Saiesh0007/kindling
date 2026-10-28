"""Tone and safety guardrails applied to everything shown to the user."""
import re

# Words that carry pressure or judgement. Replaced or removed before display.
SOFTEN = [
    (r"\byou should\b", "you could"),
    (r"\bshould\b", "could"),
    (r"\byou must\b", "you might"),
    (r"\bmust\b", "might"),
    (r"\bjust\s+", ""),
    (r"\bsimply\s+", ""),
    (r"\bobviously\b", ""),
    (r"\blazy\b", "tired"),
    (r"\bfailure\b", "hard moment"),
    (r"\bfailed\b", "had a hard time"),
    (r"\bhurry\b", "take your time"),
    (r"\bimmediately\b", "when you're ready"),
    (r"\bdeadline is\b", "the date is"),
]

CRISIS = re.compile(
    r"\b(kill myself|suicid\w*|end my life|want to die|self[- ]?harm|hurt myself|no reason to live|better off dead)\b",
    re.I,
)

OVERWHELM = re.compile(
    r"\b(overwhelm\w*|too much|can'?t (do|cope|start|handle)|stuck|panic\w*|freez\w*|paralys\w*|anxious|stressed|drowning|so behind|hopeless)\b",
    re.I,
)

SUPPORT_MESSAGE = (
    "It sounds like you're carrying something really heavy right now, and that matters more than any task. "
    "You don't have to handle this alone. In India you can call Tele-MANAS on 14416 (free, 24x7), "
    "or reach out to someone you trust. If you're in immediate danger, please call 112."
)


def soften(text: str) -> str:
    for pat, rep in SOFTEN:
        text = re.sub(pat, rep, text, flags=re.I)
    text = re.sub(r"\s{2,}", " ", text).strip()
    return text[:1].upper() + text[1:] if text else text


def is_crisis(text: str) -> bool:
    return bool(CRISIS.search(text or ""))


def is_overwhelmed(text: str) -> bool:
    return bool(OVERWHELM.search(text or ""))


def clean_step(step: str, max_len: int = 140) -> str:
    step = soften(step.strip().strip("-*•0123456789. ").strip('"'))
    if len(step) > max_len:
        step = step[:max_len].rsplit(" ", 1)[0] + "…"
    return step
