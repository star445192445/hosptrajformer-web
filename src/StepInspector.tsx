import { useMemo } from 'react'
import { chapterColor, diagnosisLabel } from './diagnosisNames'
import type { TimeBucket, Trajectory } from './types'

interface StepInspectorProps {
  trajectories: Trajectory[]
  buckets: TimeBucket[]
  activeStep: number
  onStepChange: (step: number) => void
}

export default function StepInspector({ trajectories, buckets, activeStep, onStepChange }: StepInspectorProps) {
  const total = trajectories.length
  const single = total === 1
  const bucketOrder = useMemo(() => new Map(buckets.map((bucket, index) => [bucket.id, index])), [buckets])

  const data = useMemo(() => {
    const timeCounts = new Map<number, { label: string; count: number }>()
    const primaryCounts = new Map<string, { label: string; chapter: string; count: number }>()
    const secondaryCounts = new Map<string, { label: string; count: number }>()
    trajectories.forEach((trajectory) => {
      const step = trajectory.steps[activeStep]
      if (!step) return
      const time = timeCounts.get(step.interval.id)
      if (time) time.count += 1
      else timeCounts.set(step.interval.id, { label: step.interval.label, count: 1 })
      const primaryKey = step.primary.code
      const primary = primaryCounts.get(primaryKey)
      if (primary) primary.count += 1
      else primaryCounts.set(primaryKey, { label: diagnosisLabel(step.primary.code), chapter: step.primary.chapter, count: 1 })
      step.secondary.forEach((candidate) => {
        const key = candidate.diagnosis.code
        const secondary = secondaryCounts.get(key)
        if (secondary) secondary.count += 1
        else secondaryCounts.set(key, { label: diagnosisLabel(candidate.diagnosis.code), count: 1 })
      })
    })
    const times = Array.from(timeCounts.entries())
      .map(([id, value]) => ({ id, ...value }))
      .sort((left, right) => (bucketOrder.get(left.id) ?? 99) - (bucketOrder.get(right.id) ?? 99))
    return {
      times,
      primaries: Array.from(primaryCounts.values()).sort((left, right) => right.count - left.count).slice(0, 6),
      secondaries: Array.from(secondaryCounts.values()).sort((left, right) => right.count - left.count).slice(0, 8),
    }
  }, [trajectories, activeStep, bucketOrder])

  const singleStep = single ? trajectories[0].steps[activeStep] : null
  const singleTimes = useMemo(() => {
    if (!singleStep) return []
    return singleStep.intervalProbabilities
      .map((item) => {
        const bucket = buckets.find((entry) => entry.id === item.id)
        return { id: item.id, label: bucket?.label ?? `桶 ${item.id}`, value: item.probability }
      })
      .sort((left, right) => (bucketOrder.get(left.id) ?? 99) - (bucketOrder.get(right.id) ?? 99))
  }, [singleStep, buckets, bucketOrder])

  const singlePrimaries = singleStep
    ? singleStep.primaryTop5.map((item) => ({
        label: diagnosisLabel(item.diagnosis.code),
        chapter: item.diagnosis.chapter,
        value: item.probability,
      }))
    : []
  const singleSecondaries = singleStep
    ? singleStep.secondary.map((item) => ({ label: diagnosisLabel(item.diagnosis.code), value: item.probability }))
    : []

  const times = single ? singleTimes : data.times.map((item) => ({ label: item.label, value: item.count / total }))
  const primaries = single
    ? singlePrimaries
    : data.primaries.map((item) => ({ label: item.label, chapter: item.chapter, value: item.count / total }))
  const secondaries = single
    ? singleSecondaries
    : data.secondaries.map((item) => ({ label: item.label, value: item.count / total }))

  return (
    <section className="step-panel">
      <div className="panel-heading compact">
        <div>
          <span className="eyebrow">STEP DISTRIBUTION</span>
          <h3>各未来步骤的候选构成</h3>
          <p className="panel-subline">
            {single ? '百分比为该步条件下的模型概率。' : `百分比为全部 ${total} 条抽样轨迹中的出现频率。`}
          </p>
        </div>
        <div className="step-tabs" role="tablist">
          {[0, 1, 2].map((step) => (
            <button
              type="button"
              role="tab"
              aria-selected={activeStep === step}
              key={step}
              className={activeStep === step ? 'active' : ''}
              onClick={() => onStepChange(step)}
            >
              第 {step + 1} 步
            </button>
          ))}
        </div>
      </div>

      <div className="step-grid">
        <div className="step-block">
          <h4>时间间隔（距前次住院）</h4>
          <div className="bar-list">
            {times.map((item) => (
              <div className="bar-row" key={item.label}>
                <span>{item.label}</span>
                <div><i style={{ width: item.value > 0 ? `${item.value * 100}%` : '0%' }} /></div>
                <em>{(item.value * 100).toFixed(1)}%</em>
              </div>
            ))}
          </div>
        </div>

        <div className="step-block">
          <h4>主要诊断</h4>
          <div className="rank-list">
            {primaries.map((item, index) => (
              <div className="rank-row" key={item.label}>
                <span className="rank-index">{index + 1}</span>
                <span className="rank-label">
                  <i style={{ background: chapterColor(item.chapter) }} />
                  {item.label}
                </span>
                <div className="rank-bar"><i style={{ width: item.value > 0 ? `${item.value * 100}%` : '0%' }} /></div>
                <em>{(item.value * 100).toFixed(1)}%</em>
              </div>
            ))}
          </div>
        </div>

        <div className="step-block">
          <h4>次要诊断（多标签）</h4>
          {secondaries.length ? (
            <div className="chip-row">
              {secondaries.map((item) => (
                <span className="chip" key={item.label}>
                  {item.label}
                  <em>{(item.value * 100).toFixed(0)}%</em>
                </span>
              ))}
            </div>
          ) : (
            <p className="muted">该步骤未出现达到阈值或未被抽到的次要诊断。</p>
          )}
          <p className="step-note">次要诊断是多标签集合，百分比不必相加为 100%。</p>
        </div>
      </div>
    </section>
  )
}
