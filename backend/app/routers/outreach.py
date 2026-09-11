import csv
import io
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.crm import (
    Activity,
    AuditLog,
    Company,
    Contact,
    Deal,
    Lead,
    OutreachFollowUp,
    OutreachResult,
    OutreachSendLog,
    Prospect,
    OutreachJob,
)
from app.models.user import User
from app.schemas.outreach import (
    BatchEmailSendRequest,
    BatchEmailSendResponse,
    EmailPreviewResponse,
    EmailSendRequest,
    EmailSendResponse,
    OutreachFollowUpResponse,
    OutreachJobListResponse,
    OutreachJobResponse,
    OutreachResultResponse,
    OutreachSendLogResponse,
    OutreachStatsResponse,
    ProcessBatchRequest,
    ProcessBatchResponse,
    ProspectConvertRequest,
    ProspectConvertResponse,
    ProspectCreate,
    ProspectDetailResponse,
    ProspectImportResponse,
    ProspectListResponse,
    ProspectResponse,
    ProspectUpdate,
)
from app.services.email_service import build_email_preview, send_email
from app.services.outreach_service import process_prospect, scheduled_followup_date

router = APIRouter(prefix="/outreach", tags=["outreach"])


def _is_manager(user: User) -> bool:
    return user.role in {"Admin", "Manager"}


def _scope_prospects(query: Any, user: User) -> Any:
    if user.role == "Executive":
        return query.filter(Prospect.owner_id == user.id)
    return query


def _scope_results(query: Any, user: User) -> Any:
    query = query.join(Prospect, OutreachResult.prospect_id == Prospect.id)
    if user.role == "Executive":
        query = query.filter(Prospect.owner_id == user.id)
    return query


def _scope_logs(query: Any, user: User) -> Any:
    query = query.outerjoin(Prospect, OutreachSendLog.prospect_id == Prospect.id)
    if user.role == "Executive":
        query = query.filter(Prospect.owner_id == user.id)
    return query


def _get_owner_id(db: Session, current_user: User, requested_owner_id: Optional[int]) -> int:
    owner_id = requested_owner_id or current_user.id
    if current_user.role == "Executive" and owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Executives can only assign prospects to themselves")
    owner = db.query(User).filter(User.id == owner_id, User.is_active == True).first()
    if not owner:
        raise HTTPException(status_code=400, detail="Owner user not found or inactive")
    return owner_id


def _get_prospect(db: Session, prospect_id: int, current_user: User) -> Prospect:
    prospect = db.query(Prospect).filter(Prospect.id == prospect_id).first()
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")
    if current_user.role == "Executive" and prospect.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this prospect")
    return prospect


def _get_result(db: Session, result_id: int, current_user: User) -> OutreachResult:
    query = db.query(OutreachResult).options(
        joinedload(OutreachResult.prospect),
        joinedload(OutreachResult.follow_ups),
    )
    result = query.filter(OutreachResult.id == result_id).first()
    if not result:
        raise HTTPException(status_code=404, detail="Outreach result not found")
    if current_user.role == "Executive" and result.prospect.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this result")
    return result


def _cell(row: Dict[str, Any], *names: str) -> str:
    lowered = {key.lower().strip(): value for key, value in row.items() if key}
    for name in names:
        value = lowered.get(name.lower())
        if value is not None:
            return str(value).strip()
    return ""


def _to_int(value: str) -> Optional[int]:
    if not value:
        return None
    try:
        return int(float(value.replace(",", "")))
    except ValueError:
        return None


def _audit(db: Session, user_id: int, query_type: str, raw_query: str, summary: str) -> None:
    db.add(
        AuditLog(
            user_id=user_id,
            query_type=query_type,
            raw_query=raw_query,
            result_summary=summary,
        )
    )


