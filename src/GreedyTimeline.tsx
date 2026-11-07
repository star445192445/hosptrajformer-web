import { ArrowRight } from 'lucide-react'
import { chapterColor, diagnosisLabel } from './diagnosisNames'
import type { Trajectory } from './types'

export default function GreedyTimeline({ trajectory }: { trajectory: Trajectory }) {
  return (
    <section className="greedy-panel">
      <div className="panel-heading compact">
        <div>
          <span className="eyebrow">GREEDY TIMELINE</span>
          <h3>一条逐步贪心轨迹</h3>
          <p className="panel-subline">每步取模型概率最高的候选；不显示抽样频率或路径占比。</p>
        </div>
      </div>
      <div className="greedy-steps">
        {trajectory.steps.map((step, index) => (
          <article className="greedy-step" key={step.step}>
            <div className="greedy-step-index">
              <span>第 {index + 1} 步</span>
              {index < trajectory.steps.length - 1 && <ArrowRight size={16} />}
            </div>
            <div className="greedy-step-main">
              <i style={{ background: chapterColor(step.primary.chapter) }} />
              <strong>{step.primary.code}</strong>
              <span>{diagnosisLabel(step.primary.code)}</span>
            </div>
            <dl>
              <div><dt>距前次住院</dt><dd>{step.interval.label}</dd></div>
              <div><dt>该步模型概率</dt><dd>{(step.primaryProbability * 100).toFixed(1)}%</dd></div>
              <div><dt>下一次住院年龄</dt><dd>{step.age.toFixed(1)} 岁</dd></div>
            </dl>
            {step.secondary.length > 0 && (
              <div className="greedy-secondary">
                <span>次要诊断候选</span>
                <div className="chip-row">
                  {step.secondary.map((candidate) => (
                    <span className="chip" key={candidate.diagnosis.id}>
                      {diagnosisLabel(candidate.diagnosis.code)}
                      <em>{(candidate.probability * 100).toFixed(0)}%</em>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  )
}
