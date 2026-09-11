from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Text, Boolean, JSON
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.core.database import Base

class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    industry = Column(String, nullable=True)
    website = Column(String, nullable=True)
    employee_count = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    contacts = relationship("Contact", back_populates="company", cascade="all, delete-orphan")

class Contact(Base):
    __tablename__ = "contacts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    company = relationship("Company", back_populates="contacts")

class Lead(Base):
    __tablename__ = "leads"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    company_name = Column(String, nullable=True)
    industry = Column(String, nullable=True)
    website = Column(String, nullable=True)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    country = Column(String, nullable=True)
    employee_count = Column(Integer, nullable=True)
    source = Column(String, nullable=True)  # Website, Referral, Cold Reachout, Event, etc.
    status = Column(String, default="New", nullable=False)  # New, Contacted, Qualified, Lost
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    notes = Column(Text, nullable=True)
    lead_score = Column(Float, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    owner = relationship("User")
    deals = relationship("Deal", back_populates="lead", cascade="all, delete-orphan")
    activities = relationship("Activity", back_populates="lead", cascade="all, delete-orphan")

class Deal(Base):
    __tablename__ = "deals"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    value = Column(Float, nullable=False, default=0.0)
    stage = Column(String, default="New", nullable=False)  # New, Contacted, Proposal, Negotiation, Won, Lost
    lead_id = Column(Integer, ForeignKey("leads.id", ondelete="CASCADE"), nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    closed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    lead = relationship("Lead", back_populates="deals")
    owner = relationship("User")

class Activity(Base):
    __tablename__ = "activities"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(String, nullable=False)  # Call, Email, Meeting, Task, Note
    description = Column(Text, nullable=False)
    lead_id = Column(Integer, ForeignKey("leads.id", ondelete="CASCADE"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    lead = relationship("Lead", back_populates="activities")
    user = relationship("User")

class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    due_date = Column(DateTime, nullable=True)
    priority = Column(String, default="Medium")  # Low, Medium, High
    status = Column(String, default="Pending")  # Pending, Completed
    recurring = Column(String, default="None")  # None, Daily, Weekly, Monthly
    assigned_to_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    lead_id = Column(Integer, ForeignKey("leads.id", ondelete="CASCADE"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    assigned_to = relationship("User")
    lead = relationship("Lead")

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    read = Column(Boolean, default=False)
    type = Column(String, default="info")  # info, success, warning, alert
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User")

class MeetingSummary(Base):
    __tablename__ = "meeting_summaries"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    transcript = Column(Text, nullable=False)
    summary = Column(Text, nullable=True)
    decisions = Column(Text, nullable=True)
    action_items = Column(Text, nullable=True)
    risks = Column(Text, nullable=True)
    lead_id = Column(Integer, ForeignKey("leads.id", ondelete="CASCADE"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    lead = relationship("Lead")
    user = relationship("User")

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    query_type = Column(String, nullable=False) # e.g. Assistant SQL Query, Export
    raw_query = Column(Text, nullable=False)
    result_summary = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User")

class Prospect(Base):
    __tablename__ = "prospects"

    id = Column(Integer, primary_key=True, index=True)
    company_name = Column(String, index=True, nullable=False)
    contact_name = Column(String, nullable=True)
    category = Column(String, nullable=True)
    industry = Column(String, nullable=True)
    location = Column(String, nullable=True)
    country = Column(String, nullable=True)
    website = Column(String, nullable=True)
    email = Column(String, index=True, nullable=True)
    phone = Column(String, nullable=True)
    employee_count = Column(Integer, nullable=True)
    source = Column(String, default="Cold Outreach", nullable=False)
    notes = Column(Text, nullable=True)

    validation_status = Column(String, default="Unprocessed", nullable=False)
    validation_reason = Column(Text, nullable=True)
    decision_maker_name = Column(String, nullable=True)
    decision_maker_role = Column(String, nullable=True)
    pain_point = Column(Text, nullable=True)
    recommended_service = Column(String, nullable=True)
    lead_temperature = Column(String, nullable=True)
    score = Column(Float, nullable=True)
    score_explanation = Column(Text, nullable=True)

    email_subject = Column(String, nullable=True)
    email_body = Column(Text, nullable=True)
    email_language = Column(String, nullable=True)
    recommended_send_time = Column(String, nullable=True)
    recommended_channel = Column(String, nullable=True)

    processing_status = Column(String, default="Unprocessed", nullable=False)
    processed_at = Column(DateTime, nullable=True)
    conversion_status = Column(String, default="Not Converted", nullable=False)
    converted_lead_id = Column(Integer, ForeignKey("leads.id", ondelete="SET NULL"), nullable=True)
    converted_at = Column(DateTime, nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    owner = relationship("User")
    converted_lead = relationship("Lead")
    results = relationship("OutreachResult", back_populates="prospect", cascade="all, delete-orphan")
    follow_ups = relationship("OutreachFollowUp", back_populates="prospect", cascade="all, delete-orphan")
    send_logs = relationship("OutreachSendLog", back_populates="prospect", cascade="all, delete-orphan")

class OutreachResult(Base):
    __tablename__ = "outreach_results"

    id = Column(Integer, primary_key=True, index=True)
    prospect_id = Column(Integer, ForeignKey("prospects.id", ondelete="CASCADE"), nullable=False)
    record_quality = Column(String, nullable=True)
    is_real_business = Column(Boolean, default=False)
    has_it_context = Column(Boolean, default=False)
    has_contact_channel = Column(Boolean, default=False)
    in_service_area = Column(Boolean, default=True)
    skip_reason = Column(Text, nullable=True)

    decision_maker_title = Column(String, nullable=True)
    company_size = Column(String, nullable=True)
    industry_segment = Column(String, nullable=True)
    pain_point = Column(Text, nullable=True)
    best_service = Column(String, nullable=True)
    upsell_service = Column(String, nullable=True)
    opening_line = Column(Text, nullable=True)
    lead_score = Column(String, nullable=True)
    score_value = Column(Float, nullable=True)
    confidence = Column(Float, nullable=True)

    subject_line = Column(String, nullable=True)
    email_body = Column(Text, nullable=True)
    email_language = Column(String, nullable=True)
    sign_off = Column(Text, nullable=True)
    send_best_day = Column(String, nullable=True)
    send_best_time = Column(String, nullable=True)
    send_rationale = Column(Text, nullable=True)
    channel_primary = Column(String, nullable=True)
    channel_fallback = Column(String, nullable=True)
    raw_response = Column(JSON, nullable=True)
    error = Column(Text, nullable=True)
    processed_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    prospect = relationship("Prospect", back_populates="results")
    follow_ups = relationship("OutreachFollowUp", back_populates="result", cascade="all, delete-orphan")
    send_logs = relationship("OutreachSendLog", back_populates="result", cascade="all, delete-orphan")

class OutreachFollowUp(Base):
    __tablename__ = "outreach_follow_ups"

    id = Column(Integer, primary_key=True, index=True)
    result_id = Column(Integer, ForeignKey("outreach_results.id", ondelete="CASCADE"), nullable=False)
    prospect_id = Column(Integer, ForeignKey("prospects.id", ondelete="CASCADE"), nullable=False)
    day = Column(Integer, nullable=False)
    message = Column(Text, nullable=False)
    channel = Column(String, default="Email", nullable=False)
    status = Column(String, default="Pending", nullable=False)
    scheduled_for = Column(DateTime, nullable=True)
    sent_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    result = relationship("OutreachResult", back_populates="follow_ups")
    prospect = relationship("Prospect", back_populates="follow_ups")

class OutreachSendLog(Base):
    __tablename__ = "outreach_send_logs"

    id = Column(Integer, primary_key=True, index=True)
    result_id = Column(Integer, ForeignKey("outreach_results.id", ondelete="SET NULL"), nullable=True)
    prospect_id = Column(Integer, ForeignKey("prospects.id", ondelete="SET NULL"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    to_email = Column(String, nullable=True)
    company_name = Column(String, nullable=True)
    subject = Column(String, nullable=True)
    lead_score = Column(String, nullable=True)
    status = Column(String, nullable=False)
    provider = Column(String, nullable=True)
    dry_run = Column(Boolean, default=True)
    error_message = Column(Text, nullable=True)
    sent_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    result = relationship("OutreachResult", back_populates="send_logs")
    prospect = relationship("Prospect", back_populates="send_logs")
    user = relationship("User")


class OutreachJob(Base):
    __tablename__ = "outreach_jobs"

    id = Column(Integer, primary_key=True, index=True)
    status = Column(String, nullable=False, default="queued")  # queued, running, completed, failed
    total = Column(Integer, nullable=False, default=0)
    processed = Column(Integer, nullable=False, default=0)
    failed = Column(Integer, nullable=False, default=0)
    skipped = Column(Integer, nullable=False, default=0)
    result_ids = Column(JSON, nullable=True)
    errors = Column(JSON, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    started_at = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)

    creator = relationship("User")

