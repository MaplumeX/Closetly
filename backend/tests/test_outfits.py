from .conftest import login_as, new_item


def make_wardrobe(client):
    top = new_item(client, name="白T")
    bottom = new_item(client, name="牛仔裤", slot="bottom", kind="牛仔裤")
    shoes = new_item(client, name="球鞋", slot="shoes", kind="运动鞋")
    coat = new_item(client, name="风衣", slot="outer", kind="风衣")
    return top, bottom, shoes, coat


def test_outfit_crud(admin_client):
    top, bottom, shoes, coat = make_wardrobe(admin_client)
    r = admin_client.post(
        "/api/outfits",
        json={"name": "周末", "item_ids": [shoes["id"], top["id"], bottom["id"], coat["id"], top["id"]]},
    )
    assert r.status_code == 201, r.text
    outfit = r.json()
    # 去重，并按 外套→上装→下装→鞋 排序
    assert [i["name"] for i in outfit["items"]] == ["风衣", "白T", "牛仔裤", "球鞋"]
    assert outfit["wear_count"] == 0 and outfit["last_worn_on"] is None

    r = admin_client.patch(f"/api/outfits/{outfit['id']}", json={"name": None, "item_ids": [top["id"]]})
    assert r.status_code == 200
    assert r.json()["name"] is None and [i["id"] for i in r.json()["items"]] == [top["id"]]

    assert [o["id"] for o in admin_client.get("/api/outfits").json()] == [outfit["id"]]
    assert [o["id"] for o in admin_client.get("/api/outfits", params={"item_id": top["id"]}).json()] == [outfit["id"]]
    assert admin_client.get("/api/outfits", params={"item_id": shoes["id"]}).json() == []

    assert admin_client.delete(f"/api/outfits/{outfit['id']}").status_code == 204
    assert admin_client.get(f"/api/outfits/{outfit['id']}").status_code == 404


def test_outfit_validation(admin_client):
    top, *_ = make_wardrobe(admin_client)
    assert admin_client.post("/api/outfits", json={"item_ids": []}).status_code == 422
    assert admin_client.post("/api/outfits", json={"item_ids": [99999]}).status_code == 422
    oid = admin_client.post("/api/outfits", json={"item_ids": [top["id"]]}).json()["id"]
    assert admin_client.patch(f"/api/outfits/{oid}", json={"item_ids": None}).status_code == 422


def test_deleting_item_removes_it_from_outfits(admin_client):
    top, bottom, *_ = make_wardrobe(admin_client)
    oid = admin_client.post("/api/outfits", json={"item_ids": [top["id"], bottom["id"]]}).json()["id"]
    admin_client.delete(f"/api/items/{bottom['id']}")
    assert [i["id"] for i in admin_client.get(f"/api/outfits/{oid}").json()["items"]] == [top["id"]]


def test_wear_log_from_outfit_is_a_snapshot(admin_client):
    top, bottom, shoes, _ = make_wardrobe(admin_client)
    oid = admin_client.post("/api/outfits", json={"name": "通勤", "item_ids": [top["id"], bottom["id"]]}).json()["id"]

    r = admin_client.post("/api/wear-logs", json={"worn_on": "2026-11-03", "outfit_id": oid})
    assert r.status_code == 201, r.text
    log = r.json()
    assert log["outfit_name"] == "通勤" and {i["id"] for i in log["items"]} == {top["id"], bottom["id"]}

    # 修改搭配，历史记录不变
    admin_client.patch(f"/api/outfits/{oid}", json={"item_ids": [shoes["id"]]})
    logs = admin_client.get("/api/wear-logs").json()
    assert {i["id"] for i in logs[0]["items"]} == {top["id"], bottom["id"]}

    # 删除搭配，记录保留，只是不再关联
    admin_client.delete(f"/api/outfits/{oid}")
    logs = admin_client.get("/api/wear-logs").json()
    assert logs[0]["outfit_id"] is None and len(logs[0]["items"]) == 2


def test_wear_log_crud_and_filters(admin_client):
    top, bottom, shoes, _ = make_wardrobe(admin_client)
    post = lambda **b: admin_client.post("/api/wear-logs", json=b)  # noqa: E731

    assert post(worn_on="2026-11-01").status_code == 422  # 没有衣物
    assert post(worn_on="2026-11-01", item_ids=[99999]).status_code == 422
    assert post(worn_on="2026-11-01", outfit_id=99999).status_code == 422

    a = post(worn_on="2026-10-31", item_ids=[top["id"]]).json()
    b = post(worn_on="2026-11-01", item_ids=[top["id"], bottom["id"]], notes="  面试  ").json()
    c = post(worn_on="2026-11-30", item_ids=[shoes["id"]]).json()
    assert b["notes"] == "面试"

    def ids(**params):
        return [log["id"] for log in admin_client.get("/api/wear-logs", params=params).json()]

    assert ids() == [c["id"], b["id"], a["id"]]  # 日期倒序
    assert ids(start="2026-11-01", end="2026-11-30") == [c["id"], b["id"]]  # 闭区间
    assert ids(item_id=top["id"]) == [b["id"], a["id"]]

    assert admin_client.get(f"/api/wear-logs/{b['id']}").json()["notes"] == "面试"
    r = admin_client.patch(f"/api/wear-logs/{a['id']}", json={"worn_on": "2026-11-02", "item_ids": [shoes["id"]]})
    assert r.status_code == 200 and r.json()["worn_on"] == "2026-11-02"
    assert admin_client.patch(f"/api/wear-logs/{a['id']}", json={"item_ids": []}).status_code == 422
    assert admin_client.delete(f"/api/wear-logs/{a['id']}").status_code == 204
    assert ids() == [c["id"], b["id"]]


