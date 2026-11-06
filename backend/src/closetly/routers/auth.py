from datetime import timedelta

from fastapi import APIRouter, HTTPException, Request, Response, status
from sqlalchemy import delete, select

from ..db import utcnow
from ..deps import CurrentSessionDep, CurrentUserDep, DbDep, SettingsDep
from ..models import User, UserSession
from ..schemas import ChangePasswordIn, LoginIn, UserOut
from ..security import (
    SESSION_COOKIE,
    hash_password,
    hash_token,
    needs_rehash,
    new_session_token,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _client_ip(request: Request) -> str:
    # 反向代理传来的 X-Forwarded-For 由 uvicorn --proxy-headers 解析到 request.client
    return request.client.host if request.client else "unknown"


@router.post("/login", response_model=UserOut)
def login(body: LoginIn, request: Request, response: Response, db: DbDep, settings: SettingsDep):
    limiter = request.app.state.login_limiter
    keys = (f"ip:{_client_ip(request)}", f"user:{body.username.strip().lower()}")
    if limiter.is_blocked(*keys):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "登录失败次数过多，请稍后再试")

    user = db.scalar(select(User).where(User.username == body.username.strip()))
    ok = verify_password(user.password_hash if user else None, body.password)
    if not user or not ok or not user.is_active:
        limiter.record_failure(*keys)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "用户名或密码错误")
    limiter.reset(*keys)

    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(body.password)

    now = utcnow()
    db.execute(delete(UserSession).where(UserSession.user_id == user.id, UserSession.expires_at <= now))
    token = new_session_token()
    db.add(
        UserSession(
            token_hash=hash_token(token),
            user_id=user.id,
            expires_at=now + timedelta(days=settings.session_days),
        )
    )
    db.commit()

    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=settings.session_days * 86400,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
    )
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, response: Response, db: DbDep):
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        db.execute(delete(UserSession).where(UserSession.token_hash == hash_token(token)))
        db.commit()
    response.delete_cookie(SESSION_COOKIE, path="/")


@router.get("/me", response_model=UserOut)
def me(user: CurrentUserDep):
    return user


@router.post("/password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(body: ChangePasswordIn, sess: CurrentSessionDep, db: DbDep):
    user = sess.user
    if not verify_password(user.password_hash, body.current_password):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "当前密码不正确")
    user.password_hash = hash_password(body.new_password)
    # 保留当前会话，其他设备全部下线
    db.execute(
        delete(UserSession).where(
            UserSession.user_id == user.id, UserSession.token_hash != sess.token_hash
        )
    )
    db.commit()
