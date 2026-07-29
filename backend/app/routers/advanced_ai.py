import os
import re
import time
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timezone, timedelta
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import GradientBoostingRegressor
try:
    import google.generativeai as genai
except ImportError:
    genai = None

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.crm import Lead, Deal, Task, MeetingSummary, AuditLog, Activity, Company, Contact, Prospect, OutreachSendLog, OutreachFollowUp
from app.schemas.crm import MeetingSummaryCreate, MeetingSummaryResponse

router = APIRouter(prefix="/advanced-ai", tags=["advanced-ai"])

# Rate limit for Assistant
ASSISTANT_LIMITS: dict = {}
RATE_LIMIT_SECONDS = 3.0

def enforce_rate_limit(user_id: int):
    now = time.time()
    last_req = ASSISTANT_LIMITS.get(user_id, 0.0)
    if now - last_req < RATE_LIMIT_SECONDS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Assistant is processing. Please wait 3 seconds."
        )
    ASSISTANT_LIMITS[user_id] = now

class ChatRequest(BaseModel):
    message: str

# ─────────────────────────────────────────────
# Meeting Summarizer
# ─────────────────────────────────────────────

def _parse_meeting_response(raw_text: str) -> dict:
    """Robustly parse Gemini response into structured sections."""
    sections = {
        "summary": "",
        "decisions": "",
        "action_items": "",
        "risks": ""
    }

    # Try to find sections by headers
    patterns = {
        "summary": r'(?:summary|overview)[:\s]*\n?(.*?)(?=(?:decision|action|risk|$))',
        "decisions": r'(?:decisions?\s*(?:made)?)[:\s]*\n?(.*?)(?=(?:action|risk|$))',
        "action_items": r'(?:action\s*items?)[:\s]*\n?(.*?)(?=(?:risk|$))',
        "risks": r'(?:risks?|obstacles?)[:\s]*\n?(.*?)$'
    }

    text_lower = raw_text.lower()

    for key, pattern in patterns.items():
        match = re.search(pattern, text_lower, re.DOTALL | re.IGNORECASE)
        if match:
            # Extract from original text to preserve formatting
            start = match.start(1)
            end = match.end(1)
            sections[key] = raw_text[start:end].strip()

    # Fallback: split by double newlines if regex didn't work well
    if not any(sections.values()):
        parts = [p.strip() for p in raw_text.split("\n\n") if p.strip()]
        if len(parts) >= 1:
            sections["summary"] = parts[0]
        if len(parts) >= 2:
            sections["decisions"] = parts[1]
        if len(parts) >= 3:
            sections["action_items"] = parts[2]
        if len(parts) >= 4:
            sections["risks"] = parts[3]

    # Final fallback: split by numbered sections
    if not any(sections.values()):
        numbered = re.split(r'\n\s*\d+[\.\)]\s*', raw_text)
        numbered = [p.strip() for p in numbered if p.strip()]
        keys = ["summary", "decisions", "action_items", "risks"]
        for i, part in enumerate(numbered):
            if i < len(keys):
                sections[keys[i]] = part

    return sections

