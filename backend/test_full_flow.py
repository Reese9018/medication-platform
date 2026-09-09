"""模拟 HTTP 接口完整流程，排查 call_coze 异常原因。"""
import os
import sys
import traceback

os.chdir(os.path.dirname(os.path.abspath(__file__)))

from datetime import date
from app.config import get_settings
from app.database import SessionLocal, engine
from app.models import HealthRecord, Medication, ScheduleDose, User
from app.services.assistant import answer_question, build_user_context, call_coze
from app.services.risk import list_risks

# 清除配置缓存
get_settings.cache_clear()

print("=== 连接数据库 ===")
db = SessionLocal()

try:
    # 查询用户
    user = db.query(User).filter(User.account == "elder").first()
    print(f"用户: {user.name}, id={user.id}")

    # 查询药品、日程、健康数据
    medications = db.query(Medication).filter(Medication.user_id == user.id).all()
    print(f"药品数量: {len(medications)}")

    schedule_doses = db.query(ScheduleDose).filter(
        ScheduleDose.user_id == user.id,
        ScheduleDose.dose_date == date.today()
    ).all()
    print(f"今日日程数量: {len(schedule_doses)}")

    health_records = db.query(HealthRecord).filter(HealthRecord.user_id == user.id).all()
    print(f"健康记录数量: {len(health_records)}")

    risks = list_risks(user, medications)
    print(f"风险数量: {len(risks)}")

    med_name_by_id = {m.id: m.name for m in medications}
    context = build_user_context(user, medications, schedule_doses, health_records, risks, med_name_by_id)
    print(f"\n=== context 长度: {len(context)} 字符 ===")
    print(f"context 前200字: {context[:200]}")

    print("\n=== 调用 call_coze ===")
    try:
        answer, conversation_id = call_coze(
            question="头孢和酒能一起吃吗？",
            context=context,
            user_id=str(user.id),
            conversation_id=None,
        )
        print(f"成功！conversation_id: {conversation_id}")
        print(f"回答前300字: {answer[:300]}")
    except Exception as e:
        print(f"失败！异常类型: {type(e).__name__}")
        print(f"异常信息: {e}")
        print("\n=== 完整堆栈 ===")
        traceback.print_exc()

finally:
    db.close()
