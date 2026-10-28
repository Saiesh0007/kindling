"""Retrieval over the coping-strategy knowledge base.

Uses BM25 (pure Python, no downloads) so the demo runs fully offline. Results are
re-ranked by how well each strategy fits the user's current energy level.
"""
import json
import math
import re
from pathlib import Path

DATA = Path(__file__).parent / "data" / "strategies.json"
TOKEN = re.compile(r"[a-z']+")
STOP = {"the", "a", "an", "to", "of", "and", "or", "i", "my", "me", "is", "it", "in", "on", "for", "this", "that", "with", "have", "need", "do", "be", "so", "but", "at", "am"}

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
        self.tokens = [tokenize(" ".join([d["title"], d["summary"], d["keywords"], " ".join(d["tags"])])) for d in self.docs]
        self.avgdl = sum(map(len, self.tokens)) / len(self.tokens)
        n = len(self.docs)
        df: dict[str, int] = {}
        for toks in self.tokens:
            for t in set(toks):
                df[t] = df.get(t, 0) + 1
        self.idf = {t: math.log(1 + (n - f + 0.5) / (f + 0.5)) for t, f in df.items()}

    def _bm25(self, query: list[str], i: int, k1: float = 1.4, b: float = 0.75) -> float:
        toks = self.tokens[i]
        score = 0.0
        for q in query:
            tf = toks.count(q)
            if tf:
                score += self.idf.get(q, 0) * tf * (k1 + 1) / (tf + k1 * (1 - b + b * len(toks) / self.avgdl))
        return score

    def search(self, text: str, energy: int, k: int = 3, exclude: set[str] | None = None) -> list[dict]:
        exclude = exclude or set()
        query = tokenize(text)
        types = detect_task_types(text)
        scored = []
        for i, d in enumerate(self.docs):
            if d["id"] in exclude:
                continue
            s = self._bm25(query, i)
            s += 1.5 * len(set(types) & set(d["tags"]))
            lo, hi = d["energy"]
            s += 1.0 if lo <= energy <= hi else -2.0
            if "any" in d["tags"]:
                s += 0.2
            scored.append((s, d))
        scored.sort(key=lambda x: x[0], reverse=True)
        return [d for _, d in scored[:k]]

    def get(self, sid: str) -> dict | None:
        return next((d for d in self.docs if d["id"] == sid), None)
