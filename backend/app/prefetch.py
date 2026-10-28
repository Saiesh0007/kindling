"""Download the embedding model ahead of time so the demo works fully offline: python -m app.prefetch"""
from .rag import StrategyIndex

if __name__ == "__main__":
    index = StrategyIndex()
    index.semantic.warm(background=False)
    print("Semantic retrieval ready." if index.semantic.ready else f"Could not load the model ({index.semantic.error}). Keyword retrieval will be used.")
