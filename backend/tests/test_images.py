from io import BytesIO

from PIL import Image

from .conftest import make_image, upload


def test_upload_resizes_and_strips_exif(admin_client, settings):
    key = upload(admin_client, make_image(size=(2400, 1800), exif=True))
    full = Image.open(BytesIO(admin_client.get(f"/api/images/{key}").content))
    thumb = Image.open(BytesIO(admin_client.get(f"/api/images/{key}?size=thumb").content))
    assert full.format == "WEBP" and thumb.format == "WEBP"
    # EXIF 方向为 6，应先旋转成竖图，再把长边缩到 1600
    assert full.size == (1200, 1600)
    assert max(thumb.size) == 400
    assert not full.getexif() and "exif" not in full.info


def test_image_cache_headers(admin_client):
    key = upload(admin_client)
    r = admin_client.get(f"/api/images/{key}")
    assert r.headers["content-type"] == "image/webp"
    assert "private" in r.headers["cache-control"] and "immutable" in r.headers["cache-control"]


def test_png_with_alpha(admin_client):
    im = Image.new("RGBA", (300, 300), (0, 0, 0, 0))
    buf = BytesIO()
    im.save(buf, "PNG")
    key = upload(admin_client, buf.getvalue())
    out = Image.open(BytesIO(admin_client.get(f"/api/images/{key}").content))
    assert out.mode == "RGBA"


def test_rejects_non_image(admin_client):
    r = admin_client.post("/api/images", files={"file": ("x.jpg", b"not an image", "image/jpeg")})
    assert r.status_code == 400


def test_rejects_too_large(admin_client, monkeypatch):
    from closetly.routers import images

    monkeypatch.setattr(images, "MAX_UPLOAD_BYTES", 1000)
    r = admin_client.post("/api/images", files={"file": ("x.jpg", make_image(), "image/jpeg")})
    assert r.status_code == 413


def test_requires_login_and_valid_key(client, admin_client):
    key = upload(admin_client)
    assert admin_client.get("/api/images/../../etc/passwd").status_code == 404
    assert admin_client.get("/api/images/notakey").status_code == 404
    admin_client.post("/api/auth/logout")
    assert admin_client.get(f"/api/images/{key}").status_code == 401


def test_orphan_cleanup(settings, admin_client):
    import os
    import time

    from closetly.images import ImageStore

    key = upload(admin_client)
    store = ImageStore(settings.images_dir)
    assert store.cleanup_orphans({}) == 0  # 刚上传的不清理
    old = time.time() - 2 * 86400
    for p in store.path(1, key), store.path(1, key, thumb=True):
        os.utime(p, (old, old))
    assert store.cleanup_orphans({1: {key}}) == 0  # 被引用的不清理
    assert store.cleanup_orphans({}) == 2
