import { Link, useSearchParams } from 'react-router'
import { errorText, imageUrl, itemTitle, outfitTitle, type ItemBrief, type WearLog } from '@/api'
import { useDeleteWearLog, useWearLogs } from '@/hooks/outfits'
import { formatDay, monthGrid, monthOf, shiftMonth, todayISO } from '@/lib/date'
import s from './CalendarView.module.css'

const WEEK_HEAD = ['一', '二', '三', '四', '五', '六', '日']

export default function CalendarView() {
  const [params, setParams] = useSearchParams()
  const today = todayISO()
  const month = params.get('month') ?? monthOf(today)
  const selected = params.get('day') ?? (month === monthOf(today) ? today : `${month}-01`)

  const grid = monthGrid(month)
  const logs = useWearLogs({ start: grid[0][0], end: grid.at(-1)![6] })
  const del = useDeleteWearLog()

  const byDay = new Map<string, WearLog[]>()
  for (const log of logs.data ?? []) byDay.set(log.worn_on, [...(byDay.get(log.worn_on) ?? []), log])
  const daysThisMonth = [...byDay.keys()].filter((d) => monthOf(d) === month).length

  const go = (m: string, day?: string) => setParams(day ? { month: m, day } : { month: m }, { replace: true })
  const [y, m] = month.split('-').map(Number)
  const dayLogs = [...(byDay.get(selected) ?? [])].reverse() // 同一天按记录先后

  function onDelete(log: WearLog) {
    if (window.confirm(`删除 ${formatDay(log.worn_on)} 的这条记录？`)) del.mutate(log.id)
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>穿着记录</h1>
          <p>本月记录了 {daysThisMonth} 天</p>
        </div>
        <Link to={`/calendar/new?date=${selected}`} className="btn btn-primary">＋ 记录</Link>
      </div>

      <div className={s.layout}>
        <section className={s.calendar} aria-label={`${y}年${m}月`}>
          <div className={s.nav}>
            <button className="btn btn-sm" onClick={() => go(shiftMonth(month, -1))} aria-label="上个月">‹</button>
            <h2>{y}年{m}月</h2>
            <button className="btn btn-sm" onClick={() => go(shiftMonth(month, 1))} aria-label="下个月">›</button>
            {month !== monthOf(today) && (
              <button className="btn btn-sm" onClick={() => go(monthOf(today), today)}>回到今天</button>
            )}
          </div>
          <div className={s.grid} role="grid">
            {WEEK_HEAD.map((w) => <div key={w} className={s.head} role="columnheader">{w}</div>)}
            {grid.flat().map((d) => {
              const thumbs = uniqueItems(byDay.get(d) ?? []).slice(0, 3)
              return (
                <button
                  key={d}
                  role="gridcell"
                  className={s.day}
                  data-outside={monthOf(d) !== month || undefined}
                  data-today={d === today || undefined}
                  aria-selected={d === selected}
                  aria-label={`${formatDay(d, true)}${thumbs.length ? `，穿了 ${uniqueItems(byDay.get(d)!).length} 件` : ''}`}
                  onClick={() => go(monthOf(d), d)}
                >
                  <span className={s.num}>{Number(d.slice(8))}</span>
                  <span className={s.thumbs}>
                    {thumbs.map((it) => <img key={it.id} src={imageUrl(it.image_key, 'thumb')} alt="" loading="lazy" />)}
                  </span>
                </button>
              )
            })}
          </div>
          {logs.isError && <p className="msg-error">{errorText(logs.error)}</p>}
        </section>

        <section className={s.panel} aria-live="polite">
          <h2>{formatDay(selected, true)}</h2>
          {dayLogs.length === 0 && <p className="muted">这天没有记录。</p>}
          {dayLogs.map((log) => (
            <article key={log.id} className={`card ${s.log}`}>
              <div className={s.logHead}>
                {log.outfit_id ? (
                  <Link to={`/outfits/${log.outfit_id}`}>{outfitTitle({ name: log.outfit_name })}</Link>
                ) : (
                  <span className="muted">{log.items.length} 件单品</span>
                )}
                <span className={s.logActions}>
                  <Link to={`/calendar/${log.id}/edit`} className="btn btn-sm">编辑</Link>
                  <button className="btn btn-sm btn-danger" onClick={() => onDelete(log)} disabled={del.isPending}>删除</button>
                </span>
              </div>
              <ul className={s.logItems}>
                {log.items.map((it) => (
                  <li key={it.id}>
                    <Link to={`/wardrobe/${it.id}`} title={itemTitle(it)}>
                      <img src={imageUrl(it.image_key, 'thumb')} alt={itemTitle(it)} />
                    </Link>
                  </li>
                ))}
              </ul>
              {log.notes && <p className={s.logNotes}>{log.notes}</p>}
            </article>
          ))}
          <Link to={`/calendar/new?date=${selected}`} className="btn">＋ 记录这一天</Link>
        </section>
      </div>
    </div>
  )
}

function uniqueItems(logs: WearLog[]): ItemBrief[] {
  const seen = new Map<number, ItemBrief>()
  for (const log of logs) for (const it of log.items) seen.set(it.id, it)
  return [...seen.values()]
}
