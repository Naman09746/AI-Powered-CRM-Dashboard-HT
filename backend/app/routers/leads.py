import csv
import io
from typing import Any, Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.core.database import get_db
from app.core.deps import get_current_user, RoleChecker
from app.models.user import User
from app.models.crm import Lead, Activity, AuditLog
from app.schemas.crm import LeadCreate, LeadUpdate, LeadResponse, LeadListResponse

router = APIRouter(prefix="/leads", tags=["leads"])

@router.get("/", response_model=LeadListResponse)
def get_leads(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=100),
    search: Optional[str] = None,
    status: Optional[str] = None,
    source: Optional[str] = None,
    industry: Optional[str] = None,
) -> Any:
    query = db.query(Lead)
    
    # Execs can only see their own leads unless they are Manager or Admin
    if current_user.role == "Executive":
        query = query.filter(Lead.owner_id == current_user.id)
        
    if search:
        search_filter = or_(
            Lead.name.ilike(f"%{search}%"),
            Lead.company_name.ilike(f"%{search}%"),
            Lead.email.ilike(f"%{search}%"),
            Lead.notes.ilike(f"%{search}%"),
        )
        query = query.filter(search_filter)
        
    if status:
        query = query.filter(Lead.status == status)
    if source:
        query = query.filter(Lead.source == source)
    if industry:
        query = query.filter(Lead.industry == industry)
        
    total = query.count()
    offset = (page - 1) * size
    items = query.order_by(Lead.created_at.desc()).offset(offset).limit(size).all()
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "size": size
    }

@router.post("/", response_model=LeadResponse)
def create_lead(
    lead_in: LeadCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    # Set default owner to creator if not specified and current user is Executive
    owner_id = lead_in.owner_id
    if not owner_id:
        owner_id = current_user.id
    elif current_user.role == "Executive" and owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Executives can only assign leads to themselves")
    elif not db.query(User).filter(User.id == owner_id, User.is_active == True).first():
        raise HTTPException(status_code=400, detail="Owner user not found or inactive")
        
    db_lead = Lead(
        name=lead_in.name,
        company_name=lead_in.company_name,
        industry=lead_in.industry,
        website=lead_in.website,
        email=lead_in.email,
        phone=lead_in.phone,
        country=lead_in.country,
        employee_count=lead_in.employee_count,
        source=lead_in.source,
        status=lead_in.status,
        owner_id=owner_id,
        notes=lead_in.notes,
    )
    db.add(db_lead)
    db.commit()
    db.refresh(db_lead)
    
    # Log activity
    activity = Activity(
        type="Note",
        description=f"Lead created by {current_user.full_name}",
        lead_id=db_lead.id,
        user_id=current_user.id
    )
    db.add(activity)
    db.commit()
    
    return db_lead

@router.get("/export/csv")
def export_leads(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    query = db.query(Lead)
    if current_user.role == "Executive":
        query = query.filter(Lead.owner_id == current_user.id)
        
    leads = query.order_by(Lead.created_at.desc()).all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Name", "Company", "Industry", "Website", "Email", "Phone", 
        "Country", "Employee Count", "Source", "Status", "Notes", "Lead Score"
    ])
    
    for lead in leads:
        writer.writerow([
            lead.name,
            lead.company_name,
            lead.industry,
            lead.website,
            lead.email,
            lead.phone,
            lead.country,
            lead.employee_count,
            lead.source,
            lead.status,
            lead.notes,
            lead.lead_score or ""
        ])

    db.add(AuditLog(
        user_id=current_user.id,
        query_type="Lead Export",
        raw_query="GET /leads/export/csv",
        result_summary=f"Exported {len(leads)} leads"
    ))
    db.commit()
        
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=leads_export.csv"}
    )

@router.get("/{lead_id}", response_model=LeadResponse)
def get_lead(
    lead_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
        
    if current_user.role == "Executive" and lead.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this lead")
        
    return lead

@router.put("/{lead_id}", response_model=LeadResponse)
def update_lead(
    lead_id: int,
    lead_in: LeadUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
        
    if current_user.role == "Executive" and lead.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update this lead")
        
    # Prevent Executive from changing owner unless it's to themselves or allowed by admin
    update_data = lead_in.model_dump(exclude_unset=True)
    if "owner_id" in update_data and current_user.role == "Executive" and update_data["owner_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Executives can only assign leads to themselves")
    if "owner_id" in update_data and update_data["owner_id"] is not None:
        owner = db.query(User).filter(User.id == update_data["owner_id"], User.is_active == True).first()
        if not owner:
            raise HTTPException(status_code=400, detail="Owner user not found or inactive")
        
    for field, value in update_data.items():
        setattr(lead, field, value)
        
    db.add(lead)
    
    # Log activity
    activity = Activity(
        type="Note",
        description=f"Lead updated by {current_user.full_name}",
        lead_id=lead.id,
        user_id=current_user.id
    )
    db.add(activity)
    
    db.commit()
    db.refresh(lead)
    return lead

@router.delete("/{lead_id}")
def delete_lead(
    lead_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    # Only Admin and Manager can delete leads
    if current_user.role not in ["Admin", "Manager"]:
        raise HTTPException(status_code=403, detail="Not authorized to delete leads")
        
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
        
    db.delete(lead)
    db.commit()
    return {"message": "Lead successfully deleted"}

@router.post("/import")
def import_leads(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")
        
    try:
        contents = file.file.read().decode("utf-8")
        csv_file = io.StringIO(contents)
        reader = csv.DictReader(csv_file)
        
        imported_count = 0
        for row in reader:
            db_lead = Lead(
                name=row.get("Name", row.get("name", "")),
                company_name=row.get("Company", row.get("company_name", "")),
                industry=row.get("Industry", row.get("industry", "")),
                website=row.get("Website", row.get("website", "")),
                email=row.get("Email", row.get("email", "")),
                phone=row.get("Phone", row.get("phone", "")),
                country=row.get("Country", row.get("country", "")),
                employee_count=int(row.get("Employee Count", row.get("employee_count", 0))) if row.get("Employee Count") or row.get("employee_count") else None,
                source=row.get("Source", row.get("source", "CSV Import")),
                status=row.get("Status", row.get("status", "New")),
                owner_id=current_user.id,
                notes=row.get("Notes", row.get("notes", "")),
            )
            if not db_lead.name:
                continue
            db.add(db_lead)
            imported_count += 1
            
        db.commit()
        return {"message": f"Successfully imported {imported_count} leads"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV file: {str(e)}")
