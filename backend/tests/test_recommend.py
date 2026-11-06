from collections import Counter

from closetly.recommend import band_for, season_for

from .conftest import leaf_category, new_item

DAY = "2026-11-06"  # 秋季


def rec(client, temperature=20, **params):
    r = client.get("/api/recommendation", params={"temperature": temperature, "date": DAY, **params})
    assert r.status_code == 200, r.text
    return r.json()


def names(result):
    return {i["name"] for i in result["items"]}


def item(client, name, top, child, **kw):
    kw.setdefault("seasons", ["autumn"])
    return new_item(client, name=name, category_id=leaf_category(client, top, child), **kw)


def test_bands_and_seasons():
    from datetime import date

    assert (band_for(30).min_warmth, band_for(30).need_outer) == (1, False)
    assert (band_for(26).label, band_for(25.9).label) == ("炎热", "温暖")
    assert (band_for(18).max_warmth, band_for(17.9).need_outer) == (3, True)
    assert band_for(-5).label == "寒冷"
    assert [season_for(date(2026, m, 1)) for m in (1, 4, 7, 10, 12)] == [
        "winter", "spring", "summer", "autumn", "winter",
    ]  # fmt: skip


def test_empty_wardrobe(admin_client):
    r = rec(admin_client)
    assert r["source"] == "empty" and r["items"] == [] and r["notes"]


def test_generated_combo_respects_warmth_and_outerwear(admin_client):
    item(admin_client, "薄T", "上装", "T恤", warmth=2)
    item(admin_client, "毛衣", "上装", "毛衣/针织衫", warmth=4)
    item(admin_client, "牛仔裤", "下装", "牛仔裤")  # 未填保暖度，不受限制
    item(admin_client, "球鞋", "鞋", "运动鞋")
    item(admin_client, "风衣", "外套", "风衣", warmth=3)

    warm = rec(admin_client, temperature=22)  # 保暖度 2–3，不需要外套
    assert warm["source"] == "generated"
    assert names(warm) == {"薄T", "牛仔裤", "球鞋"}
    assert warm["band"] == {"label": "温暖", "min_warmth": 2, "max_warmth": 3, "need_outer": False}

    cool = rec(admin_client, temperature=12)  # 保暖度 3–4，需要外套
    assert names(cool) == {"毛衣", "牛仔裤", "球鞋", "风衣"}
    # 按 外套→上装→下装→鞋 排序
    assert [i["name"] for i in cool["items"]] == ["风衣", "毛衣", "牛仔裤", "球鞋"]


def test_relaxes_season_with_note(admin_client):
    item(admin_client, "T恤", "上装", "T恤")
    item(admin_client, "短裤", "下装", "短裤")
    item(admin_client, "凉鞋", "鞋", "凉鞋/拖鞋", seasons=["summer"])
    r = rec(admin_client)
    assert "凉鞋" in names(r)
    assert any("放宽了季节" in n for n in r["notes"])


def test_missing_slots_are_reported(admin_client):
    item(admin_client, "T恤", "上装", "T恤")
    r = rec(admin_client, temperature=5)
    assert r["source"] == "empty"
    notes = " ".join(r["notes"])
    assert "下装" in notes and "鞋" in notes and "外套" in notes


def test_onepiece(admin_client):
    item(admin_client, "连衣裙", "连衣裙/连体", "连衣裙")
    item(admin_client, "单鞋", "鞋", "皮鞋")
    assert names(rec(admin_client)) == {"连衣裙", "单鞋"}


def test_occasion_filter(admin_client):
    item(admin_client, "衬衫", "上装", "衬衫", occasions=["commute"])
    item(admin_client, "运动T", "上装", "T恤", occasions=["sport"])
    item(admin_client, "西裤", "下装", "西裤")  # 未填场合，任何场合都可以
    item(admin_client, "鞋", "鞋", "皮鞋")
    for seed in range(5):
        assert "衬衫" in names(rec(admin_client, occasion="commute", seed=seed))
        assert "运动T" in names(rec(admin_client, occasion="sport", seed=seed))


