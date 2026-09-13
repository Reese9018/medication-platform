from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..dependencies import get_current_user
from ..models import FamilyLink, HealthRecord, Medication, Notification, ScheduleDose, User
from ..schemas import FamilyMemberOut, FamilyRequestCreate, FamilyRequestOut

router = APIRouter(prefix="/family", tags=["家属监护"])


# ---------------------------------------------------------------------------
# 工具函数
# ---------------------------------------------------------------------------
def _peer(link: FamilyLink, viewer: User) -> User:
    """返回绑定关系中与 viewer 相对的另一方。"""
    if link.user_id == viewer.id:
        return link.family_user
    return link.user


def _to_request_out(link: FamilyLink, viewer: User) -> FamilyRequestOut:
    """把一条 pending link 包装成前端用的申请视图，自动判断 incoming/outgoing。"""
    peer = _peer(link, viewer)
    direction = "outgoing" if link.requester_id == viewer.id else "incoming"
    return FamilyRequestOut(
        id=link.id,
        peer_id=peer.id,
        peer_name=peer.name,
        peer_role=peer.role,
        peer_phone=peer.phone,
        relationship=link.relationship_name,
        status=link.status,
        requester_id=link.requester_id,
        requester_name=link.requester.name,
        direction=direction,
        created_at=link.created_at,
    )


def _push_notice(db: Session, user_id: int, title: str, detail: str, level: str = "info") -> None:
    db.add(Notification(user_id=user_id, title=title, detail=detail, level=level))


