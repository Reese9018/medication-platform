from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from ..database import get_db
from ..dependencies import get_current_user
from ..models import User
from ..schemas import LoginRequest, TokenOut, UserCreate, UserOut
from ..security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["认证"])


class ChangePasswordRequest(BaseModel):
    old_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=6, max_length=64)

@router.post("/register", response_model=TokenOut, status_code=201)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.account == payload.account).first():
        raise HTTPException(409, "账号已存在")
    user = User(account=payload.account, password_hash=hash_password(payload.password), name=payload.name, role=payload.role, phone=payload.phone, avatar_color="#4A8265" if payload.role == "elder" else "#3A85A8")
    db.add(user); db.commit(); db.refresh(user)
    return TokenOut(access_token=create_access_token(str(user.id)), user=user)

@router.post("/login", response_model=TokenOut)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.account == payload.account).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "账号或密码错误")
    # 前端带了 role 时校验账号身份是否匹配，避免「账号是老人 / 选了家属端」误登到错误侧
    if payload.role and user.role != payload.role:
        expected_label = "家属" if payload.role == "family" else "老人"
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            f"该账号不是{expected_label}身份，请在登录页切换到正确的身份",
        )
    return TokenOut(access_token=create_access_token(str(user.id)), user=user)

@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user

@router.post("/logout")
def logout(_: User = Depends(get_current_user)):
    return {"message": "已退出登录"}


@router.post("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """修改当前登录用户密码：校验旧密码后更新。老人端 / 家属端共用。"""
    if not verify_password(payload.old_password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "原密码不正确")
    if payload.new_password == payload.old_password:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "新密码不能与原密码相同")
    user.password_hash = hash_password(payload.new_password)
    db.commit()
    return {"message": "密码已修改，请重新登录" }
