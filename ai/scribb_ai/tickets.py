"""One-time, 60-second tickets signed by Express (server/ai.ts). The user id comes only from here."""
import os
import time
import uuid

import jwt


class TicketError(Exception):
    pass


# ponytail: used ticket ids live in memory. Fine for one Render instance; a restart forgets them,
# but every ticket expires within 60 seconds anyway. Move to Postgres if this ever runs on several instances.
_used: dict[str, float] = {}


def verify(token: str, mode: str) -> str:
    """Returns the ticket's user id, or raises TicketError."""
    secret = os.environ.get("AI_TICKET_SECRET", "")
    if len(secret) < 32:
        raise TicketError("Scribb AI is not configured.")
    try:
        claims = jwt.decode(token, secret, algorithms=["HS256"], audience="scribb-ai",
                            options={"require": ["exp", "sub", "jti", "aud"]})
        user_id = str(uuid.UUID(claims["sub"]))
    except (jwt.PyJWTError, ValueError):
        raise TicketError("This ticket is invalid or has expired.") from None
    if claims.get("mode") != mode:
        raise TicketError("This ticket is for a different feature.")
    now = time.time()
    for jti, expires in list(_used.items()):
        if expires < now:
            del _used[jti]
    if claims["jti"] in _used:
        raise TicketError("This ticket was already used.")
    _used[claims["jti"]] = claims["exp"]
    return user_id
