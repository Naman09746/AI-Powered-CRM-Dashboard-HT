from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.crm import Deal, Lead, OutreachFollowUp, OutreachResult, OutreachSendLog, Prospect
from app.models.user import User

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _scope_query(query: Any, model: Any, current_user: User) -> Any:
    if current_user.role == "Executive":
        return query.filter(model.owner_id == current_user.id)
    return query


def _dict_rows(rows: list[tuple[Any, int]], empty_name: str = "Unknown") -> list[dict[str, Any]]:
    return [
        {"name": name or empty_name, "value": count}
        for name, count in rows
        if count
    ]


def _quality_count(result_query: Any, *qualities: str) -> int:
    return result_query.filter(OutreachResult.record_quality.in_(qualities)).count()


@router.get("/kpis")
def get_dashboard_kpis(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    lead_query = _scope_query(db.query(Lead), Lead, current_user)
    deal_query = _scope_query(db.query(Deal), Deal, current_user)
    prospect_query = _scope_query(db.query(Prospect), Prospect, current_user)

    result_query = db.query(OutreachResult).join(Prospect, OutreachResult.prospect_id == Prospect.id)
    log_query = db.query(OutreachSendLog).outerjoin(Prospect, OutreachSendLog.prospect_id == Prospect.id)
    followup_query = db.query(OutreachFollowUp).join(Prospect, OutreachFollowUp.prospect_id == Prospect.id)
    if current_user.role == "Executive":
        result_query = result_query.filter(Prospect.owner_id == current_user.id)
        log_query = log_query.filter(Prospect.owner_id == current_user.id)
        followup_query = followup_query.filter(Prospect.owner_id == current_user.id)

    total_leads = lead_query.count()
    total_prospects = prospect_query.count()
    processed = prospect_query.filter(Prospect.processing_status == "Processed").count()
    unprocessed = max(0, total_prospects - processed)

    hot = prospect_query.filter(Prospect.lead_temperature == "HOT").count()
    warm = prospect_query.filter(Prospect.lead_temperature == "WARM").count()
    cold = prospect_query.filter(Prospect.lead_temperature == "COLD").count()
    unscored = max(0, total_prospects - hot - warm - cold)

    quality_good = _quality_count(result_query, "good", "Valid")
    quality_partial = _quality_count(result_query, "partial", "Partial")
    quality_skip = _quality_count(result_query, "skip", "Invalid")

    open_deals_count = deal_query.filter(Deal.stage.notin_(["Won", "Lost"])).count()
    closed_deals_count = deal_query.filter(Deal.stage.in_(["Won", "Lost"])).count()
    won_deals = deal_query.filter(Deal.stage == "Won").all()
    total_revenue = sum(deal.value for deal in won_deals)
    won_count = len(won_deals)
    lost_count = deal_query.filter(Deal.stage == "Lost").count()
    total_closed = won_count + lost_count
    conversion_rate = (won_count / total_closed * 100) if total_closed else 0.0

    live_sent = log_query.filter(OutreachSendLog.status == "sent", OutreachSendLog.dry_run == False).count()
    dry_runs = log_query.filter(OutreachSendLog.status == "dry_run").count()
    failed_sends = log_query.filter(OutreachSendLog.status == "failed").count()
    followups_due = followup_query.filter(
        OutreachFollowUp.status == "Pending",
        OutreachFollowUp.scheduled_for <= datetime.now(timezone.utc),
    ).count()
    converted = prospect_query.filter(Prospect.conversion_status == "Converted").count()

    category_rows = (
        prospect_query.with_entities(Prospect.category, func.count(Prospect.id))
        .filter(Prospect.category.isnot(None), Prospect.category != "")
        .group_by(Prospect.category)
        .order_by(func.count(Prospect.id).desc())
        .limit(10)
        .all()
    )
    service_rows = (
        result_query.with_entities(OutreachResult.best_service, func.count(OutreachResult.id))
        .filter(OutreachResult.best_service.isnot(None), OutreachResult.best_service != "")
        .group_by(OutreachResult.best_service)
        .order_by(func.count(OutreachResult.id).desc())
        .limit(10)
        .all()
    )
    source_rows = (
        prospect_query.with_entities(Prospect.source, func.count(Prospect.id))
        .filter(Prospect.source.isnot(None), Prospect.source != "")
        .group_by(Prospect.source)
        .order_by(func.count(Prospect.id).desc())
        .limit(8)
        .all()
    )

    revenue_by_month: defaultdict[str, float] = defaultdict(float)
    for deal in won_deals:
        revenue_date = deal.closed_at or deal.created_at
        revenue_by_month[revenue_date.strftime("%Y-%m")] += deal.value
    revenue_trend = [
        {"month": month_key, "revenue": round(revenue, 2)}
        for month_key, revenue in sorted(revenue_by_month.items())[-12:]
    ]

    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=29)
    timeline_map = {
        (thirty_days_ago + timedelta(days=offset)).strftime("%Y-%m-%d"): 0
        for offset in range(30)
    }
    for log in log_query.filter(OutreachSendLog.sent_at >= thirty_days_ago).all():
        if log.sent_at:
            date_key = log.sent_at.strftime("%Y-%m-%d")
            timeline_map[date_key] = timeline_map.get(date_key, 0) + 1
    send_timeline = [
        {"date": date_key, "count": count}
        for date_key, count in sorted(timeline_map.items())
    ]

    sent_result_ids = {
        result_id
        for (result_id,) in log_query.with_entities(OutreachSendLog.result_id).filter(
            OutreachSendLog.status == "sent",
            OutreachSendLog.result_id.isnot(None),
        ).all()
    }
    prospect_rows = (
        result_query.with_entities(OutreachResult, Prospect)
        .order_by(OutreachResult.score_value.desc(), OutreachResult.processed_at.desc())
        .limit(15)
        .all()
    )
    prospects_table = [
        {
            "company": prospect.company_name,
            "email": prospect.email or "",
            "category": prospect.category or prospect.industry or "Unknown",
            "location": prospect.location or "Delhi NCR",
            "lead_score": result.lead_score or prospect.lead_temperature or "UNSCORED",
            "quality": result.record_quality or prospect.validation_status,
            "confidence": round(float(result.confidence or 0), 2),
            "pain_point": result.pain_point or prospect.pain_point or "",
            "best_service": result.best_service or prospect.recommended_service or "",
            "subject": result.subject_line or prospect.email_subject or "",
            "sent": result.id in sent_result_ids,
            "processed_at": result.processed_at.isoformat() if result.processed_at else None,
        }
        for result, prospect in prospect_rows
    ]

    send_history_rows = (
        log_query.order_by(OutreachSendLog.sent_at.desc())
        .limit(10)
        .all()
    )
    send_history = [
        {
            "id": log.id,
            "email": log.to_email or "",
            "company": log.company_name or "Unknown",
            "subject": log.subject or "",
            "lead_score": log.lead_score or "?",
            "status": log.status,
            "sent_at": log.sent_at.isoformat() if log.sent_at else None,
            "provider": log.provider or "unknown",
        }
        for log in send_history_rows
    ]

    funnel = [
        {"stage": "Total Prospects", "count": total_prospects},
        {"stage": "Processed", "count": processed},
        {"stage": "Validated", "count": quality_good + quality_partial},
        {"stage": "HOT Leads", "count": hot},
        {"stage": "WARM Leads", "count": warm},
        {"stage": "Emails Sent", "count": live_sent},
        {"stage": "Converted", "count": converted},
    ]

    industry_rows = (
        lead_query.with_entities(Lead.industry, func.count(Lead.id))
        .group_by(Lead.industry)
        .order_by(func.count(Lead.id).desc())
        .limit(8)
        .all()
    )
    stage_rows = (
        deal_query.with_entities(Deal.stage, func.sum(Deal.value), func.count(Deal.id))
        .group_by(Deal.stage)
        .all()
    )

    return {
        "total_leads": total_leads,
        "active_clients": lead_query.filter(Lead.status == "Qualified").count(),
        "open_deals": open_deals_count,
        "closed_deals": closed_deals_count,
        "total_revenue": round(total_revenue, 2),
        "conversion_rate": round(conversion_rate, 2),
        "outreach_prospects": total_prospects,
        "outreach_hot": hot,
        "outreach_emails_sent": live_sent,
        "industry_data": _dict_rows(industry_rows),
        "stage_data": [{"stage": stage, "value": value or 0.0, "count": count} for stage, value, count in stage_rows],
        "revenue_trend": revenue_trend,
        "outreach": {
            "prospects": {
                "total": total_prospects,
                "processed": processed,
                "unprocessed": unprocessed,
            },
            "leads": {
                "HOT": hot,
                "WARM": warm,
                "COLD": cold,
                "unscored": unscored,
            },
            "quality": {
                "good": quality_good,
                "partial": quality_partial,
                "skip": quality_skip,
            },
            "emails": {
                "sent": live_sent,
                "dry_runs": dry_runs,
                "failed": failed_sends,
            },
            "followups_due": followups_due,
            "converted": converted,
            "categories": _dict_rows(category_rows),
            "services": _dict_rows(service_rows),
            "sources": _dict_rows(source_rows),
            "funnel": funnel,
            "send_timeline": send_timeline,
            "prospects_table": prospects_table,
            "send_history": send_history,
            "data_note": f"Loaded from {total_prospects} HT outreach prospects with synthetic enrichment where unavailable.",
        },
    }
