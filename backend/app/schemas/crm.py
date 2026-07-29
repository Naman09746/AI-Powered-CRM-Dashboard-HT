from typing import Literal, Optional, List
from pydantic import BaseModel, Field
from datetime import datetime
from app.schemas.user import UserResponse

# Company
class CompanyBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    industry: Optional[str] = None
    website: Optional[str] = None
    employee_count: Optional[int] = Field(default=None, ge=0)

class CompanyCreate(CompanyBase):
    pass

class CompanyResponse(CompanyBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class CompanyListResponse(BaseModel):
    items: List[CompanyResponse]
    total: int
    page: int
    size: int

# Contact
class ContactBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    email: Optional[str] = None
    phone: Optional[str] = None

class ContactCreate(ContactBase):
    pass

class ContactResponse(ContactBase):
    id: int
    company_id: int
    created_at: datetime

    class Config:
        from_attributes = True

# Lead
class LeadBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    company_name: Optional[str] = None
    industry: Optional[str] = None
    website: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    country: Optional[str] = None
    employee_count: Optional[int] = Field(default=None, ge=0)
    source: Optional[str] = None
    status: Literal["New", "Contacted", "Qualified", "Lost"] = "New"
    notes: Optional[str] = None

class LeadCreate(LeadBase):
    owner_id: Optional[int] = None

class LeadUpdate(BaseModel):
    name: Optional[str] = None
    company_name: Optional[str] = None
    industry: Optional[str] = None
    website: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    country: Optional[str] = None
    employee_count: Optional[int] = Field(default=None, ge=0)
    source: Optional[str] = None
    status: Optional[Literal["New", "Contacted", "Qualified", "Lost"]] = None
    owner_id: Optional[int] = None
    notes: Optional[str] = None
    lead_score: Optional[float] = Field(default=None, ge=0, le=100)

class LeadResponse(LeadBase):
    id: int
    owner_id: Optional[int] = None
    lead_score: Optional[float] = None
    created_at: datetime
    updated_at: datetime
    owner: Optional[UserResponse] = None

    class Config:
        from_attributes = True

# Deal
class DealBase(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    value: float = Field(ge=0)
    stage: Literal["New", "Contacted", "Proposal", "Negotiation", "Won", "Lost"] = "New"
    lead_id: int

class DealCreate(DealBase):
    owner_id: Optional[int] = None

class DealUpdate(BaseModel):
    title: Optional[str] = None
    value: Optional[float] = Field(default=None, ge=0)
    stage: Optional[Literal["New", "Contacted", "Proposal", "Negotiation", "Won", "Lost"]] = None
    lead_id: Optional[int] = None
    owner_id: Optional[int] = None
    closed_at: Optional[datetime] = None

class DealResponse(DealBase):
    id: int
    owner_id: Optional[int] = None
    closed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    owner: Optional[UserResponse] = None

    class Config:
        from_attributes = True

# Activity
class ActivityBase(BaseModel):
    type: str
    description: str
    lead_id: Optional[int] = None

class ActivityCreate(ActivityBase):
    pass

class ActivityResponse(ActivityBase):
    id: int
    user_id: Optional[int] = None
    created_at: datetime
    user: Optional[UserResponse] = None

    class Config:
        from_attributes = True

# Pagination schemas
class LeadListResponse(BaseModel):
    items: List[LeadResponse]
    total: int
    page: int
    size: int

class DealListResponse(BaseModel):
    items: List[DealResponse]
    total: int
    page: int = 1
    size: int = 100

# Task Schemas
class TaskBase(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    priority: Literal["Low", "Medium", "High"] = "Medium"
    status: Literal["Pending", "Completed"] = "Pending"
    recurring: Literal["None", "Daily", "Weekly", "Monthly"] = "None"
    lead_id: Optional[int] = None

class TaskCreate(TaskBase):
    assigned_to_id: Optional[int] = None

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    priority: Optional[Literal["Low", "Medium", "High"]] = None
    status: Optional[Literal["Pending", "Completed"]] = None
    recurring: Optional[Literal["None", "Daily", "Weekly", "Monthly"]] = None
    assigned_to_id: Optional[int] = None
    lead_id: Optional[int] = None

class TaskResponse(TaskBase):
    id: int
    assigned_to_id: Optional[int] = None
    created_at: datetime
    assigned_to: Optional[UserResponse] = None
    lead: Optional[LeadResponse] = None

    class Config:
        from_attributes = True

class TaskListResponse(BaseModel):
    items: List[TaskResponse]
    total: int
    page: int = 1
    size: int = 25

# Notification Schemas
class NotificationBase(BaseModel):
    title: str
    message: str
    read: bool = False
    type: str = "info"

class NotificationResponse(NotificationBase):
    id: int
    user_id: int
    created_at: datetime

    class Config:
        from_attributes = True

# Meeting Summary Schemas
class MeetingSummaryBase(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    transcript: str = Field(min_length=20)
    lead_id: Optional[int] = None

class MeetingSummaryCreate(MeetingSummaryBase):
    pass

class MeetingSummaryResponse(MeetingSummaryBase):
    id: int
    summary: Optional[str] = None
    decisions: Optional[str] = None
    action_items: Optional[str] = None
    risks: Optional[str] = None
    user_id: Optional[int] = None
    created_at: datetime
    lead: Optional[LeadResponse] = None

    class Config:
        from_attributes = True
