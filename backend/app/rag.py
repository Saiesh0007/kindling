"""Hybrid retrieval over the coping-strategy knowledge base.

Each strategy is scored by:
  * BM25 keyword match (pure Python, always available),
  * semantic similarity from a local embedding model (when loaded, see semantic.py),
  * task-type tags, fit to the user's current energy, and
  * on-device feedback: strategies that helped this user before rank higher.
Every result carries a short explanation so the UI can show why it was picked.
"""
import json
import math
import re
from pathlib import Path

from .semantic import SemanticIndex

DATA = Path(__file__).parent / "data" / "strategies.json"
TOKEN = re.compile(r"[a-z']+")
STOP = {"the", "a", "an", "to", "of", "and", "or", "i", "my", "me", "is", "it", "in", "on", "for", "this", "that", "with", "have", "need", "do", "be", "so", "but", "at", "am", "keep", "instead", "can't", "cant", "i'm", "im", "really", "just", "too", "much", "very", "all", "get", "want", "feel", "like", "even", "what", "how", "don't", "it's", "there", "are", "was", "about", "from", "will", "its"}

# Task-type hints used both for retrieval and for the fallback step writer.
TASK_TYPES = {
    "coding": ["code", "coding", "bug", "program", "app", "function", "debug", "python", "java", "website", "repo"],
    "essay": ["essay", "report", "dissertation", "thesis", "paper", "article", "assignment", "write", "writing", "draft"],
    "email": ["email", "mail", "reply", "message", "text"],
    "reading": ["read", "reading", "chapter", "textbook", "pages", "notes"],
    "exam": ["exam", "test", "revise", "revision", "quiz", "midterm", "finals"],
    "cleaning": ["clean", "tidy", "laundry", "dishes", "room", "mess"],
    "admin": ["form", "bill", "pay", "apply", "application", "documents", "fees", "bank", "admin"],
}


def tokenize(text: str) -> list[str]:
    return [t for t in TOKEN.findall(text.lower()) if t not in STOP]


def detect_task_types(text: str) -> list[str]:
    words = set(tokenize(text))
    return [k for k, kws in TASK_TYPES.items() if words & set(kws)]


class StrategyIndex:
    def __init__(self, path: Path = DATA):
        self.docs = json.loads(path.read_text(encoding="utf-8"))
        self.tokens = [tokenize(" ".join([d["title"], d["summary"], d["keywords"], d.get("when", ""), " ".join(d["tags"])])) for d in self.docs]
        self.avgdl = sum(map(len, self.tokens)) / len(self.tokens)
        n = len(self.docs)
        df: dict[str, int] = {}
        for toks in self.tokens:
            for t in set(toks):
                df[t] = df.get(t, 0) + 1
        self.idf = {t: math.log(1 + (n - f + 0.5) / (f + 0.5)) for t, f in df.items()}
        self.semantic = SemanticIndex([f"{d['title']}. {d['summary']} {d.get('when', '')}" for d in self.docs])

    @property
    def mode(self) -> str:
        return "hybrid" if self.semantic.ready else "keyword"

    def _bm25(self, query: list[str], i: int, k1: float = 1.4, b: float = 0.75) -> float:
        toks = self.tokens[i]
        score = 0.0
        for q in query:
            tf = toks.count(q)
            if tf:
                score += self.idf.get(q, 0) * tf * (k1 + 1) / (tf + k1 * (1 - b + b * len(toks) / self.avgdl))
        return score

    def search(self, text: str, energy: int, k: int = 3, exclude: set[str] | None = None,
               feedback: dict[str, float] | None = None) -> list[dict]:
        return [d for d, _ in self.rank(text, energy, k, exclude, feedback)]

    def rank(self, text: str, energy: int, k: int = 3, exclude: set[str] | None = None,
             feedback: dict[str, float] | None = None) -> list[tuple[dict, dict]]:
        exclude = exclude or set()
        feedback = feedback or {}
        query = tokenize(text)
        qset = set(query)
        types = detect_task_types(text)
        bm25 = [self._bm25(query, i) for i in range(len(self.docs))]
        top = max(bm25) or 1.0
        sims = self.semantic.similarities(text)
        scored = []
        for i, d in enumerate(self.docs):
            if d["id"] in exclude:
                continue
            kw = bm25[i] / top
            s = 2.0 * kw
            sim = sims[i] if sims else None
            if sim is not None:
                s += 5.0 * sim
            matched_types = sorted(set(types) & set(d["tags"]))
            s += 1.5 * len(matched_types)
            lo, hi = d["energy"]
            fits = lo <= energy <= hi
            s += 1.0 if fits else -2.0
            if "any" in d["tags"]:
                s += 0.2
            personal = max(-1.0, min(1.0, float(feedback.get(d["id"], 0))))
            s += 1.5 * personal
            why = {
                "keywords": sorted(qset & set(self.tokens[i]))[:5],
                "meaning": round(sim, 3) if sim is not None else None,
                "task_types": matched_types,
                "energy_fit": fits,
                "personal": round(personal, 2),
                "score": round(s, 3),
            }
            scored.append((s, d, why))
        scored.sort(key=lambda x: x[0], reverse=True)
        return [(d, why) for _, d, why in scored[:k]]

    def get(self, sid: str) -> dict | None:
        return next((d for d in self.docs if d["id"] == sid), None)
