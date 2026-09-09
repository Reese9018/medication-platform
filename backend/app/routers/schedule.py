from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..dependencies import get_current_user
from ..models import Medication, ScheduleDose, User
from ..schemas import ScheduleCreate, ScheduleOut, ScheduleUpdate

router = APIRouter(prefix="/schedule", tags=["用药计划"])

@router.get("", response_model=list[ScheduleOut])
def list_schedule(dose_date: date | None = None, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(ScheduleDose).filter(ScheduleDose.user_id == user.id, ScheduleDose.dose_date == (dose_date or date.today())).order_by(ScheduleDose.dose_time).all()

@router.post("", response_model=ScheduleOut, status_code=201)
def create_dose(payload: ScheduleCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    medication = db.query(Medication).filter(Medication.id == payload.medication_id, Medication.user_id == user.id).first()
    if not medication: raise HTTPException(404, "药品不存在")
    dose = ScheduleDose(user_id=user.id, **payload.model_dump())
    db.add(dose); db.commit(); db.refresh(dose)
    return dose

@router.patch("/{dose_id}", response_model=ScheduleOut)
def update_dose(dose_id: int, payload: ScheduleUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    dose = db.query(ScheduleDose).filter(ScheduleDose.id == dose_id, ScheduleDose.user_id == user.id).first()
    if not dose: raise HTTPException(404, "用药计划不存在")
    dose.status = payload.status; db.commit(); db.refresh(dose)
    return dose

@router.delete("/{dose_id}")
def delete_dose(dose_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    dose = db.query(ScheduleDose).filter(ScheduleDose.id == dose_id, ScheduleDose.user_id == user.id).first()
    if not dose: raise HTTPException(404, "用药计划不存在")
    db.delete(dose); db.commit(); return {"message": "计划已删除"}
