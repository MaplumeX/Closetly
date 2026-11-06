from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """应用配置，全部通过 CLOSETLY_ 前缀的环境变量覆盖。"""

    model_config = SettingsConfigDict(env_prefix="CLOSETLY_", env_file=".env", extra="ignore")

    data_dir: Path = Path("./data")
    # 构建好的前端目录；为空或不存在时只提供 API
    static_dir: Path | None = None

    # 仅在数据库中没有任何用户时，用于创建首个管理员
    admin_username: str | None = None
    admin_password: str | None = None

    # 生产环境（HTTPS）必须为 True；本地 http 开发时设为 False
    cookie_secure: bool = True
    session_days: int = 30

    login_max_failures: int = 5
    login_window_seconds: int = 15 * 60

    # 开放注册时，同一 IP 在时间窗口内最多注册几个账号
    register_max_per_ip: int = 3
    register_window_seconds: int = 60 * 60

    @property
    def database_url(self) -> str:
        return f"sqlite:///{self.data_dir / 'closetly.db'}"

    @property
    def images_dir(self) -> Path:
        return self.data_dir / "images"


@lru_cache
def get_settings() -> Settings:
    return Settings()
