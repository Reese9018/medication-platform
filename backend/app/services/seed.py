from datetime import date, datetime, timedelta
from sqlalchemy.orm import Session
from ..models import FamilyLink, HealthRecord, Medication, Notification, ScheduleDose, User
from ..security import hash_password


# 演示老人 / 家属的「标准档案」。
# 账号已存在但档案缺字段（旧库、半初始化、只建了账号没填资料）时，用这些值补齐，
# 保证「老人端智能用药助手」一进来就有完整档案可读，而不是空白一片。
_ELDER_PROFILE = {
    "name": "王秀兰",
    "age": 68,
    "gender": "女",
    "height": 158.0,
    "weight": 62.0,
    "role": "elder",
    "avatar_color": "#4A8265",
    "chronic_conditions": ["高血压", "2型糖尿病"],
    "allergies": ["青霉素"],
    "blood_type": "A型",
    "emergency_contact": "李明（儿子）138****6789",
}

_FAMILY_PROFILE = {
    "name": "李明",
    "age": 38,
    "gender": "男",
    "height": 175.0,
    "weight": 74.0,
    "role": "family",
    "avatar_color": "#3A85A8",
    "blood_type": "A型",
    "emergency_contact": "王秀兰（母亲）139****1234",
}


def _apply_profile(user: User, profile: dict) -> bool:
    """档案字段幂等补齐：仅填充「空值」字段，已有值不覆盖；返回是否有改动。"""
    changed = False
    for key, value in profile.items():
        current = getattr(user, key, None)
        if current in (None, "", [], 0, 0.0) and value:
            setattr(user, key, value)
            changed = True
    return changed


def _ensure_demo_accounts(db: Session) -> tuple[User, User]:
    """确保 elder / family 演示账号存在且档案完整（幂等 upsert，不触碰真实用户数据）。"""
    elder = db.query(User).filter(User.account == "elder").first()
    family = db.query(User).filter(User.account == "family").first()
    if elder is None:
        elder = User(account="elder", password_hash=hash_password("123456"), **_ELDER_PROFILE)
        db.add(elder)
    elif _apply_profile(elder, _ELDER_PROFILE):
        db.add(elder)
    if family is None:
        family = User(account="family", password_hash=hash_password("123456"), **_FAMILY_PROFILE)
        db.add(family)
    elif _apply_profile(family, _FAMILY_PROFILE):
        db.add(family)
    db.flush()
    return elder, family


def _seed_elder_medications(db: Session, elder: User) -> list[Medication]:
    """老人名下没有任何药品时，补一套完整演示药品（幂等：仅在 count==0 时执行）。"""
    meds = [
        Medication(user_id=elder.id, name="硝苯地平缓释片", generic_name="Nifedipine", spec="20mg×14片", dosage="1片", purpose="降压，用于高血压", frequency_per_day=2, times=["08:00", "20:00"], status="active", risk_level="mid", category="降压药", start_date=date.today(), end_date=date.today()+timedelta(days=128), remind_before_minutes=30, precautions="避免与葡萄柚汁同服。"),
        Medication(user_id=elder.id, name="二甲双胍缓释片", generic_name="Metformin", spec="500mg×30片", dosage="1片", purpose="降糖，用于2型糖尿病", frequency_per_day=2, times=["08:00", "18:00"], status="active", risk_level="low", category="降糖药", start_date=date.today(), remind_before_minutes=30, precautions="餐后服用。"),
        Medication(user_id=elder.id, name="阿司匹林肠溶片", spec="100mg×30片", dosage="1片", purpose="预防心血管事件", frequency_per_day=1, times=["08:00"], status="active", risk_level="mid", category="心血管药", start_date=date.today(), end_date=date.today()+timedelta(days=128), remind_before_minutes=30),
        Medication(user_id=elder.id, name="格列美脲片", spec="2mg×30片", dosage="1片", purpose="降糖", frequency_per_day=1, times=["08:00"], status="active", risk_level="high", category="降糖药", start_date=date.today(), end_date=date.today()+timedelta(days=67), remind_before_minutes=20, precautions="注意低血糖。"),
        Medication(user_id=elder.id, name="氯氮平片", spec="25mg×100片", dosage="0.5片", purpose="辅助镇静", frequency_per_day=1, times=["22:00"], status="active", risk_level="high", category="精神类药", start_date=date.today(), end_date=date.today()+timedelta(days=21), remind_before_minutes=15),
    ]
    db.add_all(meds)
    db.flush()
    return meds


