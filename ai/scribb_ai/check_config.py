"""Fail deployment on missing configuration, without printing secrets or querying the database."""
import os
from urllib.parse import unquote, urlsplit, parse_qs


def problems(env):
    result = []
    for key in ("AI_TICKET_SECRET", "AI_DATABASE_URL", "GEMINI_API_KEY"):
        if not env.get(key, "").strip():
            result.append(f"{key} must be configured.")
    if len(env.get("AI_TICKET_SECRET", "")) < 32:
        result.append("AI_TICKET_SECRET must contain at least 32 random characters and match Vercel.")
    try:
        url = urlsplit(env.get("AI_DATABASE_URL", ""))
        if url.scheme not in ("postgres", "postgresql") or unquote(url.username or "") != "scribb_ai" or not url.hostname or not url.password:
            raise ValueError()
        if parse_qs(url.query).get("sslmode", [""])[0] not in ("require", "verify-ca", "verify-full"):
            result.append("AI_DATABASE_URL must require TLS with sslmode=require or stricter.")
    except ValueError:
        result.append("AI_DATABASE_URL must use the restricted scribb_ai role, not your database owner.")
    return result


if __name__ == "__main__":
    errors = [] if os.environ.get("AI_ENABLED") == "false" else problems(os.environ)
    if errors:
        raise SystemExit("AI deployment configuration needs attention:\n" + "\n".join(f"- {error}" for error in errors))
    print("AI configuration checks passed. No production services were contacted.")
