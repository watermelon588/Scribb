from fastapi.testclient import TestClient

from scribb_ai.main import app

client = TestClient(app)


def test_health_needs_nothing():
    assert client.get("/health").json() == {"ok": True}
    # Vercel routes /ai/* to this service without stripping the prefix.
    assert client.get("/ai/health").json() == {"ok": True}


def test_ask_without_a_ticket_is_refused():
    reply = client.post("/ask", json={"question": "hi", "today": "2027-01-12"})
    assert reply.status_code == 401
    assert reply.json()["error"]["code"] == "bad_ticket"


def test_only_scribb_origins_get_cors_headers():
    ok = client.options("/ask", headers={"origin": "http://localhost:5173", "access-control-request-method": "POST"})
    assert ok.headers.get("access-control-allow-origin") == "http://localhost:5173"
    other = client.options("/ask", headers={"origin": "https://evil.example", "access-control-request-method": "POST"})
    assert "access-control-allow-origin" not in other.headers
