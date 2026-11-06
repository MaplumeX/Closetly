// 开发用原型页：没有照片的衣物占位剪影，路由只在 dev 模式下注册（见 router.tsx）
import { useState } from 'react'
import { Silhouette, type SilhouetteFill } from '@/components/Silhouette'
import { COLORS, SLOTS, type Slot } from '@/constants'
import { resolveShape, SHAPE_RULES, type Shape } from '@/lib/silhouette'
import s from './PlaceholderLabView.module.css'

const hexOf = (value: string): SilhouetteFill => {
  if (value === 'multi') return 'multi'
  return COLORS.find((c) => c.value === value)?.hex ?? null
}

const SHAPE_LABELS: Record<Shape, string> = {
  tshirt: 'T恤', tank: '背心', hoodie: '卫衣', sweater: '毛衣', shirt: '衬衫',
  pants: '长裤', shorts: '短裤', skirt: '半身裙',
  dress: '连衣裙', jumpsuit: '背带裤',
  jacket: '夹克', coat: '大衣', puffer: '羽绒服',
  sneaker: '运动鞋', boot: '靴子', heel: '高跟鞋', sandal: '凉鞋',
  bag: '包', hat: '帽子', scarf: '围巾', glasses: '眼镜', belt: '腰带',
}

/** 每个部位下的剪影：默认的排第一个 */
const BY_SLOT = SLOTS.map(({ value, label }) => {
  const { fallback, rules } = SHAPE_RULES[value]
  const shapes = [fallback, ...rules.map(([, sh]) => sh).filter((sh) => sh !== fallback)]
  return {
    slot: value,
    label,
    shapes: shapes.map((sh) => ({
      shape: sh,
      keywords: rules.filter(([, x]) => x === sh).map(([re]) => re.source.replace(/\|/g, ' / ')),
    })),
  }
})

/** 模拟一个衣橱：几件常见搭配的单品 */
const WARDROBE: { slot: Slot; kind: string; name?: string; color: string | null }[] = [
  { slot: 'top', kind: '衬衫', name: '牛津纺白衬衫', color: 'white' },
  { slot: 'bottom', kind: '牛仔裤', color: 'blue' },
  { slot: 'outer', kind: '风衣', name: '卡其风衣', color: 'beige' },
  { slot: 'shoes', kind: '运动鞋', color: 'white' },
  { slot: 'top', kind: '卫衣', name: '灰色连帽卫衣', color: 'gray' },
  { slot: 'bottom', kind: '百褶裙', color: 'navy' },
  { slot: 'onepiece', kind: '连衣裙', name: '碎花裙', color: 'multi' },
  { slot: 'shoes', kind: '切尔西靴', color: 'brown' },
  { slot: 'outer', kind: '羽绒服', color: 'black' },
  { slot: 'accessory', kind: '托特包', color: 'red' },
  { slot: 'top', kind: '针织开衫', color: 'pink' },
  { slot: 'accessory', kind: '渔夫帽', color: null },
]

const MATRIX_SHAPES: Shape[] = ['tshirt', 'pants', 'coat', 'sneaker', 'bag']
const MATRIX_COLORS: { label: string; fill: SilhouetteFill }[] = [
  ...COLORS.map((c) => ({ label: c.label, fill: hexOf(c.value) })),
  { label: '自定义 #2bb3a3', fill: '#2bb3a3' },
  { label: '未填主色', fill: null },
]

