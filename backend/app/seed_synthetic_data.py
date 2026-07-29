import csv
import os
import random
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import Base, engine
from app.core.security import get_password_hash
from app.models.crm import (
    Activity,
    Company,
    Contact,
    Deal,
    Lead,
    MeetingSummary,
    OutreachFollowUp,
    OutreachResult,
    OutreachSendLog,
    Prospect,
    Task,
)
from app.models.user import User


PROJECT_ROOT = Path(__file__).resolve().parents[2]
CSV_PATH = PROJECT_ROOT / "HT COLD OUTREACH" / "prospects_dataset.csv"
TARGET_PROSPECTS = int(os.getenv("DEMO_TARGET_PROSPECTS", "80"))
TARGET_COMPANIES = int(os.getenv("DEMO_TARGET_COMPANIES", "25"))
TARGET_LEADS = int(os.getenv("DEMO_TARGET_LEADS", "25"))

INDIAN_NAMES = [
    "Aarav Mehta",
    "Ananya Verma",
    "Vikram Singh",
    "Meera Joshi",
    "Amit Malhotra",
    "Sunita Agarwal",
    "Dr. S. K. Gupta",
    "Pooja Sharma",
    "Rohan Mehta",
    "Kavita Rao",
    "Sanjay Patel",
    "Deepak Saxena",
    "Nisha Mittal",
    "Arjun Nair",
    "Neha Kapoor",
    "Vikas Bansal",
    "Siddharth Roy",
    "Ritu Chaudhary",
    "Manish Bhardwaj",
    "Shweta Tripathi",
]

SERVICES = [
    ("Custom CRM / ERP Development", "manual enquiry tracking and fragmented operations", 320000, 950000),
    ("Website Design & Development", "outdated digital presence and weak enquiry capture", 65000, 320000),
    ("E-commerce Development", "limited online ordering and payment workflows", 180000, 680000),
    ("Digital Marketing & SEO", "low local search visibility and inconsistent lead flow", 45000, 280000),
    ("Mobile App Development", "poor repeat-customer engagement on mobile", 260000, 880000),
    ("Cloud, DevOps & Automation", "manual deployment, backups, and uptime risk", 120000, 580000),
    ("Cybersecurity & IT Support", "security, backup, and IT maintenance gaps", 95000, 450000),
]

CATEGORY_SERVICE_HINTS = {
    "Hospital": SERVICES[0],
    "School": SERVICES[1],
    "Restaurant": SERVICES[2],
    "Hotel": SERVICES[1],
    "Clinic": SERVICES[0],
    "Retail": SERVICES[2],
    "Salon": SERVICES[3],
    "Gym": SERVICES[4],
    "Institute": SERVICES[1],
}

SOURCES = [
    "Cold Outreach CSV",
    "Google Local Search",
    "LinkedIn Outbound",
    "Referral Network",
    "Website Enquiry",
    "Delhi NCR Field Research",
]

STAGES = ["Won", "Won", "Negotiation", "Proposal", "Contacted", "New", "Lost"]
LEAD_STATUSES = ["Qualified", "Qualified", "Contacted", "Contacted", "New", "Lost"]


def _seeded_random() -> random.Random:
    return random.Random(42)


def _clean(value: Optional[str]) -> str:
    return (value or "").strip()


def _domain(company_name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "", company_name.lower())[:22] or "business"
    return f"{slug}.co.in"


def _city_from_location(location: str) -> str:
    lowered = location.lower()
    for city in ["Noida", "Gurugram", "Delhi", "Faridabad", "Ghaziabad", "Rohini", "Dwarka"]:
        if city.lower() in lowered:
            return city
    return "Delhi NCR"


def _service_for(category: str, notes: str, randomizer: random.Random) -> tuple[str, str, int, int]:
    for key, service in CATEGORY_SERVICE_HINTS.items():
        if key.lower() in category.lower():
            return service
    combined = f"{category} {notes}".lower()
    if "rating" in combined and "no website" in combined:
        return SERVICES[1]
    if "large" in combined or "hospital" in combined:
        return SERVICES[0]
    return randomizer.choice(SERVICES)


