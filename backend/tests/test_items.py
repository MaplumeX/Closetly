from .conftest import login_as, new_item, upload


def test_create_and_get(admin_client):
    item = new_item(
        admin_client,
        name="  白色T恤  ",
        brand="",
        color="white",
        occasions=["casual", "casual"],
        warmth=2,
        price="99.9",
        purchase_date="2026-05-01",
        location="主卧衣柜",
        tags=["基础款", "纯棉", "基础款"],
    )
    assert item["name"] == "白色T恤"  # 去掉首尾空格
    assert item["brand"] is None  # 空字符串视为未填写
    assert item["occasions"] == ["casual"]  # 去重
    assert item["tags"] == ["基础款", "纯棉"]
    assert item["price"] == 99.9
    assert item["slot"] == "top" and item["kind"] == "T恤"
    assert item["status"] == "active"
    assert admin_client.get(f"/api/items/{item['id']}").json() == item


def test_validation(admin_client):
    key = upload(admin_client)
    bad = [
        {"slot": "top", "image_key": key, "seasons": []},  # 季节必填
        {"slot": "top", "image_key": key, "seasons": ["monsoon"]},
        {"slot": "top", "image_key": key, "seasons": ["summer"], "warmth": 6},
        {"slot": "top", "image_key": key, "seasons": ["summer"], "color": "rainbow"},
        {"slot": "top", "image_key": key, "seasons": ["summer"], "price": "-1"},
        {"slot": "hat", "image_key": key, "seasons": ["summer"]},  # 部位只能是固定的几种
        {"image_key": key, "seasons": ["summer"]},  # 部位必填
        {"slot": "top", "image_key": key, "seasons": ["summer"], "kind": "x" * 33},
        {"slot": "top", "image_key": "0" * 32, "seasons": ["summer"]},  # 图片不存在
    ]
    for body in bad:
        assert admin_client.post("/api/items", json=body).status_code == 422, body


def test_image_cannot_be_shared(admin_client):
    item = new_item(admin_client)
    r = admin_client.post(
        "/api/items",
        json={"slot": "top", "image_key": item["image_key"], "seasons": ["winter"]},
    )
    assert r.status_code == 422


def test_update(admin_client, settings):
    item = new_item(admin_client, name="旧名字", color="red", tags=["a"])
    old_key = item["image_key"]
    new_key = upload(admin_client)
    r = admin_client.patch(
        f"/api/items/{item['id']}",
        json={"name": "新名字", "color": None, "tags": ["b"], "image_key": new_key, "status": "laundry"},
    )
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["name"] == "新名字" and out["color"] is None and out["tags"] == ["b"]
    assert out["status"] == "laundry" and out["seasons"] == ["spring", "summer"]  # 未传的字段不变
    # 换图后旧图片文件被删除
    assert admin_client.get(f"/api/images/{old_key}").status_code == 404
    assert admin_client.get(f"/api/images/{new_key}").status_code == 200
    # 必填字段不能清空
    assert admin_client.patch(f"/api/items/{item['id']}", json={"seasons": None}).status_code == 422


def test_delete_removes_image(admin_client):
    item = new_item(admin_client)
    assert admin_client.delete(f"/api/items/{item['id']}").status_code == 204
    assert admin_client.get(f"/api/items/{item['id']}").status_code == 404
    assert admin_client.get(f"/api/images/{item['image_key']}").status_code == 404


def test_filters(admin_client):
    a = new_item(admin_client, name="夏季T恤", seasons=["summer"], color="white", occasions=["casual"], tags=["x"])
    b = new_item(admin_client, name="冬季牛仔裤", slot="bottom", kind="牛仔裤", seasons=["winter"], color="blue", brand="Levi's")
    c = new_item(admin_client, name="旧T恤", seasons=["summer"], status="retired")

    def ids(**params):
        r = admin_client.get("/api/items", params=params)
        assert r.status_code == 200, r.text
        return {i["id"] for i in r.json()}

    assert ids() == {a["id"], b["id"]}  # 默认隐藏已淘汰
    assert ids(status="retired") == {c["id"]}
    assert ids(status=["active", "retired"]) == {a["id"], b["id"], c["id"]}
    assert ids(season="winter") == {b["id"]}
    assert ids(season=["winter", "summer"]) == {a["id"], b["id"]}
    assert ids(color="blue") == {b["id"]}
    assert ids(occasion="casual") == {a["id"]}
    assert ids(tag="x") == {a["id"]}
    assert ids(q="levi") == {b["id"]}  # 搜索品牌，不区分大小写
    assert ids(q="%") == set()  # 通配符被转义
    assert ids(slot="bottom") == {b["id"]}
    assert ids(slot="top", kind="T恤") == {a["id"]}
    assert ids(slot="bottom", kind="T恤") == set()
    assert ids(season="winter", color="white") == set()  # 不同条件之间是「并且」


