import time
import uuid

import jwt
import pytest

from scribb_ai import tickets

USER = str(uuid.uuid4())


def make(**overrides):
    claims = {"sub": USER, "aud": "scribb-ai", "mode": "ask", "jti": str(uuid.uuid4()), "exp": int(time.time()) + 60}
    claims.update(overrides)
    return jwt.encode({k: v for k, v in claims.items() if v is not None}, overrides.pop("secret", None) or "test-ticket-secret-that-is-long-enough", algorithm="HS256")


def test_a_valid_ticket_names_the_user_and_works_once():
    token = make()
    assert tickets.verify(token, "ask") == USER
    with pytest.raises(tickets.TicketError, match="already used"):
        tickets.verify(token, "ask")


@pytest.mark.parametrize("token", [
    make(exp=int(time.time()) - 1),          # expired
    make(aud="someone-else"),                # not for Scribb AI
    make(sub="not-a-uuid"),                  # not a user id
    make(jti=None),                          # cannot be made single-use
    jwt.encode({"sub": USER, "aud": "scribb-ai", "mode": "ask", "jti": "x", "exp": int(time.time()) + 60},
               "a-different-secret-that-is-long-enough", algorithm="HS256"),  # not signed by Express
    "not a ticket",
])
def test_bad_tickets_are_refused(token):
    with pytest.raises(tickets.TicketError):
        tickets.verify(token, "ask")


def test_a_ticket_only_opens_its_own_mode():
    with pytest.raises(tickets.TicketError, match="different feature"):
        tickets.verify(make(mode="listen"), "ask")
