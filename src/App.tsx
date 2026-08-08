import {
  Activity,
  AlertCircle,
  ArrowRight,
  BrainCircuit,
  Check,
  ChevronRight,
  CirclePlus,
  Clock3,
  Database,
  LoaderCircle,
  LockKeyhole,
  Play,
  RotateCcw,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import DiagnosisPicker from './DiagnosisPicker'
import { CHAPTER_NAMES, diagnosisLabel } from './diagnosisNames'
import { generateTrajectory, loadModel } from './inference'
import type { Diagnosis, GeneratedStep, ModelConfig, ModelStatus, Visit } from './types'

const uid = () => Math.random().toString(36).slice(2, 10)

const blankVisit = (age = 55, first = false): Visit => ({
  uid: uid(),
  age,
  intervalBucket: first ? 0 : 4,
  primary: null,
  secondary: [],
})

function percentage(value: number): string {
  return `${(value * 100).toFixed(value >= 0.1 ? 1 : 2)}%`
}

function App() {
  const [config, setConfig] = useState<ModelConfig | null>(null)
  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>([])
  const [visits, setVisits] = useState<Visit[]>([blankVisit(55, true)])
  const [gender, setGender] = useState(1)
  const [status, setStatus] = useState<ModelStatus>('loading')
  const [progressText, setProgressText] = useState('正在读取模型配置')
  const [results, setResults] = useState<GeneratedStep[]>([])
  const [activeStep, setActiveStep] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch('/model/config.json').then((response) => response.json() as Promise<ModelConfig>),
      fetch('/model/diagnoses.json').then((response) => response.json() as Promise<Diagnosis[]>),
    ])
      .then(async ([modelConfig, diagnosisList]) => {
        if (cancelled) return
        setConfig(modelConfig)
        setDiagnoses(diagnosisList)
        setProgressText('正在载入浏览器推理模型')
        await loadModel(`/model/${modelConfig.model_file}`)
        if (cancelled) return
        setStatus('ready')
        setProgressText('模型已就绪')
      })
      .catch((reason: unknown) => {
        if (cancelled) return
        setStatus('error')
        setProgressText('模型载入失败')
        setError(reason instanceof Error ? reason.message : '无法载入模型资源。')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const activeResult = results[activeStep]
  const canRun = status === 'ready' && visits.length > 0 && visits.every((visit) => visit.primary)

  const diagnosisByCode = useMemo(
    () => new Map(diagnoses.map((diagnosis) => [diagnosis.code, diagnosis])),
    [diagnoses],
  )

  function updateVisit(index: number, update: Partial<Visit>) {
    setVisits((current) => current.map((visit, visitIndex) => (visitIndex === index ? { ...visit, ...update } : visit)))
    setResults([])
  }

  function addVisit() {
    const previous = visits[visits.length - 1]
    setVisits((current) => [...current, blankVisit(Math.min(105, previous.age + 0.5))])
    setResults([])
  }

  function removeVisit(index: number) {
    setVisits((current) => current.filter((_, visitIndex) => visitIndex !== index))
    setResults([])
  }

  function reset() {
    setVisits([blankVisit(55, true)])
    setGender(1)
    setResults([])
    setActiveStep(0)
    setError('')
  }

  function loadExample() {
    const examples = [
      { age: 52.2, intervalBucket: 0, primary: 'E11.9', secondary: ['I10.X', 'E78.5'] },
      { age: 53.4, intervalBucket: 5, primary: 'I63.9', secondary: ['I10.X', 'E11.9'] },
      { age: 54.1, intervalBucket: 4, primary: 'N18.9', secondary: ['E11.9', 'I10.X'] },
    ]
    setGender(1)
    setVisits(
      examples.map((item) => ({
        uid: uid(),
        age: item.age,
        intervalBucket: item.intervalBucket,
        primary: diagnosisByCode.get(item.primary) ?? null,
        secondary: item.secondary.flatMap((code) => {
          const diagnosis = diagnosisByCode.get(code)
          return diagnosis ? [diagnosis] : []
        }),
      })),
    )
    setResults([])
    setError('')
  }

  async function runModel() {
    if (!config || !canRun) return
    setStatus('running')
    setProgressText('正在生成三步未来轨迹')
    setError('')
    try {
      const generated = await generateTrajectory(visits, gender, config, diagnoses)
      setResults(generated)
      setActiveStep(0)
      setStatus('ready')
      setProgressText('模型已就绪')
    } catch (reason) {
      setStatus('error')
      setProgressText('生成失败')
      setError(reason instanceof Error ? reason.message : '推理过程发生异常。')
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><BrainCircuit size={23} /></div>
          <div>
            <strong>HospTrajFormer</strong>
            <span>住院疾病轨迹研究演示平台</span>
          </div>
        </div>
        <div className="topbar-meta">
          <span><LockKeyhole size={15} />本地推理</span>
          <span><Database size={15} />V7 · 5,406词元</span>
          <span className={`status-pill ${status}`}>
            {status === 'loading' || status === 'running' ? <LoaderCircle size={15} className="spin" /> : <span className="status-dot" />}
            {progressText}
          </span>
        </div>
      </header>

      <main className="workspace">
        <section className="input-column" aria-label="住院历史输入">
          <div className="section-heading">
            <div>
              <span className="eyebrow">PATIENT HISTORY</span>
              <h1>观察到的住院历史</h1>
            </div>
            <div className="heading-actions">
              <button type="button" className="text-button" onClick={loadExample}>加载示例</button>
              <button type="button" className="icon-button" title="重置" aria-label="重置" onClick={reset}><RotateCcw size={17} /></button>
            </div>
          </div>

          <div className="patient-context">
            <label>性别</label>
            <div className="segmented" aria-label="性别">
              {[
                [1, '男'],
                [2, '女'],
                [0, '未知'],
              ].map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  className={gender === value ? 'active' : ''}
                  onClick={() => setGender(Number(value))}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="context-note">最多纳入最近10次住院</span>
          </div>

          <div className="visit-list">
            {visits.map((visit, index) => (
              <article className="visit-card" key={visit.uid}>
                <div className="visit-index">
                  <span>{index + 1}</span>
                  <div className="visit-line" />
                </div>
                <div className="visit-body">
                  <div className="visit-title">
                    <strong>第{index + 1}次住院</strong>
                    {visits.length > 1 && (
                      <button
                        type="button"
                        className="icon-button quiet danger"
                        title="删除本次住院"
                        aria-label="删除本次住院"
                        onClick={() => removeVisit(index)}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                  <div className="visit-grid">
                    <label className="field">
                      <span>住院时年龄</span>
                      <div className="number-input">
                        <input
                          type="number"
                          min="0"
                          max="105"
                          step="0.1"
                          value={visit.age}
                          onChange={(event) => updateVisit(index, { age: Number(event.target.value) })}
                        />
                        <em>岁</em>
                      </div>
                    </label>
                    <label className="field">
                      <span>距前次住院</span>
                      <select
                        value={visit.intervalBucket}
                        disabled={index === 0}
                        onChange={(event) => updateVisit(index, { intervalBucket: Number(event.target.value) })}
                      >
                        {config?.time_buckets.map((bucket) => (
                          <option key={bucket.id} value={bucket.id} disabled={index > 0 && bucket.id === 0}>
                            {index === 0 && bucket.id === 0 ? '首次记录' : bucket.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="field full">
                      <span>主要诊断</span>
                      <DiagnosisPicker
                        diagnoses={diagnoses}
                        value={visit.primary}
                        onChange={(primary) => updateVisit(index, { primary })}
                      />
                    </div>
                    <div className="field full">
                      <span>次要诊断 <small>{visit.secondary.length}/5</small></span>
                      {visit.secondary.length > 0 && (
                        <div className="secondary-chips">
                          {visit.secondary.map((diagnosis) => (
                            <button
                              type="button"
                              key={diagnosis.id}
                              title="移除次要诊断"
                              onClick={() => updateVisit(index, {
                                secondary: visit.secondary.filter((item) => item.id !== diagnosis.id),
                              })}
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
                            if (diagnosis) updateVisit(index, { secondary: [...visit.secondary, diagnosis] })
                          }}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="input-actions">
            <button type="button" className="secondary-button" disabled={visits.length >= 10} onClick={addVisit}>
              <CirclePlus size={18} />添加住院事件
            </button>
            <button type="button" className="primary-button" disabled={!canRun} onClick={runModel}>
              {status === 'running' ? <LoaderCircle size={18} className="spin" /> : <Play size={18} fill="currentColor" />}
              生成未来轨迹
            </button>
          </div>
          {error && <div className="error-banner"><AlertCircle size={18} />{error}</div>}
        </section>

        <section className="result-column" aria-label="模型输出">
          <div className="section-heading result-heading">
            <div>
              <span className="eyebrow">MODEL OUTPUT</span>
              <h2>未来住院轨迹</h2>
            </div>
            {results.length > 0 && <span className="result-badge"><Check size={15} />已生成</span>}
          </div>

          {!results.length ? (
            <div className="empty-result">
              <div className="empty-icon"><Activity size={30} /></div>
              <strong>等待生成</strong>
              <span>模型输出将在此处呈现</span>
              <div className="privacy-strip"><ShieldCheck size={16} />输入仅在当前浏览器中处理</div>
            </div>
          ) : (
            <>
              <div className="trajectory-strip">
                {results.map((result, index) => (
                  <div className="trajectory-segment" key={result.step}>
                    <button
                      type="button"
                      className={activeStep === index ? 'active' : ''}
                      onClick={() => setActiveStep(index)}
                    >
                      <span>未来第{result.step}步</span>
                      <strong>{result.primary.code}</strong>
                      <small>{result.interval.label}</small>
                    </button>
                    {index < results.length - 1 && <ChevronRight size={19} />}
                  </div>
                ))}
              </div>

              {activeResult && (
                <div className="result-details">
                  <div className="result-summary">
                    <div className="summary-icon"><Clock3 size={21} /></div>
                    <div>
                      <span>预计住院间隔</span>
                      <strong>{activeResult.interval.label}</strong>
                      <small>代表性间隔 {activeResult.interval.median_days.toLocaleString('zh-CN')} 天</small>
                    </div>
                    <ArrowRight size={20} />
                    <div>
                      <span>主要诊断候选</span>
                      <strong>{diagnosisLabel(activeResult.primary.code)}</strong>
                      <small>Top1概率 {percentage(activeResult.primaryProbability)}</small>
                    </div>
                  </div>

                  <section className="metric-section">
                    <div className="metric-heading">
                      <h3>时间间隔概率</h3>
                      <span>7个有效时间桶</span>
                    </div>
                    <div className="time-bars">
                      {activeResult.intervalProbabilities.map(({ id, probability }) => {
                        const bucket = config?.time_buckets.find((item) => item.id === id)
                        return (
                          <div className={id === activeResult.interval.id ? 'selected' : ''} key={id}>
                            <span>{bucket?.label}</span>
                            <div><i style={{ width: `${Math.max(1.5, probability * 100)}%` }} /></div>
                            <strong>{percentage(probability)}</strong>
                          </div>
                        )
                      })}
                    </div>
                  </section>

                  <section className="metric-section">
                    <div className="metric-heading">
                      <h3>主要诊断 Top5</h3>
                      <span>概率由高至低</span>
                    </div>
                    <div className="diagnosis-ranking">
                      {activeResult.primaryTop5.map(({ diagnosis, probability }, index) => (
                        <div key={diagnosis.id}>
                          <span className="rank">{index + 1}</span>
                          <div className="rank-label">
                            <strong>{diagnosisLabel(diagnosis.code)}</strong>
                            <small>{CHAPTER_NAMES[diagnosis.chapter] ?? diagnosis.chapter}</small>
                          </div>
                          <div className="rank-bar"><i style={{ width: `${Math.max(2, probability * 100)}%` }} /></div>
                          <em>{percentage(probability)}</em>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="metric-section secondary-output">
                    <div className="metric-heading">
                      <h3>次要诊断候选</h3>
                      <span>阈值0.20，最多5项</span>
                    </div>
                    {activeResult.secondary.length ? (
                      <div className="secondary-output-list">
                        {activeResult.secondary.map(({ diagnosis, probability }) => (
                          <div key={diagnosis.id}>
                            <span>{diagnosisLabel(diagnosis.code)}</span>
                            <strong>{percentage(probability)}</strong>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="no-secondary">无诊断达到预设阈值</p>
                    )}
                  </section>
                </div>
              )}
            </>
          )}
        </section>
      </main>

      <footer>
        <span>HospTrajFormer · 浏览器端研究演示</span>
        <p>仅供科研与教学演示，不用于临床诊断、治疗决策或个体预后判断。</p>
      </footer>
    </div>
  )
}

export default App
