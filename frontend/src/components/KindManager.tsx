import { useState } from 'react'
import { errorText, type KindCount } from '@/api'
import { confirmDialog, promptDialog } from '@/components/dialogs'
import { labelOf, SLOTS } from '@/constants'
import { useKinds, useRenameKind } from '@/hooks/items'
import s from './ManagerCard.module.css'

/** 设置页里的「衣物类型」：重命名、合并、删除自己定义的类型 */
export function KindManager() {
  const { data: kinds, isError, error } = useKinds()
  const rename = useRenameKind()
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)

  function run(k: KindCount, newName: string | null, ok: string) {
    setNotice(null)
    rename.mutate(
      { slot: k.slot, name: k.name, new_name: newName },
      {
        onSuccess: () => setNotice({ ok: true, text: ok }),
        onError: (e) => setNotice({ ok: false, text: errorText(e) }),
      },
    )
  }

  async function onRename(k: KindCount) {
    const raw = await promptDialog({
      title: `重命名「${k.name}」`,
      message: `改成${labelOf(SLOTS, k.slot)}下已有的类型名，会把两者合并。`,
      label: '新名称',
      defaultValue: k.name,
      confirmText: '保存',
      validate: (v) => (!v.trim() ? '名称不能为空' : v.trim().length > 32 ? '最多 32 个字' : null),
    })
    const name = raw?.trim()
    if (!name || name === k.name) return
    const merged = kinds?.some((x) => x.slot === k.slot && x.name === name)
    run(k, name, merged ? `已把「${k.name}」合并到「${name}」` : `已改名为「${name}」`)
  }

  async function onDelete(k: KindCount) {
    const ok = await confirmDialog({
      title: `删除类型「${k.name}」？`,
      message: `${k.count} 件衣物会变成只有部位「${labelOf(SLOTS, k.slot)}」，衣物本身不会被删除。`,
      confirmText: '删除',
      danger: true,
    })
    if (ok) run(k, null, `已删除类型「${k.name}」`)
  }

  const groups = SLOTS.map((slot) => ({ ...slot, kinds: kinds?.filter((k) => k.slot === slot.value) ?? [] })).filter(
    (g) => g.kinds.length > 0,
  )

  return (
    <section className={`card ${s.card}`}>
      <h2>衣物类型</h2>
      <p className={`muted ${s.hint}`}>录入衣物时填写的类型会出现在这里。部位是固定的，类型由你自己决定。</p>
      {isError && <p className="msg-error">{errorText(error)}</p>}
      {kinds && groups.length === 0 && <p className="muted">还没有填写过类型。</p>}
      {groups.map((g) => (
        <div key={g.value} className={s.group}>
          <h3>{g.label}</h3>
          <ul className={s.list}>
            {g.kinds.map((k) => (
              <li key={k.name} className={s.row}>
                <span className={s.name}>{k.name}</span>
                <span className={s.count}>{k.count} 件</span>
                <span className={s.actions}>
                  <button className="btn btn-sm" disabled={rename.isPending} onClick={() => onRename(k)}>重命名</button>
                  <button className="btn btn-sm btn-danger" disabled={rename.isPending} onClick={() => onDelete(k)}>删除</button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {notice && (
        <p className={notice.ok ? 'msg-ok' : 'msg-error'} role={notice.ok ? undefined : 'alert'}>{notice.text}</p>
      )}
    </section>
  )
}
