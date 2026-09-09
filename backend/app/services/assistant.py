import logging
import time

import httpx

from ..config import get_settings
from ..models import HealthRecord, Medication, ScheduleDose, User
from ..schemas import AICard, AssistantResponse

logger = logging.getLogger(__name__)

# 扣子（Coze）OpenAPI v3 对话接口
COZE_API_URL = "https://api.coze.cn/v3/chat"
COZE_RETRIEVE_URL = "https://api.coze.cn/v3/chat/retrieve"
COZE_MESSAGE_LIST_URL = "https://api.coze.cn/v3/chat/message/list"
COZE_TIMEOUT_SECONDS = 60
COZE_POLL_INTERVAL = 1.5  # 轮询间隔（秒）
COZE_POLL_MAX_ATTEMPTS = 40  # 最大轮询次数（约 60 秒）


# ============================================================
# 一、扣子（Coze）智能体调用
# ============================================================

def _coze_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _wait_for_completion(client: httpx.Client, chat_id: str, conversation_id: str, token: str) -> None:
    """轮询 chat/retrieve，直到会话进入 completed 状态。

    扣子机器人的回答是流式生成的：消息列表里 type=answer 的消息会先以"半截"形式出现
    （例如只写了"阿姨"两个字，剩下的还在继续生成）。如果看到非空就返回，会把半截回答
    交给前端，表现为对话只回了一个词。因此必须先等会话状态变成 completed，再取完整回答。

    返回时状态为 completed；若进入 failed/canceled 等异常终态则抛异常，由上层降级。
    """
    for _ in range(COZE_POLL_MAX_ATTEMPTS):
        time.sleep(COZE_POLL_INTERVAL)
        try:
            resp = client.get(
                COZE_RETRIEVE_URL,
                headers=_coze_headers(token),
                params={"chat_id": chat_id, "conversation_id": conversation_id},
                timeout=COZE_TIMEOUT_SECONDS,
            )
            resp.raise_for_status()
            body = resp.json()
            if body.get("code") != 0:
                raise RuntimeError(f"扣子查询会话状态失败：{body.get('msg')}")
            data = body.get("data", {})
            # 不同版本的接口字段略有差异：status 或 last_status 都可能出现
            status = data.get("status") or data.get("last_status", "")
            if status == "completed":
                return
            if status in ("failed", "canceled", "requires_action", "error"):
                raise RuntimeError(f"扣子会话异常结束：{status}（{data.get('last_error', '')}）")
        except Exception:
            # 状态接口偶发异常（网络抖动/尚未就绪）时继续轮询，不中断
            continue
    raise RuntimeError("扣子智能体响应超时（超过 60 秒）")


def _wait_for_answer(client: httpx.Client, chat_id: str, conversation_id: str, token: str) -> str:
    """先等会话完整结束，再读取并返回 assistant 的完整回答。

    修复要点：不要在看到第一条 type=answer 消息（可能是半截"阿姨"）时就返回，
    而是先通过 retrieve 确认会话到达 completed，再取消息列表里的完整回答。
    """
    _wait_for_completion(client, chat_id, conversation_id, token)
    # 会话完成后，消息列表偶尔会延迟一拍才写入完整内容，做几次短重试取到完整回答
    for _ in range(6):
        try:
            answer = _fetch_answer(client, chat_id, conversation_id, token)
            if answer and len(answer) >= 2:
                return answer
        except Exception:
            pass
        time.sleep(0.5)
    raise RuntimeError("扣子智能体响应超时（超过 60 秒）")


def _fetch_answer(client: httpx.Client, chat_id: str, conversation_id: str, token: str) -> str:
    """从扣子消息列表中提取 assistant 的回答文本。"""
    resp = client.get(
        COZE_MESSAGE_LIST_URL,
        headers=_coze_headers(token),
        params={"chat_id": chat_id, "conversation_id": conversation_id},
        timeout=COZE_TIMEOUT_SECONDS,
    )
    resp.raise_for_status()
    body = resp.json()
    if body.get("code") != 0:
        raise RuntimeError(f"扣子消息列表接口返回错误：{body.get('msg')}")
    messages = body.get("data", [])
    # 提取 type == "answer" 且 role == "assistant" 的消息内容
    answer_parts: list[str] = []
    for msg in messages:
        if msg.get("role") == "assistant" and msg.get("type") == "answer":
            content = msg.get("content", "")
            if content:
                answer_parts.append(content)
    return "\n".join(answer_parts).strip()


