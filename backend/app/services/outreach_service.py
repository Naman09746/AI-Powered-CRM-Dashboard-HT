import json
import os
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

try:
    import google.generativeai as genai
except ImportError:
    genai = None  # Gemini features disabled; local fallback will be used


SERVICE_KEYWORDS = [
    (
        "Custom CRM / ERP Development",
        ["crm", "erp", "operations", "workflow", "inventory", "sales", "dashboard", "automation"],
        "fragmented sales and operations tracking",
    ),
    (
        "Website Design & Development",
        ["website", "web", "landing", "online presence", "portfolio", "booking"],
        "an outdated or underperforming web presence",
    ),
    (
        "E-commerce Development",
        ["retail", "shop", "store", "ecommerce", "e-commerce", "catalog", "orders"],
        "online catalogue, ordering, and payment conversion gaps",
    ),
    (
        "Digital Marketing & SEO",
        ["marketing", "seo", "ads", "traffic", "lead generation", "brand", "social"],
        "inconsistent inbound lead flow and search visibility",
    ),
    (
        "Mobile App Development",
        ["mobile", "app", "android", "ios", "customer app", "delivery"],
        "customer engagement gaps on mobile channels",
    ),
    (
        "Cloud, DevOps & Automation",
        ["cloud", "server", "hosting", "devops", "deployment", "scale", "backup"],
        "manual deployment, hosting, or reliability bottlenecks",
    ),
    (
        "Cybersecurity & IT Support",
        ["security", "backup", "network", "it support", "maintenance", "compliance"],
        "security, backup, and IT maintenance risks",
    ),
]

NCR_KEYWORDS = [
    "delhi",
    "new delhi",
    "noida",
    "greater noida",
    "gurgaon",
    "gurugram",
    "faridabad",
    "ghaziabad",
    "ncr",
]


def _clean(value: Optional[str]) -> str:
    return (value or "").strip()


def _lower_join(*values: Optional[str]) -> str:
    return " ".join(_clean(value).lower() for value in values if _clean(value))


def _valid_email(email: Optional[str]) -> bool:
    if not email:
        return False
    return bool(re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email.strip()))


def _extract_json(raw_text: str) -> Optional[Dict[str, Any]]:
    match = re.search(r"\{.*\}", raw_text, re.DOTALL)
    if not match:
        return None
    try:
        parsed = json.loads(match.group(0))
    except json.JSONDecodeError:
        return None
    return parsed if isinstance(parsed, dict) else None


def _infer_company_size(employee_count: Optional[int]) -> str:
    if employee_count is None:
        return "Unknown"
    if employee_count < 20:
        return "Small Business"
    if employee_count < 200:
        return "Mid-Market"
    return "Enterprise"


def _match_service(prospect: Any) -> tuple[str, str, str]:
    context = _lower_join(
        prospect.company_name,
        prospect.category,
        prospect.industry,
        prospect.notes,
        prospect.website,
    )

    best_service = "Website Design & Development"
    pain_point = "limited digital visibility and manual lead capture"
    best_score = 0

    for service, keywords, default_pain in SERVICE_KEYWORDS:
        score = sum(1 for keyword in keywords if keyword in context)
        if score > best_score:
            best_score = score
            best_service = service
            pain_point = default_pain

    upsell_service = "Digital Marketing & SEO"
    if best_service == "Digital Marketing & SEO":
        upsell_service = "Website Design & Development"
    elif best_service in {"Custom CRM / ERP Development", "E-commerce Development"}:
        upsell_service = "Cloud, DevOps & Automation"

    return best_service, upsell_service, pain_point


