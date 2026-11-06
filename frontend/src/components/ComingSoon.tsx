import s from './ComingSoon.module.css'

export function ComingSoon({ title, subtitle, milestone }: { title: string; subtitle: string; milestone: string }) {
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
      </div>
      <div className={`card ${s.empty}`}>
        <p>这部分功能会在「{milestone}」里实现。</p>
      </div>
    </div>
  )
}
