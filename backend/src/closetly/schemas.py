from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints

from .models import Slot

Username = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=2, max_length=64, pattern=r"^[\w.-]+$")
]
NewPassword = Annotated[str, StringConstraints(min_length=8, max_length=128)]


class LoginIn(BaseModel):
    username: str
    password: str


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: NewPassword


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    is_admin: bool
    is_active: bool
    created_at: datetime


class UserCreateIn(BaseModel):
    username: Username
    password: NewPassword
    is_admin: bool = False


class UserUpdateIn(BaseModel):
    is_admin: bool | None = None
    is_active: bool | None = None


class ResetPasswordIn(BaseModel):
    password: NewPassword


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slot: Slot | None
    children: list["CategoryOut"] = []
