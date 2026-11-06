/** 自定义对话框的状态与调用入口；界面在 Dialog.tsx 的 DialogHost 里 */

interface ConfirmOptions {
  title: string
  message?: string
  confirmText?: string
  /** 危险操作：确认按钮用警示色 */
  danger?: boolean
}
interface PromptOptions {
  title: string
  message?: string
  label: string
  /** 输入框的初始内容 */
  defaultValue?: string
  type?: 'text' | 'password'
  autoComplete?: string
  confirmText?: string
  /** 返回错误文案表示不通过 */
  validate?: (v: string) => string | null
}

export type Request = { id: number } & (
  | ({ kind: 'confirm'; resolve: (v: boolean) => void } & ConfirmOptions)
  | ({ kind: 'prompt'; resolve: (v: string | null) => void } & PromptOptions)
)
type NewRequest = Request extends infer R ? (R extends Request ? Omit<R, 'id'> : never) : never

// 同一时间只显示一个对话框，后来的排队
let queue: Request[] = []
let nextId = 1
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
export const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}
function enqueue(r: NewRequest) {
  queue = [...queue, { ...r, id: nextId++ } as Request]
  emit()
}
export function settle() {
  queue = queue.slice(1)
  emit()
}

/** 替代 window.confirm，确认返回 true */
export const confirmDialog = (o: ConfirmOptions) =>
  new Promise<boolean>((resolve) => enqueue({ kind: 'confirm', resolve, ...o }))

/** 替代 window.prompt，取消返回 null */
export const promptDialog = (o: PromptOptions) =>
  new Promise<string | null>((resolve) => enqueue({ kind: 'prompt', resolve, ...o }))

export const currentRequest = () => queue[0]
