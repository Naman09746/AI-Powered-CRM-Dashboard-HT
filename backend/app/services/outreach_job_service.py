from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.crm import OutreachJob, Prospect
from app.services.outreach_service import process_prospect


def _get_scoped_prospects(db: Session, user, prospect_ids: Optional[List[int]], limit: int, force: bool):
    from app.models.crm import Prospect

    query = db.query(Prospect)
    # RBAC: Executives only see own
    if user.role == "Executive":
        query = query.filter(Prospect.owner_id == user.id)
    if prospect_ids:
        query = query.filter(Prospect.id.in_(prospect_ids))
    if not force:
        query = query.filter(Prospect.processing_status != "Processed")
    return query.order_by(Prospect.created_at.desc()).limit(limit).all()


def _save_result(db: Session, prospect: Prospect, result_data: dict):
    # Import here to avoid circular
    from app.routers.outreach import _save_result as outreach_save
    return outreach_save(db, prospect, result_data)


def run_outreach_job(job_id: int):
    """
    Background job runner — synchronous, runs in BackgroundTasks thread.
    Creates its own DB session to avoid sharing request-scoped session.
    """
    db = SessionLocal()
    try:
        job = db.query(OutreachJob).filter(OutreachJob.id == job_id).first()
        if not job:
            return
        job.status = "running"
        job.started_at = datetime.now(timezone.utc)
        db.commit()

        # Retrieve creator for scoping
        from app.models.user import User
        user = db.query(User).filter(User.id == job.created_by).first()
        # Fallback to admin-like scoping if user missing
        if not user:
            class _FallbackUser:
                role = "Admin"
                id = job.created_by
            user = _FallbackUser()  # type: ignore

        # Reconstruct prospect_ids from job.errors? Actually we stored total but need IDs.
        # For simplicity, re-query using same logic as job creation: we stored prospect_ids in result_ids initially empty,
        # so we need to re-derive. We store errors/result_ids as JSON; for pending we re-query.
        # Instead, we will fetch prospects that were intended: if job.result_ids is None, query again.
        # To preserve exact set, job creation should have stored prospect_ids in errors field temporarily.
        # Simpler: job creation stores prospect_ids in result_ids placeholder.
        # Check if job has _prospect_ids in errors (hack) — instead we will query again with same force/limit logic
        # For determinism, we re-query with limit=job.total and force=False (as stored)
        # Note: This is eventually consistent; for targeted prospect_ids we need to store them.
        # We'll store prospect_ids in job.errors initially if provided, then move.
        prospect_ids = None
        # If job.errors contains {"prospect_ids": [...]}, use it
        if job.errors and isinstance(job.errors, dict) and "prospect_ids" in job.errors:
            prospect_ids = job.errors.get("prospect_ids")
            # Clear placeholder
            job.errors = []

        prospects = _get_scoped_prospects(db, user, prospect_ids, job.total, False)
        # Adjust total if we found fewer
        if len(prospects) < job.total:
            job.total = len(prospects)

        result_ids: List[int] = []
        errors: List[str] = []
        processed = 0
        failed = 0

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
            # Update job progress every iteration
            job.processed = processed
            job.failed = failed
            job.result_ids = result_ids
            job.errors = errors
            db.commit()

        job.status = "completed"
        job.finished_at = datetime.now(timezone.utc)
        job.processed = processed
        job.failed = failed
        job.result_ids = result_ids
        job.errors = errors
        db.commit()
    except Exception as exc:
        # Mark job failed
        try:
            job = db.query(OutreachJob).filter(OutreachJob.id == job_id).first()
            if job:
                job.status = "failed"
                job.finished_at = datetime.now(timezone.utc)
                if job.errors is None:
                    job.errors = []
                if isinstance(job.errors, list):
                    job.errors.append(f"Job failed: {str(exc)}")
                db.commit()
        except Exception:
            pass
    finally:
        db.close()
