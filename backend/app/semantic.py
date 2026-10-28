"""Semantic (meaning-based) retrieval with a small local embedding model.

Uses all-MiniLM-L6-v2 via fastembed (ONNX, CPU, no PyTorch). The model is downloaded once
into backend/.models and then works offline. If fastembed or the model is missing, Kindling
silently falls back to keyword (BM25) retrieval only.
"""
import os
import threading
from pathlib import Path

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
CACHE = Path(__file__).resolve().parents[1] / ".models"
ENABLED = os.environ.get("KINDLING_SEMANTIC", "1") != "0"


class SemanticIndex:
    def __init__(self, texts: list[str]):
        self.texts = texts
        self.model = None
        self.vectors = None
        self.ready = False
        self.error: str | None = None
        self._lock = threading.Lock()

    def warm(self, background: bool = True) -> None:
        """Load the model and embed the strategy texts (in a thread so startup stays instant)."""
        if not ENABLED:
            self.error = "disabled"
            return
        if background:
            threading.Thread(target=self._load, daemon=True).start()
        else:
            self._load()

    def _load(self) -> None:
        with self._lock:
            if self.ready:
                return
            try:
                import numpy as np
                from fastembed import TextEmbedding

                self.model = TextEmbedding(MODEL_NAME, cache_dir=str(CACHE))
                self.vectors = self._normalise(np.array(list(self.model.embed(self.texts))))
                self.ready = True
            except Exception as e:  # missing package, no network on first run, etc.
                self.error = type(e).__name__

    @staticmethod
    def _normalise(m):
        import numpy as np

        return m / np.linalg.norm(m, axis=-1, keepdims=True)

    def similarities(self, text: str) -> list[float] | None:
        """Cosine similarity of the query to every strategy, or None if the model isn't ready."""
        if not self.ready:
            return None
        import numpy as np

        q = self._normalise(np.array(next(iter(self.model.embed([text])))))
        return (self.vectors @ q).tolist()
