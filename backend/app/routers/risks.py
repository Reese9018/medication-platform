from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database import get_db
from ..dependencies import get_current_user
from ..models import Medication, User
from ..schemas import RiskAlertOut
from ..services.risk import list_risks

router = APIRouter(prefix="/risks", tags=["用药风险"])


@router.get("", response_model=list[RiskAlertOut])
def risks(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    medications = db.query(Medication).filter(Medication.user_id == user.id).all()
    return list_risks(user, medications)


@router.get("/{risk_id}", response_model=RiskAlertOut)
def risk_detail(risk_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    medications = db.query(Medication).filter(Medication.user_id == user.id).all()
    all_risks = list_risks(user, medications)
    return next((item for item in all_risks if item.id == risk_id), all_risks[0] if all_risks else None)
