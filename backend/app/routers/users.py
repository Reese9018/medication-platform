from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database import get_db
from ..dependencies import get_current_user
from ..models import User
from ..schemas import UserOut, UserUpdate

router = APIRouter(prefix="/users", tags=["健康档案"])

@router.get("/me", response_model=UserOut)
def get_profile(user: User = Depends(get_current_user)):
    return user

@router.patch("/me", response_model=UserOut)
def update_profile(payload: UserUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(user, key, value)
    db.commit(); db.refresh(user)
    return user
