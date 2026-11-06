import { useState } from 'react'
import { errorText, type CustomColor } from '@/api'
import { colorDialog, confirmDialog } from '@/components/dialogs'
import { colorNameProblem, useAddColor, useCustomColors, useDeleteColor, useUpdateColor } from '@/hooks/colors'
import { ColorDot } from './Chips'
import s from './ManagerCard.module.css'

/** 设置页里的「自定义颜色」：添加、修改、删除自己的颜色 */
export function ColorManager() {
  const { data: customs, isError, error } = useCustomColors()
  const addColor = useAddColor()
  const update = useUpdateColor()
  const del = useDeleteColor()
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)
  const busy = update.isPending || del.isPending

  async function run(action: () => Promise<unknown>, ok: string) {
    setNotice(null)
    try {
      await action()
      setNotice({ ok: true, text: ok })
    } catch (e) {
      setNotice({ ok: false, text: errorText(e) })
    }
  }

  async function onAdd() {
    setNotice(null)
    try {
      const c = await addColor()
      if (c) setNotice({ ok: true, text: `已添加「${c.name}」` })
    } catch (e) {
      setNotice({ ok: false, text: errorText(e) })
    }
  }

  async function onEdit(c: CustomColor) {
    const r = await colorDialog({
      title: `修改「${c.name}」`,
      message: c.count ? `${c.count} 件衣物会一起更新。` : undefined,
      defaultName: c.name,
      defaultHex: c.hex,
      confirmText: '保存',
      validate: (n) => colorNameProblem(n, customs, c.id),
    })
    if (!r || (r.name === c.name && r.hex === c.hex)) return
    await run(() => update.mutateAsync({ id: c.id, ...r }), `已保存「${r.name}」`)
  }

  async function onDelete(c: CustomColor) {
    const ok = await confirmDialog({
      title: `删除颜色「${c.name}」？`,
      message: c.count ? `${c.count} 件衣物会变成未填主色，衣物本身不会被删除。` : undefined,
      confirmText: '删除',
      danger: true,
    })
    if (ok) await run(() => del.mutateAsync(c.id), `已删除「${c.name}」`)
  }

  return (
    <section className={`card ${s.card}`}>
      <div className={s.head}>
        <h2>自定义颜色</h2>
        <button className="btn btn-sm" onClick={onAdd}>＋ 添加</button>
      </div>
      <p className={`muted ${s.hint}`}>补充预设色板里没有的颜色，会排在预设色后面。</p>
      {isError && <p className="msg-error">{errorText(error)}</p>}
      {customs && customs.length === 0 && <p className="muted">还没有添加过颜色。</p>}
      {customs && customs.length > 0 && (
        <ul className={s.list}>
          {customs.map((c) => (
            <li key={c.id} className={s.row}>
              <ColorDot swatch={c.hex} size={18} />
              <span className={s.name}>{c.name}</span>
              <span className={s.count}>{c.count} 件</span>
              <span className={s.actions}>
                <button className="btn btn-sm" disabled={busy} onClick={() => onEdit(c)}>修改</button>
                <button className="btn btn-sm btn-danger" disabled={busy} onClick={() => onDelete(c)}>删除</button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {notice && (
        <p className={notice.ok ? 'msg-ok' : 'msg-error'} role={notice.ok ? undefined : 'alert'}>{notice.text}</p>
      )}
    </section>
  )
}