def _save_result(db: Session, prospect: Prospect, result_data: Dict[str, Any]) -> OutreachResult:
    validation = result_data.get("validation", {})
    enrichment = result_data.get("enrichment", {})
    email = result_data.get("email", {})
    strategy = result_data.get("strategy", {})

    result = OutreachResult(
        prospect_id=prospect.id,
        record_quality=validation.get("record_quality"),
        is_real_business=bool(validation.get("is_real_business")),
        has_it_context=bool(validation.get("has_it_context")),
        has_contact_channel=bool(validation.get("has_contact_channel")),
        in_service_area=bool(validation.get("in_service_area", True)),
        skip_reason=validation.get("skip_reason"),
        decision_maker_title=enrichment.get("decision_maker_title"),
        company_size=enrichment.get("company_size"),
        industry_segment=enrichment.get("industry_segment"),
        pain_point=enrichment.get("pain_point"),
        best_service=enrichment.get("best_service"),
        upsell_service=enrichment.get("upsell_service"),
        opening_line=enrichment.get("opening_line"),
        lead_score=(enrichment.get("lead_score") or "").upper() or None,
        score_value=enrichment.get("score_value"),
        confidence=enrichment.get("confidence"),
        subject_line=email.get("subject_line"),
        email_body=email.get("email_body"),
        email_language=email.get("email_language"),
        sign_off=email.get("sign_off"),
        send_best_day=strategy.get("send_best_day"),
        send_best_time=strategy.get("send_best_time"),
        send_rationale=strategy.get("send_rationale"),
        channel_primary=strategy.get("channel_primary"),
        channel_fallback=strategy.get("channel_fallback"),
        raw_response=result_data.get("raw_response"),
        error=result_data.get("error"),
    )
    db.add(result)
    db.flush()

    for followup in result_data.get("follow_ups", [])[:5]:
        day = int(followup.get("day") or 0)
        if day <= 0 or not followup.get("message"):
            continue
        db.add(
            OutreachFollowUp(
                result_id=result.id,
                prospect_id=prospect.id,
                day=day,
                message=str(followup["message"]),
                scheduled_for=scheduled_followup_date(day),
            )
        )

    prospect.validation_status = validation.get("record_quality") or "Partial"
    prospect.validation_reason = validation.get("validation_reason") or validation.get("skip_reason")
    prospect.decision_maker_name = enrichment.get("decision_maker_name")
    prospect.decision_maker_role = enrichment.get("decision_maker_title")
    prospect.pain_point = enrichment.get("pain_point")
    prospect.recommended_service = enrichment.get("best_service")
    prospect.lead_temperature = result.lead_score
    prospect.score = result.score_value
    prospect.score_explanation = enrichment.get("score_explanation")
    prospect.email_subject = result.subject_line
    prospect.email_body = result.email_body
    prospect.email_language = result.email_language
    prospect.recommended_send_time = " ".join(
        part for part in [result.send_best_day, result.send_best_time] if part
    ) or None
    prospect.recommended_channel = result.channel_primary
    prospect.processing_status = "Failed" if result.error and not result.email_body else "Processed"
    prospect.processed_at = datetime.now(timezone.utc)
    db.add(prospect)
    return result


@router.get("/prospects", response_model=ProspectListResponse)
@router.get("/prospects/", response_model=ProspectListResponse, include_in_schema=False)
def list_prospects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    size: int = Query(25, ge=1, le=100),
    search: Optional[str] = None,
    lead_temperature: Optional[str] = None,
    processing_status: Optional[str] = None,
    validation_status: Optional[str] = None,
    source: Optional[str] = None,
) -> Any:
    query = _scope_prospects(db.query(Prospect), current_user)

    if search:
        search_like = f"%{search}%"
        query = query.filter(
            or_(
                Prospect.company_name.ilike(search_like),
                Prospect.contact_name.ilike(search_like),
                Prospect.email.ilike(search_like),
                Prospect.phone.ilike(search_like),
                Prospect.location.ilike(search_like),
                Prospect.notes.ilike(search_like),
            )
        )
    if lead_temperature:
        query = query.filter(Prospect.lead_temperature == lead_temperature.upper())
    if processing_status:
        query = query.filter(Prospect.processing_status == processing_status)
    if validation_status:
        query = query.filter(Prospect.validation_status == validation_status)
    if source:
        query = query.filter(Prospect.source == source)

    total = query.count()
    items = query.order_by(Prospect.created_at.desc()).offset((page - 1) * size).limit(size).all()
    return {"items": items, "total": total, "page": page, "size": size}


