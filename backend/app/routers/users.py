from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.security import get_password_hash
from app.models.user import User
from app.schemas.user import UserResponse

router = APIRouter(prefix="/users", tags=["users"])
VALID_ROLES = {"Admin", "Manager", "Executive"}

@router.get("/", response_model=List[UserResponse])
def get_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    role: Optional[str] = None
):
    if current_user.role != "Admin":
        raise HTTPException(status_code=403, detail="Admin only")
    query = db.query(User)
    if role:
        query = query.filter(User.role == role)
    return query.all()

@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    full_name: Optional[str] = None,
    role: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "Admin":
        raise HTTPException(status_code=403, detail="Admin only")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if full_name is not None:
        user.full_name = full_name
    if role is not None:
        if role not in VALID_ROLES:
            raise HTTPException(status_code=400, detail="Invalid role")
        user.role = role
    if is_active is not None:
        if user.id == current_user.id and not is_active:
            raise HTTPException(status_code=400, detail="You cannot deactivate your own account")
        user.is_active = is_active
    db.commit()
    db.refresh(user)
    return user

@router.delete("/{user_id}")
def deactivate_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "Admin":
        raise HTTPException(status_code=403, detail="Admin only")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot deactivate your own account")
    user.is_active = False
    db.commit()
    return {"message": "User deactivated"}