def test_only_active_items(admin_client):
    item(admin_client, "送洗的T恤", "上装", "T恤", status="laundry")
    item(admin_client, "T恤", "上装", "T恤")
    item(admin_client, "裤子", "下装", "休闲裤")
    item(admin_client, "鞋", "鞋", "皮鞋")
    for seed in range(5):
        assert "送洗的T恤" not in names(rec(admin_client, seed=seed))


def test_prefers_saved_outfits_then_generates(admin_client):
    t1 = item(admin_client, "白T", "上装", "T恤")
    b1 = item(admin_client, "牛仔裤", "下装", "牛仔裤")
    item(admin_client, "黑T", "上装", "T恤")
    item(admin_client, "鞋", "鞋", "运动鞋")
    oid = admin_client.post("/api/outfits", json={"name": "常穿", "item_ids": [t1["id"], b1["id"]]}).json()["id"]

    first = rec(admin_client)
    assert first["source"] == "outfit" and first["outfit_id"] == oid and first["outfit_name"] == "常穿"

    # 「换一套」：已经展示过的搭配跳过，改为自动组合
    skip = [i["id"] for i in first["items"]]
    second = rec(admin_client, seed=1, skip=skip)
    assert second["source"] == "generated"


def test_outfit_gets_outer_when_cold(admin_client):
    t = item(admin_client, "毛衣", "上装", "毛衣/针织衫", warmth=4)
    b = item(admin_client, "厚裤", "下装", "休闲裤", warmth=4)
    item(admin_client, "大衣", "外套", "大衣", warmth=4)
    admin_client.post("/api/outfits", json={"item_ids": [t["id"], b["id"]]})
    r = rec(admin_client, temperature=8)
    assert r["source"] == "outfit" and "大衣" in names(r)
    assert any("外套" in n for n in r["notes"])


def test_outfit_with_unsuitable_item_is_skipped(admin_client):
    t = item(admin_client, "背心", "上装", "背心/吊带", warmth=1)
    b = item(admin_client, "短裤", "下装", "短裤", warmth=1)
    item(admin_client, "毛衣", "上装", "毛衣/针织衫", warmth=4)
    item(admin_client, "厚裤", "下装", "休闲裤", warmth=4)
    admin_client.post("/api/outfits", json={"item_ids": [t["id"], b["id"]]})
    assert rec(admin_client, temperature=12)["source"] == "generated"


def test_recently_worn_items_are_less_likely(admin_client):
    worn = item(admin_client, "昨天穿的", "上装", "T恤")
    item(admin_client, "没穿过", "上装", "T恤")
    item(admin_client, "裤子", "下装", "休闲裤")
    item(admin_client, "鞋", "鞋", "皮鞋")
    admin_client.post("/api/wear-logs", json={"worn_on": "2026-11-05", "item_ids": [worn["id"]]})

    picks = Counter()
    for seed in range(60):
        picks.update(names(rec(admin_client, seed=seed)) & {"昨天穿的", "没穿过"})
    assert picks["没穿过"] > picks["昨天穿的"] * 3

    # avoid_days=0 时不再降权，两者接近
    even = Counter()
    for seed in range(60):
        even.update(names(rec(admin_client, seed=seed, avoid_days=0)) & {"昨天穿的", "没穿过"})
    assert even["昨天穿的"] > 15


def test_same_seed_same_result(admin_client):
    for n in ("A", "B", "C"):
        item(admin_client, n, "上装", "T恤")
    item(admin_client, "裤", "下装", "休闲裤")
    item(admin_client, "鞋", "鞋", "皮鞋")
    assert rec(admin_client, seed=3)["items"] == rec(admin_client, seed=3)["items"]


def test_validation(admin_client):
    assert admin_client.get("/api/recommendation", params={"date": DAY}).status_code == 422
    assert admin_client.get("/api/recommendation", params={"temperature": 99, "date": DAY}).status_code == 422
    assert admin_client.get("/api/recommendation", params={"temperature": 20, "date": DAY, "occasion": "party"}).status_code == 422
