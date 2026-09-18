from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database import get_db
from ..dependencies import get_current_user
from ..models import User
from ..schemas import UserOut, UserUpdate

router = APIRouter(prefix="/users", tags=["健康档案"])

# 属于「健康档案」内容的字段：其中任意一项真实发生变化即视为档案被重新建档，
# 刷新 profile_updated_at（前端「建档日期」显示的就是这个值）。
# phone 不在其中——它属于账号联系方式，改手机号不应影响建档日期。
ARCHIVE_FIELDS = (
    "name", "age", "gender", "height", "weight", "blood_type",
    "chronic_conditions", "allergies", "emergency_contact",
)


def _norm(value: Any) -> Any:
    """宽松归一化后再比较，避免前端传 '72' / [] / None 造成「没改也算改了」。"""
    if value is None:
        return ""
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    return str(value).strip()


@router.get("/me", response_model=UserOut)
def get_profile(user: User = Depends(get_current_user)):
    return user

@router.patch("/me", response_model=UserOut)
def update_profile(payload: UserUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    changes = payload.model_dump(exclude_unset=True)
    # 先比较再赋值：只有档案内容真的变了才刷新建档日期，
    # 否则「打开弹窗直接保存」也会把建档日期改成今天
    archive_changed = any(
        key in ARCHIVE_FIELDS and _norm(getattr(user, key, None)) != _norm(value)
        for key, value in changes.items()
    )
    for key, value in changes.items():
        setattr(user, key, value)
    if archive_changed:
        user.profile_updated_at = datetime.utcnow()
    db.commit(); db.refresh(user)
    return user
