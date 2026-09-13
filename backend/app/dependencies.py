from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from .database import get_db
from .models import FamilyLink, User
from .security import decode_subject

bearer = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="未登录")
    subject = decode_subject(credentials.credentials)
    user = db.get(User, int(subject)) if subject and subject.isdigit() else None
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="登录已失效")
    return user


def get_observed_user(user: User, db: Session) -> User:
    """家属端数据归属解析：家属账号查看/操作的是其已绑定老人的数据。

    - 老人（elder）：数据就是自己的。
    - 家属（family）：通过 FamilyLink 找到自己 status=active（已绑定，
      即对方已同意申请）的老人；申请中(pending)/未绑定/已拒绝 都拿不到老人数据，
      此时回退到自身（前端按空数据展示，不会白屏）。
    """
    if user.role != "family":
        return user
    link = (
        db.query(FamilyLink)
        .filter(FamilyLink.family_user_id == user.id, FamilyLink.status == "active")
        .order_by(FamilyLink.id.asc())
        .first()
    )
    if link and link.user:
        return link.user
    return user
