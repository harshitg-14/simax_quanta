import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.user import User
from app.models.audit_log import AuditLog
from app.schemas.user import UserRegister, UserLogin
from app.auth.security import (
    hash_password, verify_password,
    create_token, get_current_user, ROLES
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register")
def register(data: UserRegister, db: Session = Depends(get_db)):
    if data.role not in ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Choose from: {ROLES}")

    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        id=str(uuid.uuid4()),
        name=data.name,
        email=data.email,
        password=hash_password(data.password),
        role=data.role
    )
    db.add(user)
    db.add(AuditLog(id=str(uuid.uuid4()), action="register", user_id=user.id))
    db.commit()

    return {"message": "User registered successfully", "role": user.role}


@router.post("/login")
def login(data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()

    if not user or not verify_password(data.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_token({"sub": user.email, "role": user.role, "name": user.name})

    db.add(AuditLog(id=str(uuid.uuid4()), action="login", user_id=user.id))
    db.commit()

    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user.role,
        "name": user.name
    }


@router.get("/profile")
def profile(current_user: dict = Depends(get_current_user)):
    return {
        "email": current_user.get("sub"),
        "name":  current_user.get("name"),
        "role":  current_user.get("role")
    }


@router.get("/users")
def list_users(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    users = db.query(User).all()
    return [{"id": u.id, "name": u.name, "email": u.email, "role": u.role} for u in users]


@router.patch("/users/{user_id}/role")
def update_user_role(
    user_id: str,
    body: dict,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    new_role = body.get("role")
    if new_role not in ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Choose from: {ROLES}")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.email == current_user.get("sub"):
        raise HTTPException(status_code=400, detail="Cannot change your own role")

    user.role = new_role
    db.add(AuditLog(id=str(uuid.uuid4()), action="role_change", user_id=current_user.get("sub"),
                    query=f"{user.email} → {new_role}"))
    db.commit()
    return {"message": f"Role updated to '{new_role}'", "user_id": user_id}


@router.delete("/users/{user_id}")
def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.email == current_user.get("sub"):
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    db.add(AuditLog(id=str(uuid.uuid4()), action="user_delete", user_id=current_user.get("sub"),
                    query=f"Deleted user: {user.email}"))
    db.delete(user)
    db.commit()
    return {"message": f"User '{user.email}' deleted"}
