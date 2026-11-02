import asyncio
from datetime import date

from scribb_ai.graph import NOTHING_FOUND, OFF_TOPIC, Plan, graph
from scribb_ai.retrieval import Passage, TooBroad, search_words

TODAY = date(2027, 2, 3)


def run(plan: Plan, found=None, broad: int | None = None):
    calls = {"answer": 0, "search": []}

    async def generate(system, prompt, schema=None, max_tokens=600):
        if schema:
            return plan
        calls["answer"] += 1
        assert "Journal passages" in prompt
        return "On 12 January you painted the river."

    async def search(user_id, f):
        calls["search"].append((user_id, f))
        if broad:
            raise TooBroad(broad)
        return found or []

    state = {"user_id": "u-1", "question": "What did I write?", "today": TODAY, "history": []}
    result = asyncio.run(graph.ainvoke(state, config={"configurable": {"generate": generate, "search": search}}))
    return result, calls


def test_a_date_question_answers_from_the_entries_it_found():
    plan = Plan(about_journal=True, date_from=date(2027, 1, 12), date_to=date(2027, 1, 12))
    result, calls = run(plan, found=[Passage("e-1", date(2027, 1, 12), "Painted the river at dawn.")])
    assert result["answer"].startswith("On 12 January")
    assert result["sources"] == [{"entryId": "e-1", "date": "2027-01-12"}]
    assert calls["search"][0][0] == "u-1" and calls["search"][0][1].date_from == date(2027, 1, 12)


def test_nothing_found_never_reaches_the_model():
    result, calls = run(Plan(about_journal=True, words=["motivation"]))
    assert result["answer"] == NOTHING_FOUND and calls["answer"] == 0 and result["sources"] == []


def test_an_oversized_request_is_refused_without_reading_text():
    result, calls = run(Plan(about_journal=True, date_from=date(2024, 1, 1), date_to=date(2024, 12, 31)), broad=212)
    assert "212 entries" in result["answer"] and calls["answer"] == 0


def test_questions_about_anything_else_are_declined_without_searching():
    result, calls = run(Plan(about_journal=False))
    assert result["answer"] == OFF_TOPIC and calls["search"] == [] and calls["answer"] == 0


def test_search_words_keep_only_plain_words():
    assert search_words(["Stuck!", "burn-out", "it's", "'); drop table x; --", ""]) == "stuck OR burnout OR it's OR droptablex"
