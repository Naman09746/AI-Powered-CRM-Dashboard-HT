import json
from types import SimpleNamespace
from app.services.outreach_service import (
    _clean,
    _extract_json,
    _valid_email,
    _infer_company_size,
    _match_service,
    _score_prospect,
    _validation,
    _local_process,
    process_prospect,
)


def test_clean():
    assert _clean("  hello world  ") == "hello world"
    assert _clean(None) == ""
    assert _clean("") == ""


def test_valid_email():
    assert _valid_email("admin@domain.com") is True
    assert _valid_email("contact.us@sub.co.in") is True
    assert _valid_email("invalid-email") is False
    assert _valid_email("") is False
    assert _valid_email(None) is False


def test_infer_company_size():
    assert _infer_company_size(None) == "Unknown"
    assert _infer_company_size(10) == "Small Business"
    assert _infer_company_size(50) == "Mid-Market"
    assert _infer_company_size(500) == "Enterprise"


def test_extract_json_strategies():
    # Direct JSON
    assert _extract_json('{"status": "ok"}') == {"status": "ok"}

    # Markdown fenced JSON block
    raw_md = """Here is the result:
```json
{
  "key": "value",
  "number": 42
}
```
"""
    assert _extract_json(raw_md) == {"key": "value", "number": 42}

    # Outer curly braces surrounded by extra text
    raw_embedded = 'Leading message {"test": 123, "active": true} Trailing text'
    assert _extract_json(raw_embedded) == {"test": 123, "active": True}

    # Invalid JSON
    assert _extract_json("not a json string") is None
    assert _extract_json("") is None


def test_match_service_keywords():
    p1 = SimpleNamespace(
        company_name="Apex Healthcare Hospital",
        category="Hospital",
        industry="Healthcare",
        notes="Needs patient record tracking and CRM automation",
        website="https://apexhealth.com",
    )
    best, upsell, pain = _match_service(p1)
    assert "CRM" in best or "Hospital" in pain or "Healthcare" in pain or "digital" in pain

    p2 = SimpleNamespace(
        company_name="Delhi Fashion Store",
        category="Shop",
        industry="Retail",
        notes="Wants an online shop with payment gateway",
        website=None,
    )
    best2, upsell2, pain2 = _match_service(p2)
    assert best2 in ["E-commerce Development", "Website Design & Development"]


def test_score_prospect_rules():
    p = SimpleNamespace(
        company_name="Test Enterprise",
        category="IT Services",
        industry="Technology",
        email="info@testenterprise.com",
        phone="+91 9811111111",
        website="https://testenterprise.com",
        location="Gurugram, Haryana",
        country="India",
        notes="High growth IT consulting firm with 150 employees",
        employee_count=150,
    )
    score, temp, explanation = _score_prospect(p, "Custom CRM / ERP Development")
    assert temp in ["HOT", "WARM"]
    assert score >= 50
    assert len(explanation) > 0


def test_validation_rules():
    valid_p = SimpleNamespace(
        company_name="Delhi Hospital",
        category="Hospital",
        industry="Healthcare",
        location="Delhi",
        country="India",
        website="https://delhihosp.com",
        email="contact@delhihosp.com",
        phone="9876543210",
        notes="Hospital operations and CRM workflow",
    )
    status, reason, is_real, has_it, has_chan, in_area = _validation(valid_p)
    assert status in ["Valid", "Partial"]
    assert is_real is True
    assert has_chan is True
    assert in_area is True


def test_local_process_fallback():
    p = SimpleNamespace(
        company_name="Delhi Public Academy",
        contact_name="Principal Sharma",
        category="Education",
        industry="School",
        location="Noida, UP",
        country="India",
        website="https://dpa.edu.in",
        email="principal@dpa.edu.in",
        phone="+91 9876543210",
        employee_count=85,
        notes="Looking for modernized student portal",
    )
    result = _local_process(p)
    assert result["validation"]["record_quality"] in ["good", "partial", "Valid", "Partial"]
    assert result["enrichment"]["lead_score"] in ["HOT", "WARM", "COLD"]
    assert "email_body" in result["email"]
    assert len(result["follow_ups"]) >= 2


def test_process_prospect_without_gemini_key():
    # When no API key is provided, gracefully uses deterministic local fallback
    p = SimpleNamespace(
        company_name="North Ex Clinic",
        contact_name="Dr. Gupta",
        category="Clinic",
        industry="Healthcare",
        location="Delhi",
        country="India",
        website="",
        email="drgupta@northex.com",
        phone="9812345678",
        employee_count=15,
        notes="Local clinic with high patient volume",
    )
    output = process_prospect(p)
    assert "validation" in output
    assert "enrichment" in output
    assert "email" in output
    assert "strategy" in output
    assert "follow_ups" in output