def test_tags_list(admin_client):
    new_item(admin_client, tags=["基础款", "纯棉"])
    new_item(admin_client, tags=["基础款"])
    assert admin_client.get("/api/tags").json() == [
        {"name": "基础款", "count": 2},
        {"name": "纯棉", "count": 1},
    ]


def test_kind_is_optional_and_trimmed(admin_client):
    item = new_item(admin_client, kind="  ")
    assert item["kind"] is None
    r = admin_client.patch(f"/api/items/{item['id']}", json={"slot": "bottom", "kind": " 工装裤 "})
    assert (r.json()["slot"], r.json()["kind"]) == ("bottom", "工装裤")
    r = admin_client.patch(f"/api/items/{item['id']}", json={"kind": None})  # 类型可以清空
    assert r.json()["kind"] is None
    assert admin_client.patch(f"/api/items/{item['id']}", json={"slot": None}).status_code == 422


def test_kinds_list(admin_client):
    new_item(admin_client, slot="bottom", kind="牛仔裤")
    new_item(admin_client, slot="top", kind="T恤")
    new_item(admin_client, slot="top", kind="T恤", status="retired")  # 已淘汰的也算
    new_item(admin_client, slot="top", kind="衬衫")
    new_item(admin_client, slot="top", kind=None)
    assert admin_client.get("/api/kinds").json() == [
        {"slot": "top", "name": "T恤", "count": 2},
        {"slot": "top", "name": "衬衫", "count": 1},
        {"slot": "bottom", "name": "牛仔裤", "count": 1},
    ]


def test_rename_merge_clear_kind(admin_client):
    a = new_item(admin_client, slot="top", kind="T恤")
    b = new_item(admin_client, slot="top", kind="短袖")
    c = new_item(admin_client, slot="bottom", kind="短袖")  # 另一个部位的同名类型不受影响

    def kind(item):
        return admin_client.get(f"/api/items/{item['id']}").json()["kind"]

    def rename(slot, name, new_name):
        r = admin_client.patch("/api/kinds", json={"slot": slot, "name": name, "new_name": new_name})
        assert r.status_code == 204, r.text

    before = admin_client.get(f"/api/items/{b['id']}").json()["updated_at"]
    rename("top", "短袖", "T恤")  # 合并
    assert (kind(a), kind(b), kind(c)) == ("T恤", "T恤", "短袖")
    assert admin_client.get(f"/api/items/{b['id']}").json()["updated_at"] == before  # 不算修改衣物
    rename("top", "T恤", "  短T ")  # 重命名
    assert (kind(a), kind(b)) == ("短T", "短T")
    rename("top", "短T", "")  # 清除
    assert (kind(a), kind(b), kind(c)) == (None, None, "短袖")


def test_user_isolation(admin_client):
    item = new_item(admin_client, tags=["私人"])
    admin_client.post("/api/admin/users", json={"username": "bob", "password": "bob-pass-12"})
    login_as(admin_client, "bob", "bob-pass-12")

    assert admin_client.get("/api/items").json() == []
    assert admin_client.get("/api/tags").json() == []
    assert admin_client.get("/api/kinds").json() == []
    assert admin_client.get(f"/api/items/{item['id']}").status_code == 404
    assert admin_client.patch(f"/api/items/{item['id']}", json={"name": "x"}).status_code == 404
    assert admin_client.delete(f"/api/items/{item['id']}").status_code == 404
    assert admin_client.get(f"/api/images/{item['image_key']}").status_code == 404
    # 改名只影响自己的衣物
    admin_client.patch("/api/kinds", json={"slot": "top", "name": "T恤", "new_name": "别人的"})
    # 不能拿别人的图片来创建衣物
    r = admin_client.post(
        "/api/items",
        json={"slot": "top", "image_key": item["image_key"], "seasons": ["summer"]},
    )
    assert r.status_code == 422
    login_as(admin_client, "admin", "admin-pass-123")
    assert admin_client.get(f"/api/items/{item['id']}").json()["kind"] == "T恤"
