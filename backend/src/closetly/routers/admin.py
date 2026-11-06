from fastapi import APIRouter, HTTPException, status
from sqlalchemy import delete, select

from ..accounts import create_user as create_account
from ..deps import AdminDep, DbDep
from ..models import User, UserSession
from ..schemas import ResetPasswordIn, SiteSettingsUpdateIn, UserCreateIn, UserOut, UserUpdateIn
from ..security import hash_password
from ..site_settings import SiteSettings, load_site_settings, save_site_settings

router = APIRouter(prefix="/api/admin", tags=["admin"])


def _get_user(db, user_id: int) -> User:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "用户不存在")
    return user


@router.get("/users", response_model=list[UserOut])
def list_users(_: AdminDep, db: DbDep):
    return db.scalars(select(User).order_by(User.id)).all()


@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(body: UserCreateIn, _: AdminDep, db: DbDep):
    return create_account(db, body.username, body.password, is_admin=body.is_admin)


@router.patch("/users/{user_id}", response_model=UserOut)
def update_user(user_id: int, body: UserUpdateIn, admin: AdminDep, db: DbDep):
    user = _get_user(db, user_id)
    if user.id == admin.id and (body.is_active is False or body.is_admin is False):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "不能停用自己或取消自己的管理员权限")
    if body.is_admin is not None:
        user.is_admin = body.is_admin
    if body.is_active is not None:
        user.is_active = body.is_active
        if not body.is_active:
            db.execute(delete(UserSession).where(UserSession.user_id == user.id))
    db.commit()
    return user


@router.post("/users/{user_id}/password", status_code=status.HTTP_204_NO_CONTENT)
def reset_password(user_id: int, body: ResetPasswordIn, _: AdminDep, db: DbDep):
    user = _get_user(db, user_id)
    user.password_hash = hash_password(body.password)
    db.execute(delete(UserSession).where(UserSession.user_id == user.id))
    db.commit()


@router.get("/settings", response_model=SiteSettings)
def get_site_settings(_: AdminDep, db: DbDep):
    return load_site_settings(db)


@router.patch("/settings", response_model=SiteSettings)
def update_site_settings(body: SiteSettingsUpdateIn, _: AdminDep, db: DbDep):
    updated = save_site_settings(db, **body.model_dump())
    db.commit()
    return updated
