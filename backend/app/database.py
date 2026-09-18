from collections.abc import Generator
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from .config import get_settings


class Base(DeclarativeBase):
    pass


engine = create_engine(
    get_settings().database_url,
    future=True,
    # Neon pooled（pgbouncer）连接稳定，无需每次请求 pre_ping；
    # 空闲约 5 分钟回收，300s 前主动重建避免 stale 连接
    pool_recycle=300,
    # 池满时最多等 15 秒拿连接，超时快速失败而非无限挂起
    pool_timeout=15,
    # 连接建连/握手最多 5 秒，避免网络抖动把请求卡死
    connect_args={"connect_timeout": 5},
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def run_legacy_migrations() -> None:
    """老库轻量迁移：补齐后加的业务列。

    仅在列缺失时执行 ALTER；新库由 create_all 建好，这里 no-op。
    """
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())

    # users.profile_updated_at：健康档案建档/更新日期（create_all 不会给老表补列）
    if "users" in tables:
        user_cols = {c["name"] for c in inspector.get_columns("users")}
        if "profile_updated_at" not in user_cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE users ADD COLUMN profile_updated_at TIMESTAMP"))

    if "family_links" not in tables:
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
