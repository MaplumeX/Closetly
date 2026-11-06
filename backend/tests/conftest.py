import pytest
from fastapi.testclient import TestClient

from closetly.config import Settings
from closetly.main import create_app

ADMIN = {"username": "admin", "password": "admin-pass-123"}


@pytest.fixture
def settings(tmp_path) -> Settings:
    return Settings(
        _env_file=None,
        data_dir=tmp_path / "data",
        admin_username=ADMIN["username"],
        admin_password=ADMIN["password"],
        cookie_secure=False,  # TestClient 走 http，Secure Cookie 不会被回传
    )


@pytest.fixture
def client(settings):
    with TestClient(create_app(settings)) as c:
        yield c


@pytest.fixture
def admin_client(client):
    r = client.post("/api/auth/login", json=ADMIN)
    assert r.status_code == 200
    return client
