import os
import jwt
import bcrypt
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException, Request
from database import db
from models import now_iso, new_id

JWT_ALGORITHM = "HS256"
TOKEN_DAYS = 7

FOUNDERS = [
    {"name": "Shubham Raj", "email": "shubham@virtelon.com", "initials": "SR",
     "avatar": "https://images.unsplash.com/photo-1560250097-0b93528c311a?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NjZ8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBoZWFkc2hvdHxlbnwwfHx8fDE3ODcyNDk3MzZ8MA&ixlib=rb-4.1.0&q=85&w=200"},
    {"name": "Sanskar Mishra", "email": "sanskar@virtelon.com", "initials": "SM",
     "avatar": "https://images.unsplash.com/photo-1629425733761-caae3b5f2e50?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NjZ8MHwxfHNlYXJjaHw0fHxwcm9mZXNzaW9uYWwlMjBoZWFkc2hvdHxlbnwwfHx8fDE3ODcyNDk3MzZ8MA&ixlib=rb-4.1.0&q=85&w=200"},
    {"name": "Vijayant Priyadarshi", "email": "vijayant@virtelon.com", "initials": "VP",
     "avatar": "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NjZ8MHwxfHNlYXJjaHwzfHxwcm9mZXNzaW9uYWwlMjBoZWFkc2hvdHxlbnwwfHx8fDE3ODcyNDk3MzZ8MA&ixlib=rb-4.1.0&q=85&w=200"},
]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def _secret() -> str:
    return os.environ["JWT_SECRET"]


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "type": "access",
        "exp": datetime.now(timezone.utc) + timedelta(days=TOKEN_DAYS),
    }
    return jwt.encode(payload, _secret(), algorithm=JWT_ALGORITHM)


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, _secret(), algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def seed_founders():
    password = os.environ.get("FOUNDER_PASSWORD", "Virtelon@2025")
    for f in FOUNDERS:
        existing = await db.users.find_one({"email": f["email"]})
        if existing is None:
            await db.users.insert_one({
                "id": new_id(),
                "name": f["name"],
                "email": f["email"],
                "initials": f["initials"],
                "avatar": f["avatar"],
                "role": "founder",
                "password_hash": hash_password(password),
                "created_at": now_iso(),
            })
        elif not verify_password(password, existing["password_hash"]):
            await db.users.update_one({"email": f["email"]},
                                      {"$set": {"password_hash": hash_password(password)}})
