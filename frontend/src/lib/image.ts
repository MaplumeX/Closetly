const MAX_EDGE = 2400

/**
 * 上传前在浏览器里把照片缩小，手机原图常有 5–10MB，缩小后上传更快，
 * 也不容易触发反向代理的请求体大小限制。服务端还会再处理一次。
 * 浏览器无法解码的格式（例如部分 HEIC）直接上传原文件，由服务端判断。
 */
export async function prepareImage(file: File): Promise<Blob> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file) // 默认会按 EXIF 方向转正
  } catch {
    return file
  }
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    if (scale === 1 && file.size < 3 * 1024 * 1024) return file
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg' // PNG 保留透明背景
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.9))
    return blob ?? file
  } finally {
    bitmap.close()
  }
}
