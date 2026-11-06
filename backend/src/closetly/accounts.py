"""创建账号的公共逻辑：管理员建号和自助注册共用。"""

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .models import User
from .security import hash_password


def username_taken(db: Session, username: str) -> bool:
    # 不区分大小写，避免注册出 Admin 这类与已有用户只差大小写的名字
    return db.scalar(select(User.id).where(func.lower(User.username) == username.lower())) is not None


def create_user(db: Session, username: str, password: str, *, is_admin: bool = False) -> User:
    """创建并提交用户；用户名已存在时抛出 409。"""
    if username_taken(db, username):
        raise HTTPException(status.HTTP_409_CONFLICT, "用户名已存在")
    user = User(username=username, password_hash=hash_password(password), is_admin=is_admin)
    db.add(user)
    try:
        db.commit()
    except IntegrityError:  # 并发注册了同一个用户名
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "用户名已存在") from None
    return user
