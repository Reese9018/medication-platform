from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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
