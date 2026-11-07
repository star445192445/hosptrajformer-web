import { ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import { chapterColor, diagnosisName } from './diagnosisNames'
import type { PathSummary } from './types'

interface PathTableProps {
  paths: PathSummary[]
  selectedKey: string | null
  samples: number
  onSelect: (key: string) => void
}

export default function PathTable({ paths, selectedKey, samples, onSelect }: PathTableProps) {
  const [expanded, setExpanded] = useState(false)
  if (!paths.length) return null
  const visible = expanded ? paths : paths.slice(0, 5)
  const hidden = paths.length - visible.length

  return (
    <section className="path-panel">
      <div className="panel-heading compact">
        <div>
          <span className="eyebrow">CANDIDATE PATHS</span>
          <h3>按主要诊断序列汇总</h3>
          <p className="panel-subline">频数分母为本次全部有效抽样；时间桶不参与这条排序。</p>
        </div>
        <span className="panel-meta">{samples} 条抽样 · 按频次排序</span>
      </div>

      <div className="path-table" role="table" aria-label="主要诊断候选路径">
        <div className="path-row path-head" role="row">
          <span>#</span>
          <span>第 1 步</span>
          <span>第 2 步</span>
          <span>第 3 步</span>
          <span>抽样频数</span>
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
            {path.steps.map((step, stepIndex) => (
              <span className="path-step-cell" key={`${path.key}-${stepIndex}`}>
                <i style={{ background: chapterColor(step.primary.chapter) }} />
                <span>
                  <code>{step.primary.code}</code>
                  {diagnosisName(step.primary.code) && <small>{diagnosisName(step.primary.code)}</small>}
                </span>
              </span>
            ))}
            <span className="path-frequency">
              <strong>{path.count}/{samples}</strong>
              <em>{((path.count / samples) * 100).toFixed(0)}%</em>
            </span>
          </button>
        ))}
      </div>

      {paths.length > 5 && (
        <button type="button" className="path-expand" onClick={() => setExpanded((value) => !value)}>
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          {expanded ? '收起其余路径' : `展开其余 ${hidden} 条路径`}
        </button>
      )}

      {selectedKey && (
        <p className="path-footnote">
          选中行的时间桶可在下方“一条抽样示例”查看，它不代表该诊断序列的频率。
        </p>
      )}
    </section>
  )
}
