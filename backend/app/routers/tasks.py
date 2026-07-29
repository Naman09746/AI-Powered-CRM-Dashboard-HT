from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.crm import Task, Lead, Notification, Activity
from app.schemas.crm import TaskCreate, TaskUpdate, TaskResponse, TaskListResponse
from app.core.websocket import manager

router = APIRouter(prefix="/tasks", tags=["tasks"])

async def create_and_send_notification(
    db: Session, 
    user_id: int, 
    title: str, 
    message: str, 
    notif_type: str = "info"
):
    # 1. Persist notification in database
    db_notification = Notification(
        user_id=user_id,
        title=title,
        message=message,
        type=notif_type
    )
    db.add(db_notification)
    db.commit()
    db.refresh(db_notification)

    # 2. Push real-time WS packet
    payload = {
        "id": db_notification.id,
        "title": db_notification.title,
        "message": db_notification.message,
        "type": db_notification.type,
        "read": db_notification.read,
        "created_at": db_notification.created_at.isoformat()
    }
    await manager.send_personal_message(payload, user_id)

@router.get("/", response_model=TaskListResponse)
def get_tasks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    status: Optional[str] = None,
    priority: Optional[str] = None,
    page: int = Query(1, ge=1),
    size: int = Query(25, ge=1, le=100)
) -> Any:
    query = db.query(Task)
    
    # Executive can only view their assigned tasks
    if current_user.role == "Executive":
        query = query.filter(Task.assigned_to_id == current_user.id)
        
    if status:
        query = query.filter(Task.status == status)
    if priority:
        query = query.filter(Task.priority == priority)
    
    total = query.count()
    offset = (page - 1) * size
    items = query.order_by(Task.due_date.asc()).offset(offset).limit(size).all()
    
    return {"items": items, "total": total, "page": page, "size": size}

@router.post("/", response_model=TaskResponse)
async def create_task(
    task_in: TaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    # Set default assignee to current user if not specified
    assignee_id = task_in.assigned_to_id or current_user.id
    if current_user.role == "Executive" and assignee_id != current_user.id:
        raise HTTPException(status_code=403, detail="Executives can only assign tasks to themselves")
    if not db.query(User).filter(User.id == assignee_id, User.is_active == True).first():
        raise HTTPException(status_code=400, detail="Assignee user not found or inactive")
    
    # Verify lead exists if linked
    if task_in.lead_id:
        lead = db.query(Lead).filter(Lead.id == task_in.lead_id).first()
        if not lead:
            raise HTTPException(status_code=404, detail="Associated lead not found")
        if current_user.role == "Executive" and lead.owner_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to create a task for this lead")
            
    db_task = Task(
        title=task_in.title,
        description=task_in.description,
        due_date=task_in.due_date,
        priority=task_in.priority,
        status=task_in.status,
        recurring=task_in.recurring,
        assigned_to_id=assignee_id,
        lead_id=task_in.lead_id,
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)

    # Log activity on Lead if linked
    if db_task.lead_id:
        activity = Activity(
            type="Task",
            description=f"Task '{db_task.title}' created and assigned",
            lead_id=db_task.lead_id,
            user_id=current_user.id
        )
        db.add(activity)
        db.commit()

    # Trigger real-time notification to assignee (if it's not the creator)
    if assignee_id != current_user.id:
        await create_and_send_notification(
            db=db,
            user_id=assignee_id,
            title="New Task Assigned",
            message=f"Task '{db_task.title}' was assigned to you by {current_user.full_name}.",
            notif_type="info"
        )
        
    return db_task

@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: int,
    task_in: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    if current_user.role == "Executive" and task.assigned_to_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to edit this task")
        
    update_data = task_in.model_dump(exclude_unset=True)
    
    # Track status change (completion)
    old_status = task.status
    new_status = update_data.get("status", old_status)
    
    # Track assignee change
    old_assignee = task.assigned_to_id
    new_assignee = update_data.get("assigned_to_id", old_assignee)

    if "assigned_to_id" in update_data and update_data["assigned_to_id"] is not None:
        if current_user.role == "Executive" and update_data["assigned_to_id"] != current_user.id:
            raise HTTPException(status_code=403, detail="Executives can only assign tasks to themselves")
        assignee = db.query(User).filter(User.id == update_data["assigned_to_id"], User.is_active == True).first()
        if not assignee:
            raise HTTPException(status_code=400, detail="Assignee user not found or inactive")

    if "lead_id" in update_data and update_data["lead_id"] is not None:
        lead = db.query(Lead).filter(Lead.id == update_data["lead_id"]).first()
        if not lead:
            raise HTTPException(status_code=404, detail="Associated lead not found")
        if current_user.role == "Executive" and lead.owner_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to link this task to that lead")

    for field, value in update_data.items():
        setattr(task, field, value)
        
    db.add(task)
    db.commit()
    db.refresh(task)

    # Log activity on Lead if status changed to Completed
    if old_status != "Completed" and new_status == "Completed" and task.lead_id:
        activity = Activity(
            type="Task",
            description=f"Task '{task.title}' completed",
            lead_id=task.lead_id,
            user_id=current_user.id
        )
        db.add(activity)
        db.commit()

    # Notify on assignee update
    if old_assignee != new_assignee and new_assignee and new_assignee != current_user.id:
        await create_and_send_notification(
            db=db,
            user_id=new_assignee,
            title="New Task Assigned",
            message=f"Task '{task.title}' was re-assigned to you by {current_user.full_name}.",
            notif_type="info"
        )

    return task

@router.delete("/{task_id}")
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    # Execs can only delete tasks they own
    if current_user.role == "Executive" and task.assigned_to_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this task")
        
    db.delete(task)
    db.commit()
    return {"message": "Task successfully deleted"}