def call_coze(question: str, context: str, user_id: str, conversation_id: str | None = None) -> tuple[str, str]:
    """调用扣子智能体 API 并返回 (回答文本, 会话ID)。

    扣子 v3 API 非流式模式分三步：①创建会话 ②轮询状态 ③获取消息列表。
    未配置 COZE_TOKEN / COZE_BOT_ID 或接口调用失败时抛异常，由上层降级到规则模拟回答。
    user_id 用于扣子侧的用户数据隔离；custom_variables.user_info 传入用户档案与健康数据。
    conversation_id 首轮不传，扣子自动创建并返回；后续轮次带上以维持多轮对话上下文。
    """
    settings = get_settings()
    if not settings.coze_token or not settings.coze_bot_id:
        raise RuntimeError("COZE_TOKEN / COZE_BOT_ID 未配置，AI 助手走规则模拟回答")

    # 把当前用户的真实健康数据作为背景拼进提问，让智能体基于数据回答
    user_content = (
        "[用户背景资料，请优先依据这些真实数据回答]\n"
        f"{context}\n\n"
        f"[用户本次提问]\n{question}"
    )
    payload: dict = {
        "bot_id": settings.coze_bot_id,
        "user_id": user_id,  # 真实用户ID，用于扣子侧对话数据隔离
        "stream": False,
        "auto_save_history": True,
        "additional_messages": [
            {"content_type": "text", "role": "user", "type": "question", "content": user_content}
        ],
        "custom_variables": {
            "user_info": context,  # 用户档案、用药、健康数据等完整信息，供智能体变量引用
        },
    }
    # 后续轮次带上 conversation_id，维持多轮对话上下文
    if conversation_id:
        payload["conversation_id"] = conversation_id

    with httpx.Client(timeout=COZE_TIMEOUT_SECONDS) as client:
        # 第一步：创建会话
        resp = client.post(COZE_API_URL, headers=_coze_headers(settings.coze_token), json=payload)
        resp.raise_for_status()
        body = resp.json()
        if body.get("code") != 0:
            raise RuntimeError(f"扣子接口返回错误：{body.get('msg')}")
        data = body.get("data", {})
        chat_id = data.get("id", "")
        new_conversation_id = data.get("conversation_id", conversation_id or "")
        if not chat_id:
            raise RuntimeError("扣子接口未返回 chat_id")

        # 第二步：轮询消息列表，直到拿到回答
        answer = _wait_for_answer(client, chat_id, new_conversation_id, settings.coze_token)
        if not answer:
            raise RuntimeError("扣子智能体返回了空回答")

    return answer, new_conversation_id


# ============================================================
# 二、把当前用户数据拼成上下文，供智能体参考
# ============================================================

_STATUS_TEXT = {"taken": "已服", "missed": "漏服", "pending": "待服"}


def build_user_context(
    user: User,
    medications: list[Medication],
    schedule_doses: list[ScheduleDose],
    health_records: list[HealthRecord],
    risks: list,
    med_name_by_id: dict[int, str] | None = None,
) -> str:
    """把当前用户的档案、用药、今日计划、健康记录与风险分析整理为一段文本。"""
    med_name_by_id = med_name_by_id or {}
    lines: list[str] = []

    conditions = "、".join(user.chronic_conditions or []) or "无"
    allergies = "、".join(user.allergies or []) or "无"
    lines.append(
        f"【用户档案】姓名：{user.name}，年龄：{user.age}岁，性别：{user.gender}，"
        f"身高：{user.height}cm，体重：{user.weight}kg，血型：{user.blood_type or '未知'}，"
        f"慢性病：{conditions}，过敏史：{allergies}"
    )

    if medications:
        lines.append("【当前用药清单】")
        for m in medications:
            times = "、".join(m.times or []) or "未设置"
            lines.append(
                f"- {m.name}（{m.spec or '规格未填'}），每次{m.dosage}，每日{m.frequency_per_day}次，"
                f"服药时间{times}，用途：{m.purpose or '未填写'}，风险等级：{m.risk_level}，"
                f"注意事项：{m.precautions or '无'}"
            )
    else:
        lines.append("【当前用药清单】无")

    if schedule_doses:
        lines.append("【今日用药计划】")
        for d in schedule_doses:
            name = med_name_by_id.get(d.medication_id, f"药品#{d.medication_id}")
            status = _STATUS_TEXT.get(d.status, d.status)
            dose_time = d.dose_time.strftime("%H:%M") if d.dose_time else "时间未定"
            lines.append(f"- {dose_time} {name}，{d.dosage}，{d.usage or '口服'}，状态：{status}")
    else:
        lines.append("【今日用药计划】今日暂无计划")

    if health_records:
        lines.append("【近期健康记录（最近一条在前）】")
        for r in health_records:
            rec_time = r.record_time.strftime("%H:%M") if r.record_time else ""
            lines.append(
                f"- {r.record_date} {rec_time} 血压{r.systolic}/{r.diastolic} mmHg，"
                f"血糖{r.blood_sugar} mmol/L，心率{r.heart_rate} 次/分"
            )
    else:
        lines.append("【近期健康记录】暂无记录")

    if risks:
        lines.append("【用药风险分析】")
        for r in risks:
            lines.append(f"- [{r.level}] {r.type}：{r.reason}（建议：{r.suggestion}）")
    else:
        lines.append("【用药风险分析】暂无风险")

    return "\n".join(lines)


