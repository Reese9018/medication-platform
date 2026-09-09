from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
import bcrypt
from .config import get_settings


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


def create_access_token(subject: str) -> str:
    settings = get_settings()
    expires = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    return jwt.encode({"sub": subject, "exp": expires}, settings.jwt_secret_key, algorithm="HS256")


def decode_subject(token: str) -> str | None:
    try:
        payload = jwt.decode(token, get_settings().jwt_secret_key, algorithms=["HS256"])
        subject = payload.get("sub")
        return str(subject) if subject else None
    except JWTError:
        return None
