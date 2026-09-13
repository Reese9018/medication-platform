from collections.abc import Generator
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from .config import get_settings


class Base(DeclarativeBase):
    pass


engine = create_engine(get_settings().database_url, pool_pre_ping=True, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def run_legacy_migrations() -> None:
    """老库轻量迁移：把旧 family_links(bound 布尔) 升级为三态 (status + requester_id)。

    仅在列缺失时执行 ALTER；新库无此表时 create_all 已建好，这里 no-op。
    """
    inspector = inspect(engine)
    if "family_links" not in inspector.get_table_names():
        return
    cols = {c["name"] for c in inspector.get_columns("family_links")}

    with engine.begin() as conn:
        if "status" not in cols:
            conn.execute(text("ALTER TABLE family_links ADD COLUMN status VARCHAR(16)"))
            # 旧数据：bound=true → active；bound=false → rejected；空值兜底 active
            conn.execute(text(
                "UPDATE family_links SET status = CASE WHEN bound = true THEN 'active' ELSE 'rejected' END "
                "WHERE status IS NULL"
            ))
            conn.execute(text("UPDATE family_links SET status = 'active' WHERE status IS NULL"))
        if "requester_id" not in cols:
            conn.execute(text("ALTER TABLE family_links ADD COLUMN requester_id INTEGER"))
            # 旧数据无发起人记录，默认记为老人(user_id)发起，仅用于历史数据兜底
            conn.execute(text("UPDATE family_links SET requester_id = user_id WHERE requester_id IS NULL"))
        if "responded_at" not in cols:
            conn.execute(text("ALTER TABLE family_links ADD COLUMN responded_at TIMESTAMP"))
        # 尝试补唯一约束（若老库已有重复行则静默跳过，不影响启动）
        try:
            conn.execute(text(
                "ALTER TABLE family_links ADD CONSTRAINT uq_family_link_pair UNIQUE (user_id, family_user_id)"
            ))
        except Exception:
            pass
