"""Scribb AI, a Vercel service at /ai (also runs standalone). Woken only when someone opens "Ask my journal"; Scribb never pings it on load.

GET  /health  public, no database: the frontend polls it while the service wakes
POST /ask     ticket (mode "ask") in Authorization: Bearer; body {question, today, history}
Listen (/speak) and live calls (/call) follow, ported from Koe.
Logs never include questions, answers or journal text."""
import asyncio
import json
import logging
import os
from datetime import date, datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, FastAPI, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from scribb_ai import llm, retrieval, tickets
from scribb_ai.graph import graph

log = logging.getLogger("scribb_ai")
ANSWER_SECONDS = 30

app = FastAPI(title="Scribb AI", docs_url=None, redoc_url=None, openapi_url=None)
app.add_middleware(CORSMiddleware, allow_methods=["GET", "POST"], allow_headers=["authorization", "content-type"],
                   allow_origins=[o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173").split(",") if o.strip()])

# Routes answer at the root (local, tests) and under /ai, the public path on Vercel,
# where a service receives the original request path including its prefix.
router = APIRouter()


def error(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse({"error": {"code": code, "message": message}}, status_code=status)


@app.exception_handler(tickets.TicketError)
async def bad_ticket(_request: Request, exc: tickets.TicketError):
    return error(401, "bad_ticket", str(exc))


class Turn(BaseModel):
    role: Literal["user", "assistant"]
    text: str = Field(max_length=2000)


class Ask(BaseModel):
    question: str = Field(min_length=1, max_length=500)
    today: date  # the user's local date, so "yesterday" means their yesterday
    history: list[Turn] = Field(default_factory=list, max_length=6)


def ticket_from(authorization: str | None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise tickets.TicketError("Missing ticket.")
    return authorization.removeprefix("Bearer ")


@router.get("/health")
async def health():
    return {"ok": True}


@router.post("/ask")
async def ask(body: Ask, request: Request, authorization: str | None = Header(None)):
    user_id = tickets.verify(ticket_from(authorization), "ask")
    utc_today = datetime.now(timezone.utc).date()
    if abs(body.today - utc_today) > timedelta(days=1):
        return error(400, "bad_date", "Your device date looks wrong.")
    if "text/event-stream" in request.headers.get("accept", ""):
        return StreamingResponse(answer_events(body, user_id), media_type="text/event-stream",
                                 headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"})
    started = asyncio.get_running_loop().time()
    try:
        async with asyncio.timeout(ANSWER_SECONDS):
            async with await retrieval.connect() as conn:
                result = await graph.ainvoke(
                    {"user_id": user_id, "question": body.question.strip(), "today": body.today,
                     "history": [t.model_dump() for t in body.history]},
                    config={"configurable": {"generate": llm.generate,
                                             "search": lambda uid, f: retrieval.search_journal(conn, uid, f)}})
    except llm.AIUnavailable:
        return error(503, "ai_resting", "Scribb AI is resting right now. Please try again in a few minutes.")
    except TimeoutError:
        return error(504, "ai_timeout", "That took too long. Please try again.")
    log.info("ask ok: %d sources in %.1fs", len(result["sources"]), asyncio.get_running_loop().time() - started)
    return {"answer": result["answer"], "sources": result["sources"]}


async def answer_events(body: Ask, user_id: str):
    """Keep the existing retrieval/identity boundary and stream only the final answer."""
    queue: asyncio.Queue = asyncio.Queue(maxsize=64)
    sent = False

    async def generate(system, prompt, schema=None, max_tokens=600):
        nonlocal sent
        if schema:
            return await llm.generate(system, prompt, schema, max_tokens)
        parts = []
        async for chunk in llm.stream_generate(system, prompt, max_tokens):
            parts.append(chunk)
            sent = True
            await queue.put(("delta", {"text": chunk}))
        return "".join(parts)

    async def run():
        try:
            async with asyncio.timeout(ANSWER_SECONDS):
                async with await retrieval.connect() as conn:
                    result = await graph.ainvoke(
                        {"user_id": user_id, "question": body.question.strip(), "today": body.today,
                         "history": [t.model_dump() for t in body.history]},
                        config={"configurable": {"generate": generate,
                                                 "search": lambda uid, f: retrieval.search_journal(conn, uid, f)}})
                if not sent:
                    await queue.put(("delta", {"text": result["answer"]}))
                await queue.put(("done", {"sources": result["sources"]}))
        except llm.AIUnavailable:
            await queue.put(("error", {"message": "Scribb AI is resting right now. Please try again in a few minutes."}))
        except TimeoutError:
            await queue.put(("error", {"message": "That took too long. Please try again."}))
        except Exception:
            # Do not log exceptions that may contain journal text or prompts.
            await queue.put(("error", {"message": "The answer could not be completed. Please try again."}))

    task = asyncio.create_task(run())
    try:
        while True:
            try:
                event, data = await asyncio.wait_for(queue.get(), timeout=10)
            except TimeoutError:
                yield ": waiting\n\n"
                continue
            yield f"event: {event}\ndata: {json.dumps(data)}\n\n"
            if event in ("done", "error"):
                break
    finally:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


app.include_router(router)
app.include_router(router, prefix="/ai")
