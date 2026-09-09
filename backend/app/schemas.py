from datetime import date, datetime, time
from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field

Role = Literal["elder", "family"]
RiskLevel = Literal["high", "mid", "low"]

class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)

class UserCreate(BaseModel):
    account: str = Field(min_length=2, max_length=64)
    password: str = Field(min_length=6, max_length=128)
    name: str = Field(min_length=1, max_length=64)
    role: Role = "elder"
    phone: str | None = None

class LoginRequest(BaseModel):
    account: str
    password: str

class UserOut(ORMModel):
    id: int; account: str; name: str; phone: str | None; age: int; gender: str
    height: float; weight: float; role: str; avatar_color: str
    chronic_conditions: list[Any]; allergies: list[Any]; blood_type: str
    emergency_contact: str | None; created_at: datetime

class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut

class UserUpdate(BaseModel):
    name: str | None = None; age: int | None = None; gender: str | None = None
    height: float | None = None; weight: float | None = None; blood_type: str | None = None
    chronic_conditions: list[str] | None = None; allergies: list[str] | None = None
    emergency_contact: str | None = None

class MedicationCreate(BaseModel):
    name: str; generic_name: str | None = None; spec: str = ""; dosage: str = "1片"
    purpose: str = ""; frequency_per_day: int = Field(default=1, ge=1, le=12)
    times: list[str] = []; status: str = "active"; risk_level: RiskLevel = "low"
    category: str = "其他"; notes: str | None = None; start_date: date = Field(default_factory=date.today)
    end_date: date | None = None; remind_before_minutes: int | None = Field(default=None, ge=0, le=120)
    contraindications: list[str] = []; precautions: str | None = None

class MedicationOut(ORMModel):
    id: int; user_id: int; name: str; generic_name: str | None; spec: str; dosage: str
    purpose: str; frequency_per_day: int; times: list[Any]; status: str; risk_level: str
    category: str; notes: str | None; start_date: date; end_date: date | None; remind_before_minutes: int | None; contraindications: list[Any]; precautions: str | None

class ScheduleCreate(BaseModel):
    medication_id: int; dose_date: date = Field(default_factory=date.today); period: str
    dose_time: datetime; dosage: str; usage: str = ""; status: str = "pending"

class ScheduleUpdate(BaseModel):
    status: Literal["taken", "pending", "missed"]

class ScheduleOut(ORMModel):
    id: int; user_id: int; medication_id: int; dose_date: date; period: str
    dose_time: datetime; dosage: str; usage: str; status: str

class HealthRecordCreate(BaseModel):
    record_date: date = Field(default_factory=date.today); record_time: datetime = Field(default_factory=datetime.utcnow)
    systolic: int = Field(ge=50, le=300); diastolic: int = Field(ge=30, le=200)
    blood_sugar: float = Field(ge=0, le=50); heart_rate: int = Field(ge=20, le=250); note: str | None = None

class HealthRecordOut(ORMModel):
    id: int; user_id: int; record_date: date; record_time: datetime
    systolic: int; diastolic: int; blood_sugar: float; heart_rate: int; note: str | None

class RiskAlertOut(BaseModel):
    id: str; type: str; level: RiskLevel; medications: list[str]; reason: str; ai_analysis: str; suggestion: str; plain_advice: str

class AssistantRequest(BaseModel):
    question: str = Field(min_length=1, max_length=1000)
    conversation_id: str | None = Field(default=None, description="扣子会话ID，首轮不传，后续轮次带上以维持上下文")

class AICard(BaseModel):
    type: Literal["medication", "risk", "tip", "action", "health"]
    title: str; detail: str | None = None; level: RiskLevel | None = None
    medications: list[str] | None = None; actions: list[dict[str, str | None]] | None = None

class AssistantResponse(BaseModel):
    content: str; cards: list[AICard]
    conversation_id: str | None = Field(default=None, description="扣子会话ID，前端保存后下次请求带上")

class FamilyBindRequest(BaseModel):
    family_account: str; relationship: str = "家属"

class FamilyMemberOut(BaseModel):
    id: int; name: str; relationship: str; role: str; bound: bool; phone: str | None

class NotificationOut(ORMModel):
    id: int; user_id: int; title: str; detail: str; level: str; read: bool; created_at: datetime

class ReportOut(BaseModel):
    period: Literal["week", "month"]; start_date: date; end_date: date; adherence_rate: int
    missed_count: int; avg_systolic: float; avg_diastolic: float; avg_blood_sugar: float
    avg_heart_rate: float; risk_count: dict[str, int]; ai_summary: str; suggestions: list[str]

# ============================================================
# AI 拍照识别药品（OCR）
# ============================================================

class OCRRequest(BaseModel):
    image_base64: str = Field(min_length=1, description="药品图片的 base64 编码（不含 data: 前缀）")

class OCRResult(BaseModel):
    name: str = Field(description="药品名称")
    spec: str = ""
    dosage: str = ""
    purpose: str = ""
    frequency_per_day: int = Field(default=1, ge=1, le=12)
    times: list[str] = []
    contraindications: list[str] = []
    precautions: str = ""
