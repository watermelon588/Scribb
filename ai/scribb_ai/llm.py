"""Gemini on the free tier, with Koe's fallback: a busy or rate-limited model rests and the next one is tried.
Every attempt is single and short (SDK retries off). All model calls live here, so changing provider touches one file."""
import os
import time

from google import genai
from google.genai import errors, types
from pydantic import BaseModel

TIMEOUT_MS = 15_000
REST_SECONDS = 300
RETRYABLE = {429, 500, 503, 504}


class AIUnavailable(Exception):
    pass


_client: genai.Client | None = None
_resting: dict[str, float] = {}  # model -> monotonic time it may be tried again


def client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=os.environ["GEMINI_API_KEY"], http_options=types.HttpOptions(
            timeout=TIMEOUT_MS, retry_options=types.HttpRetryOptions(attempts=1)))
    return _client


def models() -> list[str]:
    names = [os.environ.get("GEMINI_TEXT_MODEL", "gemini-3.5-flash-lite"),
             *os.environ.get("GEMINI_FALLBACK_MODELS", "").split(",")]
    names = list(dict.fromkeys(n.strip() for n in names if n.strip()))
    now = time.monotonic()
    return [n for n in names if _resting.get(n, 0) <= now] + [n for n in names if _resting.get(n, 0) > now]


async def generate(system: str, prompt: str, schema: type[BaseModel] | None = None, max_tokens: int = 600):
    """Text, or a validated `schema` instance when one is given."""
    config = types.GenerateContentConfig(system_instruction=system, max_output_tokens=max_tokens,
                                         response_mime_type="application/json" if schema else None,
                                         response_schema=schema)
    for model in models():
        try:
            response = await client().aio.models.generate_content(model=model, contents=prompt, config=config)
        except errors.APIError as exc:
            if exc.code not in RETRYABLE:
                raise
            _resting[model] = time.monotonic() + REST_SECONDS
            continue
        if schema:
            return schema.model_validate_json(response.text or "{}")
        return (response.text or "").strip()
    raise AIUnavailable("Every Gemini model is busy or out of free quota.")
