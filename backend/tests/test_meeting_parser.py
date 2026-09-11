from app.routers.advanced_ai import _parse_meeting_response


def test_parse_meeting_response_structured():
    raw = """Summary:
Discussed the migration of legacy database and API security hardening.

Decisions:
1. Use Alembic for all schema migrations.
2. Remove wildcard CORS regex.

Action Items:
- Write comprehensive backend tests.
- Hardening Gemini prompt serialization.

Risks:
Potential downtime if cold start isn't optimized."""

    parsed = _parse_meeting_response(raw)
    assert "migration of legacy database" in parsed["summary"]
    assert "Alembic" in parsed["decisions"]
    assert "Write comprehensive backend tests" in parsed["action_items"]
    assert "Potential downtime" in parsed["risks"]


def test_parse_meeting_response_fallback():
    raw = """First paragraph overview of discussions.

Second paragraph regarding the key agreements reached.

Third paragraph listing follow up tasks for the dev team."""

    parsed = _parse_meeting_response(raw)
    assert "First paragraph" in parsed["summary"]
    assert "Second paragraph" in parsed["decisions"]
    assert "Third paragraph" in parsed["action_items"]
