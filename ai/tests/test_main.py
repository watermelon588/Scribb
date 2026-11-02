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


def test_production_aliases_are_explicit_and_normalized(monkeypatch):
    from scribb_ai.main import allowed_origins
    monkeypatch.setenv('ALLOWED_ORIGINS', 'https://scribb.xyz/, http://localhost:5173')
    assert allowed_origins() == ['http://localhost:5173', 'https://scribb.xyz', 'https://www.scribb.xyz']
    monkeypatch.setenv('ALLOWED_ORIGINS', 'https://private.example')
    assert allowed_origins() == ['https://private.example']


def test_www_health_and_authorized_post_preflight(monkeypatch):
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware
    from scribb_ai.main import allowed_origins, router
    monkeypatch.setenv('ALLOWED_ORIGINS', 'https://scribb.xyz')
    target = FastAPI()
    target.add_middleware(CORSMiddleware, allow_origins=allowed_origins(), allow_methods=['GET', 'POST'], allow_headers=['authorization', 'content-type'])
    target.include_router(router)
    browser = TestClient(target)
    for origin in ['https://scribb.xyz', 'https://www.scribb.xyz']:
        response = browser.get('/health', headers={'origin': origin})
        assert response.headers['access-control-allow-origin'] == origin
        response = browser.options('/ask', headers={'origin': origin, 'access-control-request-method': 'POST', 'access-control-request-headers': 'authorization,content-type'})
        assert response.status_code == 200
        assert response.headers['access-control-allow-origin'] == origin
    response = browser.options('/ask', headers={'origin': 'https://scribb.xyz.attacker.example', 'access-control-request-method': 'POST'})
    assert response.status_code == 400


def test_database_failure_returns_safe_json(monkeypatch):
    from datetime import datetime, timezone
    from scribb_ai import main
    monkeypatch.setattr(main.tickets, 'verify', lambda *_: 'test-user')
    async def unavailable():
        raise RuntimeError('secret connection details must never escape')
    monkeypatch.setattr(main.retrieval, 'connect', unavailable)
    response = client.post('/ask', headers={'authorization': 'Bearer test'}, json={'question': 'Hello', 'today': datetime.now(timezone.utc).date().isoformat()})
    assert response.status_code == 503
    assert response.json()['error']['code'] == 'ai_unavailable'
    assert 'secret' not in response.text