def _score_prospect(prospect: Any, best_service: str) -> tuple[int, str, str]:
    context = _lower_join(
        prospect.category,
        prospect.industry,
        prospect.location,
        prospect.country,
        prospect.notes,
        prospect.website,
        best_service,
    )

    score = 25
    reasons: List[str] = []

    if _valid_email(prospect.email):
        score += 20
        reasons.append("valid email available")
    elif prospect.email:
        score += 6
        reasons.append("email present but format needs verification")

    if _clean(prospect.phone):
        score += 8
        reasons.append("phone channel available")
    if _clean(prospect.website):
        score += 10
        reasons.append("website context available")
    if _clean(prospect.notes):
        score += 10
        reasons.append("business notes include buying context")

    if any(keyword in context for keyword in ["crm", "erp", "automation", "ecommerce", "software", "cloud", "seo", "website"]):
        score += 15
        reasons.append("IT service fit detected")

    if any(keyword in context for keyword in NCR_KEYWORDS) or "india" in context:
        score += 7
        reasons.append("service-area fit")

    if prospect.employee_count is not None:
        if prospect.employee_count >= 50:
            score += 10
            reasons.append("company size suggests stronger budget fit")
        elif prospect.employee_count >= 10:
            score += 5
            reasons.append("small-business budget fit")

    score = max(0, min(100, score))
    if score >= 75:
        temperature = "HOT"
    elif score >= 50:
        temperature = "WARM"
    else:
        temperature = "COLD"

    explanation = ", ".join(reasons) if reasons else "limited enrichment signals available"
    return score, temperature, explanation


def _validation(prospect: Any) -> tuple[str, str, bool, bool, bool, bool]:
    has_company = bool(_clean(prospect.company_name))
    has_contact_channel = _valid_email(prospect.email) or bool(_clean(prospect.phone)) or bool(_clean(prospect.website))
    context = _lower_join(prospect.category, prospect.industry, prospect.notes, prospect.website)
    location_context = _lower_join(prospect.location, prospect.country)

    is_real_business = has_company and (
        bool(_clean(prospect.website))
        or bool(_clean(prospect.email))
        or bool(_clean(prospect.phone))
        or bool(_clean(prospect.location))
    )
    has_it_context = any(
        keyword in context
        for service in SERVICE_KEYWORDS
        for keyword in service[1]
    )
    in_service_area = not location_context or "india" in location_context or any(keyword in location_context for keyword in NCR_KEYWORDS)

    if not has_company:
        return "Invalid", "Company name is required before outreach.", False, has_it_context, has_contact_channel, in_service_area
    if not has_contact_channel:
        return "Invalid", "No email, phone, or website is available for outreach.", is_real_business, has_it_context, False, in_service_area
    if not _valid_email(prospect.email) and not _clean(prospect.phone):
        return "Partial", "Website exists, but a direct email or phone should be enriched before sending.", is_real_business, has_it_context, has_contact_channel, in_service_area
    if not has_it_context:
        return "Partial", "Business can be contacted, but IT need is inferred from limited context.", is_real_business, has_it_context, has_contact_channel, in_service_area
    return "Valid", "Prospect has enough company, contact, and service-fit context.", is_real_business, has_it_context, has_contact_channel, in_service_area


def _language_for(prospect: Any) -> str:
    context = _lower_join(prospect.location, prospect.country, prospect.notes)
    if any(keyword in context for keyword in ["delhi", "ncr", "gurgaon", "gurugram", "noida", "india", "hindi", "hinglish"]):
        return "English with light Indian business tone"
    return "Professional English"


