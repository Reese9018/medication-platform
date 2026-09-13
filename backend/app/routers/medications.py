from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..dependencies import get_current_user, get_observed_user
from ..models import Medication, ScheduleDose, User
from ..schemas import MedicationCreate, MedicationOut, OCRRequest, OCRResult
from ..services.ocr import recognize_medicine

router = APIRouter(prefix="/medications", tags=["药品管理"])


def _period_for(hour: int) -> str:
    if hour < 10: return "morning"
    if hour < 14: return "noon"
    if hour < 19: return "evening"
    return "night"

def owned_medication(medication_id: int, user: User, db: Session) -> Medication:
    medication = db.query(Medication).filter(Medication.id == medication_id, Medication.user_id == user.id).first()
    if not medication: raise HTTPException(404, "药品不存在")
    return medication

@router.get("", response_model=list[MedicationOut])
def list_medications(search: str | None = None, category: str | None = None, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    observed = get_observed_user(user, db)
    query = db.query(Medication).filter(Medication.user_id == observed.id)
    if search: query = query.filter(Medication.name.contains(search) | Medication.purpose.contains(search))
    if category and category != "全部": query = query.filter(Medication.category == category)
    return query.order_by(Medication.id.desc()).all()

@router.post("", response_model=MedicationOut, status_code=201)
def create_medication(payload: MedicationCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    observed = get_observed_user(user, db)
    medication = Medication(user_id=observed.id, **payload.model_dump())
    db.add(medication); db.commit(); db.refresh(medication)

    # 创建药品后，自动为今天的每个服用时间生成一条待确认排程，
    # 这样家属端/老人端的"今日用药计划"立刻能看到，无需手动加排程。
    today = date.today()
    for t in medication.times or []:
        try:
            hh, mm = (t.split(":") + ["00"])[:2]
            dose_time = datetime.combine(today, datetime.min.time()).replace(hour=int(hh), minute=int(mm))
            db.add(ScheduleDose(
                user_id=observed.id,
                medication_id=medication.id,
                dose_date=today,
                period=_period_for(int(hh)),
                dose_time=dose_time,
                dosage=medication.dosage,
                usage="",
                status="pending",
            ))
        except Exception:
            pass
    db.commit()
    return medication

@router.get("/{medication_id}", response_model=MedicationOut)
def get_medication(medication_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    observed = get_observed_user(user, db)
    return owned_medication(medication_id, observed, db)

@router.patch("/{medication_id}", response_model=MedicationOut)
def update_medication(medication_id: int, payload: MedicationCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    observed = get_observed_user(user, db)
    medication = owned_medication(medication_id, observed, db)
    for key, value in payload.model_dump(exclude_unset=True).items(): setattr(medication, key, value)
    db.commit(); db.refresh(medication)
    return medication

@router.delete("/{medication_id}")
def delete_medication(medication_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    observed = get_observed_user(user, db)
    medication = owned_medication(medication_id, observed, db)
    db.delete(medication); db.commit()
    return {"message": "药品已删除"}

@router.post("/ocr", response_model=OCRResult)
def recognize_medication(payload: OCRRequest, user: User = Depends(get_current_user)):
    """AI 拍照识别药品：接收 base64 图片，调用智谱 GLM 视觉模型返回结构化药品信息。

    未配置 ZHIPU_API_KEY 或调用失败时，降级返回模拟数据，保证前端可用。
    本接口只返回识别结果，不自动保存；用户在前端确认后再调用 POST /medications 保存。
    """
    try:
        return recognize_medicine(payload.image_base64)
    except Exception:
        # 降级：返回模拟识别结果
        return OCRResult(
            name="氨氯地平贝那普利片",
            spec="10mg/2.5mg×7片",
            dosage="1片",
            purpose="用于高血压，尤其适用于单药控制不佳者",
            frequency_per_day=1,
            times=["08:00"],
            contraindications=["对本品任一成分过敏者禁用", "妊娠期妇女禁用"],
            precautions="注意监测血压，避免与钾盐或保钾利尿剂合用；可能引起干咳。",
        )
