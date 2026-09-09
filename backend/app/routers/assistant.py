from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_current_user
from ..models import HealthRecord, Medication, ScheduleDose, User
from ..schemas import AssistantRequest, AssistantResponse
from ..services.assistant import answer_question, build_user_context
from ..services.risk import list_risks

router = APIRouter(prefix="/assistant", tags=["AI助手"])


@router.post("/chat", response_model=AssistantResponse)
def chat(
    payload: AssistantRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # 查出当前用户真实数据，拼成上下文交给智能体参考
    medications = (
        db.query(Medication).filter(Medication.user_id == user.id).all()
    )
    schedule_doses = (
        db.query(ScheduleDose)
        .filter(ScheduleDose.user_id == user.id, ScheduleDose.dose_date == date.today())
        .order_by(ScheduleDose.dose_time)
        .all()
    )
    health_records = (
        db.query(HealthRecord)
        .filter(HealthRecord.user_id == user.id)
        .order_by(HealthRecord.record_date.desc(), HealthRecord.record_time.desc())
        .limit(30)
        .all()
    )
    risks = list_risks(user, medications)
    med_name_by_id = {m.id: m.name for m in medications}

    context = build_user_context(
        user, medications, schedule_doses, health_records, risks, med_name_by_id
    )
    return answer_question(payload.question, context, user_id=str(user.id), conversation_id=payload.conversation_id)
