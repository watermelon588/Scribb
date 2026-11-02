from fastapi.testclient import TestClient

from scribb_ai.main import app

client = TestClient(app)


def test_health_needs_nothing():
    assert client.get("/health").json() == {"ok": True}


def test_ask_without_a_ticket_is_refused():
    reply = client.post("/ask", json={"question": "hi", "today": "2027-01-12"})
    assert reply.status_code == 401
    assert reply.json()["error"]["code"] == "bad_ticket"


def test_private_service_does_not_offer_browser_cors_access():
    ok = client.options("/ask", headers={"origin": "http://localhost:5173", "access-control-request-method": "POST"})
    assert "access-control-allow-origin" not in ok.headers
    other = client.options("/ask", headers={"origin": "https://evil.example", "access-control-request-method": "POST"})
    assert "access-control-allow-origin" not in other.headers