# ---------------------------------------------------------------------------
# 已绑定成员
# ---------------------------------------------------------------------------
@router.get("/members", response_model=list[FamilyMemberOut])
def members(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """我当前已绑定（active）的家庭成员。

    - 老人视角：返回绑定到我的家属列表
    - 家属视角：返回我绑定的老人列表
    """
    if user.role == "elder":
        links = db.query(FamilyLink).filter(
            FamilyLink.user_id == user.id, FamilyLink.status == "active"
        ).all()
        return [FamilyMemberOut(
            id=l.family_user_id, name=l.family_user.name, relationship=l.relationship_name,
            role=l.family_user.role, phone=l.family_user.phone, status="active",
        ) for l in links]
    # family 视角
    links = db.query(FamilyLink).filter(
        FamilyLink.family_user_id == user.id, FamilyLink.status == "active"
    ).all()
    return [FamilyMemberOut(
        id=l.user_id, name=l.user.name, relationship=l.relationship_name,
        role=l.user.role, phone=l.user.phone, status="active",
    ) for l in links]


# ---------------------------------------------------------------------------
# 申请：发起 / 收到 / 发出
# ---------------------------------------------------------------------------
@router.post("/requests", response_model=FamilyRequestOut, status_code=201)
def create_request(payload: FamilyRequestCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """发起绑定申请。输入对方账号，对方登录后可在「收到的申请」里同意/拒绝。"""
    peer = db.query(User).filter(User.account == payload.account.strip()).first()
    if not peer:
        raise HTTPException(404, "对方账号不存在，请确认账号是否正确")
    if peer.id == user.id:
        raise HTTPException(400, "不能给自己发起绑定申请")
    # 必须一个老人 + 一个家属
    if user.role == peer.role:
        label = "家属" if user.role == "family" else "老人"
        raise HTTPException(400, f"绑定需要一个老人账号和一个家属账号，对方也是{label}身份")

    # 数据流向固定：elder = user_id, family = family_user_id
    elder = user if user.role == "elder" else peer
    family = peer if user.role == "elder" else user

    link = db.query(FamilyLink).filter(
        FamilyLink.user_id == elder.id, FamilyLink.family_user_id == family.id
    ).first()

    if link and link.status == "active":
        raise HTTPException(409, "你们已经是绑定关系，无需重复申请")

    if link and link.status == "pending":
        if link.requester_id == user.id:
            raise HTTPException(409, "你已向对方发起过申请，等待对方同意即可")
        # 对方早已向我发起过申请 → 我此刻相当于点了「同意」
        link.status = "active"
        link.responded_at = datetime.utcnow()
        link.relationship_name = payload.relationship or link.relationship_name
        _push_notice(db, link.requester_id, "绑定申请已通过",
                     f"{user.name} 已同意你的绑定申请，现在可以查看 TA 的健康数据了", level="success")
        db.commit()
        return FamilyRequestOut(
            id=link.id, peer_id=peer.id, peer_name=peer.name, peer_role=peer.role,
            peer_phone=peer.phone, relationship=link.relationship_name, status="active",
            requester_id=link.requester_id, requester_name=link.requester.name,
            direction="outgoing", created_at=link.created_at,
        )

    # 无记录 / 之前被拒绝过 → 新建或重置为 pending
    if link:
        link.status = "pending"
        link.requester_id = user.id
        link.relationship_name = payload.relationship
        link.responded_at = None
    else:
        link = FamilyLink(
            user_id=elder.id, family_user_id=family.id, requester_id=user.id,
            relationship_name=payload.relationship, status="pending",
        )
        db.add(link)
    _push_notice(db, peer.id, "收到绑定申请",
                 f"{user.name} 请求与您建立家庭绑定，同意后对方可查看您的用药与健康数据", level="warn")
    db.commit()
    db.refresh(link)
    return _to_request_out(link, user)


@router.get("/requests/incoming", response_model=list[FamilyRequestOut])
def incoming_requests(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """我收到的、等待我处理的绑定申请（pending 且我不是发起人）。"""
    links = db.query(FamilyLink).filter(
        FamilyLink.status == "pending",
        FamilyLink.requester_id != user.id,
        (FamilyLink.user_id == user.id) | (FamilyLink.family_user_id == user.id),
    ).order_by(FamilyLink.created_at.desc()).all()
    return [_to_request_out(l, user) for l in links]


@router.get("/requests/outgoing", response_model=list[FamilyRequestOut])
def outgoing_requests(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """我发出的、等待对方同意的绑定申请（pending 且我是发起人）。"""
    links = db.query(FamilyLink).filter(
        FamilyLink.status == "pending", FamilyLink.requester_id == user.id
    ).order_by(FamilyLink.created_at.desc()).all()
    return [_to_request_out(l, user) for l in links]


# ---------------------------------------------------------------------------
# 同意 / 拒绝申请（只能由被申请方操作）
# ---------------------------------------------------------------------------
def _get_pending_for_response(request_id: int, user: User, db: Session) -> FamilyLink:
    link = db.get(FamilyLink, request_id)
    if not link:
        raise HTTPException(404, "申请不存在")
    if link.status != "pending":
        raise HTTPException(400, "该申请已处理过")
    if link.requester_id == user.id:
        raise HTTPException(403, "不能处理自己发起的申请")
    if link.user_id != user.id and link.family_user_id != user.id:
        raise HTTPException(403, "这不是发给你的申请")
    return link


@router.post("/requests/{request_id}/accept", response_model=FamilyRequestOut)
def accept_request(request_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    link = _get_pending_for_response(request_id, user, db)
    link.status = "active"
    link.responded_at = datetime.utcnow()
    _push_notice(db, link.requester_id, "绑定申请已通过",
                 f"{user.name} 已同意你的绑定申请，现在可以查看 TA 的用药与健康数据了", level="success")
    db.commit()
    db.refresh(link)
    return _to_request_out(link, user)


@router.post("/requests/{request_id}/reject")
def reject_request(request_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    link = _get_pending_for_response(request_id, user, db)
    link.status = "rejected"
    link.responded_at = datetime.utcnow()
    _push_notice(db, link.requester_id, "绑定申请被拒绝",
                 f"{user.name} 暂未同意你的绑定申请", level="info")
    db.commit()
    return {"message": "已拒绝该申请"}


# ---------------------------------------------------------------------------
# 解除绑定（双方都可）
# ---------------------------------------------------------------------------
@router.delete("/members/{peer_id}")
def unbind(peer_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    peer = db.get(User, peer_id)
    if not peer:
        raise HTTPException(404, "用户不存在")
    # 找到两人之间的 active 绑定（无论谁是 elder / family）
    link = (
        db.query(FamilyLink)
        .filter(
            FamilyLink.status == "active",
            (
                (FamilyLink.user_id == user.id) & (FamilyLink.family_user_id == peer.id)
                | (FamilyLink.user_id == peer.id) & (FamilyLink.family_user_id == user.id)
            ),
        )
        .first()
    )
    if not link:
        raise HTTPException(404, "绑定关系不存在")
    link.status = "rejected"
    link.responded_at = datetime.utcnow()
    _push_notice(db, peer.id, "家庭绑定已解除",
                 f"{user.name} 已与您解除家庭绑定", level="warn")
    db.commit()
    return {"message": "已解除绑定"}


# ---------------------------------------------------------------------------
# 家属查看老人真实数据（用药计划 / 服药记录 / 药品 / 健康曲线 / 档案）
# ---------------------------------------------------------------------------
def _ensure_bonded(db: Session, family_user: User, elder_id: int) -> User:
    """校验 family_user 与 elder_id 之间存在 active 绑定，返回老人对象。"""
    if family_user.role != "family":
        raise HTTPException(403, "仅家属端可查看老人数据")
    elder = db.get(User, elder_id)
    if not elder or elder.role != "elder":
        raise HTTPException(404, "老人不存在")
    link = db.query(FamilyLink).filter(
        FamilyLink.family_user_id == family_user.id,
        FamilyLink.user_id == elder.id,
        FamilyLink.status == "active",
    ).first()
    if not link:
        raise HTTPException(403, "您与该老人暂无绑定关系，无法查看数据")
    return elder


@router.get("/elders/{elder_id}/overview")
def elder_overview(elder_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """家属端首页/用药/健康页共用：返回老人的真实资料 + 今日用药 + 药品 + 最近健康记录。"""
    elder = _ensure_bonded(db, user, elder_id)
    today = date.today()

    # 今日用药（join 药品名）
    today_doses = (
        db.query(ScheduleDose, Medication)
        .join(Medication, ScheduleDose.medication_id == Medication.id)
        .filter(ScheduleDose.user_id == elder.id, ScheduleDose.dose_date == today)
        .order_by(ScheduleDose.dose_time)
        .all()
    )
    doses_out = [
        {
            "time": d.dose_time.strftime("%H:%M"),
            "name": m.name,
            "dosage": d.dosage,
            "status": d.status,
            "period": d.period,
        }
        for d, m in today_doses
    ]
    taken = sum(1 for d, _ in today_doses if d.status == "taken")
    total = len(today_doses)
    today_rate = round(taken / total * 100) if total else 0

    # 药品列表
    meds = db.query(Medication).filter(Medication.user_id == elder.id, Medication.status == "active").order_by(Medication.id).all()
    meds_out = [
        {
            "id": m.id, "name": m.name, "generic_name": m.generic_name, "spec": m.spec,
            "dosage": m.dosage, "freq": f"每日 {m.frequency_per_day} 次",
            "times": " / ".join(m.times), "category": m.category,
        }
        for m in meds
    ]

    # 最近 14 天健康记录（曲线用）
    records = (
        db.query(HealthRecord)
        .filter(HealthRecord.user_id == elder.id)
        .order_by(HealthRecord.record_date.desc(), HealthRecord.record_time.desc())
        .limit(14)
        .all()
    )
    records_out = [
        {
            "date": r.record_date.isoformat(),
            "time": r.record_time.strftime("%H:%M"),
            "systolic": r.systolic, "diastolic": r.diastolic,
            "blood_sugar": r.blood_sugar, "heart_rate": r.heart_rate,
        }
        for r in records
    ]
    latest = records[0] if records else None

    return {
        "id": elder.id,
        "name": elder.name,
        "age": elder.age,
        "gender": elder.gender,
        "avatar_color": elder.avatar_color,
        "relationship": "家人",
        "chronic_conditions": elder.chronic_conditions or [],
        "allergies": elder.allergies or [],
        "blood_type": elder.blood_type,
        "emergency_contact": elder.emergency_contact,
        "today_doses": doses_out,
        "today_rate": today_rate,
        "today_taken": taken,
        "today_total": total,
        "medications": meds_out,
        "health_records": records_out,
        "latest_bp": f"{latest.systolic}/{latest.diastolic}" if latest else "--/--",
        "latest_sugar": latest.blood_sugar if latest else None,
        "latest_hr": latest.heart_rate if latest else None,
    }