def _build_email(
    prospect: Any,
    best_service: str,
    upsell_service: str,
    pain_point: str,
    temperature: str,
) -> tuple[str, str, str]:
    company = _clean(prospect.company_name)
    contact = _clean(prospect.contact_name) or "there"
    industry = _clean(prospect.industry or prospect.category) or "your industry"
    location = _clean(prospect.location) or "your market"
    subject = f"Improving {company}'s digital growth with {best_service}"
    opening_line = (
        f"I noticed {company} operates in {industry} around {location}, "
        f"where {pain_point} can slow growth."
    )

    urgency = {
        "HOT": "This looks like a strong fit for a focused 15-minute discussion this week.",
        "WARM": "If this is a priority for the next quarter, a short discovery call could clarify the opportunity.",
        "COLD": "Even if this is not urgent, it may be useful to benchmark where small improvements can help.",
    }[temperature]

    body = f"""Hi {contact},

{opening_line}

I am reaching out from Hamari Technology. We help growing businesses plan, build, and maintain practical digital systems — especially around {best_service.lower()}.

For {company}, a useful starting point could be:
- identify current friction in lead capture, follow-up, or customer workflows
- map a lean solution around {best_service}
- support growth later with {upsell_service.lower()} if the first step performs well

{urgency}

Would you be open to a quick call to see whether this is relevant for {company}?"""

    sign_off = """Regards,
Dharmendra Sharma
Hamari Technology"""
    return subject, body, sign_off


def _follow_ups(prospect: Any, best_service: str, temperature: str) -> List[Dict[str, Any]]:
    company = _clean(prospect.company_name)
    delay = [2, 5, 9] if temperature == "HOT" else [3, 7, 14]
    return [
        {
            "day": delay[0],
            "message": f"Following up on my note about {best_service.lower()} for {company}. Is improving this area currently on your roadmap?",
        },
        {
            "day": delay[1],
            "message": f"Sharing one practical angle: {company} could start with a compact audit before committing to a full build. Worth exploring?",
        },
        {
            "day": delay[2],
            "message": f"I will close the loop for now. If {best_service.lower()} becomes a priority, happy to help you assess the next step.",
        },
    ]


def _send_strategy(temperature: str, has_email: bool, has_phone: bool) -> Dict[str, str]:
    if temperature == "HOT":
        return {
            "send_best_day": "Tuesday",
            "send_best_time": "10:30 AM - 12:00 PM IST",
            "send_rationale": "High-intent prospects should be contacted early in the business week.",
            "channel_primary": "Email" if has_email else "Phone",
            "channel_fallback": "Phone" if has_phone else "LinkedIn",
        }
    if temperature == "WARM":
        return {
            "send_best_day": "Wednesday",
            "send_best_time": "11:00 AM - 1:00 PM IST",
            "send_rationale": "Mid-week outreach gives enough attention without Monday backlog.",
            "channel_primary": "Email" if has_email else "Phone",
            "channel_fallback": "LinkedIn",
        }
    return {
        "send_best_day": "Thursday",
        "send_best_time": "2:00 PM - 4:00 PM IST",
        "send_rationale": "Lower-intent prospects are best handled with lighter, lower-pressure outreach.",
        "channel_primary": "Email" if has_email else "LinkedIn",
        "channel_fallback": "Phone" if has_phone else "Website Form",
    }


