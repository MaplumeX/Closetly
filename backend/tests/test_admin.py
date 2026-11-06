from .conftest import ADMIN

ALICE = {"username": "alice", "password": "alice-pass-1"}


def test_admin_manages_users(admin_client):
    r = admin_client.post("/api/admin/users", json=ALICE)
    assert r.status_code == 201
    alice_id = r.json()["id"]
    assert admin_client.post("/api/admin/users", json=ALICE).status_code == 409
    assert {u["username"] for u in admin_client.get("/api/admin/users").json()} == {"admin", "alice"}

    # 普通用户不能访问管理接口
    admin_client.post("/api/auth/logout")
    admin_client.post("/api/auth/login", json=ALICE)
    assert admin_client.get("/api/admin/users").status_code == 403

    # 停用后会话失效，且无法再登录
    admin_client.post("/api/auth/logout")
    admin_client.post("/api/auth/login", json=ADMIN)
    assert admin_client.patch(f"/api/admin/users/{alice_id}", json={"is_active": False}).status_code == 200
    admin_client.post("/api/auth/logout")
    assert admin_client.post("/api/auth/login", json=ALICE).status_code == 401


def test_admin_cannot_disable_self(admin_client):
    me = admin_client.get("/api/auth/me").json()
    r = admin_client.patch(f"/api/admin/users/{me['id']}", json={"is_active": False})
    assert r.status_code == 400


def test_reset_password(admin_client):
    uid = admin_client.post("/api/admin/users", json=ALICE).json()["id"]
    r = admin_client.post(f"/api/admin/users/{uid}/password", json={"password": "short"})
    assert r.status_code == 422
    r = admin_client.post(f"/api/admin/users/{uid}/password", json={"password": "brand-new-pw"})
    assert r.status_code == 204
    admin_client.post("/api/auth/logout")
    assert admin_client.post("/api/auth/login", json={"username": "alice", "password": "brand-new-pw"}).status_code == 200
