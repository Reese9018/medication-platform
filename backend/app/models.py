from datetime import date, datetime
from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, Time, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .database import Base


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    account: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    name: Mapped[str] = mapped_column(String(64))
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    age: Mapped[int] = mapped_column(Integer, default=0)
    gender: Mapped[str] = mapped_column(String(8), default="女")
    height: Mapped[float] = mapped_column(Float, default=0)
    weight: Mapped[float] = mapped_column(Float, default=0)
    role: Mapped[str] = mapped_column(String(16), default="elder", index=True)
    avatar_color: Mapped[str] = mapped_column(String(16), default="#4A8265")
    chronic_conditions: Mapped[list] = mapped_column(JSON, default=list)
    allergies: Mapped[list] = mapped_column(JSON, default=list)
    blood_type: Mapped[str] = mapped_column(String(16), default="")
    emergency_contact: Mapped[str | None] = mapped_column(String(128), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    medications: Mapped[list["Medication"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    health_records: Mapped[list["HealthRecord"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    doses: Mapped[list["ScheduleDose"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    family_links: Mapped[list["FamilyLink"]] = relationship(foreign_keys="FamilyLink.user_id", back_populates="user", cascade="all, delete-orphan")


class Medication(Base):
    __tablename__ = "medications"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(128))
    generic_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    spec: Mapped[str] = mapped_column(String(128), default="")
    dosage: Mapped[str] = mapped_column(String(64), default="1片")
    purpose: Mapped[str] = mapped_column(String(255), default="")
    frequency_per_day: Mapped[int] = mapped_column(Integer, default=1)
    times: Mapped[list] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(16), default="active")
    risk_level: Mapped[str] = mapped_column(String(8), default="low")
    category: Mapped[str] = mapped_column(String(64), default="其他")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    start_date: Mapped[date] = mapped_column(Date, default=date.today)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)  # 停药/结束日期，留空表示长期服用
    remind_before_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 服药前提前提醒分钟数
    contraindications: Mapped[list] = mapped_column(JSON, default=list)
    precautions: Mapped[str | None] = mapped_column(Text, nullable=True)
    user: Mapped[User] = relationship(back_populates="medications")


class ScheduleDose(Base):
    __tablename__ = "schedule_doses"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    medication_id: Mapped[int] = mapped_column(ForeignKey("medications.id"), index=True)
    dose_date: Mapped[date] = mapped_column(Date, default=date.today, index=True)
    period: Mapped[str] = mapped_column(String(16))
    dose_time: Mapped[datetime] = mapped_column(DateTime)
    dosage: Mapped[str] = mapped_column(String(64))
    usage: Mapped[str] = mapped_column(String(255), default="")
    status: Mapped[str] = mapped_column(String(16), default="pending")
    user: Mapped[User] = relationship(back_populates="doses")


class HealthRecord(Base):
    __tablename__ = "health_records"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    record_date: Mapped[date] = mapped_column(Date, default=date.today, index=True)
    record_time: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    systolic: Mapped[int] = mapped_column(Integer)
    diastolic: Mapped[int] = mapped_column(Integer)
    blood_sugar: Mapped[float] = mapped_column(Float)
    heart_rate: Mapped[int] = mapped_column(Integer)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    user: Mapped[User] = relationship(back_populates="health_records")


class FamilyLink(Base):
    __tablename__ = "family_links"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    family_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    relationship_name: Mapped[str] = mapped_column(String(32), default="家属")
    bound: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    user: Mapped[User] = relationship(foreign_keys=[user_id], back_populates="family_links")
    family_user: Mapped[User] = relationship(foreign_keys=[family_user_id])


class Notification(Base):
    __tablename__ = "notifications"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(128))
    detail: Mapped[str] = mapped_column(Text)
    level: Mapped[str] = mapped_column(String(16), default="info")
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
