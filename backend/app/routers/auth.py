from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..dependencies import get_current_user
from ..models import User
from ..schemas import LoginRequest, TokenOut, UserCreate, UserOut
from ..security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["认证"])

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
    return TokenOut(access_token=create_access_token(str(user.id)), user=user)

@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user

@router.post("/logout")
def logout(_: User = Depends(get_current_user)):
    return {"message": "已退出登录"}
