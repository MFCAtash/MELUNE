"""
INITIAL SKELETON — see services/ai/README.md.

Only covers what actually needs no live upstream: /health. /recommend
is not tested here because testing it honestly would mean either a real
NestJS API running (an integration test, not a unit test) or mocking
httpx — left for whoever picks this skeleton up next, alongside real
model code. Run with: `pytest` from services/ai/ (after `pip install
pytest` — not yet in requirements.txt since nothing here needs it to
run the app itself).
"""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_returns_ok():
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "mode": "skeleton"}


def test_recommend_without_authorization_header_is_rejected():
    response = client.get("/recommend")

    assert response.status_code == 401
