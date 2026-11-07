import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { errorText, itemTitle, outfitTitle, type ItemBrief, type Outfit, type WearLog } from '@/api'
import { Group, Groups, OccasionChips, SeasonBar, StatsCard, WarmthRange, type Stat } from '@/components/DetailParts'
import { ItemThumb } from '@/components/ItemThumb'
import { confirmDialog } from '@/components/dialogs'
import { Menu } from '@/components/Menu'
import { labelOf, SEASONS, SLOTS, STATUSES } from '@/constants'
import { useDeleteOutfit, useOutfit, useSaveWearLog, useWearLogs } from '@/hooks/outfits'
import { daysSince, formatDay, monthOf, todayISO } from '@/lib/date'
import { isMainSlot, missingSlots, sortBySlot } from '@/lib/outfit'
import s from './OutfitDetailView.module.css'

/** 穿着记录默认显示几条，更多的点「显示全部」 */
const HISTORY_SHOWN = 6

export default function OutfitDetailView() {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const { data: outfit, isPending, error } = useOutfit(id)
  const logs = useWearLogs({ outfit_id: id })
  const del = useDeleteOutfit()
  const wear = useSaveWearLog(null)

  if (isPending) return null
  if (error || !outfit) return <p className="msg-error">{errorText(error)}</p>

  const wornToday = outfit.last_worn_on === todayISO()
  const missing = outfit.items.length ? missingSlots(outfit.items) : []
  const seasonCount = outfit.seasons.length

  async function onDelete() {
    const ok = await confirmDialog({
      title: `删除「${outfitTitle(outfit!)}」？`,
      message: '衣物和穿着记录不受影响。',
      confirmText: '删除',
      danger: true,
    })
    if (!ok) return
    del.mutate(id, { onSuccess: () => navigate('/outfits', { replace: true }) })
  }

  const subtitle = [
    `${outfit.items.length} 件`,
    outfit.items.length > 0 && (seasonCount === SEASONS.length ? '四季' : outfit.seasons.map((v) => labelOf(SEASONS, v)).join('')),
  ].filter(Boolean).join(' · ')

  return (
    <div>
      <header className={s.head}>
        <div className={s.titleBlock}>
          <Link to="/outfits" className={`${s.back} hide-mobile`}>← 搭配</Link>
          <h1>{outfitTitle(outfit)}</h1>
          <p className={s.subtitle}>{subtitle}</p>
        </div>

        <div className={s.headActions}>
          <button className="btn btn-primary" disabled={wear.isPending || wornToday || !outfit.items.length}
            onClick={() => wear.mutate({ worn_on: todayISO(), outfit_id: id, item_ids: [], notes: null })}>
            {wornToday ? '今天已穿 ✓' : '今天穿这套'}
          </button>
          <Link to={`/outfits/${id}/edit`} className="btn">编辑</Link>
          <Menu
            aria-label="更多操作"
            align="right"
            triggerClassName={`btn ${s.more}`}
            trigger={<span aria-hidden="true">⋯</span>}
            items={[
              { key: 'log', label: '记录到其他日期', onSelect: () => navigate(`/calendar/new?outfit=${id}`) },
              { key: 'copy', label: '复制为新搭配', onSelect: () => navigate('/outfits/new', { state: { preset: outfit.items } }) },
              { key: 'delete', label: '删除', danger: true, onSelect: onDelete },
            ]}
          />
        </div>
      </header>

      {(wear.isError || del.isError) && <p className={`msg-error ${s.error}`}>{errorText(wear.error ?? del.error)}</p>}

      <div className={s.layout}>
        <div className={s.look}>
          <Board items={outfit.items} />
          {missing.length > 0 && (
            <p className={s.missing}>
              还缺{missing.map((v) => labelOf(SLOTS, v)).join('、')}，补上才是能直接出门的一套。
              <Link to={`/outfits/${id}/edit`}>去补上</Link>
            </p>
          )}
        </div>

        <div className={s.info}>
          <StatsCard label="穿着情况" {...wearStats(outfit, logs.data)}>
            <Link to={`/calendar/new?outfit=${id}`} className="btn btn-sm">记录到其他日期</Link>
          </StatsCard>

          <Groups>
            <Group label="适合">
              {outfit.items.length > 0 && (seasonCount > 0
                ? <SeasonBar seasons={outfit.seasons} />
                : <span className={s.muted}>单品之间没有共同的季节</span>)}
              {outfit.occasions && outfit.occasions.length > 0 && <OccasionChips occasions={outfit.occasions} />}
              {outfit.warmth_min !== null && <WarmthRange min={outfit.warmth_min} max={outfit.warmth_max!} />}
            </Group>
            <Group label="备注">{outfit.notes && <p className={s.notes}>{outfit.notes}</p>}</Group>
          </Groups>
        </div>
      </div>

      <History logs={logs.data} />
    </div>
  )
}

