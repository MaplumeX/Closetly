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


def make_image(fmt: str = "JPEG", size=(2400, 1800), color=(200, 80, 40), exif: bool = False) -> bytes:
    from io import BytesIO

    from PIL import Image

    im = Image.new("RGB", size, color)
    buf = BytesIO()
    kwargs = {}
    if exif:
        ex = Image.Exif()
        ex[0x0112] = 6  # Orientation：需要顺时针旋转 90°
        ex[0x010F] = "TestCam"  # Make
        kwargs["exif"] = ex
    im.save(buf, fmt, **kwargs)
    return buf.getvalue()


def upload(client, data: bytes | None = None) -> str:
    r = client.post("/api/images", files={"file": ("photo.jpg", data or make_image(), "image/jpeg")})
    assert r.status_code == 201, r.text
    return r.json()["key"]


def leaf_category(client, top: str = "上装", child: str = "T恤") -> int:
    cats = client.get("/api/categories").json()
    parent = next(c for c in cats if c["name"] == top)
    return next(c["id"] for c in parent["children"] if c["name"] == child)


def login_as(client, username: str, password: str):
    client.post("/api/auth/logout")
    assert client.post("/api/auth/login", json={"username": username, "password": password}).status_code == 200


def new_item(client, **overrides):
    body = {
        "category_id": leaf_category(client),
        "image_key": upload(client),
        "seasons": ["spring", "summer"],
        **overrides,
    }
    r = client.post("/api/items", json=body)
    assert r.status_code == 201, r.text
    return r.json()