def _score_for(row: dict, service_name: str, randomizer: random.Random) -> tuple[float, str]:
    score = randomizer.randint(38, 72)
    if _clean(row.get("email")):
        score += 10
    if _clean(row.get("phone")):
        score += 6
    if _clean(row.get("website")):
        score += 6
    notes = _clean(row.get("notes")).lower()
    if "large" in notes or "well-known" in notes:
        score += 9
    if "no website" in notes:
        score += 7
    if service_name in {"Custom CRM / ERP Development", "E-commerce Development"}:
        score += 4
    score = float(max(30, min(98, score)))
    if score >= 80:
        return score, "HOT"
    if score >= 60:
        return score, "WARM"
    return score, "COLD"


def _read_prospect_rows() -> list[dict]:
    if not CSV_PATH.exists():
        return []
    rows: list[dict] = []
    with CSV_PATH.open("r", encoding="utf-8-sig", errors="ignore", newline="") as csv_file:
        reader = csv.DictReader(csv_file)
        for row in reader:
            company_name = _clean(row.get("company_name") or row.get("company"))
            if company_name:
                rows.append(row)
    return rows


def _ensure_users(db: Session) -> list[User]:
    users = [
        ("admin@crm.com", "Admin123!", "Rohit Admin", "Admin"),
        ("manager@crm.com", "Manager123!", "Priya Manager", "Manager"),
        ("exec@crm.com", "Exec123!", "Rahul Executive", "Executive"),
    ]
    created: list[User] = []
    for email, password, full_name, role in users:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            user = User(
                email=email,
                hashed_password=get_password_hash(password),
                full_name=full_name,
                role=role,
            )
            db.add(user)
            db.flush()
        created.append(user)
    db.commit()
    return created


def _clear_demo_data(db: Session) -> None:
    for model in [
        OutreachSendLog,
        OutreachFollowUp,
        OutreachResult,
        Prospect,
        MeetingSummary,
        Task,
        Activity,
        Deal,
        Lead,
        Contact,
        Company,
    ]:
        db.query(model).delete()
    db.commit()


def _seed_prospects(db: Session, rows: list[dict], users: list[User], randomizer: random.Random) -> list[Prospect]:
    now = datetime.now(timezone.utc)
    existing_names = {
        name.lower()
        for (name,) in db.query(Prospect.company_name).all()
        if name
    }
    prospects = db.query(Prospect).order_by(Prospect.id.asc()).all()
    needed = max(0, TARGET_PROSPECTS - len(prospects))
    if needed == 0:
        return prospects

    for row in rows:
        if needed <= 0:
            break
        company_name = _clean(row.get("company_name") or row.get("company"))
        if not company_name or company_name.lower() in existing_names:
            continue

        category = _clean(row.get("category")) or "General Business"
        location = _clean(row.get("location")) or "Delhi NCR"
        notes = _clean(row.get("notes"))
        service_name, pain_point, _, _ = _service_for(category, notes, randomizer)
        score, temperature = _score_for(row, service_name, randomizer)
        email = _clean(row.get("email")) or f"contact@{_domain(company_name)}"
        phone = _clean(row.get("phone")) or f"+91 98{randomizer.randint(10000000, 99999999)}"
        website = _clean(row.get("website")) or f"https://www.{_domain(company_name)}"
        owner = users[len(prospects) % len(users)]
        validation_status = randomizer.choices(["Valid", "Partial", "Invalid"], weights=[76, 19, 5])[0]
        processing_status = randomizer.choices(["Processed", "Unprocessed"], weights=[86, 14])[0]
        created_at = now - timedelta(days=randomizer.randint(3, 150))

        prospect = Prospect(
            company_name=company_name,
            contact_name=randomizer.choice(INDIAN_NAMES),
            category=category,
            industry=category,
            location=location,
            country="India",
            website=website,
            email=email,
            phone=phone,
            employee_count=randomizer.randint(8, 900),
            source=randomizer.choice(SOURCES),
            notes=notes or f"Imported from HT prospects dataset; likely fit for {service_name}.",
            validation_status=validation_status,
            validation_reason="Sufficient company and contact signals." if validation_status == "Valid" else "Needs light enrichment before live send.",
            decision_maker_name=randomizer.choice(INDIAN_NAMES),
            decision_maker_role=randomizer.choice(["Founder", "Managing Director", "Operations Head", "IT Manager", "Principal", "Admin Head"]),
            pain_point=pain_point,
            recommended_service=service_name,
            lead_temperature=temperature,
            score=score,
            score_explanation=f"{temperature} fit based on {category}, contact availability, and {service_name} need.",
            email_subject=f"Improving {company_name}'s growth with {service_name}",
            email_body=f"Hi Team,\n\nI noticed {company_name} in {_city_from_location(location)} and saw an opportunity around {pain_point}. Hamari Technology can help with {service_name} in a practical, phased way.\n\nWould a short discovery call next week be useful?",
            email_language="English with light Indian business tone",
            recommended_send_time=randomizer.choice(["Tuesday 10:30 AM IST", "Wednesday 11:00 AM IST", "Thursday 2:30 PM IST"]),
            recommended_channel="Email" if email else "Phone",
            processing_status=processing_status,
            processed_at=created_at + timedelta(days=randomizer.randint(1, 7)) if processing_status == "Processed" else None,
            owner_id=owner.id,
            created_at=created_at,
        )
        db.add(prospect)
        prospects.append(prospect)
        existing_names.add(company_name.lower())
        needed -= 1

    db.commit()
    return db.query(Prospect).order_by(Prospect.id.asc()).all()