# ============================================================
# 三、统一入口：优先扣子，未配置/失败时降级到规则模拟回答
# ============================================================

def answer_question(question: str, context: str = "", user_id: str = "guest", conversation_id: str | None = None) -> AssistantResponse:
    """统一入口：优先走扣子智能体；调用失败时降级到规则模拟回答。

    扣子调用失败（未配置/超时/接口异常）不再把堆栈暴露给前端，
    而是记入后端日志，并返回 _fallback_answer 的规则回答，保证前端体验稳定。
    """
    try:
        answer, new_conversation_id = call_coze(question, context, user_id, conversation_id)
        return AssistantResponse(content=answer, cards=[], conversation_id=new_conversation_id)
    except Exception as e:
        logger.warning("扣子智能体调用失败，已降级到规则模拟回答：%s", e)
        return _fallback_answer(question)


# ============================================================
# 四、原有规则模拟回答（降级兜底，前端无需改动）
# ============================================================

def _fallback_answer(question: str) -> AssistantResponse:
    if "今天" in question or "吃哪些药" in question:
        return AssistantResponse(content="根据今日模拟用药计划，您需要按照早晨、午间、晚间和睡前四个时间段服药。请打开用药计划确认具体时间。", cards=[AICard(type="medication", title="今日用药计划", detail="早晨4种、午间1种、晚间1种、睡前1种药品", medications=["硝苯地平缓释片", "二甲双胍缓释片", "阿司匹林肠溶片", "格列美脲片", "氯氮平片"]), AICard(type="action", title="查看计划", actions=[{"label": "前往用药计划", "to": "/schedule"}])])
    if "漏服" in question:
        return AssistantResponse(content="漏服处理需要结合药品和距离下次服药的时间判断。不要自行加倍补服，建议查看说明书并咨询医生或药师。", cards=[AICard(type="risk", title="漏服安全提醒", detail="接近下一次服药时间时通常不建议补服；切勿一次服用双倍剂量。", level="mid"), AICard(type="action", title="查看用药记录", actions=[{"label": "打开用药计划", "to": "/schedule"}])])
    if "血压" in question:
        return AssistantResponse(content="根据模拟健康数据，近7天血压整体较稳定，但有一次晚间略高，建议继续记录并关注趋势。", cards=[AICard(type="health", title="健康趋势", detail="收缩压平均约133 mmHg，舒张压平均约83 mmHg。"), AICard(type="action", title="查看健康数据", actions=[{"label": "打开健康数据", "to": "/health"}])])
    if "水果" in question or "食物" in question:
        return AssistantResponse(content="用药期间请特别注意食物相互作用。葡萄柚或西柚汁可能影响部分降压药代谢。", cards=[AICard(type="risk", title="葡萄柚/西柚汁", detail="服用硝苯地平期间建议避免食用，以免增加血药浓度。", level="high", medications=["硝苯地平缓释片"]), AICard(type="tip", title="饮食建议", detail="水果适量，两餐之间食用，并持续关注血糖。")])
    if "冲突" in question or "一起吃" in question:
        return AssistantResponse(content="模拟分析发现降糖药与阿司匹林联用需要关注低血糖风险，同时应留意氯氮平与降压药叠加造成的体位性低血压。", cards=[AICard(type="risk", title="低血糖风险", detail="格列美脲与阿司匹林、二甲双胍联用需要监测血糖。", level="high", medications=["格列美脲片", "阿司匹林肠溶片"]), AICard(type="risk", title="体位性低血压", detail="夜间起身宜先坐立片刻，避免突然站起。", level="mid", medications=["氯氮平片", "硝苯地平缓释片"]), AICard(type="action", title="查看风险分析", actions=[{"label": "打开风险中心", "to": "/risk"}])])
    return AssistantResponse(content="我可以根据您的药品、健康档案和健康数据提供用药辅助建议。请描述具体药品、症状或健康指标。", cards=[AICard(type="tip", title="健康提示", detail="本助手为模拟健康管理功能，不能替代医生或药师的专业判断。")])
