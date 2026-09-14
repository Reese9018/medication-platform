from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_current_user
from ..models import HealthRecord, Medication, ScheduleDose, User
from ..schemas import AssistantProfileSummary, AssistantRequest, AssistantResponse
from ..services.assistant import (
    AssistantContext,
    answer_question,
    build_profile_summary,
)
from ..services.risk import list_risks

router = APIRouter(prefix="/assistant", tags=["AI助手"])


@router.get("/profile", response_model=AssistantProfileSummary, tags=["AI助手"])
def profile_summary(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """单独获取「AI 已读到的档案」摘要，助手页进入时即可展示，不必先提一个问题。"""
    return build_profile_summary(_load_context(user, db))


def _load_context(user: User, db: Session) -> AssistantContext:
    """一次性查出当前用户的全部真实数据，组装成助手上下文。"""
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
    return AssistantContext(
        user=user,
        medications=medications,
        doses=schedule_doses,
        records=health_records,
        risks=risks,
        med_name_by_id={m.id: m.name for m in medications},
    )


@router.post("/chat", response_model=AssistantResponse)
def chat(
    payload: AssistantRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # 查出当前用户真实数据，既拼成文本交给扣子智能体，也供本地应答引擎直接使用
    ctx = _load_context(user, db)
    response = answer_question(
        payload.question,
        ctx.render_text(),
        user_id=str(user.id),
        conversation_id=payload.conversation_id,
        ctx=ctx,
    )
    # 每次回答都带上最新档案摘要，前端可实时反映「AI 读到了什么」
    response.profile = build_profile_summary(ctx)
    return response
