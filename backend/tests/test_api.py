from fastapi.testclient import TestClient

from app.main import app
from app.guardrails import soften

client = TestClient(app)


def post(**kw):
    body = {"task": "I need to write my history essay on the french revolution", "energy": 3, "use_llm": False, **kw}
    r = client.post("/api/sequence", json=body)
    assert r.status_code == 200, r.text
    return r.json()


def test_health():
    assert client.get("/api/health").json()["status"] == "ok"


def test_steps_scale_with_energy():
    assert len(post(energy=1)["steps"]) == 1
    assert len(post(energy=2)["steps"]) == 2
    assert len(post(energy=5)["steps"]) == 3


def test_essay_gets_writing_strategy():
    data = post()
    assert data["kind"] == "steps"
    assert data["strategy"]["id"] in {"make-it-ugly", "first-line-only", "two-minute-start", "question-first", "task-landing-pad"}
    assert "essay" in " ".join(data["steps"]).lower() or "revolution" in " ".join(data["steps"]).lower()


def test_change_excludes_previous_strategy():
    first = post()
    other = post(mode="change", exclude=[first["strategy"]["id"]], current_step=first["steps"][0])
    assert other["strategy"]["id"] != first["strategy"]["id"]


def test_smaller_returns_one_step_same_strategy():
    first = post()
    small = post(mode="smaller", exclude=[first["strategy"]["id"]], current_step=first["steps"][0])
    assert len(small["steps"]) == 1
    assert small["strategy"]["id"] == first["strategy"]["id"]


def test_overwhelm_lowers_step_count():
    data = post(task="I'm so overwhelmed, I have a coding assignment and can't start", energy=5)
    assert data["overwhelmed"] is True
    assert len(data["steps"]) <= 2


def test_crisis_routes_to_support():
    data = post(task="i want to die, nothing matters")
    assert data["kind"] == "support"
    assert "14416" in data["message"]


def test_soften_removes_pressure_words():
    out = soften("You should just finish it, don't be lazy")
    assert "should" not in out and "just" not in out and "lazy" not in out


def test_feedback_boosts_a_strategy_that_helped():
    base = post()["strategy"]["id"]
    target = "question-first" if base != "question-first" else "make-it-ugly"
    boosted = post(feedback={target: 1.0, base: -1.0})
    assert boosted["strategy"]["id"] == target
    assert boosted["strategy"]["why"]["personal"] == 1.0


def test_semantic_retrieval_matches_meaning():
    from app.main import index
    index.semantic.warm(background=False)
    if not index.semantic.ready:
        import pytest
        pytest.skip("embedding model not downloaded")
    data = post(task="I keep doomscrolling on my phone instead of studying")
    assert data["retrieval"] == "hybrid"
    assert data["strategy"]["id"] == "transition-ritual"
    assert data["strategy"]["why"]["meaning"] > 0.3
