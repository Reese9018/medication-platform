from datetime import date, datetime, timedelta
from sqlalchemy.orm import Session
from ..models import FamilyLink, HealthRecord, Medication, Notification, ScheduleDose, User
from ..security import hash_password


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
    # 幂等补绑定：即使库中已有演示账号（旧库），也确保「家属 ↔ 老人」存在已绑定关系
    elder = db.query(User).filter(User.account == "elder").first()
    family = db.query(User).filter(User.account == "family").first()
    if elder and family:
        link = db.query(FamilyLink).filter(FamilyLink.user_id == elder.id, FamilyLink.family_user_id == family.id).first()
        if not link:
            db.add(FamilyLink(user_id=elder.id, family_user_id=family.id, requester_id=elder.id, relationship_name="儿子", status="active", responded_at=datetime.utcnow()))
            db.commit()

    if db.query(User).count():
        _ensure_today_schedule(db, elder)
        return
    elder = User(account="elder", password_hash=hash_password("123456"), name="王秀兰", age=68, gender="女", height=158, weight=62, role="elder", avatar_color="#4A8265", chronic_conditions=["高血压", "2型糖尿病"], allergies=["青霉素"], blood_type="A型", emergency_contact="李明（儿子）138****6789")
    family = User(account="family", password_hash=hash_password("123456"), name="李明", age=38, gender="男", height=175, weight=74, role="family", avatar_color="#3A85A8", blood_type="A型", emergency_contact="王秀兰（母亲）139****1234")
    db.add_all([elder, family]); db.flush()
    db.add(FamilyLink(user_id=elder.id, family_user_id=family.id, requester_id=elder.id, relationship_name="儿子", status="active", responded_at=datetime.utcnow()))
    meds = [
        Medication(user_id=elder.id, name="硝苯地平缓释片", generic_name="Nifedipine", spec="20mg×14片", dosage="1片", purpose="降压，用于高血压", frequency_per_day=2, times=["08:00", "20:00"], status="active", risk_level="mid", category="降压药", start_date=date.today(), end_date=date.today()+timedelta(days=128), remind_before_minutes=30, precautions="避免与葡萄柚汁同服。"),
        Medication(user_id=elder.id, name="二甲双胍缓释片", generic_name="Metformin", spec="500mg×30片", dosage="1片", purpose="降糖，用于2型糖尿病", frequency_per_day=2, times=["08:00", "18:00"], status="active", risk_level="low", category="降糖药", start_date=date.today(), remind_before_minutes=30, precautions="餐后服用。"),
        Medication(user_id=elder.id, name="阿司匹林肠溶片", spec="100mg×30片", dosage="1片", purpose="预防心血管事件", frequency_per_day=1, times=["08:00"], status="active", risk_level="mid", category="心血管药", start_date=date.today(), end_date=date.today()+timedelta(days=128), remind_before_minutes=30),
        Medication(user_id=elder.id, name="格列美脲片", spec="2mg×30片", dosage="1片", purpose="降糖", frequency_per_day=1, times=["08:00"], status="active", risk_level="high", category="降糖药", start_date=date.today(), end_date=date.today()+timedelta(days=67), remind_before_minutes=20, precautions="注意低血糖。"),
        Medication(user_id=elder.id, name="氯氮平片", spec="25mg×100片", dosage="0.5片", purpose="辅助镇静", frequency_per_day=1, times=["22:00"], status="active", risk_level="high", category="精神类药", start_date=date.today(), end_date=date.today()+timedelta(days=21), remind_before_minutes=15),
    ]
    db.add_all(meds); db.flush()
    periods = [(meds[0], "morning", "08:00", "taken"), (meds[1], "morning", "08:00", "taken"), (meds[2], "morning", "08:00", "taken"), (meds[3], "morning", "08:00", "taken"), (meds[1], "noon", "12:30", "pending"), (meds[0], "evening", "20:00", "pending"), (meds[4], "night", "22:00", "missed")]
    for med, period, value, status in periods:
        hour, minute = map(int, value.split(":"))
        db.add(ScheduleDose(user_id=elder.id, medication_id=med.id, dose_date=date.today(), period=period, dose_time=datetime.combine(date.today(), datetime.min.time().replace(hour=hour, minute=minute)), dosage=med.dosage, usage="餐后口服" if period != "night" else "睡前服用", status=status))
    for i, values in enumerate([(132,82,6.1,74),(128,80,5.9,72),(135,85,6.4,76),(130,82,6.0,71),(142,88,7.2,80),(134,84,6.2,75),(131,81,6.1,73)]):
        db.add(HealthRecord(user_id=elder.id, record_date=date.today()-timedelta(days=6-i), record_time=datetime.utcnow(), systolic=values[0], diastolic=values[1], blood_sugar=values[2], heart_rate=values[3]))
    db.add_all([Notification(user_id=elder.id, title="漏服提醒", detail="昨晚氯氮平片未按时服用", level="warn"), Notification(user_id=elder.id, title="风险预警", detail="格列美脲与阿司匹林联用存在低血糖风险", level="danger")])
    db.commit()
