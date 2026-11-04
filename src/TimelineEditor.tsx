import { CirclePlus, Clock3, Trash2 } from 'lucide-react'
import DiagnosisPicker from './DiagnosisPicker'
import { diagnosisLabel } from './diagnosisNames'
import type { Diagnosis, Visit } from './types'

interface TimelineEditorProps {
  visits: Visit[]
  gender: number
  diagnoses: Diagnosis[]
  onGenderChange: (gender: number) => void
  onChange: (visits: Visit[]) => void
}

function updateVisit(visits: Visit[], index: number, patch: Partial<Visit>): Visit[] {
  return visits.map((visit, visitIndex) => (visitIndex === index ? { ...visit, ...patch } : visit))
}

export default function TimelineEditor({
  visits,
  gender,
  diagnoses,
  onGenderChange,
  onChange,
}: TimelineEditorProps) {
  function removeVisit(index: number) {
    onChange(visits.filter((_, visitIndex) => visitIndex !== index))
  }

  function addVisit() {
    const last = visits[visits.length - 1]
    onChange([
      ...visits,
      {
        uid: Math.random().toString(36).slice(2, 10),
        age: Math.min(105, Number((last.age + 0.8).toFixed(1))),
        intervalDays: 180,
        primary: null,
        secondary: [],
      },
    ])
  }

  return (
    <section className="editor-panel" aria-label="历史住院轨迹编辑器">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">OBSERVED HISTORY</span>
          <h2>观察到的住院轨迹</h2>
        </div>
        <div className="gender-toggle" role="group" aria-label="性别">
          {[
            [1, '男'],
            [2, '女'],
            [0, '未知'],
          ].map(([value, label]) => (
            <button
              type="button"
              key={value}
              className={gender === value ? 'active' : ''}
              onClick={() => onGenderChange(Number(value))}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="timeline">
        {visits.map((visit, index) => (
          <article className="timeline-row" key={visit.uid}>
            <div className="timeline-index">
              <span>{String(index + 1).padStart(2, '0')}</span>
              <i />
            </div>
            <div className="visit-card">
              <div className="visit-meta">
                <strong>{index === 0 ? '首次记录' : `第 ${index + 1} 次住院`}</strong>
                <span className="visit-age">年龄 {visit.age.toFixed(1)} 岁</span>
                {visits.length > 1 && (
                  <button
                    type="button"
                    className="icon-quiet"
                    title="删除本次住院"
                    aria-label="删除本次住院"
                    onClick={() => removeVisit(index)}
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
              <div className="visit-grid">
                <label className="field">
                  <span>入院年龄</span>
                  <div className="number-field">
                    <input
                      type="number"
                      min={0}
                      max={105}
                      step={0.1}
                      value={visit.age}
                      onChange={(event) =>
                        onChange(updateVisit(visits, index, { age: Math.max(0, Math.min(105, Number(event.target.value))) }))
                      }
                    />
                    <em>岁</em>
                  </div>
                </label>
                <label className="field">
                  <span>距前次住院</span>
                  <div className="number-field">
                    <input
                      type="number"
                      min={1}
                      max={3650}
                      step={1}
                      value={index === 0 ? 0 : visit.intervalDays}
                      disabled={index === 0}
                      onChange={(event) =>
                        onChange(updateVisit(visits, index, { intervalDays: Math.max(1, Number(event.target.value)) }))
                      }
                    />
                    <em>天</em>
                  </div>
                </label>
                <div className="field full">
                  <span>主要诊断</span>
                  <DiagnosisPicker
                    diagnoses={diagnoses}
                    value={visit.primary}
                    onChange={(primary) => onChange(updateVisit(visits, index, { primary }))}
                    placeholder="检索 ICD-10 编码或名称"
                  />
                </div>
                <div className="field full">
                  <span>
                    次要诊断 <small>{visit.secondary.length}/5</small>
                  </span>
                  {visit.secondary.length > 0 && (
                    <div className="chip-row">
                      {visit.secondary.map((diagnosis) => (
                        <button
                          type="button"
                          className="chip removable"
                          key={diagnosis.id}
                          onClick={() =>
                            onChange(
                              updateVisit(visits, index, {
                                secondary: visit.secondary.filter((item) => item.id !== diagnosis.id),
                              }),
                            )
                          }
                        >
                          {diagnosisLabel(diagnosis.code)} <span>×</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {visit.secondary.length < 5 && (
                    <DiagnosisPicker
                      diagnoses={diagnoses}
                      value={null}
                      excludedIds={[
                        ...(visit.primary ? [visit.primary.id] : []),
                        ...visit.secondary.map((item) => item.id),
                      ]}
                      placeholder="添加次要诊断"
                      onChange={(diagnosis) => {
                        if (diagnosis) {
                          onChange(updateVisit(visits, index, { secondary: [...visit.secondary, diagnosis] }))
                        }
                      }}
                    />
                  )}
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="editor-actions">
        <button type="button" className="ghost-button" disabled={visits.length >= 10} onClick={addVisit}>
          <CirclePlus size={17} /> 添加住院
        </button>
        <span className="editor-hint">
          <Clock3 size={14} /> 最多纳入最近 10 次住院
        </span>
      </div>
      <p className="editor-note">
        输入为合成示例；年龄、间隔与诊断仅用于演示模型输出，全部推理在浏览器本地完成。
      </p>
    </section>
  )
}