@router.post("/prospects", response_model=ProspectResponse)
def create_prospect(
    prospect_in: ProspectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    owner_id = _get_owner_id(db, current_user, prospect_in.owner_id)
    data = prospect_in.model_dump()
    data["owner_id"] = owner_id
    prospect = Prospect(**data)
    db.add(prospect)
    _audit(db, current_user.id, "Prospect Create", "POST /outreach/prospects", f"Created prospect {prospect.company_name}")
    db.commit()
    db.refresh(prospect)
    return prospect


@router.post("/prospects/import", response_model=ProspectImportResponse)
def import_prospects(
    file: UploadFile = File(...),
    update_existing: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")

    try:
        contents = file.file.read().decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(contents))
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=400, detail="CSV must be UTF-8 encoded") from exc

    summary = {"created": 0, "updated": 0, "skipped": 0, "invalid": 0, "duplicates": 0, "errors": []}
    owner_id = current_user.id

    try:
        for line_number, row in enumerate(reader, start=2):
            company_name = _cell(row, "company_name", "company", "Company Name", "business_name", "Business Name")
            contact_name = _cell(row, "contact_name", "name", "contact", "person")
            email = _cell(row, "email", "Email", "email_address")
            phone = _cell(row, "phone", "Phone", "mobile", "contact_number")
            website = _cell(row, "website", "Website", "url")
            location = _cell(row, "location", "city", "area", "address")
            country = _cell(row, "country")

            if not company_name:
                summary["invalid"] += 1
                summary["errors"].append(f"Line {line_number}: missing company name")
                continue

            duplicate_query = db.query(Prospect).filter(Prospect.owner_id == owner_id)
            if email:
                duplicate_query = duplicate_query.filter(func.lower(Prospect.email) == email.lower())
            else:
                duplicate_query = duplicate_query.filter(
                    func.lower(Prospect.company_name) == company_name.lower(),
                    func.lower(func.coalesce(Prospect.location, "")) == location.lower(),
                )
            existing = duplicate_query.first()
            if existing and not update_existing:
                summary["duplicates"] += 1
                summary["skipped"] += 1
                continue

            data = {
                "company_name": company_name,
                "contact_name": contact_name or None,
                "category": _cell(row, "category", "business_category") or None,
                "industry": _cell(row, "industry", "sector") or None,
                "location": location or None,
                "country": country or None,
                "website": website or None,
                "email": email or None,
                "phone": phone or None,
                "employee_count": _to_int(_cell(row, "employee_count", "employees", "Employee Count", "company_size")),
                "source": _cell(row, "source") or f"CSV: {file.filename}",
                "notes": _cell(row, "notes", "description", "about") or None,
                "owner_id": owner_id,
            }

            if existing:
                for field, value in data.items():
                    setattr(existing, field, value)
                db.add(existing)
                summary["updated"] += 1
            else:
                db.add(Prospect(**data))
                summary["created"] += 1

        _audit(
            db,
            current_user.id,
            "Prospect Import",
            f"POST /outreach/prospects/import {file.filename}",
            f"Created {summary['created']}, updated {summary['updated']}, skipped {summary['skipped']}",
        )
        db.commit()
        return summary
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to import prospects: {str(exc)}") from exc


