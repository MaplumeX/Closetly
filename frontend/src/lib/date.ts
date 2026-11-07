/** 日期统一用本地时区的 YYYY-MM-DD 字符串，避免 UTC 换算导致差一天 */

const pad = (n: number) => String(n).padStart(2, '0')

export const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const todayISO = () => toISO(new Date())

export function parseISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(s: string, n: number): string {
  const d = parseISO(s)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

/** 今天 / 昨天 / 11月6日 周五 / 2025年11月6日 */
export function formatDay(s: string, withWeekday = false): string {
  const today = todayISO()
  if (s === today) return '今天'
  if (s === addDays(today, -1)) return '昨天'
  const d = parseISO(s)
  const md = `${d.getMonth() + 1}月${d.getDate()}日`
  const base = d.getFullYear() === new Date().getFullYear() ? md : `${d.getFullYear()}年${md}`
  return withWeekday ? `${base} 周${WEEKDAYS[d.getDay()]}` : base
}

/** 11月6日 周五（不使用「今天」等相对说法） */
export function formatFull(s: string): string {
  const d = parseISO(s)
  return `${d.getMonth() + 1}月${d.getDate()}日 周${WEEKDAYS[d.getDay()]}`
}

/** 从某天到今天过了几天 */
export const daysSince = (s: string) => Math.round((parseISO(todayISO()).getTime() - parseISO(s).getTime()) / 86_400_000)

/** 'YYYY-MM' */
export const monthOf = (s: string) => s.slice(0, 7)

export function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

/** 日历网格：从周一开始，覆盖整个月的若干周 */
export function monthGrid(month: string): string[][] {
  const [y, m] = month.split('-').map(Number)
  const first = new Date(y, m - 1, 1)
  const start = new Date(first)
  start.setDate(1 - ((first.getDay() + 6) % 7)) // 回到周一
  const last = new Date(y, m, 0)
  const weeks: string[][] = []
  const cur = new Date(start)
  do {
    const week: string[] = []
    for (let i = 0; i < 7; i++) {
      week.push(toISO(cur))
      cur.setDate(cur.getDate() + 1)
    }
    weeks.push(week)
  } while (cur <= last)
  return weeks
}

export function monthRange(month: string): { start: string; end: string } {
  const [y, m] = month.split('-').map(Number)
  return { start: `${month}-01`, end: toISO(new Date(y, m, 0)) }
}

/** 2026年11月6日 周五（始终带年份） */
export function formatLong(s: string): string {
  const d = parseISO(s)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 周${WEEKDAYS[d.getDay()]}`
}

/** 按月平移日期；目标月没有这一天时取月末（1月31日 + 1个月 = 2月28/29日） */
export function addMonths(s: string, n: number): string {
  const [y, m, d] = s.split('-').map(Number)
  const lastDay = new Date(y, m - 1 + n + 1, 0).getDate()
  return toISO(new Date(y, m - 1 + n, Math.min(d, lastDay)))
}
