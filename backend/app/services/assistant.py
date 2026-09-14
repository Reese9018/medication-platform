"""AI 智能用药助手服务。

分三层：
1. call_coze          —— 调用扣子（Coze）智能体，回答质量最好，但耗时 8~50 秒
2. build_profile_summary —— 把老人档案整理成结构化摘要，前端用来展示「AI 已读到什么」
3. answer_from_context   —— 本地兜底应答引擎：即使扣子未配置/超时/断网，
                            也能基于真实档案、用药、健康数据回答各类问题，
                            而不是只丢一句「我已了解您的问题」。

设计原则：所有回答都必须基于用户的真实数据（档案/用药/今日计划/健康记录/风险），
读不到数据时明确告诉用户「我不知道」，并引导去补录，绝不编造数值。
"""

import logging
import time
from dataclasses import dataclass, field

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
# 轮询节奏：前几拍密一点（多数回答 8~15 秒就好），后面放宽避免空转。
COZE_POLL_SCHEDULE = [0.8, 0.8, 1.0, 1.0, 1.2, 1.2, 1.5, 1.5, 2.0, 2.0]
COZE_POLL_MAX_ATTEMPTS = 30


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
    for attempt in range(COZE_POLL_MAX_ATTEMPTS):
        time.sleep(COZE_POLL_SCHEDULE[min(attempt, len(COZE_POLL_SCHEDULE) - 1)])
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

    不要在看到第一条 type=answer 消息（可能是半截"阿姨"）时就返回，
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
    未配置 COZE_TOKEN / COZE_BOT_ID 或接口调用失败时抛异常，由上层降级到本地应答引擎。
    user_id 用于扣子侧的用户数据隔离；custom_variables.user_info 传入用户档案与健康数据。
    conversation_id 首轮不传，扣子自动创建并返回；后续轮次带上以维持多轮对话上下文。
    """
    settings = get_settings()
    if not settings.coze_token or not settings.coze_bot_id:
        raise RuntimeError("COZE_TOKEN / COZE_BOT_ID 未配置，AI 助手走本地应答引擎")

    # 把当前用户的真实健康数据作为背景拼进提问，让智能体基于数据回答
    user_content = (
        "[用户背景资料，请优先依据这些真实数据回答；资料里没有的内容不要编造]\n"
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

        # 第二步：轮询消息列表，直到拿到完整回答
        answer = _wait_for_answer(client, chat_id, new_conversation_id, settings.coze_token)
        if not answer:
            raise RuntimeError("扣子智能体返回了空回答")

    return answer, new_conversation_id


# ============================================================
# 二、把当前用户数据整理成上下文（给智能体）+ 档案摘要（给前端）
# ============================================================

_STATUS_TEXT = {"taken": "已服", "missed": "漏服", "pending": "待服"}
_PERIOD_TEXT = {"morning": "早晨", "noon": "午间", "evening": "晚间", "night": "睡前"}


@dataclass
class AssistantContext:
    """助手回答所需的全部真实数据，一次查库组装，渲染文本与本地应答共用。"""

    user: User
    medications: list[Medication] = field(default_factory=list)
    doses: list[ScheduleDose] = field(default_factory=list)
    records: list[HealthRecord] = field(default_factory=list)
    risks: list = field(default_factory=list)
    med_name_by_id: dict[int, str] = field(default_factory=dict)

    # ---------- 派生数据 ----------
    @property
    def active_medications(self) -> list[Medication]:
        items = [m for m in self.medications if (m.status or "active") == "active"]
        return items or list(self.medications)

    def med_name(self, medication_id: int) -> str:
        return self.med_name_by_id.get(medication_id, f"药品#{medication_id}")

    def latest_record(self) -> HealthRecord | None:
        return self.records[0] if self.records else None

    def dose_stats(self) -> dict[str, int]:
        stats = {"total": len(self.doses), "taken": 0, "pending": 0, "missed": 0}
        for d in self.doses:
            if d.status in stats:
                stats[d.status] += 1
        return stats

    def match_medications(self, text: str) -> list[Medication]:
        """从提问里找出被提到的药品：先匹配药名/通用名，再匹配药品分类口语（降压药、降糖药）。"""
        lowered = text.lower()
        hits: list[Medication] = []
        for m in self.medications:
            name = m.name or ""
            generic = (m.generic_name or "").lower()
            if name and name in text:
                hits.append(m)
            elif generic and len(generic) >= 4 and generic in lowered:
                hits.append(m)
        if hits:
            return hits
        # 药名没命中时按分类猜："降压药""降糖药"这类口语
        for m in self.medications:
            category = (m.category or "").strip()
            if category and category not in ("其他",) and category in text:
                hits.append(m)
        return hits

    # ---------- 渲染给智能体的文本 ----------
    def render_text(self) -> str:
        lines: list[str] = []
        u = self.user
        conditions = "、".join(_as_str_list(u.chronic_conditions)) or "无"
        allergies = "、".join(_as_str_list(u.allergies)) or "未填写"
        lines.append(
            f"【用户档案】姓名：{u.name or '未填写'}，年龄：{u.age or '未填写'}岁，性别：{u.gender or '未填写'}，"
            f"身高：{u.height or '未填写'}cm，体重：{u.weight or '未填写'}kg，血型：{u.blood_type or '未填写'}，"
            f"慢性病：{conditions}，过敏史：{allergies}，紧急联系人：{u.emergency_contact or '未填写'}"
        )

        if self.medications:
            lines.append("【当前用药清单】")
            for m in self.medications:
                times = "、".join(_as_str_list(m.times)) or "未设置"
                lines.append(
                    f"- {m.name}（{m.spec or '规格未填'}），每次{m.dosage or '未填写'}，每日{m.frequency_per_day or 1}次，"
                    f"服药时间{times}，用途：{m.purpose or '未填写'}，分类：{m.category or '未分类'}，"
                    f"风险等级：{m.risk_level or 'low'}，注意事项：{m.precautions or '无'}"
                )
        else:
            lines.append("【当前用药清单】无")

        if self.doses:
            lines.append("【今日用药计划】")
            for d in self.doses:
                status = _STATUS_TEXT.get(d.status, d.status)
                dose_time = d.dose_time.strftime("%H:%M") if d.dose_time else "时间未定"
                lines.append(f"- {dose_time} {self.med_name(d.medication_id)}，{d.dosage}，{d.usage or '口服'}，状态：{status}")
        else:
            lines.append("【今日用药计划】今日暂无计划")

        if self.records:
            lines.append("【近期健康记录（最近一条在前）】")
            for r in self.records[:14]:
                rec_time = r.record_time.strftime("%H:%M") if r.record_time else ""
                lines.append(
                    f"- {r.record_date} {rec_time} 血压{r.systolic}/{r.diastolic} mmHg，"
                    f"血糖{r.blood_sugar} mmol/L，心率{r.heart_rate} 次/分"
                )
        else:
            lines.append("【近期健康记录】暂无记录")

        if self.risks:
            lines.append("【用药风险分析】")
            for r in self.risks:
                lines.append(f"- [{r.level}] {r.type}：{r.reason}（建议：{r.suggestion}）")
        else:
            lines.append("【用药风险分析】暂无风险")

        return "\n".join(lines)


def _as_str_list(value) -> list[str]:
    if not value:
        return []
    if isinstance(value, str):
        return [value]
    return [str(v) for v in value]


# 判断档案是否「录入完整」所必须的字段（缺哪项就在助手页提示补哪项）
_PROFILE_REQUIRED_FIELDS = ["年龄", "身高", "体重", "血型", "慢性病史", "紧急联系人", "在服药品"]


def build_profile_summary(ctx: AssistantContext) -> dict:
    """整理「AI 已读到的老人档案」摘要，供前端在助手页可视化展示。

    同时给出 missing_fields，前端据此提示「档案还没录全，去补一下」——
    这是原来的助手页完全缺失的部分：页面声称"已读取健康档案"，但用户看不到读了什么。
    """
    u = ctx.user
    latest = ctx.latest_record()
    stats = ctx.dose_stats()
    conditions = _as_str_list(u.chronic_conditions)
    allergies = _as_str_list(u.allergies)

    missing: list[str] = []
    if not u.age:
        missing.append("年龄")
    if not u.height:
        missing.append("身高")
    if not u.weight:
        missing.append("体重")
    if not u.blood_type:
        missing.append("血型")
    if not conditions:
        missing.append("慢性病史")
    if not u.emergency_contact:
        missing.append("紧急联系人")
    if not ctx.active_medications:
        missing.append("在服药品")

    completeness = round((len(_PROFILE_REQUIRED_FIELDS) - len(missing)) / len(_PROFILE_REQUIRED_FIELDS) * 100)

    return {
        "name": u.name or "未填写",
        "age": u.age,
        "gender": u.gender or "",
        "height": u.height,
        "weight": u.weight,
        "blood_type": u.blood_type or "",
        "chronic_conditions": conditions,
        "allergies": allergies,
        "emergency_contact": u.emergency_contact or "",
        "active_medication_count": len(ctx.active_medications),
        "today_total": stats["total"],
        "today_taken": stats["taken"],
        "today_pending": stats["pending"],
        "today_missed": stats["missed"],
        "latest_bp": f"{latest.systolic}/{latest.diastolic}" if latest else "",
        "latest_blood_sugar": latest.blood_sugar if latest else None,
        "latest_heart_rate": latest.heart_rate if latest else None,
        "record_count": len(ctx.records),
        "risk_count": len(ctx.risks),
        "completeness": min(100, max(0, completeness)),
        "missing_fields": missing,
    }


def build_user_context(
    user: User,
    medications: list[Medication],
    schedule_doses: list[ScheduleDose],
    health_records: list[HealthRecord],
    risks: list,
    med_name_by_id: dict[int, str] | None = None,
) -> str:
    """把当前用户的档案、用药、今日计划、健康记录与风险分析整理为一段文本。

    保留此函数作为便捷入口（历史调用方/测试仍在用），内部走 AssistantContext.render_text。
    """
    ctx = AssistantContext(
        user=user,
        medications=medications,
        doses=schedule_doses,
        records=health_records,
        risks=risks,
        med_name_by_id=med_name_by_id or {},
    )
    return ctx.render_text()


# ============================================================
# 三、统一入口：优先扣子，未配置/失败时降级到本地应答引擎
# ============================================================

def answer_question(
    question: str,
    context: str = "",
    user_id: str = "guest",
    conversation_id: str | None = None,
    ctx: AssistantContext | None = None,
) -> AssistantResponse:
    """统一入口：优先走扣子智能体；调用失败时降级到本地应答引擎。

    扣子调用失败（未配置/超时/接口异常）不再把堆栈暴露给前端，
    而是记入后端日志，并返回本地应答引擎基于真实数据的回答，
    保证任何问题都能得到有针对性的答复，前端体验稳定。
    """
    try:
        answer, new_conversation_id = call_coze(question, context, user_id, conversation_id)
        return AssistantResponse(content=answer, cards=[], conversation_id=new_conversation_id, source="ai")
    except Exception as e:
        logger.warning("扣子智能体调用失败，已降级到本地应答引擎：%s", e)
        response = answer_from_context(question, ctx, context)
        response.source = "local"
        return response


# ============================================================
# 四、本地应答引擎（兜底）：基于真实档案/用药/健康数据回答各类问题
# ============================================================
#
# 关键改动：原实现只有 5 个固定关键词分支（今天/漏服/血压/水果/冲突），
# 其余问题一律回「我已了解您的问题…请试试左侧快捷问题」——这就是用户反馈的
# 「不能问他其他问题，不能智能回答」。现在改为多意图识别 + 数据填充式回答，
# 覆盖档案查询、药品作用/用法/副作用、饮食禁忌、指标解读、复诊、运动、睡眠、
# 情绪、家属、报告、急救等，且所有数值都来自用户真实数据，读不到就明说。

_MED_KNOWLEDGE: dict[str, dict[str, str]] = {
    "地平": {
        "class": "钙通道阻滞剂（降压药）",
        "action": "通过放松血管、扩张血管来降低血压，常用于高血压和心绞痛。",
        "side": "可能出现脚踝水肿、面部潮红、头痛、心跳偏快，一般用药初期明显，之后多会减轻。",
    },
    "普利": {
        "class": "血管紧张素转换酶抑制剂（降压药）",
        "action": "抑制血管紧张素生成，扩张血管降压，同时对心脏和肾脏有保护作用。",
        "side": "部分人会出现干咳，少数人血钾升高，需要定期复查肾功能和血钾。",
    },
    "沙坦": {
        "class": "血管紧张素受体拮抗剂（降压药）",
        "action": "阻断血管紧张素受体来降压，作用平稳，通常不会引起干咳。",
        "side": "偶有头晕、血钾升高，需要定期复查肾功能。",
    },
    "洛尔": {
        "class": "β受体阻滞剂",
        "action": "减慢心率、降低心肌耗氧，常用于高血压、冠心病、心律失常。",
        "side": "可能心跳偏慢、乏力、手脚发凉，不能自行突然停药。",
    },
    "二甲双胍": {
        "class": "双胍类降糖药",
        "action": "减少肝脏输出葡萄糖、改善胰岛素抵抗，是2型糖尿病的基础用药。",
        "side": "常见胃肠不适、腹泻，随餐或餐后服用可减轻；肾功能明显异常时需医生评估。",
    },
    "格列": {
        "class": "磺脲类降糖药",
        "action": "刺激胰岛β细胞分泌胰岛素来降血糖。",
        "side": "低血糖风险较高，按时进餐、随身带糖；漏服后切勿自行加倍。",
    },
    "阿卡波糖": {
        "class": "α-糖苷酶抑制剂",
        "action": "延缓碳水吸收，降低餐后血糖，需与第一口饭同服。",
        "side": "常见腹胀、排气增多；发生低血糖时要直接吃葡萄糖而不是蔗糖。",
    },
    "阿司匹林": {
        "class": "抗血小板药",
        "action": "抑制血小板聚集，预防心梗、脑梗等血栓事件。",
        "side": "可能胃部不适、牙龈或皮肤易出血、大便发黑，出现这些要尽快就医。",
    },
    "他汀": {
        "class": "调脂药",
        "action": "降低胆固醇，稳定血管斑块，降低心脑血管事件风险。",
        "side": "少数人肌肉酸痛、肝酶升高，需定期复查血脂和肝功能。",
    },
    "氯氮平": {
        "class": "抗精神病药",
        "action": "用于精神症状控制或辅助镇静，需严格按医嘱剂量服用。",
        "side": "可能嗜睡、头晕、体位性低血压、便秘，起身要慢；不可自行停药或加量。",
    },
}

# 常见食物/饮品与慢病用药的注意事项
_FOOD_RULES: list[tuple[tuple[str, ...], str, str]] = [
    (("葡萄柚", "西柚", "柚子汁"), "high", "葡萄柚（西柚）会抑制肝脏代谢酶，让部分降压药、他汀类药的血药浓度明显升高，可能导致血压过低或肌肉损伤。服药期间请避免食用。"),
    (("酒", "白酒", "啤酒", "红酒", "饮酒"), "high", "酒精会加强降压药和镇静类药物的作用，容易引起低血压、头晕、跌倒，也会干扰血糖控制。服药期间建议不饮酒。"),
    (("牛奶", "豆浆"), "low", "牛奶、豆浆本身与常用慢病药没有严重冲突，但建议与服药时间错开 1~2 小时，避免影响吸收；也要注意别选含糖量高的调味奶。"),
    (("浓茶", "茶", "咖啡", "可乐"), "mid", "浓茶、咖啡含咖啡因，可能让心率加快、血压波动，也会影响睡眠。建议与服药时间错开，下午以后少喝。"),
    (("西芹", "芹菜"), "low", "芹菜本身对血压友好，但大量食用时注意监测血压，避免血压偏低。"),
    (("香蕉", "橙子", "橘子", "菠菜", "土豆", "紫菜"), "mid", "这类食物富含钾。服用普利类、沙坦类降压药或保钾利尿剂时，大量摄入可能让血钾升高，建议适量并定期复查血钾。"),
    (("西瓜", "葡萄", "荔枝", "芒果", "甜"), "mid", "高糖水果会让血糖明显波动，建议放在两餐之间、每次一小份，并监测餐后血糖。"),
    (("苹果", "梨", "草莓", "樱桃"), "low", "苹果、梨、草莓等升糖较慢，比较适合作为加餐，仍建议一次一小份。"),
    (("盐", "咸菜", "腌", "腊肉", "酱油"), "high", "高盐饮食是血压升高的重要原因。建议每天食盐控制在 5 克以内，少吃咸菜、腌制品和加工肉。"),
]


def answer_from_context(question: str, ctx: AssistantContext | None, context_text: str = "") -> AssistantResponse:
    """本地应答引擎：识别问题意图，用用户真实数据组织回答。

    ctx 为空（理论上不该发生）时退化为通用安全提示，不再输出无信息量的模板话术。
    """
    q = (question or "").strip()
    if ctx is None:
        return _generic_answer(q)

    # 「水果」这种泛问，实际最常关心的是葡萄柚（西柚）——直接按最需要警惕的那条回答
    for generic, alias in (("水果", "葡萄柚"), ("果汁", "葡萄柚")):
        if generic in q and alias not in q:
            q = f"{q} {alias}"

    # 0) 急救优先：出现危险症状先给明确行动指引
    emergency = _emergency_answer(q)
    if emergency:
        return emergency

    # 顺序即优先级：越是具体/特殊的意图越靠前，泛化的意图（今日用药、药品详情）
    # 放在后面，避免「我今天心情不好」被「今天」两个字误判成「查今日用药」。
    handlers = [
        _answer_allergy,
        _answer_mood,
        _answer_side_effect,
        _answer_adherence,
        _answer_missed_dose,
        _answer_blood_pressure,
        _answer_blood_sugar,
        _answer_heart_rate,
        _answer_body_metrics,
        _answer_food,
        _answer_interaction,
        _answer_exercise,
        _answer_sleep,
        _answer_recheck,
        _answer_stop_or_adjust,
        _answer_report,
        _answer_reminder,
        _answer_risk_overview,
        _answer_family,
        _answer_profile,
        _answer_medication_detail,
        _answer_today_plan,
        _answer_greeting,
    ]
    for handler in handlers:
        response = handler(q, ctx)
        if response is not None:
            return response
    return _grounded_fallback(q, ctx)


# ---------- 各意图实现 ----------

_EMERGENCY_KEYWORDS = (
    "胸痛", "胸口痛", "胸闷", "心绞痛", "呼吸困难", "喘不上气", "昏倒", "晕倒", "昏迷",
    "抽搐", "嘴歪", "半边身子", "说话不清", "大出血", "咯血", "便血", "剧烈头痛",
    "视力模糊", "心跳特别快", "心慌得厉害",
)


def _emergency_answer(q: str) -> AssistantResponse | None:
    if not any(k in q for k in _EMERGENCY_KEYWORDS):
        return None
    return AssistantResponse(
        content=(
            "您描述的情况需要马上处理，请先别自己判断、也别自行加药或停药：\n\n"
            "1. 如果现在正难受，请立刻拨打 **120**，或让身边人马上送医。\n"
            "2. 保持坐位或半卧位休息，不要剧烈活动，解开领口，保持呼吸顺畅。\n"
            "3. 带上您的药盒或用药清单，医生需要知道您正在吃的每一种药。\n\n"
            "如果是低血糖引起的心慌、出冷汗、手抖，可以立刻吃两块糖或喝半杯含糖饮料，"
            "15 分钟后再测一次血糖，没有好转也要立即就医。"
        ),
        cards=[
            AICard(
                type="risk",
                title="紧急情况：请立即就医",
                level="high",
                detail="胸痛、呼吸困难、意识不清、肢体无力等可能是心脑血管急症，必须由医生处理。",
            ),
            AICard(type="tip", title="随身信息", detail="就医时请告知医生您的慢性病史、过敏史和当前全部用药。"),
        ],
        source="local",
    )


def _answer_profile(q: str, ctx: AssistantContext) -> AssistantResponse | None:
    """档案查询：让老人随时能看到 AI 到底「记住了我什么」。"""
    keys = ("我的档案", "我的信息", "我是谁", "我叫什么", "我多大", "我的年龄", "我的资料",
            "我的病史", "慢性病", "我的血型", "个人信息", "建档", "健康档案", "我有什么病")
    if not any(k in q for k in keys):
        return None
    s = build_profile_summary(ctx)
    lines = [
        f"我这边记录到的您的健康档案是这样的：\n",
        f"- 姓名：{s['name']}",
        f"- 年龄：{s['age'] or '未填写'}　性别：{s['gender'] or '未填写'}",
        f"- 身高：{s['height'] or '未填写'} cm　体重：{s['weight'] or '未填写'} kg　血型：{s['blood_type'] or '未填写'}",
        f"- 慢性病史：{'、'.join(s['chronic_conditions']) or '未填写'}",
        f"- 过敏史：{'、'.join(s['allergies']) or '未填写'}",
        f"- 在服药品：{s['active_medication_count']} 种",
        f"- 紧急联系人：{s['emergency_contact'] or '未填写'}",
    ]
    cards: list[AICard] = []
    if s["missing_fields"]:
        lines.append(f"\n有 {len(s['missing_fields'])} 项还没录全：{'、'.join(s['missing_fields'])}。"
                     "补全之后我能给您更贴合的建议。")
        cards.append(AICard(
            type="action",
            title="完善档案",
            actions=[{"label": "去完善健康档案", "to": "/profile"}],
        ))
    else:
        lines.append("\n档案信息已经录全啦，我会一直结合这些信息给您建议。")
    cards.append(AICard(type="tip", title="温馨提示", detail="档案有变化（比如新查出的病、新换的药）记得及时更新。"))
    return AssistantResponse(content="\n".join(lines), cards=cards, source="local")


def _answer_today_plan(q: str, ctx: AssistantContext) -> AssistantResponse | None:
    keys = ("今天吃", "今天要", "今天该", "今天的药", "今日用药", "今日吃", "哪些药", "什么药",
            "用药计划", "服药计划", "几点吃", "该吃药", "还要吃", "接下来", "下一个", "服药安排",
            "吃哪些", "吃什么")
    if not any(k in q for k in keys):
        return None
    if not ctx.doses:
        return AssistantResponse(
            content="今天还没有生成用药计划。您可以先确认「我的药品」里每种药的服用时间和次数是否填好了，"
                    "填好之后系统会自动排出每天的用药计划。",
            cards=[AICard(type="action", title="去检查药品", actions=[{"label": "打开我的药品", "to": "/medications"}])],
            source="local",
        )
    stats = ctx.dose_stats()
    pending = [d for d in ctx.doses if d.status == "pending"]
    missed = [d for d in ctx.doses if d.status == "missed"]

    lines = [f"今天一共 {stats['total']} 次用药，已经记录完成 {stats['taken']} 次，"
             f"待服 {stats['pending']} 次，漏服 {stats['missed']} 次。\n"]
    cards: list[AICard] = []
    if pending:
        lines.append("**接下来要吃的药：**")
        for d in pending:
            t = d.dose_time.strftime("%H:%M") if d.dose_time else "时间未定"
            lines.append(f"- {t}　{ctx.med_name(d.medication_id)}　{d.dosage}（{d.usage or '口服'}）")
        cards.append(AICard(
            type="medication",
            title="接下来待服用药",
            detail="；".join(
                f"{d.dose_time.strftime('%H:%M') if d.dose_time else '时间未定'} {ctx.med_name(d.medication_id)} {d.dosage}"
                for d in pending
            ),
            medications=[ctx.med_name(d.medication_id) for d in pending],
        ))
    else:
        lines.append("今天剩下的药都已经记录完成了，很不错。")
    if missed:
        lines.append("\n**已漏服的：**")
        for d in missed:
            t = d.dose_time.strftime("%H:%M") if d.dose_time else "时间未定"
            lines.append(f"- {t}　{ctx.med_name(d.medication_id)}　{d.dosage}")
        lines.append("漏服的药不要一次吃双倍补回来，具体可以问我「漏服了怎么办」。")
    cards.append(AICard(type="action", title="查看完整计划", actions=[{"label": "打开用药计划", "to": "/schedule"}]))
    return AssistantResponse(content="\n".join(lines), cards=cards, source="local")


def _answer_medication_detail(q: str, ctx: AssistantContext) -> AssistantResponse | None:
    keys = ("作用", "功效", "治什么", "干什么用", "什么用", "用途", "怎么吃", "吃几片", "吃多少",
            "剂量", "用法", "什么时候吃", "饭前", "饭后", "是什么药", "适应", "说明书", "成分")
    matched = ctx.match_medications(q)
    if not any(k in q for k in keys) and not matched:
        return None

    targets = matched or ctx.active_medications[:3]
    if not targets:
        return AssistantResponse(
            content="我这边还没有您的用药记录，所以没法告诉您某种药的具体用法。"
                    "请先在「我的药品」里添加您正在吃的药，之后我就能按您的实际情况解答了。",
            cards=[AICard(type="action", title="添加药品", actions=[{"label": "打开我的药品", "to": "/medications"}])],
            source="local",
        )

    lines = ["根据您的用药记录，给您说说这些药：\n"]
    cards: list[AICard] = []
    for m in targets[:3]:
        times = "、".join(_as_str_list(m.times)) or "未设置时间"
        detail = (
            f"每次 {m.dosage or '未填写'}，每天 {m.frequency_per_day or 1} 次，服药时间 {times}。"
            f"用途：{m.purpose or '未填写'}。"
        )
        if m.precautions:
            detail += f"注意事项：{m.precautions}"
        lines.append(f"**{m.name}**（{m.category or '未分类'}）")
        lines.append(f"- 用法用量：{detail}")
        for key, knowledge in _MED_KNOWLEDGE.items():
            if key in (m.name or ""):
                lines.append(f"- 这一类药是{knowledge['class']}：{knowledge['action']}")
                lines.append(f"- 常见反应：{knowledge['side']}")
                break
        else:
            if m.purpose:
                lines.append(f"- 它是用来「{m.purpose}」的，请按医生开的剂量规律服用。")
        cards.append(AICard(
            type="medication",
            title=m.name,
            detail=f"每次 {m.dosage or '未填写'}，每天 {m.frequency_per_day or 1} 次，时间 {times}",
            medications=[m.name],
        ))
        lines.append("")
    lines.append("药名、剂量、时间如果有变化，记得先在「我的药品」里更新，我给出的提醒才会准确。")
    cards.append(AICard(type="action", title="查看药品详情", actions=[{"label": "打开我的药品", "to": "/medications"}]))
    return AssistantResponse(content="\n".join(lines), cards=cards, source="local")


def _answer_missed_dose(q: str, ctx: AssistantContext) -> AssistantResponse | None:
    if not any(k in q for k in ("漏服", "忘了吃", "忘记吃", "没吃", "错过度", "补服")):
        return None
    missed = [d for d in ctx.doses if d.status == "missed"]
    lines = ["漏服药的处理原则是：**不要自行一次吃双倍剂量**，宁可少一次也不要过量。\n"]
    lines.append("不同药的处理方式不一样：")
    lines.append("- 降压药、降糖药漏服后，如果已经接近下一次服药时间，就跳过这次，按原计划吃下一次。")
    lines.append("- 降糖药漏服且出现心慌、手抖、出冷汗，先吃糖块应急并及时就医。")
    lines.append("- 阿司匹林这类抗血小板药漏服一次通常影响不大，不要补双倍。")
    lines.append("- 氯氮平这类镇静药漏服，如果离睡觉时间还近可以补半片；已经到了第二天就直接跳过。")

    cards: list[AICard] = []
    if missed:
        detail = "；".join(
            f"{d.dose_time.strftime('%H:%M') if d.dose_time else '时间未定'} {ctx.med_name(d.medication_id)}"
            for d in missed
        )
        cards.append(AICard(
            type="risk",
            title="您今天有漏服的药",
            level="mid",
            detail=f"{detail}。请按上面原则处理，不要加倍补服。",
            medications=[ctx.med_name(d.medication_id) for d in missed],
        ))
        lines.append(f"\n我查到您今天漏服的是：{detail}。")
    lines.append("\n如果不确定该不该补，最稳妥的做法是打电话问开药的医生或药师。")
    cards.append(AICard(type="action", title="记录服药情况", actions=[
        {"label": "打开用药计划", "to": "/schedule"},
    ]))
    return AssistantResponse(content="\n".join(lines), cards=cards, source="local")


def _answer_interaction(q: str, ctx: AssistantContext) -> AssistantResponse | None:
    if not any(k in q for k in ("冲突", "一起吃", "相互作用", "同服", "相克", "能不能同时", "配伍")):
        return None
    cards: list[AICard] = []
    lines: list[str] = []
    if ctx.risks:
        high = [r for r in ctx.risks if getattr(r, "level", "") == "high"]
        mid = [r for r in ctx.risks if getattr(r, "level", "") == "mid"]
        lines.append(f"我已经分析过您现在的 {len(ctx.active_medications)} 种药，"
                     f"发现 {len(high)} 项高风险、{len(mid)} 项中风险需要注意：\n")
        for r in ctx.risks[:6]:
            lines.append(f"- **{r.type}**：{r.reason}")
            advice = getattr(r, "plain_advice", "") or r.suggestion
            if advice:
                lines.append(f"  建议：{advice}")
            cards.append(AICard(
                type="risk",
                title=r.type,
                level=getattr(r, "level", "mid"),
                detail=(getattr(r, "plain_advice", "") or r.suggestion or r.reason),
                medications=_as_str_list(getattr(r, "medications", [])),
            ))
    else:
        names = "、".join(m.name for m in ctx.active_medications)
        lines.append(f"我核对了您正在服用的药（{names or '暂无记录'}），"
                     "目前没有发现明确的严重相互作用，但仍要注意以下几点：\n")
        lines.append("- 同一时间吃的药越多，相互影响的可能性越大，不要自行加药或换药。")
        lines.append("- 看其他病时，主动把用药清单给医生看，避免开出重复或冲突的药。")
    lines.append("\n任何加药、减药、换药，都要先经过开药的医生确认。")
    cards.append(AICard(type="action", title="查看完整风险分析", actions=[{"label": "打开风险分析", "to": "/risk"}]))
    return AssistantResponse(content="\n".join(lines), cards=cards, source="local")


def _answer_food(q: str, ctx: AssistantContext) -> AssistantResponse | None:
    keys = ("能吃", "能不能吃", "可以吃", "食物", "水果", "饮食", "忌口", "不能吃", "喝", "菜",
            "牛奶", "茶", "酒", "盐", "忌食", "入口")
    food_mentioned = any(alias in q for aliases, _, _ in _FOOD_RULES for alias in aliases)
    if not any(k in q for k in keys) and not food_mentioned:
        return None

    cards: list[AICard] = []
    lines: list[str] = []
    hit = False
    for aliases, level, advice in _FOOD_RULES:
        if any(alias in q for alias in aliases):
            hit = True
            lines.append(f"- **{aliases[0]}**：{advice}")
            cards.append(AICard(
                type="risk" if level in ("high", "mid") else "tip",
                title=f"{aliases[0]}与用药",
                level=level,
                detail=advice,
                medications=[m.name for m in ctx.active_medications[:3]],
            ))

    names = "、".join(m.name for m in ctx.active_medications) or "您正在服用的药"
    if hit:
        lines.append("\n以上是您问到的食物。另外无论吃什么，都建议和服药时间错开 1~2 小时。")
    else:
        lines.append(f"关于饮食，我没有查到与「{names}」之间需要特别避开的食物，"
                     "给您一份通用的饮食原则：\n")
        lines.append("- 少盐：每天食盐控制在 5 克以内，咸菜、腌肉、加工食品尽量不吃。")
        lines.append("- 少糖：含糖饮料、甜点会让血糖波动，白开水或淡茶替代。")
        lines.append("- 多吃：新鲜蔬菜、粗粮、优质蛋白（鸡蛋、鱼、豆制品）。")
        lines.append("- 水果：放在两餐之间、每次一小份，优先选苹果、梨、草莓这类升糖慢的。")
        lines.append("- **两样务必避开**：葡萄柚（西柚）和酒。\n")
        lines.append("如果您是想问某一样具体的东西（比如牛奶、香蕉、浓茶），直接说名字我就能给您更明确的答复。")
        cards.append(AICard(type="tip", title="通用饮食原则", detail="少盐少糖、多蔬菜粗粮，避开葡萄柚和酒。"))
    cards.append(AICard(type="action", title="记录餐后血糖", actions=[{"label": "打开健康数据", "to": "/health"}]))
    return AssistantResponse(content="\n".join(lines), cards=cards, source="local")


def _answer_blood_pressure(q: str, ctx: AssistantContext) -> AssistantResponse | None:
    if not any(k in q for k in ("血压", "高压", "低压", "收缩压", "舒张压")):
        return None
    records = [r for r in ctx.records if r.systolic and r.diastolic]
    if not records:
        return AssistantResponse(
            content="我这边还没有您的血压记录，所以没法判断您最近的血压情况。\n\n"
                    "建议每天早晚各测一次，测之前先静坐 5 分钟，连续测 2 次取平均值，"
                    "把结果记到「健康数据」里，我就能帮您看趋势了。",
            cards=[AICard(type="action", title="记录血压", actions=[{"label": "去记录健康数据", "to": "/health"}])],
            source="local",
        )
    recent = records[:7]
    avg_sys = round(sum(r.systolic for r in recent) / len(recent))
    avg_dia = round(sum(r.diastolic for r in recent) / len(recent))
    latest = recent[0]
    highs = [r for r in recent if r.systolic >= 140 or r.diastolic >= 90]

    lines = [
        f"最近 {len(recent)} 次记录：收缩压平均 {avg_sys} mmHg，舒张压平均 {avg_dia} mmHg。",
        f"最近一次（{latest.record_date}）是 {latest.systolic}/{latest.diastolic} mmHg。\n",
    ]
    cards: list[AICard] = [AICard(
        type="health",
        title=f"近 {len(recent)} 次血压",
        detail=f"收缩压平均 {avg_sys} mmHg，舒张压平均 {avg_dia} mmHg",
    )]
    if highs:
        worst = max(highs, key=lambda r: r.systolic)
        lines.append(f"有 {len(highs)} 次偏高，最高的是 {worst.record_date} 的 "
                     f"{worst.systolic}/{worst.diastolic} mmHg，需要留意。")
        cards.append(AICard(
            type="risk", title="血压偏高", level="mid",
            detail=f"{worst.record_date} 测到 {worst.systolic}/{worst.diastolic} mmHg，建议复测并告知医生。",
        ))
    else:
        lines.append("整体都控制在 140/90 mmHg 以内，是比较理想的状态，继续保持。")
    lines.append("\n日常注意：按时吃降压药、少盐、别熬夜、起床先坐 30 秒再站起来。"
                 "如果连续几天都在 140/90 以上，请找医生调整方案，不要自己加药。")
    cards.append(AICard(type="action", title="查看趋势图", actions=[{"label": "打开健康数据", "to": "/health"}]))
    return AssistantResponse(content="\n".join(lines), cards=cards, source="local")


def _answer_blood_sugar(q: str, ctx: AssistantContext) -> AssistantResponse | None:
    if not any(k in q for k in ("血糖", "糖化", "糖尿病")):
        return None
    records = [r for r in ctx.records if r.blood_sugar]
    if not records:
        return AssistantResponse(
            content="我这边还没有您的血糖记录，暂时没法评估。\n\n"
                    "建议按医生要求的时间点测（比如空腹和餐后 2 小时），把数值记到「健康数据」里，我就能帮您看趋势。",
            cards=[AICard(type="action", title="记录血糖", actions=[{"label": "去记录健康数据", "to": "/health"}])],
            source="local",
        )
    recent = records[:7]
    avg = round(sum(r.blood_sugar for r in recent) / len(recent), 1)
    latest = recent[0]
    abnormal = [r for r in recent if r.blood_sugar >= 7.0]

    lines = [
        f"最近 {len(recent)} 次记录：平均血糖 {avg} mmol/L，最近一次（{latest.record_date}）是 {latest.blood_sugar} mmol/L。\n",
    ]
    cards: list[AICard] = [AICard(
        type="health", title=f"近 {len(recent)} 次血糖",
        detail=f"平均 {avg} mmol/L，最近一次 {latest.blood_sugar} mmol/L",
    )]
    if abnormal:
        lines.append(f"有 {len(abnormal)} 次达到或超过 7.0 mmol/L，属于偏高，建议复查。")
        cards.append(AICard(type="risk", title="血糖偏高", level="mid",
                            detail=f"{len(abnormal)} 次记录达到 7.0 mmol/L 及以上，建议控制主食、复查空腹血糖。"))
    else:
        lines.append("从记录看血糖控制还不错，继续保持规律饮食和用药。")
    lines.append("\n日常注意：主食定量、少喝粥和含糖饮料、餐后走一走；"
                 "正在用格列美脲这类药的话，随身带几块糖防低血糖。")
    cards.append(AICard(type="action", title="查看趋势图", actions=[{"label": "打开健康数据", "to": "/health"}]))
    return AssistantResponse(content="\n".join(lines), cards=cards, source="local")


def _answer_heart_rate(q: str, ctx: AssistantContext) -> AssistantResponse | None:
    if not any(k in q for k in ("心率", "心跳", "脉搏")):
        return None
    records = [r for r in ctx.records if r.heart_rate]
    if not records:
        return AssistantResponse(
            content="我这边还没有您的心率记录，暂时没法判断。测血压时一起把心率记下来，我就能帮您看趋势。",
            cards=[AICard(type="action", title="记录心率", actions=[{"label": "去记录健康数据", "to": "/health"}])],
            source="local",
        )
    recent = records[:7]
    avg = round(sum(r.heart_rate for r in recent) / len(recent))
    latest = recent[0]
    lines = [
        f"最近 {len(recent)} 次记录：平均心率 {avg} 次/分，最近一次（{latest.record_date}）是 {latest.heart_rate} 次/分。",
        "安静状态下 60~100 次/分属于正常范围。",
    ]
    cards = [AICard(type="health", title=f"近 {len(recent)} 次心率", detail=f"平均 {avg} 次/分")]
    if latest.heart_rate < 60:
        lines.append("\n您最近一次偏慢。如果同时有乏力、头晕，请告诉医生；服用减慢心率的药物时更要留意。")
        cards.append(AICard(type="risk", title="心率偏慢", level="mid", detail=f"最近一次 {latest.heart_rate} 次/分，如伴头晕乏力请就医。"))
    elif latest.heart_rate > 100:
        lines.append("\n您最近一次偏快。先休息 10 分钟再复测一次，如果仍然偏快并伴有心慌、胸闷，请及时就医。")
        cards.append(AICard(type="risk", title="心率偏快", level="mid", detail=f"最近一次 {latest.heart_rate} 次/分，建议静息后复测。"))
    else:
        lines.append("\n心率在正常范围内。")
    cards.append(AICard(type="action", title="查看趋势图", actions=[{"label": "打开健康数据", "to": "/health"}]))
    return AssistantResponse(content="\n".join(lines), cards=cards, source="local")


def _answer_body_metrics(q: str, ctx: AssistantContext) -> AssistantResponse | None:
    if not any(k in q for k in ("身高", "体重", "胖", "瘦", "BMI", "体质指数")):
        return None
    u = ctx.user
    if not u.height or not u.weight:
        return AssistantResponse(
            content="您的身高或体重还没录进档案，所以算不出体质指数。补全之后我可以帮您看看体重是否合适。",
            cards=[AICard(type="action", title="完善档案", actions=[{"label": "去完善健康档案", "to": "/profile"}])],
            source="local",
        )
    bmi = round(float(u.weight) / ((float(u.height) / 100) ** 2), 1)
    if bmi < 18.5:
        level, advice = "mid", "偏瘦，建议增加优质蛋白摄入（鸡蛋、鱼、豆制品），并排查是否有慢性消耗性疾病。"
    elif bmi < 24:
        level, advice = "low", "在正常范围内，继续保持规律饮食和适量运动。"
    elif bmi < 28:
        level, advice = "mid", "偏重，建议减少主食和油脂摄入、每天快走 30 分钟。"
    else:
        level, advice = "high", "属于肥胖，会明显增加血压和血糖控制的难度，建议在医生指导下减重。"
    return AssistantResponse(
        content=f"您身高 {u.height} cm，体重 {u.weight} kg，体质指数（BMI）约为 **{bmi}**。\n\n{advice}",
        cards=[AICard(type="health", title="体质指数", detail=f"BMI {bmi}"),
               AICard(type="tip", title="体重管理", detail=advice, level=level)],
        source="local",
    )


def _answer_side_effect(q: str, ctx: AssistantContext) -> AssistantResponse | None:
    if not any(k in q for k in ("副作用", "不良反应", "难受", "不舒服", "会不会有影响", "伤肝", "伤肾", "有害",
                                "头晕", "恶心", "拉肚子", "腹泻", "便秘", "皮疹", "乏力", "水肿", "干咳",
                                "吃完药", "服药后")):
        return None
    targets = ctx.match_medications(q) or ctx.active_medications[:3]
    lines = ["任何药都可能有不良反应，但**绝大多数人按医嘱剂量服用是安全的**，不必因为担心副作用就自己停药。\n"]
    cards: list[AICard] = []
    for m in targets[:3]:
        knowledge = next((v for k, v in _MED_KNOWLEDGE.items() if k in (m.name or "")), None)
        if knowledge:
            lines.append(f"**{m.name}**（{knowledge['class']}）：{knowledge['side']}")
            cards.append(AICard(type="tip", title=f"{m.name}常见反应", detail=knowledge["side"], medications=[m.name]))
        else:
            lines.append(f"**{m.name}**：{m.precautions or '目前没有登记特殊注意事项，如服药后不舒服请记录下来并告知医生。'}")
    lines.append("\n**出现下面这些情况请尽快就医：**皮疹、呼吸困难、眼皮或嘴唇肿、大便发黑、"
                 "持续心慌、肌肉酸痛无力。轻度的头晕、恶心可以先观察并记录下来。")
    cards.append(AICard(type="action", title="登记不适", actions=[{"label": "记录健康数据", "to": "/health"}]))
    return AssistantResponse(content="\n".join(lines), cards=cards, source="local")


def _answer_stop_or_adjust(q: str, ctx: AssistantContext) -> AssistantResponse | None:
    if not any(k in q for k in ("停药", "能不能停", "可以停", "减量", "加量", "加药", "换药", "调整",
                                "加点", "加一点", "多吃一粒", "多吃一片", "少吃一粒", "自己加", "自己减")):
        return None
    names = "、".join(m.name for m in ctx.active_medications) or "您正在服用的药"
    return AssistantResponse(
        content=(
            f"关于停药和调整剂量，请您**不要自己决定**，尤其是{names}这类长期用的药：\n\n"
            "- 降压药突然停可能引起血压反弹升高\n"
            "- 降糖药自己加量容易造成低血糖\n"
            "- 阿司匹林、氯氮平突然停用也有风险\n\n"
            "正确做法是：把最近一段时间的血压、血糖记录整理好，带上药盒去找开药的医生，"
            "由医生判断是否可以减量或停药。如果出现了明显不适，也应尽快联系医生而不是自行停药。"
        ),
        cards=[
            AICard(type="risk", title="不要自行停药或加减剂量", level="high",
                   detail="自行调整慢病用药可能引起血压反弹、低血糖或撤药反应。"),
            AICard(type="action", title="准备复查资料", actions=[
                {"label": "打开健康数据", "to": "/health"},
                {"label": "打开健康报告", "to": "/reports"},
            ]),
        ],
        source="local",
    )


def _answer_recheck(q: str, ctx: AssistantContext) -> AssistantResponse | None:
    if not any(k in q for k in ("复查", "复诊", "去医院", "挂号", "体检", "化验", "抽血", "诊疗")):
        return None
    meds = "、".join(f"{m.name}（{m.spec}）" for m in ctx.active_medications[:6]) or "您正在服用的药"
    return AssistantResponse(
        content=(
            "去医院复查前，建议您这样准备：\n\n"
            f"1. 带上所有药盒或用药清单：{meds}\n"
            "2. 带上最近的血压、血糖记录，医生据此判断要不要调药。\n"
            "3. 需要空腹抽血的话，当天早上先别吃降糖药和早饭，抽完血再吃；降压药通常按原时间服用。\n"
            "4. 主动告诉医生您有"
            f"{'、'.join(_as_str_list(ctx.user.chronic_conditions)) or '哪些慢性病'}，"
            f"以及过敏史（{'、'.join(_as_str_list(ctx.user.allergies)) or '未填写'}）。\n"
            "5. 最好有家人陪同，路上走慢一些。\n\n"
            "如果复查时间还没定，可以翻看报告里的建议，或直接联系您的主治医生。"
        ),
        cards=[
            AICard(type="tip", title="复查清单", detail="药盒 + 血压血糖记录 + 过敏史 + 家人陪同"),
            AICard(type="action", title="导出记录", actions=[
                {"label": "打开健康数据", "to": "/health"},
                {"label": "打开健康报告", "to": "/reports"},
            ]),
        ],
        source="local",
    )


def _answer_exercise(q: str, ctx: AssistantContext) -> AssistantResponse | None:
    if not any(k in q for k in ("运动", "锻炼", "散步", "走路", "跳舞", "太极", "健身", "能干活")):
        return None
    conditions = _as_str_list(ctx.user.chronic_conditions)
    lines = ["适合您的运动是「中等强度、能正常说话」的活动：\n"]
    lines.append("- 快走：每次 20~30 分钟，每周 5 天，饭后休息 1 小时再走。")
    lines.append("- 太极拳、八段锦：动作舒缓、能调呼吸，对血压血糖都有好处。")
    lines.append("- 慢骑自行车、做家务也算活动，量力而行就好。\n")
    lines.append("**要避免的：**憋气用力的运动（举重、拔河）、突然低头弯腰、快跑，"
                 "这些会让血压一下子升高。")
    if any("糖尿病" in c for c in conditions):
        lines.append("\n您有糖尿病，运动时兜里带两块糖或饼干，"
                     "出现心慌、手抖、出冷汗就先坐下吃一块，休息 15 分钟再复测血糖。")
    if any("高血压" in c for c in conditions):
        lines.append("您有高血压，运动前后各测一次血压；如果当天血压超过 160/100 mmHg，先别运动。")
    cards = [AICard(type="tip", title="运动建议", detail="快走 20~30 分钟 / 太极八段锦，每周 5 天"),
             AICard(type="action", title="记录数据", actions=[{"label": "打开健康数据", "to": "/health"}])]
    return AssistantResponse(content="\n".join(lines), cards=cards, source="local")


def _answer_sleep(q: str, ctx: AssistantContext) -> AssistantResponse | None:
    if not any(k in q for k in ("睡眠", "失眠", "睡不着", "多梦", "睡得")):
        return None
    lines = [
        "睡不好会影响血压和血糖的稳定，可以从这几件小事做起：\n",
        "1. 固定作息：尽量同一时间上床、同一时间起床，白天午睡别超过 30 分钟。",
        "2. 睡前 1 小时不看手机电视，不喝浓茶咖啡，晚饭别吃太饱。",
        "3. 睡前用温水泡脚 10 分钟，房间调暗、安静。",
        "4. 如果躺下 20 分钟还睡不着，起来坐一会儿再躺下，别在床上着急。",
    ]
    if any("氯氮平" in (m.name or "") for m in ctx.active_medications):
        lines.append("\n您在服用氯氮平，本身可能有嗜睡、头晕的反应，晚上起身一定要慢，"
                     "先在床边坐 30 秒再站起来，防止摔倒。")
    lines.append("\n如果长期失眠影响白天精神，请找医生评估，不要自己加安眠药。")
    return AssistantResponse(
        content="\n".join(lines),
        cards=[AICard(type="tip", title="助眠小贴士", detail="固定作息 + 睡前不喝浓茶咖啡 + 泡脚放松"),
               AICard(type="tip", title="安全提醒", detail="夜间起身先坐 30 秒再站，防止体位性低血压摔倒。", level="mid")],
        source="local",
    )


def _answer_mood(q: str, ctx: AssistantContext) -> AssistantResponse | None:
    if not any(k in q for k in ("心情", "烦", "焦虑", "抑郁", "不开心", "孤独", "闷得慌")):
        return None
    name = ctx.user.name or "您"
    lines = [
        f"{name}，心情不好的时候，身体也会跟着受影响——情绪波动会让血压升高、血糖不稳，"
        "所以照顾心情和照顾身体一样重要。\n",
        "可以试试这几件事：\n",
        "1. 找人说说：给家人打个电话，或者和老邻居、老姐妹聊聊天，把心里的事说出来。",
        "2. 出去走走：天气好的时候到楼下晒晒太阳、慢慢走 20 分钟。",
        "3. 做点喜欢的事：听戏曲、养花、写字、听广播都可以。",
        "4. 深呼吸放松：慢慢吸气 4 秒、屏住 4 秒、呼气 6 秒，重复 5 次。\n",
        "如果这种情绪持续两周以上，或者影响到吃饭睡觉，请一定告诉家人，"
        "也可以找医生聊聊，这不是您的错，是能被帮到的。",
    ]
    return AssistantResponse(
        content="\n".join(lines),
        cards=[AICard(type="tip", title="情绪与慢病", detail="情绪波动会影响血压血糖，规律作息与家人交流很重要。"),
               AICard(type="action", title="联系家人", actions=[{"label": "打开家属监护", "to": "/family"}])],
        source="local",
    )


def _answer_family(q: str, ctx: AssistantContext) -> AssistantResponse | None:
    if not any(k in q for k in ("家人", "家属", "儿子", "女儿", "孩子", "谁能看", "隐私", "绑定")):
        return None
    return AssistantResponse(
        content=(
            "关于家人查看您的数据，说明如下：\n\n"
            "- 只有**您同意绑定**的家人，才能看到您的健康数据和用药情况；\n"
            "- 绑定需要双方确认，您可以随时在「家属监护」里解除；\n"
            "- 家人的手机能收到您的漏服提醒和血压异常提醒，方便他们及时关心您；\n"
            "- 没有绑定的家人是看不到您任何数据的。\n\n"
            "如果您希望有人帮忙盯着用药，可以在「家属监护」里把家人的账号加进来。"
        ),
        cards=[
            AICard(type="tip", title="数据隐私", detail="只有经过您同意的家属才能查看数据，随时可以解除绑定。"),
            AICard(type="action", title="管理家属", actions=[{"label": "打开家属监护", "to": "/family"}]),
        ],
        source="local",
    )


def _answer_report(q: str, ctx: AssistantContext) -> AssistantResponse | None:
    if not any(k in q for k in ("报告", "依从", "按时吃药率", "完成率", "统计", "总结",
                                "服药记录", "用药记录", "吃药记录", "打卡", "吃没吃")):
        return None
    stats = ctx.dose_stats()
    rate = round(stats["taken"] / stats["total"] * 100) if stats["total"] else 0
    return AssistantResponse(
        content=(
            f"今天的用药统计：共 {stats['total']} 次，已服 {stats['taken']} 次，"
            f"待服 {stats['pending']} 次，漏服 {stats['missed']} 次，按时服药率 {rate}%。\n\n"
            "周报和月报里还能看到血压、血糖、心率的平均值与趋势，以及按时服药率的变化。"
            "复查时把报告给医生看，医生更容易判断要不要调药。"
        ),
        cards=[
            AICard(type="health", title="今日服药完成率", detail=f"{rate}%（{stats['taken']}/{stats['total']}）"),
            AICard(type="action", title="查看完整报告", actions=[{"label": "打开健康报告", "to": "/reports"}]),
        ],
        source="local",
    )


def _answer_risk_overview(q: str, ctx: AssistantContext) -> AssistantResponse | None:
    if not any(k in q for k in ("风险", "危险", "要注意什么", "注意什么", "该注意")):
        return None
    cards: list[AICard] = []
    lines = [f"我已经核对过您的档案、用药和近期数据，给您梳理出这些需要留意的地方：\n"]
    for r in ctx.risks[:4]:
        lines.append(f"- **{r.type}**（{'高风险' if getattr(r, 'level', '') == 'high' else '中风险'}）："
                     f"{getattr(r, 'plain_advice', '') or r.suggestion or r.reason}")
        cards.append(AICard(type="risk", title=r.type, level=getattr(r, "level", "mid"),
                            detail=getattr(r, "plain_advice", "") or r.suggestion or r.reason))
    if not ctx.risks:
        lines.append("- 用药方面暂时没发现明显风险，继续保持规律服药。")
    if ctx.user.allergies:
        lines.append(f"- 过敏史提醒：您对 {'、'.join(_as_str_list(ctx.user.allergies))} 过敏，"
                     "每次看病开药都要提前告诉医生。")
    lines.append("- 起床、起夜动作要慢，先坐 30 秒再站，防止头晕摔倒。")
    lines.append("- 饮食少盐少糖，避免葡萄柚和酒。")
    cards.append(AICard(type="action", title="查看完整分析", actions=[{"label": "打开风险分析", "to": "/risk"}]))
    return AssistantResponse(content="\n".join(lines), cards=cards, source="local")


def _answer_allergy(q: str, ctx: AssistantContext) -> AssistantResponse | None:
    if "过敏" not in q:
        return None
    allergies = _as_str_list(ctx.user.allergies)
    if not allergies:
        return AssistantResponse(
            content="您的过敏史这一项还没有填写。为了用药安全，建议补上——"
                    "很多人是对某种抗生素或解热镇痛药过敏，医生开药时必须知道。",
            cards=[AICard(type="action", title="填写过敏史", actions=[{"label": "去完善健康档案", "to": "/profile"}])],
            source="local",
        )
    names = "、".join(allergies)
    return AssistantResponse(
        content=(
            f"您的过敏史登记为：**{names}**。\n\n"
            "请务必注意：\n"
            f"- 每次去医院、药店买药，都主动说「我对{names}过敏」；\n"
            "- 拿药后看清楚成分表，避免买到含同类成分的药；\n"
            "- 如果服药后出现皮疹、瘙痒、嘴唇或眼皮肿、呼吸困难，立即停药并就医。\n\n"
            "如果过敏史有变化（比如新发现了某种过敏），记得及时更新档案。"
        ),
        cards=[AICard(type="risk", title=f"过敏史：{names}", level="high",
                      detail="就诊、购药时务必主动告知医生和药师。"),
               AICard(type="action", title="更新档案", actions=[{"label": "去完善健康档案", "to": "/profile"}])],
        source="local",
    )


def _answer_adherence(q: str, ctx: AssistantContext) -> AssistantResponse | None:
    # 只匹配「习惯性忘药」的表述；单次「忘了吃」交给漏服处理逻辑（两者的处理方式不同）
    if not any(k in q for k in ("老忘", "总忘", "总是忘", "老是忘", "经常忘", "容易忘", "记不住吃药",
                                "经常漏", "老是漏", "坚持不了", "依从", "不想吃药")):
        return None
    stats = ctx.dose_stats()
    lines = [
        "慢病用药最怕的就是「三天打鱼两天晒网」，给您几个好用的办法：\n",
        "1. 用分药盒：把一周的药按早、中、晚、睡前分好，吃没吃一眼就能看出来。",
        "2. 固定动作：把药放在水杯、牙刷旁边，刷牙后顺手就吃。",
        "3. 用手机提醒：把「智能用药计划」里的提醒打开，到点会叫您。",
        "4. 让家人搭把手：家属绑定的提醒会同步给家人，忘了一起提醒您。",
        "5. 记下来：吃了就在计划里点一下「已服」，漏了也标出来，这样复查时医生才看得清。\n",
    ]
    if stats["total"]:
        lines.append(f"今天的记录是：{stats['taken']}/{stats['total']} 次已完成，"
                     f"{stats['missed']} 次漏服。")
    return AssistantResponse(
        content="\n".join(lines),
        cards=[AICard(type="tip", title="防漏服小办法", detail="分药盒 + 固定位置 + 手机提醒 + 家人提醒"),
               AICard(type="action", title="设置提醒", actions=[{"label": "打开用药计划", "to": "/schedule"}])],
        source="local",
    )


def _answer_reminder(q: str, ctx: AssistantContext) -> AssistantResponse | None:
    if not any(k in q for k in ("提醒", "闹钟", "通知", "消息")):
        return None
    return AssistantResponse(
        content=(
            "提醒功能是这样设置的：\n\n"
            "- 每种药在「我的药品」里填好每天吃几次、几点吃，以及提前多少分钟提醒；\n"
            "- 系统会按这些设置安排每天的用药计划，到点提醒您；\n"
            "- 漏服时，绑定的家属也会收到一条提醒。\n\n"
            "想改提醒时间，去「我的药品」里点开对应的药修改就行。"
        ),
        cards=[AICard(type="action", title="设置提醒", actions=[
            {"label": "打开我的药品", "to": "/medications"},
            {"label": "打开用药计划", "to": "/schedule"},
        ])],
        source="local",
    )


_GREETING_KEYWORDS = ("你好", "您好", "你是谁", "你是谁呀", "介绍一下", "在吗", "早上好", "晚上好", "下午好", "hi", "hello")


def _answer_greeting(q: str, ctx: AssistantContext) -> AssistantResponse | None:
    if not any(k in q.lower() for k in _GREETING_KEYWORDS):
        return None
    s = build_profile_summary(ctx)
    name = s["name"] if s["name"] != "未填写" else "您"
    lines = [
        f"{name}您好，我是您的 AI 用药助手，已经读到您的健康档案了：\n",
        f"- 慢性病史：{'、'.join(s['chronic_conditions']) or '未填写'}",
        f"- 在服药品：{s['active_medication_count']} 种",
    ]
    if s["latest_bp"]:
        lines.append(f"- 最近一次血压：{s['latest_bp']} mmHg")
    if s["today_total"]:
        lines.append(f"- 今日用药：{s['today_taken']}/{s['today_total']} 次已完成")
    lines.append("\n您可以问我任何用药和健康方面的问题，比如：")
    lines.append("- 我今天还要吃哪些药？")
    lines.append("- 这个药有什么副作用？")
    lines.append("- 我最近的血压怎么样？")
    lines.append("- 哪些东西不能和我的药一起吃？")
    lines.append("\n听不懂或拿不准的，都可以直接问我，不用客气。")
    cards: list[AICard] = []
    if s["missing_fields"]:
        lines.append(f"\n对了，您的档案还有 {len(s['missing_fields'])} 项没填："
                     f"{'、'.join(s['missing_fields'])}，补上之后我给的建议会更贴合您。")
        cards.append(AICard(type="action", title="完善档案", actions=[{"label": "去完善健康档案", "to": "/profile"}]))
    cards.append(AICard(type="tip", title="温馨提示", detail="我的建议不能替代医生诊断，身体不舒服请及时就医。"))
    return AssistantResponse(content="\n".join(lines), cards=cards, source="local")


def _grounded_fallback(q: str, ctx: AssistantContext) -> AssistantResponse:
    """没命中任何具体意图时的兜底。

    原来的兜底是一句没有信息量的模板话术（"我已了解您的问题…请试试左侧快捷问题"），
    这是「不能问他其他问题」的直接原因。现在改为：先给出基于本人档案的个性化回答，
    再给出可以继续追问的方向，让用户任何时候都能得到有用的回应。
    """
    s = build_profile_summary(ctx)
    name = s["name"] if s["name"] != "未填写" else "您"
    lines = [f"这个问题我没有把握直接给结论，先跟您说清楚我看到了什么，免得误导您：\n"]

    facts: list[str] = []
    if s["chronic_conditions"]:
        facts.append(f"您的慢性病史是 {'、'.join(s['chronic_conditions'])}")
    if s["active_medication_count"]:
        facts.append(f"正在服用 {s['active_medication_count']} 种药")
    if s["latest_bp"]:
        facts.append(f"最近一次血压 {s['latest_bp']} mmHg")
    if s["latest_blood_sugar"]:
        facts.append(f"最近一次血糖 {s['latest_blood_sugar']} mmol/L")
    if facts:
        lines.append("目前的记录是：" + "，".join(facts) + "。\n")
        if s["today_total"]:
            lines.append(f"今天的用药记录：已服 {s['today_taken']} 次、待服 {s['today_pending']} 次、"
                         f"漏服 {s['today_missed']} 次。\n")

    lines.append("您可以这样问我，我能答得更准：")
    lines.append("- 直接说药名，例如「二甲双胍怎么吃」「阿司匹林有什么副作用」")
    lines.append("- 说身体指标，例如「我最近血压怎么样」「血糖高不高」")
    lines.append("- 说生活场景，例如「能不能喝牛奶」「可以做什么运动」「睡不着怎么办」")
    lines.append("- 说具体症状，例如「吃完药有点头晕」\n")
    lines.append("涉及具体诊断、药物调整的问题，还是要以医生和药师的意见为准。")

    cards = [
        AICard(type="tip", title="怎么问更准", detail="带上药名、指标或具体症状，我能结合您的档案给出针对性回答。"),
        AICard(type="action", title="快捷入口", actions=[
            {"label": "用药计划", "to": "/schedule"},
            {"label": "健康数据", "to": "/health"},
            {"label": "风险分析", "to": "/risk"},
        ]),
    ]
    if s["missing_fields"]:
        lines.append(f"\n另外提醒一句：您的档案还缺 {'、'.join(s['missing_fields'])}，"
                     "补全后我回答会更贴合您的身体情况。")
        cards.append(AICard(type="action", title="完善档案", actions=[{"label": "去完善健康档案", "to": "/profile"}]))
    return AssistantResponse(content="\n".join(lines), cards=cards, source="local")


def _generic_answer(q: str) -> AssistantResponse:
    """连用户数据都取不到时的最简安全回答（正常流程不会走到这里）。"""
    return AssistantResponse(
        content=(
            "抱歉，我这次没能读到您的健康档案，所以没法给出针对您个人的回答。\n\n"
            "您可以稍后再试一次，或者先确认一下登录状态；"
            "如果一直这样，请先把页面重新打开一次。\n\n"
            "在没读到档案之前，我只能给通用安全提示：按时按量服药、不自行加量或停药，"
            "服药期间避免饮酒和葡萄柚，身体不适及时就医。"
        ),
        cards=[AICard(type="tip", title="安全提示", detail="用药相关的具体问题，请以医生或药师的意见为准。")],
        source="local",
    )
