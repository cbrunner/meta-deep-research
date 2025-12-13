import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, Request, Response
import bcrypt
from itsdangerous import URLSafeSerializer, BadSignature
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload

from database import get_db, User, Session, UserRole

SESSION_SECRET = os.environ.get("SESSION_SECRET", "dev-secret-change-in-production")
SESSION_COOKIE_NAME = "session_id"
SESSION_EXPIRY_DAYS = 7

serializer = URLSafeSerializer(SESSION_SECRET)


def hash_password(password: str) -> str:
    password_bytes = password.encode('utf-8')[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password_bytes, salt).decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    password_bytes = plain_password.encode('utf-8')[:72]
    return bcrypt.checkpw(password_bytes, hashed_password.encode('utf-8'))


def sign_session_id(session_id: str) -> str:
    return serializer.dumps(session_id)


def unsign_session_id(signed_value: str) -> Optional[str]:
    try:
        return serializer.loads(signed_value)
    except BadSignature:
        return None


async def create_session(db: AsyncSession, user_id: str) -> str:
    session_id = str(uuid.uuid4())
    expires_at = datetime.now(timezone.utc) + timedelta(days=SESSION_EXPIRY_DAYS)
    
    session = Session(
        id=session_id,
        user_id=user_id,
        expires_at=expires_at
    )
    db.add(session)
    await db.commit()
    
    return session_id


async def delete_session(db: AsyncSession, session_id: str):
    await db.execute(delete(Session).where(Session.id == session_id))
    await db.commit()


async def get_session_user(db: AsyncSession, session_id: str) -> Optional[User]:
    result = await db.execute(
        select(Session).where(
            Session.id == session_id,
            Session.expires_at > datetime.now(timezone.utc)
        )
    )
    session = result.scalar_one_or_none()
    
    if not session:
        return None
    
    user_result = await db.execute(select(User).where(User.id == session.user_id))
    return user_result.scalar_one_or_none()


async def get_current_user_optional(
    request: Request,
    db: AsyncSession = Depends(get_db)
) -> Optional[User]:
    signed_session_id = request.cookies.get(SESSION_COOKIE_NAME)
    if not signed_session_id:
        return None
    
    session_id = unsign_session_id(signed_session_id)
    if not session_id:
        return None
    
    return await get_session_user(db, session_id)


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db)
) -> User:
    user = await get_current_user_optional(request, db)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


async def require_admin(
    user: User = Depends(get_current_user)
) -> User:
    if user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def set_session_cookie(response: Response, session_id: str):
    signed = sign_session_id(session_id)
    is_production = os.environ.get("REPL_SLUG") is not None
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=signed,
        httponly=True,
        secure=is_production,
        samesite="lax",
        max_age=SESSION_EXPIRY_DAYS * 24 * 60 * 60
    )


def clear_session_cookie(response: Response):
    response.delete_cookie(key=SESSION_COOKIE_NAME)


async def create_initial_admin(db: AsyncSession):
    admin_email = os.environ.get("INITIAL_ADMIN_EMAIL")
    admin_password = os.environ.get("INITIAL_ADMIN_PASSWORD")
    
    if not admin_email or not admin_password:
        return
    
    result = await db.execute(select(User).where(User.role == UserRole.admin))
    existing_admin = result.scalar_one_or_none()
    
    if existing_admin:
        return
    
    admin = User(
        id=str(uuid.uuid4()),
        email=admin_email,
        password_hash=hash_password(admin_password),
        role=UserRole.admin,
        first_name="Admin"
    )
    db.add(admin)
    await db.commit()
    print(f"Created initial admin user: {admin_email}")
