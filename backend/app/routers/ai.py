import os
import time
import re
from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
try:
    import google.generativeai as genai
except ImportError:
    genai = None

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.crm import Lead
from app.core.ml import scoring_model

router = APIRouter(prefix="/ai", tags=["ai"])

# Rate limiter (User ID -> Timestamp)
AI_LIMITS: Dict[int, float] = {}
RATE_LIMIT_SECONDS = 5.0

def enforce_rate_limit(user_id: int):
    now = time.time()
    last_req = AI_LIMITS.get(user_id, 0.0)
    if now - last_req < RATE_LIMIT_SECONDS:
        wait_time = int(RATE_LIMIT_SECONDS - (now - last_req))
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded. Please wait {wait_time}s before requesting AI assistance again."
        )
    AI_LIMITS[user_id] = now

# Request Schemas
class EmailGenRequest(BaseModel):
    lead_id: int
    intent: str  # Cold Outreach, Follow Up, Meeting Invitation, Proposal, Thank You
    tone: str    # Professional, Friendly, Casual, Formal

VALID_INTENTS = ["Cold Outreach", "Follow Up", "Meeting Invitation", "Proposal", "Thank You"]
VALID_TONES = ["Professional", "Friendly", "Casual", "Formal"]

@router.post("/score-leads")
def batch_score_leads(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Retrains the ML model and calculates scores for all leads."""
    scoring_model.train()

    query = db.query(Lead)
    if current_user.role == "Executive":
        query = query.filter(Lead.owner_id == current_user.id)

    leads = query.all()
    scored_count = 0
    for lead in leads:
        lead_dict = {
            "source": lead.source,
            "industry": lead.industry,
            "country": lead.country,
            "status": lead.status,
            "employee_count": lead.employee_count,
            "website": lead.website or "",
            "email": lead.email or "",
            "phone": lead.phone or "",
            "notes": lead.notes or ""
        }
        score = scoring_model.predict_score(lead_dict)
        lead.lead_score = score
        db.add(lead)
        scored_count += 1

    db.commit()
    return {
        "message": f"Successfully scored {scored_count} leads.",
        "model_accuracy": scoring_model.cv_score,
        "features_used": len(scoring_model.feature_names)
    }

@router.post("/explain-lead/{lead_id}")
def explain_lead_score(
    lead_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Returns SHAP-style feature attributions for a specific lead."""
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    lead_dict = {
        "source": lead.source,
        "industry": lead.industry,
        "country": lead.country,
        "status": lead.status,
        "employee_count": lead.employee_count,
        "website": lead.website or "",
        "email": lead.email or "",
        "phone": lead.phone or "",
        "notes": lead.notes or ""
    }

    score = scoring_model.predict_score(lead_dict)
    shaps = scoring_model.explain_score(lead_dict)

    return {
        "lead_id": lead.id,
        "lead_name": lead.name,
        "lead_score": score,
        "model_accuracy": scoring_model.cv_score,
        "shaps": shaps
    }

def _extract_subject(text: str) -> str:
    """Extract subject line from generated email text."""
    # Try to find explicit subject line
    match = re.search(r'Subject:\s*(.+?)(?:\n|$)', text, re.IGNORECASE)
    if match:
        return match.group(1).strip()
    # Try first line if it looks like a subject
    first_line = text.strip().split('\n')[0].strip()
    if len(first_line) < 100 and not first_line.startswith(('Hi ', 'Dear ', 'Hello')):
        return first_line
    return "No subject"

def _build_email_prompt(lead_name: str, company: str, industry: str, notes: str,
                        sender_name: str, intent: str, tone: str) -> str:
    """Build a detailed prompt for email generation."""
    intent_instructions = {
        "Cold Outreach": "This is a first contact. Introduce the company briefly, reference something specific about their business, and propose a short discovery call.",
        "Follow Up": "Reference previous communication, address potential concerns, and suggest next steps.",
        "Meeting Invitation": "Propose a specific meeting time, outline the agenda, and explain the value of the meeting.",
        "Proposal": "Summarize the proposed solution, highlight key benefits, and include a clear call to action.",
        "Thank You": "Express gratitude for their time, recap key takeaways, and outline next steps."
    }

    tone_instructions = {
        "Professional": "Use formal business language. Be concise and direct.",
        "Friendly": "Use warm, approachable language while maintaining professionalism.",
        "Casual": "Use relaxed, conversational language. Keep it brief.",
        "Formal": "Use very formal language with proper business etiquette."
    }

    return f"""Write a personalized {tone.lower()} email from {sender_name} to {lead_name}.

Context:
- Recipient: {lead_name} at {company}
- Industry: {industry}
- Notes about the lead: {notes}
- Email intent: {intent}
- Tone: {tone}

Instructions:
- {intent_instructions.get(intent, 'Write a professional business email.')}
- {tone_instructions.get(tone, 'Use professional language.')}
- Keep it concise (150-250 words).
- Start with "Subject: [subject line]" on the first line.
- Then a blank line, then the email body.
- End with a professional sign-off.
- Do not include any meta-commentary or explanations."""

@router.post("/generate-email")
def generate_lead_email(
    request: EmailGenRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Generates personalized email drafts using Gemini API (with template fallback)."""
    enforce_rate_limit(current_user.id)

    # Validate inputs
    if request.intent not in VALID_INTENTS:
        raise HTTPException(status_code=400, detail=f"Invalid intent. Choose from: {', '.join(VALID_INTENTS)}")
    if request.tone not in VALID_TONES:
        raise HTTPException(status_code=400, detail=f"Invalid tone. Choose from: {', '.join(VALID_TONES)}")

    lead = db.query(Lead).filter(Lead.id == request.lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    company = lead.company_name or "their company"
    industry = lead.industry or "Technology"
    notes = lead.notes or "general business partnership"

    api_key = os.getenv("GEMINI_API_KEY")

    if api_key:
        try:
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel("gemini-2.0-flash")

            prompt = _build_email_prompt(
                lead.name, company, industry, notes,
                current_user.full_name, request.intent, request.tone
            )

            response = model.generate_content(prompt)
            email_text = response.text.strip()
            subject = _extract_subject(email_text)

            return {
                "draft": email_text,
                "subject": subject,
                "mode": "Google Gemini API Live",
                "intent": request.intent,
                "tone": request.tone
            }

        except Exception as e:
            print(f"Gemini API failure: {str(e)}. Falling back to template.")

    # Template fallback
    subject = f"Connecting: IT Solutions for {company}"
    salutation = f"Hi {lead.name},"

    templates = {
        "Cold Outreach": f"I was reviewing {company}'s accomplishments in the {industry} sector and noticed you might be expanding your operations. I would love to connect to discuss how our IT systems support organizations in achieving cloud efficiency.",
        "Follow Up": f"I am following up on our previous communication regarding {notes}. I wanted to check if you have any questions about the points we discussed, or if you would like us to customize our approach further.",
        "Meeting Invitation": f"I would love to invite you to a brief 15-minute introductory call next week. I would be glad to share how we can assist {company} with your {notes} challenges and explore a mutual partnership.",
        "Proposal": f"Based on our discussions about {notes}, I have prepared a tailored proposal for {company}. Our solutions in the {industry} space have helped similar organizations reduce costs by 30% while improving operational efficiency.",
        "Thank You": f"Thank you for taking the time to meet with us. I appreciated the opportunity to learn more about {company}'s goals in the {industry} space. As discussed, I will {notes[:50]}."
    }

    body = templates.get(request.intent, templates["Cold Outreach"])
    signoff = f"Best regards,\n\n{current_user.full_name}\nEnterprise IT Solutions"

    draft = f"Subject: {subject}\n\n{salutation}\n\n{body}\n\n{signoff}"

    return {
        "draft": draft,
        "subject": subject,
        "mode": "Contextual Template Generator",
        "intent": request.intent,
        "tone": request.tone
    }