def _seed_outreach_results(db: Session, prospects: list[Prospect], randomizer: random.Random) -> None:
    now = datetime.now(timezone.utc)
    existing_result_ids = {
        prospect_id
        for (prospect_id,) in db.query(OutreachResult.prospect_id).distinct().all()
        if prospect_id
    }

    for prospect in prospects:
        if prospect.processing_status != "Processed" or prospect.id in existing_result_ids:
            continue

        quality = {"Valid": "good", "Partial": "partial", "Invalid": "skip"}.get(prospect.validation_status, "partial")
        result = OutreachResult(
            prospect_id=prospect.id,
            record_quality=quality,
            is_real_business=quality != "skip",
            has_it_context=True,
            has_contact_channel=bool(prospect.email or prospect.phone or prospect.website),
            in_service_area=True,
            skip_reason=None if quality != "skip" else "Low-quality contact context.",
            decision_maker_title=prospect.decision_maker_role,
            company_size=randomizer.choice(["Small Business", "Mid-Market", "Enterprise"]),
            industry_segment=prospect.industry,
            pain_point=prospect.pain_point,
            best_service=prospect.recommended_service,
            upsell_service=randomizer.choice(["Digital Marketing & SEO", "Cloud, DevOps & Automation", "Cybersecurity & IT Support"]),
            opening_line=f"I noticed {prospect.company_name} operates in {_city_from_location(prospect.location or '')}.",
            lead_score=prospect.lead_temperature,
            score_value=prospect.score,
            confidence=round(randomizer.uniform(0.58, 0.94), 2),
            subject_line=prospect.email_subject,
            email_body=prospect.email_body,
            email_language=prospect.email_language,
            sign_off="Regards,\nDharmendra Sharma\nHamari Technology",
            send_best_day=randomizer.choice(["Tuesday", "Wednesday", "Thursday"]),
            send_best_time=randomizer.choice(["10:30 AM - 12:00 PM IST", "11:00 AM - 1:00 PM IST", "2:00 PM - 4:00 PM IST"]),
            send_rationale="Chosen from synthetic engagement model using business-day outreach windows.",
            channel_primary=prospect.recommended_channel or "Email",
            channel_fallback="Phone" if prospect.phone else "LinkedIn",
            raw_response={"mode": "synthetic_seed", "source": "prospects_dataset.csv"},
            processed_at=prospect.processed_at or now - timedelta(days=randomizer.randint(1, 90)),
        )
        db.add(result)
        db.flush()

        for day in [3, 7, 14]:
            db.add(
                OutreachFollowUp(
                    result_id=result.id,
                    prospect_id=prospect.id,
                    day=day,
                    message=f"Following up with {prospect.company_name} about {prospect.recommended_service}.",
                    scheduled_for=result.processed_at + timedelta(days=day),
                    status=randomizer.choices(["Pending", "Completed"], weights=[72, 28])[0],
                )
            )

        if prospect.email and quality != "skip" and randomizer.random() < 0.52:
            status = randomizer.choices(["sent", "sent", "sent", "failed", "dry_run"], weights=[70, 8, 8, 6, 8])[0]
            db.add(
                OutreachSendLog(
                    result_id=result.id,
                    prospect_id=prospect.id,
                    user_id=prospect.owner_id,
                    to_email=prospect.email,
                    company_name=prospect.company_name,
                    subject=result.subject_line,
                    lead_score=result.lead_score,
                    status=status,
                    provider="synthetic" if status != "dry_run" else "dry_run",
                    dry_run=status == "dry_run",
                    error_message="Synthetic bounce simulation" if status == "failed" else None,
                    sent_at=result.processed_at + timedelta(days=randomizer.randint(0, 5), hours=randomizer.randint(1, 7)),
                )
            )

    db.commit()


