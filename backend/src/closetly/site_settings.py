"""全站设置：存放在 app_settings 表中，数据库里没有的项使用默认值。"""

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import AppSetting


class SiteSettings(BaseModel):
    # 是否允许访客在登录页自助注册；默认关闭，由管理员在「用户管理」中开启
    registration_open: bool = False


def load_site_settings(db: Session) -> SiteSettings:
    stored = {row.key: row.value for row in db.scalars(select(AppSetting))}
    return SiteSettings.model_validate(
        {k: v for k, v in stored.items() if k in SiteSettings.model_fields}
    )


def save_site_settings(db: Session, **updates: object) -> SiteSettings:
    """只写入传入的项（值为 None 的忽略）；调用方负责 commit。"""
    current = load_site_settings(db)
    merged = SiteSettings.model_validate(
        current.model_dump() | {k: v for k, v in updates.items() if v is not None}
    )
    for key, value in merged.model_dump().items():
        db.merge(AppSetting(key=key, value=value))
    return merged
