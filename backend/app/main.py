import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from .config import get_settings
from .database import Base, SessionLocal, engine
from .services.seed import seed_demo_data
from .routers import auth, users, medications, schedule, health, risks, assistant, family, reports, notifications

settings = get_settings()

@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_demo_data(db)
    yield

app = FastAPI(title=settings.app_name, version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origin_list, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

@app.get("/health", tags=["系统"])
def health_check():
    return {"status": "ok", "service": settings.app_name}

prefix = "/api/v1"
app.include_router(auth.router, prefix=prefix)
app.include_router(users.router, prefix=prefix)
app.include_router(medications.router, prefix=prefix)
app.include_router(schedule.router, prefix=prefix)
app.include_router(health.router, prefix=prefix)
app.include_router(risks.router, prefix=prefix)
app.include_router(assistant.router, prefix=prefix)
app.include_router(family.router, prefix=prefix)
app.include_router(reports.router, prefix=prefix)
app.include_router(notifications.router, prefix=prefix)

# ---- 前端静态资源托管（同源一体部署时自动生效）----
# 当仓库根目录存在 dist/（前端构建产物）时，FastAPI 直接托管整个网站，
# 一个服务同时提供 API 和页面，无需 CORS，单网址即可访问
_dist = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "dist")
if os.path.isdir(_dist):
    _assets = os.path.join(_dist, "assets")
    if os.path.isdir(_assets):
        app.mount("/assets", StaticFiles(directory=_assets), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        """静态文件存在则返回该文件，否则返回 index.html（SPA 前端路由支持）"""
        candidate = os.path.realpath(os.path.join(_dist, full_path))
        if full_path and candidate.startswith(os.path.realpath(_dist)) and os.path.isfile(candidate):
            return FileResponse(candidate)
        return FileResponse(os.path.join(_dist, "index.html"))
