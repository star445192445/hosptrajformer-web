import { useMemo } from 'react'
import { chapterColor } from './diagnosisNames'
import type { PathSummary } from './types'

interface TrajectoryFanProps {
  paths: PathSummary[]
  selectedKey: string | null
  onSelect: (key: string) => void
}

const STEP_X = [92, 402, 712]
const TOP_Y = 78
const ROW_GAP = 29
const MAX_PATHS = 7

export default function TrajectoryFan({ paths, selectedKey, onSelect }: TrajectoryFanProps) {
  const topPaths = useMemo(() => paths.slice(0, MAX_PATHS), [paths])

  const rankMaps = useMemo(() => {
    return [0, 1, 2].map((step) => {
      const weights = new Map<string, number>()
      topPaths.forEach((path) => {
        const code = path.steps[step]?.primary.code
        if (!code) return
        weights.set(code, (weights.get(code) ?? 0) + path.count)
      })
      const ordered = Array.from(weights.entries()).sort((left, right) => right[1] - left[1])
      return new Map(ordered.map(([code], index) => [code, index]))
    })
  }, [topPaths])

  if (!topPaths.length) return null

  return (
    <div className="fan-wrap">
      <div className="fan-legend">
        <span><i className="legend-line" /> 线条粗细表示同一主要诊断序列的出现频次</span>
        <span><i className="legend-dot" /> 颜色表示第一步主要诊断所属 ICD 章节</span>
      </div>
      <svg className="trajectory-fan" viewBox="0 0 860 330" role="img" aria-label="三步主要诊断候选轨迹">
        {[0, 1, 2].map((step) => (
          <g key={step}>
            <text x={STEP_X[step]} y={34} className="fan-step-label" textAnchor="middle">
              未来第 {step + 1} 步
            </text>
            <line x1={STEP_X[step]} x2={STEP_X[step]} y1={62} y2={296} className="fan-guide" />
          </g>
        ))}

        {topPaths.map((path) => {
          const color = chapterColor(path.steps[0]?.primary.chapter ?? '')
          const points = path.steps.map((step, index) => {
            const rank = rankMaps[index].get(step.primary.code) ?? 0
            return {
              x: STEP_X[index],
              y: TOP_Y + rank * ROW_GAP,
              code: step.primary.code,
            }
          })
          const selected = path.key === selectedKey
          const strokeWidth = Math.min(12, 1.5 + path.share * 10)
          return (
            <g
              key={path.key}
              className={`fan-path ${selected ? 'selected' : ''}`}
              onClick={() => onSelect(path.key)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') onSelect(path.key)
              }}
            >
              <polyline
                points={points.map((point) => `${point.x},${point.y}`).join(' ')}
                fill="none"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeOpacity={selected ? 0.95 : 0.18 + path.share * 0.7}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {points.map((point, index) => (
                <g key={`${path.key}-${index}`}>
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={selected ? 6 : 3.5 + path.share * 6}
                    fill={color}
                    fillOpacity={selected ? 1 : 0.75}
                  />
                  <text x={point.x} y={point.y - 10} className="fan-node-label" textAnchor="middle">
                    {point.code}
                  </text>
                </g>
              ))}
            </g>
          )
        })}

        {topPaths.slice(0, 4).map((path) => {
          const step = path.steps[2]
          if (!step) return null
          const rank = rankMaps[2].get(step.primary.code) ?? 0
          return (
            <text
              key={`share-${path.key}`}
              x={STEP_X[2] + 22}
              y={TOP_Y + rank * ROW_GAP + 4}
              className="fan-share-label"
            >
              {(path.share * 100).toFixed(0)}%
            </text>
          )
        })}
      </svg>
      <p className="fan-caption">
        仅展示出现频次最高的 {Math.min(MAX_PATHS, topPaths.length)} 条主要诊断序列；比例是有限次 Monte Carlo 抽样的经验频率，
        不是个体概率或预后风险。
      </p>
    </div>
  )
}
