from datetime import date, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database import get_db
from ..dependencies import get_current_user, get_observed_user
from ..models import HealthRecord, ScheduleDose, User
from ..schemas import ReportOut

router = APIRouter(prefix="/reports", tags=["健康报告"])

@router.get("/{period}", response_model=ReportOut)
def report(period: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    observed = get_observed_user(user, db)
    days = 30 if period == "month" else 7
    end = date.today(); start = end - timedelta(days=days - 1)
    records = db.query(HealthRecord).filter(HealthRecord.user_id == observed.id, HealthRecord.record_date >= start).all()
    doses = db.query(ScheduleDose).filter(ScheduleDose.user_id == observed.id, ScheduleDose.dose_date >= start).all()
    count = len(records) or 1
    taken = sum(1 for dose in doses if dose.status == "taken")
    missed = sum(1 for dose in doses if dose.status == "missed")
    return ReportOut(period=period if period in ("week", "month") else "week", start_date=start, end_date=end, adherence_rate=round(taken/len(doses)*100) if doses else 0, missed_count=missed, avg_systolic=round(sum(r.systolic for r in records)/count, 1), avg_diastolic=round(sum(r.diastolic for r in records)/count, 1), avg_blood_sugar=round(sum(r.blood_sugar for r in records)/count, 1), avg_heart_rate=round(sum(r.heart_rate for r in records)/count, 1), risk_count={"high": 2, "mid": 2, "low": 2}, ai_summary="近阶段健康数据整体较稳定，建议继续保持规律服药与健康作息。", suggestions=["保持固定服药时间", "持续监测血压血糖", "如有异常及时咨询医生"])
