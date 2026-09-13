from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "智药护航 API"
    environment: str = "development"
    # 生产部署时请通过环境变量 DATABASE_URL 注入 PostgreSQL 连接串
    database_url: str = "postgresql://postgres:postgres@localhost:5432/zhiyouyao"
    jwt_secret_key: str = "change-me-in-production"
    jwt_expire_minutes: int = 1440
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    # 扣子（Coze）智能体接入配置；留空则 AI 助手走原规则模拟回答
    coze_token: str = ""
    coze_bot_id: str = ""
    # 智谱（Zhipu）GLM 视觉模型，用于 AI 拍照识别药品；留空则 OCR 走模拟数据
    zhipu_api_key: str = ""
    # 生产环境表结构已就绪时置为 1，跳过冷启动时的 create_all / legacy migrations，
    # 显著缩短 Vercel Serverless 冷启动时间；seed（幂等、维护演示数据）仍会执行
    skip_db_init: bool = False

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()