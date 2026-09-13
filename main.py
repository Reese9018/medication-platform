"""Vercel Services 后端入口 —— 复用 backend 的 FastAPI 应用。

Vercel Services 模式下 backend 服务从项目根目录加载 `main:app`，
本文件把 backend/app/main.py 的 FastAPI 实例导入并重新导出。

关键点：
1. backend/ 目录随函数打包（Vercel Python 函数默认包含构建时可达文件），
   因此通过 sys.path 即可导入 backend 下的 `app` 包。
2. 生产环境数据库为 Neon PostgreSQL（环境变量 DATABASE_URL），
   连接串由 Vercel 项目环境变量注入，不入代码库。
"""

import os
import sys

# 将 backend 目录加入模块搜索路径，使 `app` 包可被导入
_BACKEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend")
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

from app.main import app  # noqa: E402  FastAPI 实例（顶层变量名必须为 app）

# ---- 幂等初始化：确保云端数据表 + 演示账号（elder/123456 等）就绪 ----
# 函数冷启动不一定会触发 FastAPI lifespan，因此在模块导入时
# 幂等地执行一次初始化；seed 自带 count 检查，重复执行安全。
# 生产（Vercel）设置 SKIP_DB_INIT=1 时跳过 create_all / migrations（表结构已就绪），
# 大幅缩短冷启动时间；seed 仍执行，维护演示账号与今日用药数据。
try:
    from app.database import Base, engine, SessionLocal, run_legacy_migrations  # noqa: E402
    from app.services.seed import seed_demo_data  # noqa: E402
    from app.config import get_settings  # noqa: E402

    if not get_settings().skip_db_init:
        Base.metadata.create_all(bind=engine)
        run_legacy_migrations()
    with SessionLocal() as db:
        seed_demo_data(db)
except Exception:
    # 并发冷启动时 seed 可能撞唯一约束，忽略即可；真实错误会在请求时暴露
    pass