/**
 * 整套搭配的大图，排法与列表里的封面（OutfitCollage）一致：
 * 左边大格放主体（上装、下装、连体），右边一列放外套、鞋、配饰；只有一类时排成两列。
 * 每格可以点进单品；不在衣柜里的单品变灰并标出状态。
 */
function Board({ items }: { items: ItemBrief[] }) {
  const sorted = sortBySlot(items)
  const main = sorted.filter((i) => isMainSlot(i.slot))
  const side = sorted.filter((i) => !isMainSlot(i.slot))

  if (!items.length) return <div className={`${s.board} ${s.boardEmpty}`}>这套搭配里还没有单品</div>

  if (main.length && side.length) {
    return (
      <ul className={`${s.board} ${s.split}`}>
        <li className={s.col}><ul>{main.map((it) => <Tile key={it.id} item={it} large />)}</ul></li>
        <li className={s.col}><ul>{side.map((it) => <Tile key={it.id} item={it} />)}</ul></li>
      </ul>
    )
  }
  return (
    <ul className={`${s.board} ${s.grid}`} data-single={items.length === 1 || undefined}>
      {sorted.map((it) => <Tile key={it.id} item={it} large={items.length <= 2} />)}
    </ul>
  )
}

function Tile({ item, large = false }: { item: ItemBrief; large?: boolean }) {
  const off = item.status !== 'active'
  return (
    <li>
      <Link to={`/wardrobe/${item.id}`} className={s.tile} data-off={off || undefined}>
        <ItemThumb item={item} size={large ? 'full' : 'thumb'} />
        {off && <span className={s.badge}>{labelOf(STATUSES, item.status)}</span>}
        <span className={s.caption}>
          <b>{itemTitle(item)}</b>
          <small>{labelOf(SLOTS, item.slot)}</small>
        </span>
      </Link>
    </li>
  )
}

function wearStats(outfit: Outfit, logs: WearLog[] | undefined): { stats: Stat[]; hint: string | null } {
  // 记录按日期倒序；至少两次才有间隔
  let interval = '—'
  if (logs && logs.length >= 2) {
    const days = (daysSince(logs.at(-1)!.worn_on) - daysSince(logs[0].worn_on)) / (logs.length - 1)
    interval = `${Math.max(1, Math.round(days))} 天`
  }
  const stats: Stat[] = [
    { label: '穿过', value: `${outfit.wear_count} 次` },
    { label: '上次穿', value: outfit.last_worn_on ? formatDay(outfit.last_worn_on) : '—' },
    { label: '平均间隔', value: interval },
  ]

  let hint: string | null = null
  const unavailable = outfit.items.filter((i) => i.status !== 'active')
  if (unavailable.length) {
    hint = `${unavailable.map(itemTitle).join('、')}目前不在衣柜里`
  } else if (outfit.last_worn_on && daysSince(outfit.last_worn_on) >= 60) {
    hint = `已经 ${daysSince(outfit.last_worn_on)} 天没穿了`
  } else if (!outfit.wear_count && daysSince(outfit.created_at.slice(0, 10)) >= 7) {
    hint = `搭好 ${daysSince(outfit.created_at.slice(0, 10))} 天了，还没穿过`
  }
  return { stats, hint }
}

function History({ logs }: { logs: WearLog[] | undefined }) {
  const [all, setAll] = useState(false)
  if (!logs) return null
  const shown = all ? logs : logs.slice(0, HISTORY_SHOWN)

  return (
    <section className={s.history}>
      <h2>穿着记录</h2>
      {logs.length === 0 ? (
        <p className={s.muted}>还没有穿过这套。</p>
      ) : (
        <>
          <ol>
            {shown.map((log) => (
              <li key={log.id}>
                <Link to={`/calendar?month=${monthOf(log.worn_on)}&day=${log.worn_on}`}>
                  <time dateTime={log.worn_on}>{formatDay(log.worn_on, true)}</time>
                  {log.notes && <span>{log.notes}</span>}
                </Link>
              </li>
            ))}
          </ol>
          {logs.length > HISTORY_SHOWN && (
            <button type="button" className={`btn btn-sm ${s.toggle}`} onClick={() => setAll(!all)}>
              {all ? '收起' : `显示全部 ${logs.length} 条`}
            </button>
          )}
        </>
      )}
    </section>
  )
}
