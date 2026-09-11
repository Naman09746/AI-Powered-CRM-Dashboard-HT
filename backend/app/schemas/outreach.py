from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


LeadTemperature = Literal["HOT", "WARM", "COLD"]
ProcessingStatus = Literal["Unprocessed", "Processed", "Failed"]
ValidationStatus = Literal["Unprocessed", "Valid", "Partial", "Invalid"]


class ProspectBase(BaseModel):
    company_name: str = Field(default="Unknown Company", min_length=1, max_length=200)
    contact_name: Optional[str] = Field(default=None, max_length=200)
    category: Optional[str] = Field(default=None, max_length=120)
    industry: Optional[str] = Field(default=None, max_length=120)
    location: Optional[str] = Field(default=None, max_length=200)
    country: Optional[str] = Field(default=None, max_length=120)
    website: Optional[str] = Field(default=None, max_length=300)
    email: Optional[str] = Field(default=None, max_length=254)
    phone: Optional[str] = Field(default=None, max_length=80)
    employee_count: Optional[int] = Field(default=None, ge=0)
    source: str = Field(default="Cold Outreach", max_length=120)
    notes: Optional[str] = None


class ProspectCreate(ProspectBase):
    owner_id: Optional[int] = None


class ProspectUpdate(BaseModel):
    company_name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    contact_name: Optional[str] = Field(default=None, max_length=200)
    category: Optional[str] = Field(default=None, max_length=120)
    industry: Optional[str] = Field(default=None, max_length=120)
    location: Optional[str] = Field(default=None, max_length=200)
    country: Optional[str] = Field(default=None, max_length=120)
    website: Optional[str] = Field(default=None, max_length=300)
    email: Optional[str] = Field(default=None, max_length=254)
    phone: Optional[str] = Field(default=None, max_length=80)
    employee_count: Optional[int] = Field(default=None, ge=0)
    source: Optional[str] = Field(default=None, max_length=120)
    notes: Optional[str] = None
    owner_id: Optional[int] = None


class OutreachFollowUpResponse(BaseModel):
    id: int
    result_id: int
    prospect_id: int
    day: int
    message: str
    channel: str = "Email"
    status: str = "Pending"
    scheduled_for: Optional[datetime] = None
    sent_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class OutreachResultResponse(BaseModel):
    id: int
    prospect_id: int
    record_quality: Optional[str] = None
    is_real_business: bool = False
    has_it_context: bool = False
    has_contact_channel: bool = False
    in_service_area: bool = True
    skip_reason: Optional[str] = None
    decision_maker_title: Optional[str] = None
    company_size: Optional[str] = None
    industry_segment: Optional[str] = None
    pain_point: Optional[str] = None
    best_service: Optional[str] = None
    upsell_service: Optional[str] = None
    opening_line: Optional[str] = None
    lead_score: Optional[str] = None
    score_value: Optional[float] = None
    confidence: Optional[float] = None
    subject_line: Optional[str] = None
    email_body: Optional[str] = None
    email_language: Optional[str] = None
    sign_off: Optional[str] = None
    send_best_day: Optional[str] = None
    send_best_time: Optional[str] = None
    send_rationale: Optional[str] = None
    channel_primary: Optional[str] = None
    channel_fallback: Optional[str] = None
    raw_response: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    processed_at: Optional[datetime] = None
    follow_ups: List[OutreachFollowUpResponse] = []

    class Config:
        from_attributes = True


class ProspectResponse(ProspectBase):
    id: int
    validation_status: str = "Unprocessed"
    validation_reason: Optional[str] = None
    decision_maker_name: Optional[str] = None
    decision_maker_role: Optional[str] = None
    pain_point: Optional[str] = None
    recommended_service: Optional[str] = None
    lead_temperature: Optional[str] = None
    score: Optional[float] = None
    score_explanation: Optional[str] = None
    email_subject: Optional[str] = None
    email_body: Optional[str] = None
    email_language: Optional[str] = None
    recommended_send_time: Optional[str] = None
    recommended_channel: Optional[str] = None
    processing_status: str = "Unprocessed"
    processed_at: Optional[datetime] = None
    conversion_status: str = "Not Converted"
    converted_lead_id: Optional[int] = None
    converted_at: Optional[datetime] = None
    owner_id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ProspectDetailResponse(ProspectResponse):
    results: List[OutreachResultResponse] = []
    follow_ups: List[OutreachFollowUpResponse] = []


class ProspectListResponse(BaseModel):
    items: List[ProspectResponse]
    total: int
    page: int
    size: int


class ProspectImportResponse(BaseModel):
    created: int
    updated: int
    skipped: int
    invalid: int
    duplicates: int
    errors: List[str] = []


class ProcessBatchRequest(BaseModel):
    prospect_ids: Optional[List[int]] = None
    force: bool = False
    limit: int = Field(default=25, ge=1, le=100)


class ProcessBatchResponse(BaseModel):
    processed: int
    failed: int
    skipped: int
    result_ids: List[int] = []
    errors: List[str] = []


class OutreachJobResponse(BaseModel):
    id: int
    status: str
    total: int
    processed: int
    failed: int
    skipped: int
    result_ids: Optional[List[int]] = None
    errors: Optional[List[str]] = None
    created_by: Optional[int] = None
    created_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class OutreachJobListResponse(BaseModel):
    items: List[OutreachJobResponse]
    total: int


class EmailPreviewResponse(BaseModel):
    result_id: int
    prospect_id: int
    to_email: Optional[str] = None
    company_name: str
    subject: str
    body: str
    lead_score: Optional[str] = None
    send_best_day: Optional[str] = None
    send_best_time: Optional[str] = None
    channel_primary: Optional[str] = None
    follow_ups: List[OutreachFollowUpResponse] = []


class EmailSendRequest(BaseModel):
    result_id: int
    dry_run: bool = True
    force: bool = False


class BatchEmailSendRequest(BaseModel):
    result_ids: Optional[List[int]] = None
    lead_score: Optional[LeadTemperature] = None
    dry_run: bool = True
    force: bool = False
    limit: int = Field(default=25, ge=1, le=100)


class EmailSendResponse(BaseModel):
    status: str
    provider: str
    dry_run: bool
    log_id: int
    preview: EmailPreviewResponse


class BatchEmailSendResponse(BaseModel):
    sent: int
    failed: int
    skipped: int
    logs: List[int] = []
    errors: List[str] = []


class OutreachSendLogResponse(BaseModel):
    id: int
    result_id: Optional[int] = None
    prospect_id: Optional[int] = None
    user_id: Optional[int] = None
    to_email: Optional[str] = None
    company_name: Optional[str] = None
    subject: Optional[str] = None
    lead_score: Optional[str] = None
    status: str
    provider: Optional[str] = None
    dry_run: bool
    error_message: Optional[str] = None
    sent_at: datetime

    class Config:
        from_attributes = True


class ProspectConvertRequest(BaseModel):
    create_deal: bool = False
    deal_title: Optional[str] = Field(default=None, max_length=200)
    deal_value: float = Field(default=0.0, ge=0)
    deal_stage: Literal["New", "Contacted", "Proposal", "Negotiation"] = "New"


class ProspectConvertResponse(BaseModel):
    prospect_id: int
    lead_id: int
    company_id: int
    contact_id: Optional[int] = None
    deal_id: Optional[int] = None
    status: str


class OutreachStatsResponse(BaseModel):
    total_prospects: int
    processed: int
    valid: int
    hot: int
    warm: int
    cold: int
    emails_generated: int
    emails_sent: int
    dry_runs: int
    followups_due: int
    converted: int