def _seed_elder_records(db: Session, elder: User) -> None:
    """老人名下没有任何健康记录时，补近 7 天演示记录（幂等：仅在 count==0 时执行）。"""
    for i, values in enumerate([(132, 82, 6.1, 74), (128, 80, 5.9, 72), (135, 85, 6.4, 76), (130, 82, 6.0, 71), (142, 88, 7.2, 80), (134, 84, 6.2, 75), (131, 81, 6.1, 73)]):
        db.add(HealthRecord(user_id=elder.id, record_date=date.today()-timedelta(days=6-i), record_time=datetime.utcnow(), systolic=values[0], diastolic=values[1], blood_sugar=values[2], heart_rate=values[3]))


def _seed_elder_notifications(db: Session, elder: User) -> None:
    """老人名下没有任何通知时，补演示通知（幂等：仅在 count==0 时执行）。"""
    db.add_all([
        Notification(user_id=elder.id, title="漏服提醒", detail="昨晚氯氮平片未按时服用", level="warn"),
        Notification(user_id=elder.id, title="风险预警", detail="格列美脲与阿司匹林联用存在低血糖风险", level="danger"),
    ])


def _ensure_today_schedule(db: Session, elder: User | None) -> None:
    """每日演示数据维护：老人「今天」还没有用药计划时补一份当日计划。

    首次建库或跨天重启后，今天的用药记录/家属监护都不会因日期滚动而变空；
    已存在的历史打卡数据不会被改动。
    """
    if not elder:
        return
    today = date.today()
    exists = db.query(ScheduleDose).filter(ScheduleDose.user_id == elder.id, ScheduleDose.dose_date == today).first()
    if exists:
        return
    meds = db.query(Medication).filter(Medication.user_id == elder.id).order_by(Medication.id).all()
    if len(meds) < 5:
        return
    periods = [(meds[0], "morning", "08:00", "taken"), (meds[1], "morning", "08:00", "taken"), (meds[2], "morning", "08:00", "taken"), (meds[3], "morning", "08:00", "taken"), (meds[1], "noon", "12:30", "pending"), (meds[0], "evening", "20:00", "pending"), (meds[4], "night", "22:00", "missed")]
    for med, period, value, status in periods:
        hour, minute = map(int, value.split(":"))
        db.add(ScheduleDose(user_id=elder.id, medication_id=med.id, dose_date=today, period=period, dose_time=datetime.combine(today, datetime.min.time().replace(hour=hour, minute=minute)), dosage=med.dosage, usage="餐后口服" if period != "night" else "睡前服用", status=status))
    db.commit()


def seed_demo_data(db: Session) -> None:
    """幂等维护演示数据，保证「老人端智能用药助手」任何时候都有完整档案可读：

    - elder / family 账号不存在则创建，存在但档案缺字段则补齐——解决旧库 / 半初始化
      导致「没有录入老人档案」的问题；
    - 老人名下缺药品 / 健康记录 / 通知 / 今日计划时分别补齐；
    - 家属 ↔ 老人绑定关系幂等维护。

    只针对 elder / family 两个演示账号；真实用户（新注册账号）的数据一律不触碰。
    """
    elder, family = _ensure_demo_accounts(db)

    # 幂等补绑定：确保「家属 ↔ 老人」存在已绑定关系
    link = db.query(FamilyLink).filter(FamilyLink.user_id == elder.id, FamilyLink.family_user_id == family.id).first()
    if not link:
        db.add(FamilyLink(user_id=elder.id, family_user_id=family.id, requester_id=elder.id, relationship_name="儿子", status="active", responded_at=datetime.utcnow()))

    # 老人名下缺什么补什么（count==0 才补，避免覆盖用户自己录入/删除过的数据）
    if db.query(Medication).filter(Medication.user_id == elder.id).count() == 0:
        _seed_elder_medications(db, elder)
    if db.query(HealthRecord).filter(HealthRecord.user_id == elder.id).count() == 0:
        _seed_elder_records(db, elder)
    if db.query(Notification).filter(Notification.user_id == elder.id).count() == 0:
        _seed_elder_notifications(db, elder)
    _ensure_today_schedule(db, elder)
    db.commit()