def test_wear_stats(admin_client):
    top, bottom, *_ = make_wardrobe(admin_client)
    oid = admin_client.post("/api/outfits", json={"item_ids": [top["id"], bottom["id"]]}).json()["id"]
    admin_client.post("/api/wear-logs", json={"worn_on": "2026-11-01", "outfit_id": oid})
    admin_client.post("/api/wear-logs", json={"worn_on": "2026-11-01", "item_ids": [top["id"]]})  # 同一天不重复计数
    admin_client.post("/api/wear-logs", json={"worn_on": "2026-11-05", "item_ids": [top["id"]]})

    t = admin_client.get(f"/api/items/{top['id']}").json()
    assert (t["wear_count"], t["last_worn_on"]) == (2, "2026-11-05")
    listed = {i["id"]: i for i in admin_client.get("/api/items").json()}
    assert (listed[bottom["id"]]["wear_count"], listed[bottom["id"]]["last_worn_on"]) == (1, "2026-11-01")
    o = admin_client.get(f"/api/outfits/{oid}").json()
    assert (o["wear_count"], o["last_worn_on"]) == (1, "2026-11-01")


def test_isolation(admin_client):
    top, *_ = make_wardrobe(admin_client)
    oid = admin_client.post("/api/outfits", json={"item_ids": [top["id"]]}).json()["id"]
    lid = admin_client.post("/api/wear-logs", json={"worn_on": "2026-11-01", "outfit_id": oid}).json()["id"]
    admin_client.post("/api/admin/users", json={"username": "bob", "password": "bob-pass-12"})
    login_as(admin_client, "bob", "bob-pass-12")

    assert admin_client.get("/api/outfits").json() == []
    assert admin_client.get("/api/wear-logs").json() == []
    assert admin_client.get(f"/api/outfits/{oid}").status_code == 404
    assert admin_client.get(f"/api/wear-logs/{lid}").status_code == 404
    assert admin_client.patch(f"/api/wear-logs/{lid}", json={"notes": "x"}).status_code == 404
    # 不能用别人的衣物或搭配
    assert admin_client.post("/api/outfits", json={"item_ids": [top["id"]]}).status_code == 422
    assert admin_client.post("/api/wear-logs", json={"worn_on": "2026-11-01", "outfit_id": oid}).status_code == 422


def test_outfit_profile_is_derived_from_items(admin_client):
    top = new_item(admin_client, seasons=["autumn", "spring", "winter"], occasions=["casual", "commute"], warmth=2)
    bottom = new_item(admin_client, slot="bottom", seasons=["spring", "autumn"], occasions=["commute"], warmth=4)
    shoes = new_item(admin_client, slot="shoes", seasons=["autumn", "spring"])  # 未填场合、保暖度：不限
    r = admin_client.post("/api/outfits", json={"item_ids": [top["id"], bottom["id"], shoes["id"]]})
    o = r.json()
    assert o["seasons"] == ["spring", "autumn"]
    assert o["occasions"] == ["commute"]
    assert (o["warmth_min"], o["warmth_max"]) == (2, 4)

    o = admin_client.patch(f"/api/outfits/{o['id']}", json={"item_ids": [shoes["id"]]}).json()
    assert o["occasions"] is None and o["warmth_min"] is None and o["warmth_max"] is None

    # 场合没有交集：空列表，与「不限」区分开
    sport = new_item(admin_client, slot="bottom", occasions=["sport"])
    o = admin_client.patch(f"/api/outfits/{o['id']}", json={"item_ids": [top["id"], sport["id"]]}).json()
    assert o["occasions"] == [] and o["seasons"] == ["spring"]


def test_item_briefs_carry_matching_attributes(admin_client):
    """挑选搭配时前端要用季节、场合、保暖度判断其余单品是否合适。"""
    top = new_item(admin_client, seasons=["summer"], occasions=["sport"], warmth=1)
    brief = admin_client.post("/api/outfits", json={"item_ids": [top["id"]]}).json()["items"][0]
    assert (brief["seasons"], brief["occasions"], brief["warmth"]) == (["summer"], ["sport"], 1)
