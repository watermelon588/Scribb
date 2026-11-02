"""Scribb AI on Render. Woken only when someone opens "Ask my journal"; Scribb never pings it on load.

GET  /health  public, no database: the frontend polls it while Render wakes
POST /ask     ticket (mode "ask") in Authorization: Bearer; body {question, today, history}
Listen (/speak) and live calls (/call) follow, ported from Koe.
Logs never include questions, answers or journal text."""
import asyncio
import logging
import os
from datetime import date, datetime, timedelta, timezone
from typing import Literal

from fastapi import FastAPI, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from scribb_ai import llm, retrieval, tickets
from scribb_ai.graph import graph

log = logging.getLogger("scribb_ai")
ANSWER_SECONDS = 30

app = FastAPI(title="Scribb AI", docs_url=None, redoc_url=None, openapi_url=None)
app.add_middleware(CORSMiddleware, allow_methods=["GET", "POST"], allow_headers=["authorization", "content-type"],
                   allow_origins=[o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173").split(",") if o.strip()])


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


@app.get("/health")
async def health():
    return {"ok": True}


@app.post("/ask")
async def ask(body: Ask, authorization: str | None = Header(None)):
    user_id = tickets.verify(ticket_from(authorization), "ask")
    utc_today = datetime.now(timezone.utc).date()
    if abs(body.today - utc_today) > timedelta(days=1):
        return error(400, "bad_date", "Your device date looks wrong.")
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
    # ponytail: the answer arrives whole; stream it token by token when answers get long enough to wait for.
    return {"answer": result["answer"], "sources": result["sources"]}
