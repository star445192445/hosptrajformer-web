import { chapterColor, diagnosisLabel } from './diagnosisNames'
import type { PathSummary } from './types'

interface PathTableProps {
  paths: PathSummary[]
  selectedKey: string | null
  samples: number
  onSelect: (key: string) => void
}

export default function PathTable({ paths, selectedKey, samples, onSelect }: PathTableProps) {
  if (!paths.length) return null
  const visible = paths.slice(0, 8)
  return (
    <section className="path-panel">
      <div className="panel-heading compact">
        <div>
          <span className="eyebrow">CANDIDATE PATHS</span>
          <h3>主要诊断候选路径</h3>
        </div>
        <span className="panel-meta">{samples} 条候选轨迹 · 按频次排序</span>
      </div>
      <div className="path-table" role="table">
        <div className="path-row path-head" role="row">
          <span>#</span>
          <span>三步主要诊断序列</span>
          <span>间隔桶</span>
          <span>频次</span>
          <span>占比</span>
        </div>
        {visible.map((path, index) => (
          <button
            type="button"
            role="row"
            key={path.key}
            className={`path-row ${path.key === selectedKey ? 'selected' : ''}`}
            onClick={() => onSelect(path.key)}
          >
            <span className="path-rank">{String(index + 1).padStart(2, '0')}</span>
            <span className="path-sequence">
              {path.steps.map((step, stepIndex) => (
                <span key={`${path.key}-${stepIndex}`} className="path-step">
                  <i style={{ background: chapterColor(step.primary.chapter) }} />
                  {diagnosisLabel(step.primary.code)}
                  {stepIndex < path.steps.length - 1 && <em>→</em>}
                </span>
              ))}
            </span>
            <span className="path-intervals">
              {path.steps.map((step) => step.interval.label.replace('天', '')).join(' / ')}
            </span>
            <span className="path-count">{path.count}</span>
            <span className="path-share">
              <i style={{ width: `${Math.max(2, path.share * 100)}%` }} />
              {(path.share * 100).toFixed(1)}%
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}
