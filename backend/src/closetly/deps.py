from collections.abc import Iterator
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from .config import Settings
from .db import utcnow
from .models import User, UserSession
from .security import SESSION_COOKIE, hash_token


def get_settings_dep(request: Request) -> Settings:
    return request.app.state.settings


def get_db(request: Request) -> Iterator[Session]:
    with request.app.state.sessionmaker() as db:
        yield db


SettingsDep = Annotated[Settings, Depends(get_settings_dep)]
DbDep = Annotated[Session, Depends(get_db)]


def get_current_session(request: Request, db: DbDep) -> UserSession:
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        sess = db.get(UserSession, hash_token(token))
        if sess and sess.expires_at > utcnow() and sess.user.is_active:
            return sess
    raise HTTPException(status.HTTP_401_UNAUTHORIZED, "未登录或登录已过期")


CurrentSessionDep = Annotated[UserSession, Depends(get_current_session)]


def get_current_user(sess: CurrentSessionDep) -> User:
    return sess.user


CurrentUserDep = Annotated[User, Depends(get_current_user)]


def require_admin(user: CurrentUserDep) -> User:
    if not user.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "需要管理员权限")
    return user


AdminDep = Annotated[User, Depends(require_admin)]
