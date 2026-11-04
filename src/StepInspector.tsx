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
  const data = useMemo(() => {
    const timeCounts = new Map<number, { label: string; count: number }>()
    const primaryCounts = new Map<string, { label: string; chapter: string; count: number }>()
    const secondaryCounts = new Map<string, { label: string; count: number }>()
    let entropySum = 0
    let entropyN = 0
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
      entropySum += step.entropy
      entropyN += 1
    })
    return {
      times: Array.from(timeCounts.values()).sort((left, right) => right.count - left.count),
      primaries: Array.from(primaryCounts.values()).sort((left, right) => right.count - left.count).slice(0, 6),
      secondaries: Array.from(secondaryCounts.values()).sort((left, right) => right.count - left.count).slice(0, 8),
      entropy: entropyN ? entropySum / entropyN : 0,
    }
  }, [trajectories, activeStep])

  const singleStep = single ? trajectories[0].steps[activeStep] : null
  const singleTimes = useMemo(() => {
    if (!singleStep) return []
    return singleStep.intervalProbabilities
      .map((item) => {
        const bucket = buckets.find((entry) => entry.id === item.id)
        return { label: bucket?.label ?? `桶 ${item.id}`, value: item.probability }
      })
      .sort((left, right) => right.value - left.value)
  }, [singleStep, buckets])

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

  const candWord = single ? '概率' : '候选'
  return (
    <section className="step-panel">
      <div className="panel-heading compact">
        <div>
          <span className="eyebrow">STEP DISTRIBUTION</span>
          <h3>各未来步骤的候选构成</h3>
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
          <h4>时间间隔{candWord}</h4>
          <div className="bar-list">
            {(single ? singleTimes : data.times.map((item) => ({ label: item.label, value: item.count / total }))).map((item) => (
              <div className="bar-row" key={item.label}>
                <span>{item.label}</span>
                <div><i style={{ width: `${Math.max(2, item.value * 100)}%` }} /></div>
                <em>{(item.value * 100).toFixed(1)}%</em>
              </div>
            ))}
          </div>
        </div>

        <div className="step-block">
          <h4>主要诊断{candWord}</h4>
          <div className="rank-list">
            {(single ? singlePrimaries : data.primaries.map((item) => ({ label: item.label, chapter: item.chapter, value: item.count / total }))).map((item, index) => (
              <div className="rank-row" key={item.label}>
                <span className="rank-index">{index + 1}</span>
                <span className="rank-label">
                  <i style={{ background: chapterColor(item.chapter) }} />
                  {item.label}
                </span>
                <div className="rank-bar"><i style={{ width: `${Math.max(2, item.value * 100)}%` }} /></div>
                <em>{(item.value * 100).toFixed(1)}%</em>
              </div>
            ))}
          </div>
        </div>

        <div className="step-block">
          <h4>次要诊断{candWord}</h4>
          {((single ? singleSecondaries : data.secondaries.map((item) => ({ label: item.label, value: item.count / total }))).length) ? (
            <div className="chip-row">
              {(single ? singleSecondaries : data.secondaries.map((item) => ({ label: item.label, value: item.count / total }))).map((item) => (
                <span className="chip" key={item.label}>
                  {item.label}
                  <em>{(item.value * 100).toFixed(0)}%</em>
                </span>
              ))}
            </div>
          ) : (
            <p className="muted">该步骤未出现达到阈值的次要诊断。</p>
          )}
          <p className="step-note">
            平均预测熵 {data.entropy.toFixed(3)}；{single ? '百分比为该步骤的模型概率。' : '百分比为候选轨迹中的出现频次。'}
          </p>
        </div>
      </div>
    </section>
  )
}
