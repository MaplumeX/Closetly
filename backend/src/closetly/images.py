"""衣物照片的处理与存储。

文件按用户分目录存放：images/<user_id>/<key>.webp 和 <key>_thumb.webp。
key 是随机生成的 32 位十六进制串，图片内容不变，所以浏览器可以永久缓存。
"""

import os
import re
import time
import uuid
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError

FULL_SIZE = 1600
THUMB_SIZE = 400
MAX_UPLOAD_BYTES = 15 * 1024 * 1024
KEY_PATTERN = r"^[0-9a-f]{32}$"
_KEY_RE = re.compile(KEY_PATTERN)

# 防止「解压炸弹」：超过约 6000 万像素直接拒绝
Image.MAX_IMAGE_PIXELS = 60_000_000


class InvalidImage(ValueError):
    pass


def _encode_webp(im: Image.Image, size: int, quality: int) -> bytes:
    im = im.copy()
    im.thumbnail((size, size), Image.Resampling.LANCZOS)
    buf = BytesIO()
    # 不传 exif 参数，输出文件中不含任何 EXIF（包括 GPS 位置）
    im.save(buf, "WEBP", quality=quality, method=4)
    return buf.getvalue()


def process_image(data: bytes) -> tuple[bytes, bytes]:
    """返回 (大图, 缩略图) 的 WebP 字节。"""
    try:
        with Image.open(BytesIO(data)) as src:
            src.load()
            im = ImageOps.exif_transpose(src)  # 按 EXIF 方向把照片转正
            has_alpha = im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info)
            im = im.convert("RGBA" if has_alpha else "RGB")
            return _encode_webp(im, FULL_SIZE, 85), _encode_webp(im, THUMB_SIZE, 80)
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError, ValueError) as e:
        raise InvalidImage("无法识别的图片格式，或图片已损坏") from e


def is_valid_key(key: str) -> bool:
    return bool(_KEY_RE.match(key))


class ImageStore:
    def __init__(self, root: Path) -> None:
        self.root = root

    def _dir(self, user_id: int) -> Path:
        return self.root / str(user_id)

    def path(self, user_id: int, key: str, thumb: bool = False) -> Path:
        if not is_valid_key(key):  # 防止路径穿越
            raise ValueError("invalid image key")
        return self._dir(user_id) / (f"{key}_thumb.webp" if thumb else f"{key}.webp")

    def exists(self, user_id: int, key: str) -> bool:
        return is_valid_key(key) and self.path(user_id, key).is_file()

    def save(self, user_id: int, data: bytes) -> str:
        full, thumb = process_image(data)
        key = uuid.uuid4().hex
        self._dir(user_id).mkdir(parents=True, exist_ok=True)
        for content, is_thumb in ((thumb, True), (full, False)):
            target = self.path(user_id, key, is_thumb)
            tmp = target.with_suffix(".tmp")
            tmp.write_bytes(content)
            os.replace(tmp, target)  # 原子替换，避免读到写了一半的文件
        return key

    def delete(self, user_id: int, key: str) -> None:
        if not is_valid_key(key):
            return
        for thumb in (False, True):
            self.path(user_id, key, thumb).unlink(missing_ok=True)

    def cleanup_orphans(self, referenced: dict[int, set[str]], min_age_seconds: int = 86400) -> int:
        """删除没有被任何衣物引用、且上传超过一定时间的图片（上传后放弃保存的情况）。"""
        removed = 0
        cutoff = time.time() - min_age_seconds
        if not self.root.is_dir():
            return 0
        for user_dir in self.root.iterdir():
            if not (user_dir.is_dir() and user_dir.name.isdigit()):
                continue
            keep = referenced.get(int(user_dir.name), set())
            for f in user_dir.iterdir():
                key = f.name.split("_")[0].split(".")[0]
                if key not in keep and f.stat().st_mtime < cutoff:
                    f.unlink(missing_ok=True)
                    removed += 1
        return removed
