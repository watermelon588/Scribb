from contextlib import asynccontextmanager
from datetime import datetime, timezone
import json

from fastapi.testclient import TestClient
from scribb_ai import llm, main


@asynccontextmanager
async def connection():
    yield object()


def request(monkeypatch, invoke):
    monkeypatch.setattr(main.tickets, "verify", lambda *_: "test-user")
    monkeypatch.setattr(main.retrieval, "connect", lambda: _connection())
    monkeypatch.setattr(main.graph, "ainvoke", invoke)
    return TestClient(main.app).post("/ask", headers={"accept": "text/event-stream", "authorization": "Bearer test"},
                                     json={"question": "What did I write?", "today": datetime.now(timezone.utc).date().isoformat()})


async def _connection():
    return connection()


def events(response):
    return [(block.splitlines()[0], json.loads(block.split("data: ", 1)[1]))
            for block in response.text.strip().split("\n\n") if "data: " in block]


def test_answer_streams_provider_chunks_and_finishes_with_sources(monkeypatch):
    async def chunks(*_):
        yield "You wrote "
        yield "about drawing."

    async def invoke(_state, config):
        answer = await config["configurable"]["generate"]("system", "prompt")
        return {"answer": answer, "sources": [{"entryId": "entry-1", "date": "2026-11-01"}]}

    monkeypatch.setattr(llm, "stream_generate", chunks)
    reply = request(monkeypatch, invoke)
    assert reply.status_code == 200
    assert reply.headers["cache-control"] == "no-store"
    result = events(reply)
    assert [e[0] for e in result] == ["event: delta", "event: delta", "event: done"]
    assert "".join(e[1]["text"] for e in result[:-1]) == "You wrote about drawing."
    assert result[-1][1]["sources"][0]["entryId"] == "entry-1"


def test_fixed_replies_also_have_a_complete_stream(monkeypatch):
    async def invoke(*_, **__):
        return {"answer": "I couldn't find anything about that in your journal.", "sources": []}

    result = events(request(monkeypatch, invoke))
    assert [e[0] for e in result] == ["event: delta", "event: done"]
    assert result[-1][1] == {"sources": []}


def test_stream_failures_are_explicit_and_do_not_leak_private_text(monkeypatch):
    async def invoke(*_, **__):
        raise RuntimeError("private journal passage")

    reply = request(monkeypatch, invoke)
    assert events(reply)[0][0] == "event: error"
    assert "private journal passage" not in reply.text


def test_stream_still_requires_a_ticket():
    reply = TestClient(main.app).post("/ask", headers={"accept": "text/event-stream"},
                                      json={"question": "hi", "today": datetime.now(timezone.utc).date().isoformat()})
    assert reply.status_code == 401
