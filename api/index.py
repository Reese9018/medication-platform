"""Vercel 无服务器入口 —— 复用 backend 的 FastAPI 应用。

Vercel 要求 api/ 目录下的 Python 文件暴露顶层变量 `app`（ASGI 应用），
本文件把 backend/app/main.py 的 FastAPI 实例导入并重新导出。

关键点：
1. Vercel 函数冷启动不一定会触发 FastAPI lifespan，因此在模块导入时
   幂等地执行一次「建表 + 演示数据」初始化，保证云端数据库可用。
2. 生产环境数据库为 Neon PostgreSQL（环境变量 DATABASE_URL），
   连接串由 Vercel 项目环境变量注入，不入代码库。
"""

import os
import sys

# 将 backend 目录加入模块搜索路径，使 `app` 包可被导入
_BACKEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend")
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

from app.main import app  # noqa: E402  FastAPI 实例（顶层变量名必须为 app）

# ---- 幂等初始化：确保云端数据表 + 演示账号（elder/123456 等）就绪 ----
# Vercel 每个冷启动实例执行一次；seed 自带 count 检查，重复执行安全。
try:
    from app.database import Base, engine, SessionLocal  # noqa: E402
    from app.services.seed import seed_demo_data  # noqa: E402

    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_demo_data(db)
except Exception:
    # 并发冷启动时 seed 可能撞唯一约束，忽略即可；真实错误会在请求时暴露
    pass
