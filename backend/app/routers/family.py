from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..dependencies import get_current_user
from ..models import FamilyLink, User
from ..schemas import FamilyBindRequest, FamilyMemberOut

router = APIRouter(prefix="/family", tags=["家属监护"])

@router.get("/members", response_model=list[FamilyMemberOut])
def members(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    links = db.query(FamilyLink).filter(FamilyLink.user_id == user.id).all()
    return [FamilyMemberOut(id=link.family_user_id, name=link.family_user.name, relationship=link.relationship_name, role=link.family_user.role, bound=link.bound, phone=link.family_user.phone) for link in links]

@router.post("/bind", response_model=FamilyMemberOut)
def bind(payload: FamilyBindRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    family = db.query(User).filter(User.account == payload.family_account, User.role == "family").first()
    if not family: raise HTTPException(404, "家属账号不存在")
    link = db.query(FamilyLink).filter(FamilyLink.user_id == user.id, FamilyLink.family_user_id == family.id).first()
    if link: link.bound = True
    else: link = FamilyLink(user_id=user.id, family_user_id=family.id, relationship_name=payload.relationship, bound=True); db.add(link)
    db.commit()
    return FamilyMemberOut(id=family.id, name=family.name, relationship=payload.relationship, role=family.role, bound=True, phone=family.phone)

@router.delete("/bind/{family_user_id}")
def unbind(family_user_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    link = db.query(FamilyLink).filter(FamilyLink.user_id == user.id, FamilyLink.family_user_id == family_user_id).first()
    if not link: raise HTTPException(404, "绑定关系不存在")
    link.bound = False; db.commit(); return {"message": "已解除绑定"}
