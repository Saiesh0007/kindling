"""Kindling API. Stateless: requests are processed in memory and never stored or logged."""
from pathlib import Path
from typing import Literal

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import sequencer
from .guardrails import SUPPORT_MESSAGE, is_crisis, is_overwhelmed
from .rag import StrategyIndex

app = FastAPI(title="Kindling API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^(chrome-extension://.*|http://(localhost|127\.0\.0\.1)(:\d+)?)$",
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

index = StrategyIndex()

VALIDATION = {
    1: "Energy is really low right now, so we'll keep this tiny. Rest is always an option too.",
    2: "Low-ish energy is okay. Here's something small to try.",
    3: "Let's find a gentle way in.",
    4: "You've got some fuel today. Here's a small way to start.",
    5: "Nice energy. Let's point it at one small step.",
}
OVERWHELM_VALIDATION = "That sounds like a lot to hold at once. You don't need to do all of it, only the next tiny thing."


class SequenceRequest(BaseModel):
    task: str = Field(..., min_length=1, max_length=2000)
    energy: int = Field(3, ge=1, le=5)
    mode: Literal["start", "smaller", "change"] = "start"
    current_step: str | None = None
    exclude: list[str] = []
    use_llm: bool = True


class Strategy(BaseModel):
    id: str
    title: str
    summary: str


class SequenceResponse(BaseModel):
    kind: Literal["steps", "support"]
    message: str
    steps: list[str]
    strategy: Strategy | None
    engine: str
    overwhelmed: bool


@app.get("/api/health")
async def health():
    available = await sequencer.llm_available(wait=True)
    return {"status": "ok", "llm": available, "model": sequencer.MODEL if available else None,
            "engine": f"ollama:{sequencer.MODEL}" if available else "built-in"}


@app.get("/api/strategies")
def strategies():
    return [{k: d[k] for k in ("id", "title", "summary", "energy", "tags")} for d in index.docs]


@app.post("/api/sequence", response_model=SequenceResponse)
async def sequence(req: SequenceRequest):
    if is_crisis(req.task):
        return SequenceResponse(kind="support", message=SUPPORT_MESSAGE, steps=[], strategy=None,
                                engine="guardrail", overwhelmed=True)

    overwhelmed = is_overwhelmed(req.task)
    energy = min(req.energy, 2) if overwhelmed and req.mode == "start" else req.energy
    exclude = set(req.exclude)
    hits = index.search(req.task, energy, k=3, exclude=exclude)
    if not hits:  # every strategy excluded: start over
        hits = index.search(req.task, energy, k=3)
    if req.mode == "smaller" and req.exclude:
        # Keep the same strategy, make the step smaller.
        strategy = index.get(req.exclude[-1]) or hits[0]
    else:
        strategy = hits[0]

    result = None
    if req.use_llm and await sequencer.llm_available():
        result = await sequencer.llm_steps(req.task, energy, strategy, req.mode, req.current_step)
    if result:
        message, steps = result
        engine = f"ollama:{sequencer.MODEL}"
    else:
        steps = sequencer.builtin_steps(req.task, energy, strategy, req.mode, req.current_step)
        message = ""
        engine = "built-in"
    if not message:
        message = OVERWHELM_VALIDATION if overwhelmed else VALIDATION[energy]
    if req.mode == "smaller":
        message = "Smaller is smart. Here's a tinier version."
    elif req.mode == "change":
        message = "Different angle, same gentle pace."

    return SequenceResponse(kind="steps", message=message, steps=steps,
                            strategy=Strategy(id=strategy["id"], title=strategy["title"], summary=strategy["summary"]),
                            engine=engine, overwhelmed=overwhelmed)


# Serve the built web app (web/dist) from the same server for a one-command demo.
DIST = Path(__file__).resolve().parents[2] / "web" / "dist"
if DIST.exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{path:path}")
    def spa(path: str):
        f = DIST / path
        return FileResponse(f if path and f.is_file() else DIST / "index.html")
