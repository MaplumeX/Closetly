import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { errorText, itemTitle, type ItemInput } from '@/api'
import { ItemForm } from '@/components/ItemForm'
import { emptyDraft, itemToDraft, type Draft } from '@/lib/itemDraft'
import { useCreateItem, useItem, useUpdateItem } from '@/hooks/items'

/** 「保存并继续添加」时保留这些字段，连续录入同一类衣物更快。
 *  标签通常是单件衣物独有的，不保留，避免不知不觉打上错误标签。 */
function carryOver(d: Draft): Draft {
  return {
    ...emptyDraft,
    category_id: d.category_id,
    seasons: d.seasons,
    occasions: d.occasions,
    location: d.location,
  }
}

/**
 * /wardrobe/new            新建
 * /wardrobe/new?from=:id   复制为新衣物（不带照片）
 * /wardrobe/:id/edit       编辑
 */
export default function ItemEditView() {
  const params = useParams()
  const [search] = useSearchParams()
  const navigate = useNavigate()

  const editId = params.id ? Number(params.id) : null
  const fromId = search.get('from') ? Number(search.get('from')) : null
  const source = useItem(editId ?? fromId)

  const create = useCreateItem()
  const update = useUpdateItem(editId ?? 0)
  const mutation = editId ? update : create

  // 「保存并继续添加」后用新的 key 重新挂载表单
  const [next, setNext] = useState<{ draft: Draft; key: number; saved: string } | null>(null)

  if ((editId ?? fromId) !== null && source.isPending) return null
  if (source.isError) return <p className="msg-error">{errorText(source.error)}</p>

  const initial = next?.draft ?? (source.data ? itemToDraft(source.data, editId !== null) : emptyDraft)
  const backTo = editId ? `/wardrobe/${editId}` : '/wardrobe'

  function onSubmit(input: ItemInput, draft: Draft, submitter: string) {
    if (editId) {
      update.mutate(input, { onSuccess: () => navigate(`/wardrobe/${editId}`, { replace: true }) })
      return
    }
    create.mutate(input, {
      onSuccess: (item) => {
        if (submitter === 'another') {
          setNext({ draft: carryOver(draft), key: (next?.key ?? 0) + 1, saved: itemTitle(item) })
          window.scrollTo({ top: 0 })
        } else {
          navigate(`/wardrobe/${item.id}`, { replace: true })
        }
      },
    })
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{editId ? '编辑衣物' : '添加衣物'}</h1>
          {fromId && !next && <p>已复制「{source.data && itemTitle(source.data)}」的信息，请重新拍一张照片</p>}
          {next && <p className="msg-ok">已保存「{next.saved}」，继续录入下一件</p>}
        </div>
        <Link to={backTo} className="btn hide-mobile">取消</Link>
      </div>

      <ItemForm
        key={next?.key ?? 0}
        initial={initial}
        onSubmit={onSubmit}
        submitting={mutation.isPending}
        error={mutation.isError ? errorText(mutation.error) : undefined}
        actions={
          <>
            <button className="btn btn-primary" value="save" disabled={mutation.isPending}>
              {mutation.isPending ? '保存中…' : '保存'}
            </button>
            {!editId && (
              <button className="btn" value="another" disabled={mutation.isPending}>
                保存并继续添加
              </button>
            )}
          </>
        }
      />
    </div>
  )
}
