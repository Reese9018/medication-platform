from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database import get_db
from ..dependencies import get_current_user
from ..models import Notification, User
from ..schemas import NotificationOut

router = APIRouter(prefix="/notifications", tags=["消息提醒"])

@router.get("", response_model=list[NotificationOut])
def list_notifications(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Notification).filter(Notification.user_id == user.id).order_by(Notification.created_at.desc()).all()

@router.post("/read-all")
def read_all(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(Notification).filter(Notification.user_id == user.id).update({Notification.read: True}); db.commit(); return {"message": "全部已读"}

@router.post("/{notification_id}/read")
def read_one(notification_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(Notification).filter(Notification.id == notification_id, Notification.user_id == user.id).update({Notification.read: True}); db.commit(); return {"message": "已读"}
