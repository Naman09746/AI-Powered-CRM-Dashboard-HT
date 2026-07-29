from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.crm import Deal, Lead, Activity
from app.schemas.crm import DealCreate, DealUpdate, DealResponse, DealListResponse

router = APIRouter(prefix="/deals", tags=["deals"])

@router.get("/", response_model=DealListResponse)
def get_deals(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    stage: Optional[str] = None,
    lead_id: Optional[int] = None,
    page: int = Query(1, ge=1),
    size: int = Query(100, ge=1, le=500)
) -> Any:
    query = db.query(Deal)
    
    # Executive can only see their own deals
    if current_user.role == "Executive":
        query = query.filter(Deal.owner_id == current_user.id)
    
    if stage:
        query = query.filter(Deal.stage == stage)
    if lead_id:
        query = query.filter(Deal.lead_id == lead_id)
    
    total = query.count()
    offset = (page - 1) * size
    items = query.order_by(Deal.created_at.desc()).offset(offset).limit(size).all()
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "size": size
    }

@router.post("/", response_model=DealResponse)
def create_deal(
    deal_in: DealCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    # Verify lead exists
    lead = db.query(Lead).filter(Lead.id == deal_in.lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
        
    # Execs can only create deals for their own leads
    if current_user.role == "Executive" and lead.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to create a deal for this lead")
        
    owner_id = deal_in.owner_id or current_user.id
    if current_user.role == "Executive" and owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Executives can only assign deals to themselves")
    if not db.query(User).filter(User.id == owner_id, User.is_active == True).first():
        raise HTTPException(status_code=400, detail="Owner user not found or inactive")
    
    db_deal = Deal(
        title=deal_in.title,
        value=deal_in.value,
        stage=deal_in.stage,
        lead_id=deal_in.lead_id,
        owner_id=owner_id,
    )
    if db_deal.stage == "Won" or db_deal.stage == "Lost":
        db_deal.closed_at = datetime.now(timezone.utc)
        
    db.add(db_deal)
    db.commit()
    db.refresh(db_deal)
    
    # Log activity
    activity = Activity(
        type="Meeting",
        description=f"Deal '{db_deal.title}' created with stage '{db_deal.stage}' and value ${db_deal.value:,.2f}",
        lead_id=db_deal.lead_id,
        user_id=current_user.id
    )
    db.add(activity)
    db.commit()
    
    return db_deal

@router.put("/{deal_id}", response_model=DealResponse)
def update_deal(
    deal_id: int,
    deal_in: DealUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    deal = db.query(Deal).filter(Deal.id == deal_id).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
        
    if current_user.role == "Executive" and deal.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update this deal")
        
    update_data = deal_in.model_dump(exclude_unset=True)

    if "owner_id" in update_data and update_data["owner_id"] is not None:
        if current_user.role == "Executive" and update_data["owner_id"] != current_user.id:
            raise HTTPException(status_code=403, detail="Executives can only assign deals to themselves")
        owner = db.query(User).filter(User.id == update_data["owner_id"], User.is_active == True).first()
        if not owner:
            raise HTTPException(status_code=400, detail="Owner user not found or inactive")

    if "lead_id" in update_data:
        lead = db.query(Lead).filter(Lead.id == update_data["lead_id"]).first()
        if not lead:
            raise HTTPException(status_code=404, detail="Lead not found")
        if current_user.role == "Executive" and lead.owner_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to move this deal to that lead")
    
    # Track stage transition
    old_stage = deal.stage
    new_stage = update_data.get("stage", old_stage)
    
    for field, value in update_data.items():
        setattr(deal, field, value)
        
    if new_stage in ["Won", "Lost"] and old_stage not in ["Won", "Lost"]:
        deal.closed_at = datetime.now(timezone.utc)
    elif new_stage not in ["Won", "Lost"]:
        deal.closed_at = None
        
    db.add(deal)
    
    # Log activity if stage changed
    if old_stage != new_stage:
        activity = Activity(
            type="Meeting",
            description=f"Deal '{deal.title}' stage updated from '{old_stage}' to '{new_stage}'",
            lead_id=deal.lead_id,
            user_id=current_user.id
        )
        db.add(activity)
        
    db.commit()
    db.refresh(deal)
    return deal

@router.delete("/{deal_id}")
def delete_deal(
    deal_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    if current_user.role not in ["Admin", "Manager"]:
        raise HTTPException(status_code=403, detail="Not authorized to delete deals")
        
    deal = db.query(Deal).filter(Deal.id == deal_id).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
        
    db.delete(deal)
    db.commit()
    return {"message": "Deal successfully deleted"}