@router.get("/meetings", response_model=List[MeetingSummaryResponse])
def get_meeting_summaries(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    query = db.query(MeetingSummary)
    if current_user.role == "Executive":
        query = query.filter(MeetingSummary.user_id == current_user.id)
    return query.order_by(MeetingSummary.created_at.desc()).all()

@router.post("/meeting-summarizer", response_model=MeetingSummaryResponse)
def summarize_meeting(
    request: MeetingSummaryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Summarizes a meeting transcript into structured sections."""
    enforce_rate_limit(current_user.id)
    transcript = request.transcript
    api_key = os.getenv("GEMINI_API_KEY")

    if request.lead_id:
        lead = db.query(Lead).filter(Lead.id == request.lead_id).first()
        if not lead:
            raise HTTPException(status_code=404, detail="Lead not found")
        if current_user.role == "Executive" and lead.owner_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to summarize meetings for this lead")

    summary_text = ""
    decisions_text = ""
    actions_text = ""
    risks_text = ""

    if api_key:
        try:
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel("gemini-2.0-flash")
            prompt = f"""Analyze the following meeting transcript. Provide a structured summary with exactly four sections using these headers:

SUMMARY:
(2-3 sentence overview of the meeting)

DECISIONS MADE:
- (bullet points of agreed items)

ACTION ITEMS:
- (bullet points with assignees if mentioned, include deadlines)

RISKS / OBSTACLES:
- (bullet points of potential issues or blockers)

Meeting Transcript:
{transcript}

Format your response with the exact headers shown above."""

            response = model.generate_content(prompt)
            parsed = _parse_meeting_response(response.text)

            summary_text = parsed["summary"] or "Meeting summary generated."
            decisions_text = parsed["decisions"] or "No specific decisions recorded."
            actions_text = parsed["action_items"] or "No action items identified."
            risks_text = parsed["risks"] or "No risks identified."

        except Exception as e:
            print(f"Gemini Summarizer failure: {str(e)}")

    # Fallback if Gemini not configured or failed
    if not summary_text or summary_text == "Meeting summary generated.":
        word_count = len(transcript.split())
        participant_hints = set(re.findall(r'(?:^|\n)([A-Z][a-z]+):', transcript))
        sentences = re.split(r'(?<=[.!?])\s+', transcript.strip())
        summary_sentences = " ".join(sentences[:2]).strip()
        action_candidates = [
            line.strip()
            for line in transcript.splitlines()
            if re.search(r'\b(will|follow up|need(?:s)? to|action|assign|due|next step)\b', line, re.IGNORECASE)
        ]
        risk_candidates = [
            line.strip()
            for line in transcript.splitlines()
            if re.search(r'\b(risk|blocker|concern|issue|delay|dependency)\b', line, re.IGNORECASE)
        ]
        decision_candidates = [
            line.strip()
            for line in transcript.splitlines()
            if re.search(r'\b(decided|agreed|approved|confirmed)\b', line, re.IGNORECASE)
        ]

        summary_text = f"Meeting transcript analyzed ({word_count} words"
        if participant_hints:
            summary_text += f", {len(participant_hints)} participants detected"
        summary_text += ")."
        if summary_sentences:
            summary_text += f" {summary_sentences}"

        decisions_text = "\n".join(f"- {item}" for item in decision_candidates[:5]) or "No explicit decisions detected."
        actions_text = "\n".join(f"- {item}" for item in action_candidates[:5]) or "No explicit action items detected."
        risks_text = "\n".join(f"- {item}" for item in risk_candidates[:5]) or "No explicit risks detected."

    db_meeting = MeetingSummary(
        title=request.title,
        transcript=transcript,
        summary=summary_text,
        decisions=decisions_text,
        action_items=actions_text,
        risks=risks_text,
        lead_id=request.lead_id,
        user_id=current_user.id
    )
    db.add(db_meeting)
    db.commit()
    db.refresh(db_meeting)
    return db_meeting

# ─────────────────────────────────────────────
# Revenue Forecasting
# ─────────────────────────────────────────────

@router.get("/revenue-forecasting")
def get_revenue_forecast(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Forecasts revenue from actual closed-won deal history only."""
    deals_query = db.query(Deal).filter(Deal.stage == "Won")
    if current_user.role == "Executive":
        deals_query = deals_query.filter(Deal.owner_id == current_user.id)
    deals = deals_query.order_by(Deal.created_at.asc()).all()

    # Aggregate by month
    months_map = {}
    for d in deals:
        revenue_date = d.closed_at or d.created_at
        m_str = revenue_date.strftime("%Y-%m")
        months_map[m_str] = months_map.get(m_str, 0.0) + d.value

    sorted_months = sorted(months_map.keys())
    historical_results = []
    for m_str in sorted_months[-6:]:
        m_date = datetime.strptime(m_str, "%Y-%m")
        historical_results.append({
            "month": m_date.strftime("%b"),
            "month_full": m_str,
            "revenue": round(float(months_map[m_str]), 2)
        })

    historical_revenue = [months_map[m] for m in sorted_months]
    if len(historical_revenue) < 2:
        return {
            "historical": historical_results,
            "forecast": [],
            "trend_percent": 0,
            "using_fallback": False,
            "data_quality": "insufficient",
            "model_type": "Needs at least 2 months of closed-won revenue"
        }

    # Prepare features for forecasting
    n = len(historical_revenue)
    X = np.arange(n).reshape(-1, 1)
    y = np.array(historical_revenue)

    # Add trend and seasonal features
    X_enhanced = np.column_stack([
        X,                          # trend
        np.sin(2 * np.pi * X / 12),  # seasonal sin
        np.cos(2 * np.pi * X / 12),  # seasonal cos
    ])

    lr = LinearRegression()
    lr.fit(X_enhanced, y)

    # Forecast next 3 months with recency weighting
    forecast_X = np.arange(n, n + 3).reshape(-1, 1)
    forecast_X_enhanced = np.column_stack([
        forecast_X,
        np.sin(2 * np.pi * forecast_X / 12),
        np.cos(2 * np.pi * forecast_X / 12),
    ])

    lr_pred = lr.predict(forecast_X_enhanced)
    model_type = "Linear trend"
    if len(historical_revenue) >= 4:
        gb = GradientBoostingRegressor(n_estimators=50, max_depth=3, random_state=42)
        gb.fit(X_enhanced, y)
        gb_pred = gb.predict(forecast_X_enhanced)
        predictions = 0.4 * lr_pred + 0.6 * gb_pred
        fitted = 0.4 * lr.predict(X_enhanced) + 0.6 * gb.predict(X_enhanced)
        model_type = "Ensemble (Linear + GradientBoosting)"
    else:
        predictions = lr_pred
        fitted = lr.predict(X_enhanced)

    # Confidence intervals based on residual std
    residuals = y - fitted
    std_err = float(np.std(residuals)) if len(residuals) > 1 else float(np.mean(y) * 0.15)
    if len(historical_revenue) < 4:
        std_err = max(std_err, float(np.mean(y) * 0.35))

    # Generate month labels
    from dateutil.relativedelta import relativedelta
    last_month = datetime.strptime(sorted_months[-1], "%Y-%m")

    forecast_results = []
    for i, pred in enumerate(predictions):
        future_date = last_month + relativedelta(months=i + 1)
        val = max(0.0, round(float(pred), 2))
        ci_width = std_err * (1.5 + i * 0.3)  # Widening CI
        forecast_results.append({
            "month": future_date.strftime("%b"),
            "month_full": future_date.strftime("%Y-%m"),
            "forecast": val,
            "ci_low": max(0.0, round(val - ci_width, 2)),
            "ci_high": round(val + ci_width, 2)
        })

    # Calculate trend direction
    if len(historical_revenue) >= 2:
        recent_avg = np.mean(historical_revenue[-2:])
        older_avg = np.mean(historical_revenue[:-2]) if len(historical_revenue) > 2 else historical_revenue[0]
        trend_pct = round(((recent_avg - older_avg) / older_avg * 100), 1) if older_avg > 0 else 0
    else:
        trend_pct = 0

    return {
        "historical": historical_results,
        "forecast": forecast_results,
        "trend_percent": trend_pct,
        "using_fallback": False,
        "data_quality": "limited" if len(historical_revenue) < 4 else "model-ready",
        "model_type": model_type
    }

# ─────────────────────────────────────────────
# Customer Insights
# ─────────────────────────────────────────────

@router.get("/customer-insights")
def get_customer_insights(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Computes dynamic insights from actual CRM data."""
    insights = []
    lead_query = db.query(Lead)
    deal_query = db.query(Deal)
    task_query = db.query(Task)

    if current_user.role == "Executive":
        lead_query = lead_query.filter(Lead.owner_id == current_user.id)
        deal_query = deal_query.filter(Deal.owner_id == current_user.id)
        task_query = task_query.filter(Task.assigned_to_id == current_user.id)

    # 1. Overall conversion rate
    total_leads = lead_query.count()
    qualified_leads = lead_query.filter(Lead.status == "Qualified").count()
    if total_leads > 0:
        rate = round((qualified_leads / total_leads * 100), 1)
        insights.append({
            "insight": "Lead Conversion Rate",
            "detail": f"{rate}% of leads ({qualified_leads}/{total_leads}) progress to Qualified status.",
            "type": "info"
        })

    # 2. Best performing industry by deal value
    industry_stats = (
        db.query(Lead.industry, func.avg(Deal.value), func.count(Deal.id))
        .join(Deal, Deal.lead_id == Lead.id)
        .filter(Deal.stage == "Won")
        .group_by(Lead.industry)
    )
    if current_user.role == "Executive":
        industry_stats = industry_stats.filter(Deal.owner_id == current_user.id)
    industry_stats = industry_stats.all()
    if industry_stats:
        best = max(industry_stats, key=lambda x: x[1] or 0)
        worst = min(industry_stats, key=lambda x: x[1] or 0)
        if best[0] and best[1]:
            multiplier = round(best[1] / worst[1], 1) if worst[1] and worst[1] > 0 else "N/A"
            insights.append({
                "insight": f"Top Sector: {best[0]}",
                "detail": f"{best[0]} deals average ${best[1]:,.0f} — {multiplier}x higher than {worst[0]}.",
                "type": "positive"
            })

    # 3. Best lead source by conversion
    source_stats = (
        db.query(Lead.source, func.count(Lead.id))
        .filter(Lead.status == "Qualified")
        .group_by(Lead.source)
    )
    if current_user.role == "Executive":
        source_stats = source_stats.filter(Lead.owner_id == current_user.id)
    source_stats = source_stats.all()
    if source_stats:
        best_source = max(source_stats, key=lambda x: x[1])
        total_qualified = sum(s[1] for s in source_stats)
        pct = round(best_source[1] / total_qualified * 100, 1) if total_qualified > 0 else 0
        insights.append({
            "insight": f"Top Channel: {best_source[0]}",
            "detail": f"{best_source[0]} accounts for {pct}% of all qualified leads ({best_source[1]} leads).",
            "type": "positive"
        })

    # 4. Average deal cycle time (days from creation to close)
    closed_deals = deal_query.filter(Deal.closed_at.isnot(None)).all()
    if closed_deals:
        cycle_days = [(d.closed_at - d.created_at).days for d in closed_deals if d.closed_at]
        if cycle_days:
            avg_cycle = round(np.mean(cycle_days), 1)
            insights.append({
                "insight": "Average Deal Cycle",
                "detail": f"Deals take an average of {avg_cycle} days from creation to close.",
                "type": "info"
            })

    # 5. Active pipeline value
    open_deals = deal_query.filter(Deal.stage.notin_(["Won", "Lost"])).all()
    if open_deals:
        pipeline_value = sum(d.value for d in open_deals)
        insights.append({
            "insight": "Open Pipeline Value",
            "detail": f"${pipeline_value:,.0f} across {len(open_deals)} active deals in the pipeline.",
            "type": "info"
        })

    # 6. Task completion rate
    total_tasks = task_query.count()
    completed_tasks = task_query.filter(Task.status == "Completed").count()
    if total_tasks > 0:
        completion_rate = round(completed_tasks / total_tasks * 100, 1)
        insights.append({
            "insight": "Task Completion Rate",
            "detail": f"{completion_rate}% of tasks ({completed_tasks}/{total_tasks}) have been completed.",
            "type": "positive" if completion_rate > 70 else "warning"
        })

    # 7. Top performing sales rep
    if current_user.role != "Executive":
        rep_stats = (
            db.query(User.full_name, func.sum(Deal.value))
            .join(Deal, Deal.owner_id == User.id)
            .filter(Deal.stage == "Won")
            .group_by(User.full_name)
            .order_by(func.sum(Deal.value).desc())
            .first()
        )
        if rep_stats and rep_stats[0]:
            insights.append({
                "insight": f"Top Performer: {rep_stats[0]}",
                "detail": f"${rep_stats[1]:,.0f} in closed-won revenue.",
                "type": "positive"
            })

    # 8. Leads without recent activity
    stale_threshold = datetime.now(timezone.utc) - timedelta(days=30)
    stale_leads = lead_query.filter(
        Lead.status.notin_(["Lost", "Qualified"]),
        Lead.updated_at < stale_threshold
    ).count()
    if stale_leads > 0:
        insights.append({
            "insight": "Stale Leads Alert",
            "detail": f"{stale_leads} leads have not been updated in over 30 days.",
            "type": "warning"
        })

    if not insights:
        insights.append({
            "insight": "No Data Available",
            "detail": "Add more leads and deals to generate meaningful insights.",
            "type": "info"
        })

    return insights

# ─────────────────────────────────────────────
# Conversational AI Assistant
# ─────────────────────────────────────────────

def _query_leads(db: Session, user: User) -> str:
    query = db.query(Lead)
    if user.role == "Executive":
        query = query.filter(Lead.owner_id == user.id)
    count = query.count()
    by_status = {}
    for status_name in ["New", "Contacted", "Qualified", "Lost"]:
        q = query.filter(Lead.status == status_name)
        c = q.count()
        if c > 0:
            by_status[status_name] = c
    result = f"We have {count} leads total."
    if by_status:
        parts = [f"{v} {k.lower()}" for k, v in by_status.items()]
        result += f" Breakdown: {', '.join(parts)}."
    return result

def _query_revenue(db: Session, user: User) -> str:
    deal_query = db.query(Deal).filter(Deal.stage == "Won")
    if user.role == "Executive":
        deal_query = deal_query.filter(Deal.owner_id == user.id)
    won_deals = deal_query.all()
    total = sum(d.value for d in won_deals)
    count = len(won_deals)
    avg = total / count if count > 0 else 0
    return f"Won revenue: ${total:,.2f} across {count} deals (avg ${avg:,.2f} per deal)."

def _query_pipeline(db: Session, user: User) -> str:
    deal_query = db.query(Deal)
    if user.role == "Executive":
        deal_query = deal_query.filter(Deal.owner_id == user.id)
    stages = {}
    for stage in ["New", "Contacted", "Proposal", "Negotiation"]:
        c = deal_query.filter(Deal.stage == stage).count()
        if c > 0:
            stages[stage] = c
    total_open = sum(stages.values())
    if not total_open:
        return "No open deals in the pipeline."
    parts = [f"{v} in {k}" for k, v in stages.items()]
    return f"Pipeline has {total_open} open deals: {', '.join(parts)}."

def _query_tasks(db: Session, user: User) -> str:
    task_query = db.query(Task)
    if user.role == "Executive":
        task_query = task_query.filter(Task.assigned_to_id == user.id)
    pending = task_query.filter(Task.status == "Pending").count()
    completed = task_query.filter(Task.status == "Completed").count()
    high_priority = task_query.filter(Task.status == "Pending", Task.priority == "High").count()
    result = f"Tasks: {pending} pending, {completed} completed."
    if high_priority > 0:
        result += f" {high_priority} high-priority tasks need attention."
    return result

def _query_companies(db: Session) -> str:
    count = db.query(Company).count()
    industries = db.query(Company.industry, func.count(Company.id)).group_by(Company.industry).all()
    parts = [f"{c} {i or 'unspecified'}" for i, c in industries if c > 0]
    result = f"{count} companies registered."
    if parts:
        result += f" By sector: {', '.join(parts)}."
    return result

def _query_contacts(db: Session) -> str:
    count = db.query(Contact).count()
    return f"{count} contacts in the database."

def _query_meetings(db: Session, user: User) -> str:
    query = db.query(MeetingSummary)
    if user.role == "Executive":
        query = query.filter(MeetingSummary.user_id == user.id)
    count = query.count()
    return f"{count} meeting summaries on record."

def _query_deals_by_stage(db: Session, user: User, stage: str) -> str:
    deal_query = db.query(Deal).filter(Deal.stage == stage)
    if user.role == "Executive":
        deal_query = deal_query.filter(Deal.owner_id == user.id)
    deals = deal_query.all()
    total = sum(d.value for d in deals)
    return f"{len(deals)} {stage.lower()} deals worth ${total:,.2f}."

def _prospect_query(db: Session, user: User):
    query = db.query(Prospect)
    if user.role == "Executive":
        query = query.filter(Prospect.owner_id == user.id)
    return query

def _query_outreach(db: Session, user: User) -> str:
    query = _prospect_query(db, user)
    total = query.count()
    processed = query.filter(Prospect.processing_status == "Processed").count()
    hot = query.filter(Prospect.lead_temperature == "HOT").count()
    warm = query.filter(Prospect.lead_temperature == "WARM").count()
    cold = query.filter(Prospect.lead_temperature == "COLD").count()
    return f"Outreach has {total} prospects: {processed} processed, {hot} hot, {warm} warm, and {cold} cold."

def _query_hot_prospects(db: Session, user: User) -> str:
    prospects = (
        _prospect_query(db, user)
        .filter(Prospect.lead_temperature == "HOT")
        .order_by(Prospect.score.desc())
        .limit(5)
        .all()
    )
    if not prospects:
        return "No HOT outreach prospects are currently scored."
    names = [f"{p.company_name} ({round(p.score or 0)}%)" for p in prospects]
    return f"Top HOT prospects: {', '.join(names)}."

def _query_outreach_emails(db: Session, user: User) -> str:
    query = db.query(OutreachSendLog).outerjoin(Prospect, OutreachSendLog.prospect_id == Prospect.id)
    if user.role == "Executive":
        query = query.filter(Prospect.owner_id == user.id)
    sent = query.filter(OutreachSendLog.status == "sent", OutreachSendLog.dry_run == False).count()
    dry_runs = query.filter(OutreachSendLog.status == "dry_run").count()
    failed = query.filter(OutreachSendLog.status == "failed").count()
    return f"Outreach email log: {sent} live sent, {dry_runs} dry-runs, and {failed} failed attempts."

def _query_due_followups(db: Session, user: User) -> str:
    query = db.query(OutreachFollowUp).join(Prospect, OutreachFollowUp.prospect_id == Prospect.id)
    if user.role == "Executive":
        query = query.filter(Prospect.owner_id == user.id)
    due = query.filter(
        OutreachFollowUp.status == "Pending",
        OutreachFollowUp.scheduled_for <= datetime.now(timezone.utc),
    ).count()
    pending = query.filter(OutreachFollowUp.status == "Pending").count()
    return f"Outreach follow-ups: {due} due now and {pending} pending overall."

# Keyword-to-handler mapping
QUERY_PATTERNS = [
    (r'\b(?:outreach|prospects?|cold)\b.*\b(?:summary|status|count|pipeline)\b', _query_outreach),
    (r'\bhot\b.*\bprospects?\b', _query_hot_prospects),
    (r'\b(?:outreach|cold).*\bemails?\b', _query_outreach_emails),
    (r'\bfollow[- ]?ups?\b.*\b(?:due|outreach|pending)\b', _query_due_followups),
    (r'\b(?:how many|count|total|number of).*\bleads?\b', _query_leads),
    (r'\b(?:lead|contact).*\b(?:status|breakdown|summary)\b', _query_leads),
    (r'\brevenue\b.*\b(?:won|total|sum|closed)\b', _query_revenue),
    (r'\b(?:won|closed).*\b(?:revenue|deal|amount)\b', _query_revenue),
    (r'\bpipeline\b', _query_pipeline),
    (r'\bopen.*\bdeals?\b', _query_pipeline),
    (r'\btask', _query_tasks),
    (r'\b(?:to-?do|checklist)\b', _query_tasks),
    (r'\bcompan(?:y|ies)\b', _query_companies),
    (r'\bcontacts?\b', _query_contacts),
    (r'\bmeetings?\b', _query_meetings),
    (r'\bwon.*\bdeals?\b', lambda db, u: _query_deals_by_stage(db, u, "Won")),
    (r'\blost.*\bdeals?\b', lambda db, u: _query_deals_by_stage(db, u, "Lost")),
    (r'\bnegotiation\b', lambda db, u: _query_deals_by_stage(db, u, "Negotiation")),
    (r'\bproposal', lambda db, u: _query_deals_by_stage(db, u, "Proposal")),
]

@router.post("/assistant/chat")
def conversational_assistant(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Safe read-only natural language assistant with pattern-matched queries."""
    enforce_rate_limit(current_user.id)
    message = request.message.lower().strip()

    # Log query
    audit = AuditLog(
        user_id=current_user.id,
        query_type="Assistant Query",
        raw_query=request.message,
    )

    result_summary = ""

    # Try pattern matching
    for pattern, handler in QUERY_PATTERNS:
        if re.search(pattern, message):
            try:
                result_summary = handler(db, current_user)
            except Exception as e:
                result_summary = f"Error querying data: {str(e)}"
            break

    # Fallback: general help
    if not result_summary:
        result_summary = (
            "I can help you with information about: "
            "leads (count, status breakdown), "
            "revenue (won deals, totals), "
            "pipeline (open deals by stage), "
            "tasks (pending, completed, high-priority), "
            "companies and contacts, "
            "meeting summaries, "
            "and outreach prospects, emails, and follow-ups. "
            "Try asking: 'How many leads do we have?' or 'What is our pipeline status?'"
        )

    # Format with Gemini if available
    api_key = os.getenv("GEMINI_API_KEY")
    if api_key:
        try:
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel("gemini-2.0-flash")
            prompt = f"""The user asked the CRM assistant: "{request.message}"
Database result: "{result_summary}"

Respond in 1-2 friendly, professional sentences. Be concise. Do not repeat the raw data verbatim — rephrase naturally."""
            response = model.generate_content(prompt)
            formatted = response.text.strip()
            audit.result_summary = result_summary
            db.add(audit)
            db.commit()
            return {"response": formatted, "audited": True, "raw_data": result_summary}
        except Exception as e:
            print(f"Gemini assistant failure: {str(e)}")

    audit.result_summary = result_summary
    db.add(audit)
    db.commit()
    return {"response": result_summary, "audited": True}
