"""AI 拍照识别药品 —— 调用智谱 GLM-5.3-Flash 视觉模型。

未配置 ZHIPU_API_KEY 或调用失败时，由路由层降级到模拟数据，保证功能可用。
"""

import json
import re

import httpx

from ..config import get_settings
from ..schemas import OCRResult

# 智谱 OpenAPI 对话补全接口（兼容 OpenAI 格式）
ZHIPU_API_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions"
ZHIPU_MODEL = "glm-5.3-flash"  # 免费视觉模型
ZHIPU_TIMEOUT_SECONDS = 60

# 提示词：要求 AI 以纯 JSON 返回结构化药品信息
OCR_PROMPT = """请识别这张药品包装/说明书图片，提取以下信息，以纯 JSON 格式返回（不要包含任何其他文字、markdown 或代码块标记）：
{
  "name": "药品名称",
  "spec": "规格，如 20mg×14片",
  "dosage": "每次服用剂量，如 1片",
  "purpose": "用途/适应症",
  "frequencyPerDay": 每日服用次数(数字),
  "times": ["服用时间点，如 08:00"],
  "contraindications": ["禁忌症"],
  "precautions": "注意事项"
}
如果图片中没有某些信息，请留空字符串或空数组。"""


def _normalize(raw: dict) -> OCRResult:
    """把 AI 返回的字段名归一化为后端 schema（兼容 camelCase / snake_case）。"""
    def pick(*keys: str, default=""):
        for k in keys:
            if k in raw and raw[k] not in (None, ""):
                return raw[k]
        return default

    name = str(pick("name", "药品名称", default="")).strip()
    spec = str(pick("spec", "规格", default="")).strip()
    dosage = str(pick("dosage", "剂量", "每次剂量", default="")).strip()
    purpose = str(pick("purpose", "indication", "用途", "适应症", default="")).strip()

    # 每日次数：尝试转数字
    freq_raw = pick("frequencyPerDay", "frequency_per_day", "frequency", "每日次数", default=1)
    try:
        frequency_per_day = max(1, min(12, int(freq_raw)))
    except (ValueError, TypeError):
        frequency_per_day = 1

    # 服用时间点
    times_raw = pick("times", "服用时间", "time", default=[])
    if isinstance(times_raw, str):
        times = [t.strip() for t in re.split(r"[，,、；;\s]+", times_raw) if t.strip()]
    elif isinstance(times_raw, list):
        times = [str(t).strip() for t in times_raw if str(t).strip()]
    else:
        times = []

    # 禁忌症
    contra_raw = pick("contraindications", "contraindication", "禁忌", "禁忌症", default=[])
    if isinstance(contra_raw, str):
        contraindications = [c.strip() for c in re.split(r"[。；;\n]+", contra_raw) if c.strip()]
    elif isinstance(contra_raw, list):
        contraindications = [str(c).strip() for c in contra_raw if str(c).strip()]
    else:
        contraindications = []

    precautions = str(pick("precautions", "注意事项", "warning", default="")).strip()

    return OCRResult(
        name=name or "未识别药品",
        spec=spec,
        dosage=dosage or "1片",
        purpose=purpose,
        frequency_per_day=frequency_per_day,
        times=times,
        contraindications=contraindications,
        precautions=precautions,
    )


def recognize_medicine(image_base64: str) -> OCRResult:
    """调用智谱 GLM 视觉模型识别药品图片，返回结构化结果。

    Raises:
        RuntimeError: 未配置 API Key 或接口调用失败。
    """
    settings = get_settings()
    if not settings.zhipu_api_key:
        raise RuntimeError("ZHIPU_API_KEY 未配置，AI 拍照识别走模拟数据")

    # 去掉可能带有的 data:image/...;base64, 前缀，只保留纯 base64
    clean_base64 = image_base64
    if "," in clean_base64 and clean_base64.startswith("data:"):
        clean_base64 = clean_base64.split(",", 1)[1]

    payload = {
        "model": ZHIPU_MODEL,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": OCR_PROMPT},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{clean_base64}"},
                    },
                ],
            }
        ],
        "response_format": {"type": "json_object"},
    }

    resp = httpx.post(
        ZHIPU_API_URL,
        headers={
            "Authorization": f"Bearer {settings.zhipu_api_key}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=ZHIPU_TIMEOUT_SECONDS,
    )
    resp.raise_for_status()
    body = resp.json()

    if "error" in body:
        raise RuntimeError(f"智谱接口返回错误：{body['error'].get('message', body['error'])}")

    ai_text = body["choices"][0]["message"]["content"]

    # 尝试解析 JSON；AI 有时会包裹在 ```json ... ``` 中，做一次清洗
    ai_text = ai_text.strip()
    if ai_text.startswith("```"):
        ai_text = re.sub(r"^```(?:json)?\s*", "", ai_text)
        ai_text = re.sub(r"\s*```$", "", ai_text)

    try:
        raw = json.loads(ai_text)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"AI 返回内容无法解析为 JSON：{e}；原始内容：{ai_text[:200]}")

    return _normalize(raw)
