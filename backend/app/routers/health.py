from datetime import date
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database import get_db
from ..dependencies import get_current_user
from ..models import HealthRecord, User
from ..schemas import HealthRecordCreate, HealthRecordOut

router = APIRouter(prefix="/health-records", tags=["健康数据"])

@router.get("", response_model=list[HealthRecordOut])
def list_records(days: int = 7, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    records = db.query(HealthRecord).filter(HealthRecord.user_id == user.id).order_by(HealthRecord.record_date.desc(), HealthRecord.record_time.desc()).limit(30).all()
    return records[:max(1, min(days, 30))]

@router.post("", response_model=HealthRecordOut, status_code=201)
def create_record(payload: HealthRecordCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    record = HealthRecord(user_id=user.id, **payload.model_dump())
    db.add(record); db.commit(); db.refresh(record)
    return record

@router.get("/summary")
def summary(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    records = db.query(HealthRecord).filter(HealthRecord.user_id == user.id).order_by(HealthRecord.record_date.desc()).limit(7).all()
    if not records: return {"count": 0}
    return {"count": len(records), "avg_systolic": round(sum(r.systolic for r in records)/len(records), 1), "avg_diastolic": round(sum(r.diastolic for r in records)/len(records), 1), "avg_blood_sugar": round(sum(r.blood_sugar for r in records)/len(records), 1), "avg_heart_rate": round(sum(r.heart_rate for r in records)/len(records), 1)}
