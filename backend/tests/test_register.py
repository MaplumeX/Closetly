from fastapi.testclient import TestClient

from .conftest import ADMIN

NEW = {"username": "alice", "password": "alice-pass-123"}


def open_registration(admin_client, value: bool = True):
    r = admin_client.patch("/api/admin/settings", json={"registration_open": value})
    assert r.status_code == 200 and r.json()["registration_open"] is value
    admin_client.post("/api/auth/logout")


def test_registration_closed_by_default(client):
    assert client.get("/api/auth/config").json() == {"registration_open": False}
    assert client.post("/api/auth/register", json=NEW).status_code == 403


def test_register_logs_in(admin_client):
    open_registration(admin_client)
    c = admin_client
    assert c.get("/api/auth/config").json() == {"registration_open": True}

    r = c.post("/api/auth/register", json=NEW)
    assert r.status_code == 201, r.text
    assert r.json()["username"] == "alice" and r.json()["is_admin"] is False
    assert c.get("/api/auth/me").json()["username"] == "alice"
    # 注册的用户是普通用户，数据与他人隔离，不能访问管理接口
    assert c.get("/api/admin/users").status_code == 403
    assert c.get("/api/items").json() == []

    c.post("/api/auth/logout")
    assert c.post("/api/auth/login", json=NEW).status_code == 200


def test_register_rejects_duplicates_case_insensitively(admin_client):
    open_registration(admin_client)
    r = admin_client.post("/api/auth/register", json={"username": "Admin", "password": "x" * 8})
    assert r.status_code == 409


def test_register_validates_input(admin_client):
    open_registration(admin_client)
    c = admin_client
    assert c.post("/api/auth/register", json={"username": "bob", "password": "short"}).status_code == 422
    assert c.post("/api/auth/register", json={"username": "a b", "password": "x" * 8}).status_code == 422


def test_register_rate_limited_per_ip(admin_client):
    open_registration(admin_client)
    c = admin_client
    for i in range(3):
        assert c.post("/api/auth/register", json={"username": f"u{i}", "password": "x" * 8}).status_code == 201
        c.post("/api/auth/logout")
    assert c.post("/api/auth/register", json={"username": "u9", "password": "x" * 8}).status_code == 429


def test_closing_registration(admin_client):
    open_registration(admin_client)
    admin_client.post("/api/auth/login", json=ADMIN)
    open_registration(admin_client, False)
    assert admin_client.post("/api/auth/register", json=NEW).status_code == 403


def test_site_settings_require_admin(admin_client):
    open_registration(admin_client)
    admin_client.post("/api/auth/register", json=NEW)
    assert admin_client.get("/api/admin/settings").status_code == 403
    assert admin_client.patch("/api/admin/settings", json={"registration_open": False}).status_code == 403


def test_setting_persists_across_restart(settings):
    from closetly.main import create_app

    with TestClient(create_app(settings)) as c:
        c.post("/api/auth/login", json=ADMIN)
        c.patch("/api/admin/settings", json={"registration_open": True})
    with TestClient(create_app(settings)) as c:
        assert c.get("/api/auth/config").json() == {"registration_open": True}