def _seed_crm_pipeline(db: Session, prospects: list[Prospect], users: list[User], randomizer: random.Random) -> None:
    now = datetime.now(timezone.utc)
    existing_company_count = db.query(Company).count()
    existing_lead_count = db.query(Lead).count()
    if existing_company_count >= TARGET_COMPANIES and existing_lead_count >= TARGET_LEADS:
        return

    existing_companies = {
        name.lower()
        for (name,) in db.query(Company.name).all()
        if name
    }
    companies: list[Company] = []
    for prospect in prospects[: TARGET_COMPANIES * 2]:
        if len(companies) + existing_company_count >= TARGET_COMPANIES:
            break
        if prospect.company_name.lower() in existing_companies:
            continue
        company = Company(
            name=prospect.company_name,
            industry=prospect.industry or prospect.category,
            website=prospect.website,
            employee_count=prospect.employee_count,
            created_at=prospect.created_at,
        )
        db.add(company)
        db.flush()
        companies.append(company)
        existing_companies.add(company.name.lower())
        contact_name = prospect.contact_name or randomizer.choice(INDIAN_NAMES)
        db.add(
            Contact(
                name=contact_name,
                email=prospect.email or f"{contact_name.lower().replace(' ', '.')}@{_domain(company.name)}",
                phone=prospect.phone,
                company_id=company.id,
                created_at=company.created_at,
            )
        )
    db.commit()

    companies_for_leads = db.query(Company).order_by(Company.created_at.desc()).limit(TARGET_LEADS).all()
    existing_lead_companies = {
        name.lower()
        for (name,) in db.query(Lead.company_name).all()
        if name
    }
    leads: list[Lead] = []
    for company in companies_for_leads:
        if db.query(Lead).count() >= TARGET_LEADS:
            break
        if company.name.lower() in existing_lead_companies:
            continue
        owner = users[len(leads) % len(users)]
        lead_name = randomizer.choice(INDIAN_NAMES)
        lead = Lead(
            name=lead_name,
            company_name=company.name,
            industry=company.industry,
            website=company.website,
            email=f"{lead_name.lower().replace(' ', '.')}@{_domain(company.name)}",
            phone=f"+91 98{randomizer.randint(10000000, 99999999)}",
            country="India",
            employee_count=company.employee_count,
            source=randomizer.choice(SOURCES),
            status=randomizer.choice(LEAD_STATUSES),
            owner_id=owner.id,
            notes=f"Synthetic CRM opportunity generated from outreach prospect dataset for {company.industry}.",
            lead_score=float(randomizer.randint(42, 98)),
            created_at=company.created_at,
        )
        db.add(lead)
        db.flush()
        leads.append(lead)
        existing_lead_companies.add(company.name.lower())
    db.commit()

    all_leads = db.query(Lead).order_by(Lead.created_at.desc()).limit(TARGET_LEADS).all()
    if db.query(Deal).count() < TARGET_LEADS:
        for lead in all_leads:
            if db.query(Deal).filter(Deal.lead_id == lead.id).first():
                continue
            service_name, _, min_value, max_value = _service_for(lead.industry or "", lead.notes or "", randomizer)
            stage = randomizer.choice(STAGES)
            created_at = now - timedelta(days=randomizer.randint(5, 390))
            closed_at = None
            if stage in {"Won", "Lost"}:
                closed_at = created_at + timedelta(days=randomizer.randint(8, 45))
                if closed_at > now:
                    closed_at = now - timedelta(days=randomizer.randint(1, 10))
            db.add(
                Deal(
                    title=f"{lead.company_name} - {service_name}",
                    value=float(min(max_value - 1, randomizer.randint(min_value, max_value))),
                    stage=stage,
                    lead_id=lead.id,
                    owner_id=lead.owner_id,
                    created_at=created_at,
                    closed_at=closed_at,
                )
            )
    db.commit()

    if db.query(Task).count() < 120:
        for lead in all_leads[:140]:
            db.add(
                Task(
                    title=f"Follow up with {lead.company_name}",
                    description=f"Review outreach context and send proposal for {lead.company_name}.",
                    due_date=now + timedelta(days=randomizer.randint(-8, 21)),
                    priority=randomizer.choice(["High", "Medium", "Low"]),
                    status=randomizer.choice(["Pending", "Completed"]),
                    assigned_to_id=lead.owner_id,
                    lead_id=lead.id,
                    created_at=now - timedelta(days=randomizer.randint(1, 40)),
                )
            )
            db.add(
                Activity(
                    type=randomizer.choice(["Call", "Email", "Meeting", "Note"]),
                    description=f"Discussed digital growth opportunity with {lead.company_name}.",
                    lead_id=lead.id,
                    user_id=lead.owner_id,
                    created_at=now - timedelta(days=randomizer.randint(1, 80)),
                )
            )
    db.commit()

    if db.query(MeetingSummary).count() < 15 and all_leads:
        for index in range(18):
            lead = all_leads[index % len(all_leads)]
            db.add(
                MeetingSummary(
                    title=f"{lead.company_name} discovery call",
                    transcript=f"Discussed {lead.industry} workflow gaps, timeline, budget, and deployment priorities.",
                    summary=f"{lead.company_name} is evaluating a practical digital transformation project.",
                    decisions="Proceed with phased proposal and technical audit.",
                    action_items="Send scope document, pricing estimate, and implementation timeline.",
                    risks="Legacy process dependencies and stakeholder availability.",
                    lead_id=lead.id,
                    user_id=lead.owner_id,
                    created_at=now - timedelta(days=randomizer.randint(2, 70)),
                )
            )
    db.commit()


def seed_synthetic_crm_data(db: Session) -> None:
    randomizer = _seeded_random()
    Base.metadata.create_all(bind=engine)
    users = _ensure_users(db)

    if os.getenv("RESET_DEMO_DATA") == "1":
        _clear_demo_data(db)
        users = _ensure_users(db)

    rows = _read_prospect_rows()
    if not rows:
        print(f"Prospect CSV not found or empty at {CSV_PATH}")
        return

    prospects = _seed_prospects(db, rows, users, randomizer)
    _seed_outreach_results(db, prospects, randomizer)
    _seed_crm_pipeline(db, prospects, users, randomizer)

    prospect_count = db.query(func.count(Prospect.id)).scalar() or 0
    result_count = db.query(func.count(OutreachResult.id)).scalar() or 0
    log_count = db.query(func.count(OutreachSendLog.id)).scalar() or 0
    print(f"Demo data ready: {prospect_count} prospects, {result_count} outreach results, {log_count} send logs.")