def _local_process(prospect: Any, error: Optional[str] = None) -> Dict[str, Any]:
    validation_status, validation_reason, is_real_business, has_it_context, has_contact_channel, in_service_area = _validation(prospect)
    best_service, upsell_service, pain_point = _match_service(prospect)
    score, temperature, explanation = _score_prospect(prospect, best_service)
    subject, body, sign_off = _build_email(prospect, best_service, upsell_service, pain_point, temperature)
    strategy = _send_strategy(temperature, _valid_email(prospect.email), bool(_clean(prospect.phone)))

    skip_reason = None
    if validation_status == "Invalid":
        skip_reason = validation_reason

    raw_response: Dict[str, Any] = {
        "mode": "rules_fallback",
        "score_explanation": explanation,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
    if error:
        raw_response["ai_error"] = error

    return {
        "validation": {
            "record_quality": validation_status,
            "is_real_business": is_real_business,
            "has_it_context": has_it_context,
            "has_contact_channel": has_contact_channel,
            "in_service_area": in_service_area,
            "skip_reason": skip_reason,
            "validation_reason": validation_reason,
        },
        "enrichment": {
            "decision_maker_title": "Owner / Founder" if _infer_company_size(prospect.employee_count) != "Enterprise" else "IT / Operations Head",
            "decision_maker_name": _clean(prospect.contact_name) or None,
            "company_size": _infer_company_size(prospect.employee_count),
            "industry_segment": _clean(prospect.industry or prospect.category) or "General Business",
            "pain_point": pain_point,
            "best_service": best_service,
            "upsell_service": upsell_service,
            "opening_line": body.splitlines()[2] if len(body.splitlines()) > 2 else "",
            "lead_score": temperature,
            "score_value": score,
            "confidence": 0.72 if validation_status == "Valid" else 0.55,
            "score_explanation": explanation,
        },
        "email": {
            "subject_line": subject,
            "email_body": body,
            "email_language": _language_for(prospect),
            "sign_off": sign_off,
        },
        "strategy": strategy,
        "follow_ups": _follow_ups(prospect, best_service, temperature),
        "raw_response": raw_response,
        "error": error,
    }


def _gemini_process(prospect: Any) -> Optional[Dict[str, Any]]:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or genai is None:
        return None

    prompt = f"""You are an AI cold-outreach assistant for Hamari Technology, an IT services company in Delhi NCR.
Use only the supplied prospect fields. Do not claim that you verified external facts.

Return strict JSON with these top-level keys:
validation(record_quality,is_real_business,has_it_context,has_contact_channel,in_service_area,skip_reason,validation_reason),
enrichment(decision_maker_title,decision_maker_name,company_size,industry_segment,pain_point,best_service,upsell_service,opening_line,lead_score,score_value,confidence,score_explanation),
email(subject_line,email_body,email_language,sign_off),
strategy(send_best_day,send_best_time,send_rationale,channel_primary,channel_fallback),
follow_ups(array of objects with day and message).

Scoring rules: lead_score must be HOT, WARM, or COLD. score_value must be 0-100.
Brand voice: professional, practical, concise, India-friendly where relevant. Sign off as Dharmendra Sharma, Hamari Technology.

Prospect:
{{
  "company_name": "{_clean(prospect.company_name)}",
  "contact_name": "{_clean(prospect.contact_name)}",
  "category": "{_clean(prospect.category)}",
  "industry": "{_clean(prospect.industry)}",
  "location": "{_clean(prospect.location)}",
  "country": "{_clean(prospect.country)}",
  "website": "{_clean(prospect.website)}",
  "email": "{_clean(prospect.email)}",
  "phone": "{_clean(prospect.phone)}",
  "employee_count": {prospect.employee_count if prospect.employee_count is not None else "null"},
  "notes": "{_clean(prospect.notes)}"
}}"""

    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-2.0-flash")
        response = model.generate_content(prompt)
        parsed = _extract_json(response.text or "")
        if not parsed:
            return None
        parsed["raw_response"] = {
            "mode": "gemini",
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
        parsed["error"] = None
        return parsed
    except Exception as exc:
        return _local_process(prospect, error=f"Gemini fallback used: {str(exc)}")


def process_prospect(prospect: Any) -> Dict[str, Any]:
    gemini_result = _gemini_process(prospect)
    if gemini_result:
        local_result = _local_process(prospect)
        return _merge_with_defaults(gemini_result, local_result)
    return _local_process(prospect)


def _merge_with_defaults(result: Dict[str, Any], defaults: Dict[str, Any]) -> Dict[str, Any]:
    merged = defaults.copy()
    for section in ["validation", "enrichment", "email", "strategy"]:
        merged[section] = {**defaults.get(section, {}), **(result.get(section) or {})}
    merged["follow_ups"] = result.get("follow_ups") or defaults.get("follow_ups") or []
    merged["raw_response"] = result.get("raw_response") or defaults.get("raw_response")
    merged["error"] = result.get("error")
    return merged


def scheduled_followup_date(day_offset: int) -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=day_offset)
