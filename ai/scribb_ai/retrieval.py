"""search_journal: the only way Scribb AI reads journals. Typed chat and live calls both use it.

Every query runs as the restricted scribb_ai role with app.user_id set inside the transaction, so
Postgres row-level security (db/migrations/002_journals.sql) returns only that user's entries."""
import os
import re
from dataclasses import dataclass, field
from datetime import date

import psycopg

MAX_SUMMARY_ENTRIES = 31  # entries one date question may read in full
MAX_CONTEXT_WORDS = 8000  # words of journal text one answer may send to Gemini
MAX_PASSAGES = 8          # passages one word search returns


@dataclass
class Filter:
    date_from: date | None = None
    date_to: date | None = None
    words: list[str] = field(default_factory=list)


@dataclass
class Passage:
    entry_id: str
    entry_date: date
    text: str


class TooBroad(Exception):
    def __init__(self, entries: int):
        super().__init__(f"{entries} entries")
        self.entries = entries


def search_words(words: list[str]) -> str:
    """Keywords for websearch_to_tsquery, joined with OR. Only letters, digits and apostrophes survive."""
    clean = [w for w in (re.sub(r"[^\w']", "", word.lower()).strip("'") for word in words) if w][:20]
    return " OR ".join(clean)


async def connect() -> psycopg.AsyncConnection:
    # prepare_threshold=None: no server-side prepared statements, which a transaction pooler may not keep.
    return await psycopg.AsyncConnection.connect(os.environ["AI_DATABASE_URL"], prepare_threshold=None)


async def search_journal(conn: psycopg.AsyncConnection, user_id: str, f: Filter) -> list[Passage]:
    words = search_words(f.words)
    async with conn.transaction():
        await conn.execute("select set_config('app.user_id', %s, true)", [user_id])
        dates = "entry_date between coalesce(%(from)s::date, '-infinity') and coalesce(%(to)s::date, 'infinity')"
        params = {"from": f.date_from, "to": f.date_to, "q": words}
        if words:
            # Postgres picks the most relevant fragments, so only small excerpts reach the model.
            rows = await (await conn.execute(f"""
                select id::text, entry_date,
                       ts_headline('english', plain_text, websearch_to_tsquery('english', %(q)s),
                                   'MaxFragments=3, MinWords=15, MaxWords=60, FragmentDelimiter=" … ", StartSel="", StopSel=""')
                from journal_entries
                where {dates} and search @@ websearch_to_tsquery('english', %(q)s)
                order by ts_rank(search, websearch_to_tsquery('english', %(q)s)) desc, entry_date desc
                limit {MAX_PASSAGES}""", params)).fetchall()
        else:
            # Count before reading any text, so an oversized request is refused cheaply and never sampled.
            count, total = await (await conn.execute(
                f"select count(*), coalesce(sum(word_count), 0) from journal_entries where {dates}", params)).fetchone()
            if count > MAX_SUMMARY_ENTRIES or total > MAX_CONTEXT_WORDS:
                raise TooBroad(count)
            rows = await (await conn.execute(
                f"select id::text, entry_date, plain_text from journal_entries where {dates} order by entry_date, id", params)).fetchall()
    return [Passage(entry_id=r[0], entry_date=r[1], text=r[2]) for r in rows]
