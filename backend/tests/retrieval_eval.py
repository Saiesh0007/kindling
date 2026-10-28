"""Retrieval evaluation: top-1 / top-3 accuracy of keyword-only vs hybrid search.

A small in-house set of 30 everyday phrasings, each labelled with the strategies a coach
would consider a good fit. It was written before tuning; the scoring was later adjusted after
looking at its failures, so treat the numbers as indicative, not as a benchmark.
Run from backend/: python -m tests.retrieval_eval
"""
from app.rag import StrategyIndex

TEST = [
    ("I've watched reels for an hour and my report is untouched", {"transition-ritual"}),
    ("I can't stop checking my phone", {"transition-ritual"}),
    ("I'm glued to netflix and my assignment is due", {"transition-ritual", "two-minute-start"}),
    ("my head is a mess of a hundred things", {"externalise"}),
    ("I have so many deadlines I don't know which one first", {"externalise"}),
    ("I'm completely drained today", {"low-spoon-mode", "shrink-the-step"}),
    ("burnt out, can barely think", {"low-spoon-mode", "shrink-the-step"}),
    ("the first paragraph has to be perfect", {"make-it-ugly", "first-line-only"}),
    ("I keep deleting what I write because it sounds dumb", {"make-it-ugly", "first-line-only"}),
    ("the page is empty and I'm just staring at it", {"first-line-only", "make-it-ugly"}),
    ("my code throws an error I don't understand", {"code-smallest-change"}),
    ("I need to build the login page for my web app", {"code-smallest-change", "task-landing-pad"}),
    ("forty pages of the textbook to get through", {"reading-chunk"}),
    ("I read the same sentence five times", {"reading-chunk"}),
    ("my viva is next week and I'm terrified", {"exam-revision-recall"}),
    ("I don't know how to study for the midterm", {"exam-revision-recall"}),
    ("dishes everywhere and the floor is covered in clothes", {"cleaning-one-zone"}),
    ("I need to sort out my visa paperwork", {"admin-gather"}),
    ("I have to pay my hostel fees online", {"admin-gather"}),
    ("I need to email my landlord about the rent", {"first-line-only", "admin-gather"}),
    ("it's so dull I'd rather do anything else", {"temptation-bundling"}),
    ("this chore is mind-numbingly boring", {"temptation-bundling", "cleaning-one-zone"}),
    ("I work better when a friend is around", {"body-doubling"}),
    ("I feel alone and can't focus at home", {"body-doubling"}),
    ("I have no idea what the topic even means", {"question-first"}),
    ("I'm confused about where the research should begin", {"question-first", "externalise"}),
    ("it's midnight and I can't do it now", {"future-self-note", "low-spoon-mode"}),
    ("even the tiny step feels like too much", {"shrink-the-step", "low-spoon-mode"}),
    ("I'm putting it off again", {"two-minute-start", "task-landing-pad"}),
    ("I have energy today and want to do a proper chunk", {"timer-pomodoro-lite"}),
]


def evaluate(index: StrategyIndex, energy: int = 3) -> tuple[float, float]:
    top1 = top3 = 0
    for text, good in TEST:
        ids = [d["id"] for d in index.search(text, energy, k=3)]
        top1 += ids[0] in good
        top3 += bool(set(ids) & good)
    return top1 / len(TEST), top3 / len(TEST)


if __name__ == "__main__":
    index = StrategyIndex()
    k1, k3 = evaluate(index)
    index.semantic.warm(background=False)
    h1, h3 = evaluate(index)
    print(f"keyword only : top-1 {k1:.0%}  top-3 {k3:.0%}")
    print(f"hybrid       : top-1 {h1:.0%}  top-3 {h3:.0%}  ({len(TEST)} held-out queries, energy 3)")