@router.get("/prospects/{prospect_id}", response_model=ProspectDetailResponse)
def get_prospect(
    prospect_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    prospect = _get_prospect(db, prospect_id, current_user)
    return prospect


@router.put("/prospects/{prospect_id}", response_model=ProspectResponse)
def update_prospect(
    prospect_id: int,
    prospect_in: ProspectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    prospect = _get_prospect(db, prospect_id, current_user)
    update_data = prospect_in.model_dump(exclude_unset=True)
    if "owner_id" in update_data and update_data["owner_id"] is not None:
        update_data["owner_id"] = _get_owner_id(db, current_user, update_data["owner_id"])
    elif current_user.role == "Executive":
        update_data.pop("owner_id", None)

    for field, value in update_data.items():
        setattr(prospect, field, value)
    db.add(prospect)
    _audit(db, current_user.id, "Prospect Update", f"PUT /outreach/prospects/{prospect_id}", f"Updated {prospect.company_name}")
    db.commit()
    db.refresh(prospect)
    return prospect


@router.delete("/prospects/{prospect_id}")
def delete_prospect(
    prospect_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    if not _is_manager(current_user):
        raise HTTPException(status_code=403, detail="Only Admin and Manager users can delete prospects")
    prospect = _get_prospect(db, prospect_id, current_user)
    db.delete(prospect)
    _audit(db, current_user.id, "Prospect Delete", f"DELETE /outreach/prospects/{prospect_id}", f"Deleted {prospect.company_name}")
    db.commit()
    return {"message": "Prospect successfully deleted"}


@router.post("/prospects/{prospect_id}/process", response_model=OutreachResultResponse)
def process_single_prospect(
    prospect_id: int,
    force: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    prospect = _get_prospect(db, prospect_id, current_user)
    if prospect.processing_status == "Processed" and not force:
        latest = (
            db.query(OutreachResult)
            .options(joinedload(OutreachResult.follow_ups))
            .filter(OutreachResult.prospect_id == prospect.id)
            .order_by(OutreachResult.processed_at.desc())
            .first()
        )
        if latest:
            return latest

    result_data = process_prospect(prospect)
    result = _save_result(db, prospect, result_data)
    _audit(db, current_user.id, "Prospect Process", f"POST /outreach/prospects/{prospect_id}/process", f"Processed {prospect.company_name}")
    db.commit()
    db.refresh(result)
    return result


@router.post("/process-batch", response_model=ProcessBatchResponse)
def process_batch(
    request: ProcessBatchRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    sync: bool = Query(False, description="Run synchronously (for tests). Default async 202 with job."),
) -> Any:
    # Sync mode retains original behavior for tests/CI
    if sync:
        query = _scope_prospects(db.query(Prospect), current_user)
        if request.prospect_ids:
            query = query.filter(Prospect.id.in_(request.prospect_ids))
        if not request.force:
            query = query.filter(Prospect.processing_status != "Processed")

        prospects = query.order_by(Prospect.created_at.desc()).limit(request.limit).all()
        processed = failed = skipped = 0
        result_ids = []
        errors = []

        for prospect in prospects:
            try:
                result_data = process_prospect(prospect)
                result = _save_result(db, prospect, result_data)
                db.commit()
                db.refresh(result)
                result_ids.append(result.id)
                processed += 1
            except Exception as exc:
                db.rollback()
                failed += 1
                errors.append(f"{prospect.company_name}: {str(exc)}")

        if request.prospect_ids:
            skipped = max(0, len(request.prospect_ids) - processed - failed)

        _audit(db, current_user.id, "Prospect Batch Process", "POST /outreach/process-batch?sync=true", f"Processed {processed}, failed {failed}, skipped {skipped}")
        db.commit()
        return {"processed": processed, "failed": failed, "skipped": skipped, "result_ids": result_ids, "errors": errors}

    # Async mode — create job and return 202 immediately
    query = _scope_prospects(db.query(Prospect), current_user)
    if request.prospect_ids:
        query = query.filter(Prospect.id.in_(request.prospect_ids))
    if not request.force:
        query = query.filter(Prospect.processing_status != "Processed")
    prospects = query.order_by(Prospect.created_at.desc()).limit(request.limit).all()

    if not prospects:
        return {"processed": 0, "failed": 0, "skipped": len(request.prospect_ids or []), "result_ids": [], "errors": []}

    job = OutreachJob(
        status="queued",
        total=len(prospects),
        processed=0,
        failed=0,
        skipped=0,
        result_ids=[],
        errors={"prospect_ids": [p.id for p in prospects]} if request.prospect_ids else [],
        created_by=current_user.id,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    # Enqueue background task
    from app.services.outreach_job_service import run_outreach_job

    background_tasks.add_task(run_outreach_job, job.id)

    _audit(db, current_user.id, "Prospect Batch Async", "POST /outreach/process-batch", f"Queued job {job.id} for {len(prospects)} prospects")
    db.commit()
    # Return 202-style payload but keep ProcessBatchResponse for compat; include job hint in errors
    return {"processed": 0, "failed": 0, "skipped": 0, "result_ids": [job.id], "errors": [f"Async job {job.id} queued for {len(prospects)} prospects"]}


@router.get("/jobs", response_model=OutreachJobListResponse)
def list_jobs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    size: int = Query(25, ge=1, le=100),
) -> Any:
    query = db.query(OutreachJob)
    if current_user.role == "Executive":
        query = query.filter(OutreachJob.created_by == current_user.id)
    total = query.count()
    items = query.order_by(OutreachJob.created_at.desc()).offset((page - 1) * size).limit(size).all()
    return {"items": items, "total": total}


@router.get("/jobs/{job_id}", response_model=OutreachJobResponse)
def get_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    job = db.query(OutreachJob).filter(OutreachJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if current_user.role == "Executive" and job.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this job")
    return job


@router.get("/results", response_model=list[OutreachResultResponse])
def list_results(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lead_score: Optional[str] = None,
    page: int = Query(1, ge=1),
    size: int = Query(25, ge=1, le=100),
) -> Any:
    query = _scope_results(
        db.query(OutreachResult).options(joinedload(OutreachResult.follow_ups)),
        current_user,
    )
    if lead_score:
        query = query.filter(OutreachResult.lead_score == lead_score.upper())
    return query.order_by(OutreachResult.processed_at.desc()).offset((page - 1) * size).limit(size).all()


@router.get("/emails/preview/{result_id}", response_model=EmailPreviewResponse)
def preview_email(
    result_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    result = _get_result(db, result_id, current_user)
    return build_email_preview(result)


@router.post("/emails/send", response_model=EmailSendResponse)
def send_single_email(
    request: EmailSendRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    result = _get_result(db, request.result_id, current_user)
    preview = build_email_preview(result)

    if not preview.get("to_email") and not request.dry_run:
        raise HTTPException(status_code=400, detail="Prospect has no email address")

    duplicate = (
        db.query(OutreachSendLog)
        .filter(
            OutreachSendLog.prospect_id == result.prospect_id,
            OutreachSendLog.status == "sent",
            OutreachSendLog.dry_run == False,
        )
        .first()
    )
    if duplicate and not request.force and not request.dry_run:
        raise HTTPException(status_code=409, detail="A live email was already sent to this prospect. Use force=true to resend.")

    try:
        send_result = send_email(preview, dry_run=request.dry_run)
        log = OutreachSendLog(
            result_id=result.id,
            prospect_id=result.prospect_id,
            user_id=current_user.id,
            to_email=preview["to_email"],
            company_name=preview["company_name"],
            subject=preview["subject"],
            lead_score=preview["lead_score"],
            status=send_result["status"],
            provider=send_result["provider"],
            dry_run=request.dry_run,
        )
        db.add(log)
        _audit(db, current_user.id, "Outreach Email Send", "POST /outreach/emails/send", f"{send_result['status']} for {preview['company_name']}")
        db.commit()
        db.refresh(log)
        return {
            "status": log.status,
            "provider": log.provider or "unknown",
            "dry_run": log.dry_run,
            "log_id": log.id,
            "preview": preview,
        }
    except Exception as exc:
        db.rollback()
        log = OutreachSendLog(
            result_id=result.id,
            prospect_id=result.prospect_id,
            user_id=current_user.id,
            to_email=preview["to_email"],
            company_name=preview["company_name"],
            subject=preview["subject"],
            lead_score=preview["lead_score"],
            status="failed",
            provider="unknown",
            dry_run=request.dry_run,
            error_message=str(exc),
        )
        db.add(log)
        db.commit()
        raise HTTPException(status_code=400, detail=f"Email send failed: {str(exc)}") from exc


@router.post("/emails/send-batch", response_model=BatchEmailSendResponse)
def send_batch_email(
    request: BatchEmailSendRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    query = _scope_results(
        db.query(OutreachResult).options(joinedload(OutreachResult.prospect), joinedload(OutreachResult.follow_ups)),
        current_user,
    )
    if request.result_ids:
        query = query.filter(OutreachResult.id.in_(request.result_ids))
    if request.lead_score:
        query = query.filter(OutreachResult.lead_score == request.lead_score)

    results = query.order_by(OutreachResult.processed_at.desc()).limit(request.limit).all()
    sent = failed = skipped = 0
    logs = []
    errors = []

    for result in results:
        if not result.prospect.email and not request.dry_run:
            skipped += 1
            continue
        duplicate = (
            db.query(OutreachSendLog)
            .filter(
                OutreachSendLog.prospect_id == result.prospect_id,
                OutreachSendLog.status == "sent",
                OutreachSendLog.dry_run == False,
            )
            .first()
        )
        if duplicate and not request.force and not request.dry_run:
            skipped += 1
            continue
        try:
            preview = build_email_preview(result)
            send_result = send_email(preview, dry_run=request.dry_run)
            log = OutreachSendLog(
                result_id=result.id,
                prospect_id=result.prospect_id,
                user_id=current_user.id,
                to_email=preview["to_email"],
                company_name=preview["company_name"],
                subject=preview["subject"],
                lead_score=preview["lead_score"],
                status=send_result["status"],
                provider=send_result["provider"],
                dry_run=request.dry_run,
            )
            db.add(log)
            db.commit()
            db.refresh(log)
            logs.append(log.id)
            sent += 1
        except Exception as exc:
            db.rollback()
            failed += 1
            errors.append(f"Result {result.id}: {str(exc)}")

    _audit(db, current_user.id, "Outreach Batch Email", "POST /outreach/emails/send-batch", f"Sent {sent}, failed {failed}, skipped {skipped}")
    db.commit()
    return {"sent": sent, "failed": failed, "skipped": skipped, "logs": logs, "errors": errors}


@router.get("/send-log", response_model=list[OutreachSendLogResponse])
def get_send_log(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    size: int = Query(25, ge=1, le=100),
) -> Any:
    query = _scope_logs(db.query(OutreachSendLog), current_user)
    return query.order_by(OutreachSendLog.sent_at.desc()).offset((page - 1) * size).limit(size).all()


@router.get("/follow-ups", response_model=list[OutreachFollowUpResponse])
def get_follow_ups(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    status: Optional[str] = None,
    due_only: bool = Query(False),
    limit: int = Query(50, ge=1, le=200),
) -> Any:
    query = db.query(OutreachFollowUp).join(Prospect, OutreachFollowUp.prospect_id == Prospect.id)
    if current_user.role == "Executive":
        query = query.filter(Prospect.owner_id == current_user.id)
    if status:
        query = query.filter(OutreachFollowUp.status == status)
    if due_only:
        query = query.filter(
            OutreachFollowUp.status == "Pending",
            OutreachFollowUp.scheduled_for <= datetime.now(timezone.utc),
        )
    return query.order_by(OutreachFollowUp.scheduled_for.asc()).limit(limit).all()


@router.post("/prospects/{prospect_id}/convert", response_model=ProspectConvertResponse)
def convert_prospect(
    prospect_id: int,
    request: ProspectConvertRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    prospect = _get_prospect(db, prospect_id, current_user)
    if prospect.converted_lead_id:
        lead = db.query(Lead).filter(Lead.id == prospect.converted_lead_id).first()
        if lead:
            company = db.query(Company).filter(func.lower(Company.name) == prospect.company_name.lower()).first()
            return {
                "prospect_id": prospect.id,
                "lead_id": lead.id,
                "company_id": company.id if company else 0,
                "contact_id": None,
                "deal_id": None,
                "status": "Already Converted",
            }

    try:
        company = db.query(Company).filter(func.lower(Company.name) == prospect.company_name.lower()).first()
        if not company:
            company = Company(
                name=prospect.company_name,
                industry=prospect.industry or prospect.category,
                website=prospect.website,
                employee_count=prospect.employee_count,
            )
            db.add(company)
            db.flush()

        contact = None
        if prospect.email:
            contact = (
                db.query(Contact)
                .filter(Contact.company_id == company.id, func.lower(Contact.email) == prospect.email.lower())
                .first()
            )
        if not contact:
            contact = Contact(
                name=prospect.contact_name or prospect.decision_maker_name or prospect.company_name,
                email=prospect.email,
                phone=prospect.phone,
                company_id=company.id,
            )
            db.add(contact)
            db.flush()

        lead = Lead(
            name=prospect.contact_name or prospect.decision_maker_name or prospect.company_name,
            company_name=prospect.company_name,
            industry=prospect.industry or prospect.category,
            website=prospect.website,
            email=prospect.email,
            phone=prospect.phone,
            country=prospect.country,
            employee_count=prospect.employee_count,
            source=f"Cold Outreach: {prospect.source}",
            status="Contacted" if db.query(OutreachSendLog).filter(OutreachSendLog.prospect_id == prospect.id).count() else "New",
            owner_id=prospect.owner_id or current_user.id,
            notes="\n\n".join(
                part
                for part in [
                    prospect.notes,
                    f"Outreach score: {prospect.lead_temperature or 'Unscored'} ({prospect.score or 0})",
                    f"Pain point: {prospect.pain_point}" if prospect.pain_point else None,
                    f"Recommended service: {prospect.recommended_service}" if prospect.recommended_service else None,
                ]
                if part
            ),
            lead_score=prospect.score,
        )
        db.add(lead)
        db.flush()

        deal_id = None
        if request.create_deal:
            deal = Deal(
                title=request.deal_title or f"{prospect.company_name} - {prospect.recommended_service or 'Outreach Opportunity'}",
                value=request.deal_value,
                stage=request.deal_stage,
                lead_id=lead.id,
                owner_id=lead.owner_id,
            )
            db.add(deal)
            db.flush()
            deal_id = deal.id

        activity = Activity(
            type="Note",
            description=f"Converted from outreach prospect by {current_user.full_name}",
            lead_id=lead.id,
            user_id=current_user.id,
        )
        db.add(activity)

        prospect.converted_lead_id = lead.id
        prospect.conversion_status = "Converted"
        prospect.converted_at = datetime.now(timezone.utc)
        db.add(prospect)
        _audit(db, current_user.id, "Prospect Convert", f"POST /outreach/prospects/{prospect_id}/convert", f"Converted to lead {lead.id}")
        db.commit()

        return {
            "prospect_id": prospect.id,
            "lead_id": lead.id,
            "company_id": company.id,
            "contact_id": contact.id if contact else None,
            "deal_id": deal_id,
            "status": "Converted",
        }
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Conversion failed: {str(exc)}") from exc


@router.get("/stats", response_model=OutreachStatsResponse)
@router.get("/stats/", response_model=OutreachStatsResponse, include_in_schema=False)
def get_outreach_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    prospects = _scope_prospects(db.query(Prospect), current_user)
    results = _scope_results(db.query(OutreachResult), current_user)
    logs = _scope_logs(db.query(OutreachSendLog), current_user)
    followups = db.query(OutreachFollowUp).join(Prospect, OutreachFollowUp.prospect_id == Prospect.id)
    if current_user.role == "Executive":
        followups = followups.filter(Prospect.owner_id == current_user.id)

    return {
        "total_prospects": prospects.count(),
        "processed": prospects.filter(Prospect.processing_status == "Processed").count(),
        "valid": prospects.filter(Prospect.validation_status == "Valid").count(),
        "hot": prospects.filter(Prospect.lead_temperature == "HOT").count(),
        "warm": prospects.filter(Prospect.lead_temperature == "WARM").count(),
        "cold": prospects.filter(Prospect.lead_temperature == "COLD").count(),
        "emails_generated": results.filter(OutreachResult.email_body.isnot(None)).count(),
        "emails_sent": logs.filter(OutreachSendLog.status == "sent", OutreachSendLog.dry_run == False).count(),
        "dry_runs": logs.filter(OutreachSendLog.status == "dry_run").count(),
        "followups_due": followups.filter(
            OutreachFollowUp.status == "Pending",
            OutreachFollowUp.scheduled_for <= datetime.now(timezone.utc),
        ).count(),
        "converted": prospects.filter(Prospect.conversion_status == "Converted").count(),
    }


@router.get("/export/csv")
def export_prospects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    prospects = _scope_prospects(db.query(Prospect), current_user).order_by(Prospect.created_at.desc()).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "Company",
            "Contact",
            "Email",
            "Phone",
            "Industry",
            "Location",
            "Temperature",
            "Score",
            "Validation",
            "Recommended Service",
            "Subject",
            "Send Time",
            "Conversion Status",
        ]
    )
    for prospect in prospects:
        writer.writerow(
            [
                prospect.company_name,
                prospect.contact_name or "",
                prospect.email or "",
                prospect.phone or "",
                prospect.industry or prospect.category or "",
                prospect.location or "",
                prospect.lead_temperature or "",
                prospect.score or "",
                prospect.validation_status,
                prospect.recommended_service or "",
                prospect.email_subject or "",
                prospect.recommended_send_time or "",
                prospect.conversion_status,
            ]
        )

    _audit(db, current_user.id, "Prospect Export", "GET /outreach/export/csv", f"Exported {len(prospects)} prospects")
    db.commit()
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=outreach_prospects.csv"},
    )
