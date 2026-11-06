from .conftest import login_as, new_item, upload


def add_color(client, name="燕麦", hex="#D8C8A8"):
    r = client.post("/api/colors", json={"name": name, "hex": hex})
    assert r.status_code == 201, r.text
    return r.json()


def test_create_list_and_use(admin_client):
    c = add_color(admin_client)
    assert c["name"] == "燕麦" and c["hex"] == "#d8c8a8" and c["count"] == 0
    value = f"custom:{c['id']}"

    item = new_item(admin_client, color=value)
    assert item["color"] == value
    assert admin_client.get(f"/api/items/{item['id']}").json()["color"] == value
    assert admin_client.get("/api/colors").json() == [{**c, "count": 1}]

    # 改回预设色，自定义颜色的引用随之清掉
    r = admin_client.patch(f"/api/items/{item['id']}", json={"color": "red"})
    assert r.json()["color"] == "red"
    assert admin_client.get("/api/colors").json()[0]["count"] == 0
    r = admin_client.patch(f"/api/items/{item['id']}", json={"color": value})
    assert r.json()["color"] == value


def test_validation(admin_client):
    for body in (
        {"name": "", "hex": "#ffffff"},
        {"name": "x" * 17, "hex": "#ffffff"},
        {"name": "雾蓝", "hex": "blue"},
        {"name": "雾蓝", "hex": "#fff"},
    ):
        assert admin_client.post("/api/colors", json=body).status_code == 422, body
    add_color(admin_client, "雾蓝")
    assert admin_client.post("/api/colors", json={"name": " 雾蓝 ", "hex": "#000000"}).status_code == 409
    assert admin_client.post("/api/colors", json={"name": "红", "hex": "#000000"}).status_code == 409
    # 不存在的颜色、格式不对的值都不能用在衣物上
    body = {"slot": "top", "image_key": upload(admin_client), "seasons": ["summer"]}
    r = admin_client.post("/api/items", json={**body, "color": "custom:999"})
    assert r.status_code == 422 and "颜色" in r.json()["detail"]
    r = admin_client.patch(f"/api/items/{new_item(admin_client)['id']}", json={"color": "custom:999"})
    assert r.status_code == 422 and "颜色" in r.json()["detail"]
    assert admin_client.patch(f"/api/items/{new_item(admin_client)['id']}", json={"color": "custom:abc"}).status_code == 422


def test_update(admin_client):
    a = add_color(admin_client, "燕麦")
    b = add_color(admin_client, "雾蓝")
    r = admin_client.patch(f"/api/colors/{a['id']}", json={"name": "奶茶", "hex": "#C0A080"})
    assert r.status_code == 200 and r.json()["name"] == "奶茶" and r.json()["hex"] == "#c0a080"
    assert admin_client.patch(f"/api/colors/{a['id']}", json={"name": "雾蓝"}).status_code == 409
    assert admin_client.patch(f"/api/colors/{a['id']}", json={"name": "奶茶"}).status_code == 200  # 名字不变
    assert admin_client.patch(f"/api/colors/{b['id']}", json={"hex": "#8899aa"}).json()["name"] == "雾蓝"


def test_delete_clears_items(admin_client):
    c = add_color(admin_client)
    item = new_item(admin_client, color=f"custom:{c['id']}")
    assert admin_client.delete(f"/api/colors/{c['id']}").status_code == 204
    assert admin_client.get("/api/colors").json() == []
    assert admin_client.get(f"/api/items/{item['id']}").json()["color"] is None
    assert admin_client.delete(f"/api/colors/{c['id']}").status_code == 404


def test_filter(admin_client):
    c = add_color(admin_client)
    a = new_item(admin_client, color=f"custom:{c['id']}")
    b = new_item(admin_client, color="blue")
    new_item(admin_client, color="red")

    def ids(*colors):
        r = admin_client.get("/api/items", params={"color": list(colors)})
        assert r.status_code == 200, r.text
        return {i["id"] for i in r.json()}

    assert ids(f"custom:{c['id']}") == {a["id"]}
    assert ids(f"custom:{c['id']}", "blue") == {a["id"], b["id"]}
    assert ids("custom:999") == set()


def test_user_isolation(admin_client):
    c = add_color(admin_client)
    admin_client.post("/api/admin/users", json={"username": "bob", "password": "bob-pass-123"})
    login_as(admin_client, "bob", "bob-pass-123")

    assert admin_client.get("/api/colors").json() == []
    assert admin_client.patch(f"/api/colors/{c['id']}", json={"name": "别人的"}).status_code == 404
    assert admin_client.delete(f"/api/colors/{c['id']}").status_code == 404
    body = {"slot": "top", "image_key": upload(admin_client), "seasons": ["summer"], "color": f"custom:{c['id']}"}
    r = admin_client.post("/api/items", json=body)
    assert r.status_code == 422 and "颜色" in r.json()["detail"]
    add_color(admin_client)  # 不同用户可以有同名颜色
