import { useEffect, useEffectEvent, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { errorText } from '@/api'
import { uploadImage } from '@/hooks/items'

/** 有鼠标的设备（电脑）上才提示粘贴和拖放；手机上靠拍照和相册 */
export const canPasteOrDrop =
  typeof matchMedia === 'function' && matchMedia('(hover: hover) and (pointer: fine)').matches

function imageIn(files: FileList | undefined | null): File | undefined {
  return Array.from(files ?? []).find((f) => f.type.startsWith('image/'))
}

function isEditable(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.isContentEditable || target.matches('input, textarea, select'))
}

/**
 * 拿到一张图片就上传：点选文件、粘贴（Ctrl+V / ⌘V）或拖放到 dropProps 所在的元素上都行。
 * 挂载期间监听整页的粘贴；焦点在输入框里且剪贴板带文字时让给文字粘贴。
 */
export function usePhotoUpload(onUploaded: (key: string) => unknown) {
  const input = useRef<HTMLInputElement>(null)
  const busyRef = useRef(false)
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)

  async function upload(file: File) {
    if (busyRef.current) return
    busyRef.current = true
    setError('')
    setBusy(true)
    const local = URL.createObjectURL(file)
    setPreview(local)
    try {
      await onUploaded(await uploadImage(file))
    } catch (e) {
      setError(errorText(e))
    } finally {
      busyRef.current = false
      setBusy(false)
      setPreview(null)
      URL.revokeObjectURL(local)
      if (input.current) input.current.value = ''
    }
  }

  const onPaste = useEffectEvent((e: ClipboardEvent) => {
    const file = imageIn(e.clipboardData?.files)
    if (!file) return
    if (isEditable(e.target) && e.clipboardData?.types.includes('text/plain')) return
    e.preventDefault()
    upload(file)
  })

  useEffect(() => {
    const listener = (e: ClipboardEvent) => onPaste(e)
    window.addEventListener('paste', listener)
    return () => window.removeEventListener('paste', listener)
  }, [])

  const dropProps = {
    onDragOver(e: DragEvent) {
      if (!e.dataTransfer.types.includes('Files')) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
      setDragging(true)
    },
    onDragLeave(e: DragEvent) {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false)
    },
    onDrop(e: DragEvent) {
      if (!e.dataTransfer.types.includes('Files')) return
      e.preventDefault()
      setDragging(false)
      const file = imageIn(e.dataTransfer.files)
      if (file) upload(file)
      else setError('只能使用图片文件')
    },
  }

  const inputProps = {
    ref: input,
    type: 'file',
    accept: 'image/*',
    hidden: true,
    onChange: (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) upload(file)
    },
  } as const

  return { busy, preview, error, dragging, pick: () => input.current?.click(), inputProps, dropProps }
}
