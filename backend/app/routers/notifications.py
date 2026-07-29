from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from sqlalchemy.orm import Session
from jose import jwt

from app.core.database import get_db
from app.core.config import settings
from app.core.security import ALGORITHM
from app.core.deps import get_current_user
from app.models.user import User
from app.models.crm import Notification
from app.schemas.crm import NotificationResponse
from app.schemas.user import TokenPayload
from app.core.websocket import manager

router = APIRouter(prefix="/notifications", tags=["notifications"])

@router.get("/", response_model=List[NotificationResponse])
def get_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    # Returns notifications for the current user, ordered by newest first
    return (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(20)
        .all()
    )

@router.put("/{notif_id}/read", response_model=NotificationResponse)
def mark_as_read(
    notif_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    notif = db.query(Notification).filter(
        Notification.id == notif_id,
        Notification.user_id == current_user.id
    ).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
        
    notif.read = True
    db.add(notif)
    db.commit()
    db.refresh(notif)
    return notif

@router.put("/read-all")
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.read == False
    ).update({Notification.read: True}, synchronize_session=False)
    db.commit()
    return {"message": "All notifications marked as read"}

@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(...),
    db: Session = Depends(get_db)
):
    # Decode token to authenticate connection
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        token_data = TokenPayload(**payload)
        user = db.query(User).filter(User.email == token_data.sub).first()
        if not user or not user.is_active:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
    except Exception as e:
        print(f"WS authentication failed: {str(e)}")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await manager.connect(user.id, websocket)
    try:
        while True:
            # Wait for any incoming client messages (heartbeats, etc.)
            await websocket.receive_text()
            # Send a simple ping/pong packet to keep connection alive
            await websocket.send_json({"type": "ping", "data": "pong"})
    except WebSocketDisconnect:
        manager.disconnect(user.id, websocket)
    except Exception as e:
        print(f"WS error: {str(e)}")
        manager.disconnect(user.id, websocket)
