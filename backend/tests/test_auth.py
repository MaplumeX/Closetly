from fastapi.testclient import TestClient

from closetly.main import create_app

from .conftest import ADMIN


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_requires_login(client):
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/kinds").status_code == 401


def test_admin_bootstrap_and_login(client):
    r = client.post("/api/auth/login", json=ADMIN)
    assert r.status_code == 200
    assert r.json()["username"] == "admin" and r.json()["is_admin"] is True
    cookie = r.headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=lax" in cookie
    assert client.get("/api/auth/me").json()["username"] == "admin"


def test_secure_cookie_in_production(settings):
    settings.cookie_secure = True
    with TestClient(create_app(settings)) as c:
        r = c.post("/api/auth/login", json=ADMIN)
        assert "secure" in r.headers["set-cookie"].lower()


def test_wrong_password(client):
    r = client.post("/api/auth/login", json={"username": "admin", "password": "nope"})
    assert r.status_code == 401
    r = client.post("/api/auth/login", json={"username": "ghost", "password": "nope"})
    assert r.status_code == 401


def test_rate_limit(client):
    for _ in range(5):
        client.post("/api/auth/login", json={"username": "admin", "password": "wrong"})
    # 第 6 次即使密码正确也被拒绝
    assert client.post("/api/auth/login", json=ADMIN).status_code == 429


def test_logout_invalidates_session(admin_client):
    token = admin_client.cookies.get("closetly_session")
    assert admin_client.post("/api/auth/logout").status_code == 204
    admin_client.cookies.set("closetly_session", token)  # 旧 token 不能再用
    assert admin_client.get("/api/auth/me").status_code == 401


def test_change_password_logs_out_other_sessions(settings):
    with TestClient(create_app(settings)) as a:
        a.post("/api/auth/login", json=ADMIN)
        b = TestClient(a.app)
        b.post("/api/auth/login", json=ADMIN)

        r = a.post(
            "/api/auth/password",
            json={"current_password": "wrong", "new_password": "new-pass-456"},
        )
        assert r.status_code == 400
        r = a.post(
            "/api/auth/password",
            json={"current_password": ADMIN["password"], "new_password": "new-pass-456"},
        )
        assert r.status_code == 204
        assert a.get("/api/auth/me").status_code == 200
        assert b.get("/api/auth/me").status_code == 401
        assert (
            b.post("/api/auth/login", json={"username": "admin", "password": "new-pass-456"}).status_code
            == 200
        )
