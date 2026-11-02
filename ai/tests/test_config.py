from scribb_ai.check_config import problems


def ready():
    return {"AI_TICKET_SECRET": "test-ticket-value-with-at-least-32-characters", "AI_DATABASE_URL": "postgresql://scribb_ai:test@database.example/app?sslmode=require", "GEMINI_API_KEY": "test-key", "ALLOWED_ORIGINS": "https://scribb.example"}


def test_valid_hosting_config_does_not_contact_providers():
    assert problems(ready()) == []


def test_database_owner_is_refused():
    errors = problems({**ready(), "AI_DATABASE_URL": "postgresql://owner:private-value@database.example/app?sslmode=require"})
    assert "restricted scribb_ai role" in errors[0]
    assert "private-value" not in "".join(errors)


def test_tls_and_exact_cors_origins_are_required():
    errors = problems({**ready(), "AI_DATABASE_URL": "postgresql://scribb_ai:test@database.example/app", "ALLOWED_ORIGINS": "https://*.example"})
    assert len(errors) == 2
