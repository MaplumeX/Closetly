from typing import Literal

from fastapi import APIRouter, HTTPException, Request, UploadFile, status
from fastapi.responses import FileResponse

from ..deps import CurrentUserDep
from ..images import MAX_UPLOAD_BYTES, ImageStore, InvalidImage, is_valid_key
from ..schemas import ImageOut

router = APIRouter(prefix="/api/images", tags=["images"])


def _store(request: Request) -> ImageStore:
    return request.app.state.image_store


@router.post("", response_model=ImageOut, status_code=status.HTTP_201_CREATED)
def upload_image(file: UploadFile, request: Request, user: CurrentUserDep):
    """上传一张照片，返回 key。照片在保存衣物时才与衣物关联。"""
    data = file.file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, "图片不能超过 15MB")
    try:
        key = _store(request).save(user.id, data)
    except InvalidImage as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e
    return ImageOut(key=key)


@router.get("/{key}")
def get_image(key: str, request: Request, user: CurrentUserDep, size: Literal["full", "thumb"] = "full"):
    store = _store(request)
    if not is_valid_key(key):
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    path = store.path(user.id, key, thumb=size == "thumb")
    if not path.is_file():
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    # 同一个 key 的内容永远不变；private 禁止 CDN/代理缓存
    return FileResponse(
        path, media_type="image/webp", headers={"Cache-Control": "private, max-age=31536000, immutable"}
    )