export default function PlaceholderLabView() {
  const [slot, setSlot] = useState<Slot>('top')
  const [kind, setKind] = useState('连帽卫衣')
  const [color, setColor] = useState('navy')
  const tested = resolveShape(slot, kind)

  return (
    <div className={s.page}>
      <div className="page-head">
        <div>
          <h1>占位剪影原型</h1>
          <p>没有照片的衣物，用「部位 + 类型」决定剪影形状，用主色填充。</p>
        </div>
      </div>

      <section className={s.section}>
        <h2>试一试</h2>
        <div className={`card ${s.tester}`}>
          <div className={s.testerForm}>
            <label className="field">
              <span>部位</span>
              <select value={slot} onChange={(e) => setSlot(e.target.value as Slot)}>
                {SLOTS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>类型</span>
              <input value={kind} onChange={(e) => setKind(e.target.value)} placeholder="例如 牛仔短裤" />
            </label>
            <label className="field">
              <span>主色</span>
              <select value={color} onChange={(e) => setColor(e.target.value)}>
                {COLORS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
                <option value="">未填</option>
              </select>
            </label>
            <p className={s.result}>
              匹配到 <b>{SHAPE_LABELS[tested]}</b>（{tested}）
            </p>
          </div>
          <div className={s.testerThumb}>
            <Silhouette shape={tested} fill={hexOf(color)} hint />
          </div>
        </div>
      </section>

      <section className={s.section}>
        <h2>衣橱网格里的样子</h2>
        <p className={s.note}>和衣橱页同样的 3:4 卡片，右下角相机表示「还没有照片」。</p>
        <ul className={s.grid}>
          {WARDROBE.map((it, i) => (
            <li key={i} className={s.card}>
              <div className={s.thumb}>
                <Silhouette shape={resolveShape(it.slot, it.kind, it.name)} fill={it.color && hexOf(it.color)} hint />
              </div>
              <span className={s.title}>{it.name ?? it.kind}</span>
              <span className={s.sub}>{it.name ? it.kind : SLOTS.find((o) => o.value === it.slot)?.label}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className={s.section}>
        <h2>全部剪影</h2>
        <p className={s.note}>每个部位第一个是默认剪影（类型没匹配上关键词时用），下面是触发关键词。</p>
        {BY_SLOT.map((g) => (
          <div key={g.slot} className={s.group}>
            <h3>{g.label}</h3>
            <ul className={s.grid}>
              {g.shapes.map(({ shape, keywords }, i) => (
                <li key={shape} className={s.card}>
                  <div className={s.thumb}>
                    <Silhouette shape={shape} fill="#4a86c8" />
                  </div>
                  <span className={s.title}>
                    {SHAPE_LABELS[shape]}
                    {i === 0 && <em className={s.tag}>默认</em>}
                  </span>
                  <span className={s.kw}>{keywords.join(' / ') || '—'}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className={s.section}>
        <h2>颜色 × 浅色 / 深色模式</h2>
        <p className={s.note}>重点看白、米在浅色模式，黑、藏青在深色模式下轮廓是否清楚。</p>
        <div className={s.themes}>
          {(['light', 'dark'] as const).map((theme) => (
            <div key={theme} data-theme={theme} className={s.themePanel}>
              <h3>{theme === 'light' ? '浅色' : '深色'}</h3>
              <table className={s.matrix}>
                <tbody>
                  {MATRIX_COLORS.map((c) => (
                    <tr key={c.label}>
                      <th>{c.label}</th>
                      {MATRIX_SHAPES.map((sh) => (
                        <td key={sh}>
                          <div className={s.mini}>
                            <Silhouette shape={sh} fill={c.fill} />
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </section>

      <section className={s.section}>
        <h2>小尺寸</h2>
        <p className={s.note}>搭配拼图和日历里的缩略图。小图可以关掉细节线，左右对比看哪个更清楚。</p>
        <div className={s.smallRow}>
          {[true, false].map((detail) => (
            <figure key={String(detail)} className={s.smallFig}>
              <div className={s.collage}>
                {WARDROBE.slice(0, 4).map((it, i) => (
                  <Silhouette key={i} shape={resolveShape(it.slot, it.kind)} fill={it.color && hexOf(it.color)} detail={detail} />
                ))}
              </div>
              <div className={s.calThumbs}>
                {WARDROBE.slice(4, 7).map((it, i) => (
                  <div key={i} className={s.calThumb}>
                    <Silhouette shape={resolveShape(it.slot, it.kind)} fill={it.color && hexOf(it.color)} detail={detail} />
                  </div>
                ))}
              </div>
              <figcaption>{detail ? '带细节线' : '不带细节线'}</figcaption>
            </figure>
          ))}
        </div>
      </section>
    </div>
  )
}
