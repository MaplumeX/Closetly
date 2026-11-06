"""版本号与升级时的数据库备份。"""

import sqlite3
from contextlib import closing

from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient

from closetly import __version__
from closetly.bootstrap import MIGRATIONS_DIR
from closetly.main import create_app


def test_health_reports_version(client):
    body = client.get("/api/health").json()
    assert body == {"status": "ok", "version": __version__}
    assert __version__ != "0.0.0+unknown"


def _alembic_cfg(settings):
    cfg = Config()
    cfg.set_main_option("script_location", str(MIGRATIONS_DIR))
    cfg.set_main_option("sqlalchemy.url", settings.database_url)
    return cfg


def _backups(settings):
    d = settings.data_dir / "backups"
    return sorted(d.glob("*.db")) if d.exists() else []


def test_no_backup_on_fresh_install_or_when_up_to_date(settings):
    with TestClient(create_app(settings)):
        pass
    with TestClient(create_app(settings)):
        pass
    assert _backups(settings) == []


def test_backup_before_pending_migration(settings):
    with TestClient(create_app(settings)):
        pass
    # 模拟旧版本的数据库：回退一个迁移
    cfg = _alembic_cfg(settings)
    command.downgrade(cfg, "-1")
    with closing(sqlite3.connect(settings.data_dir / "closetly.db")) as conn:
        old_rev = conn.execute("SELECT version_num FROM alembic_version").fetchone()[0]

    with TestClient(create_app(settings)):
        pass

    [backup] = _backups(settings)
    assert backup.name.endswith(f"-{old_rev}.db")
    with closing(sqlite3.connect(backup)) as conn:
        assert conn.execute("SELECT version_num FROM alembic_version").fetchone()[0] == old_rev
        assert conn.execute("SELECT username FROM users").fetchone()[0] == "admin"
