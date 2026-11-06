import {
  Activity,
  AlertCircle,
  Check,
  Info,
  LoaderCircle,
  Play,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import CasePicker from './CasePicker'
import ConsentGate from './ConsentGate'
import ModelCard from './ModelCard'
import ReadingGuide from './ReadingGuide'
import PathTable from './PathTable'
import StepInspector from './StepInspector'
import TechnicalPanel from './TechnicalPanel'
import TimelineEditor from './TimelineEditor'
import TrajectoryFan from './TrajectoryFan'
import { CASES } from './cases'
import { diagnosisLabel } from './diagnosisNames'
import { loadModel, runGreedy, runMonteCarlo } from './inference'
import type {
  CaseDefinition,
  DecodingMode,
  Diagnosis,
  ModelConfig,
  ModelStatus,
  MonteCarloResult,
  PathSummary,
  Trajectory,
  Visit,
} from './types'

interface ValidationInfo {
  cases: number
  max_absolute_error: Record<string, number>
  passed: boolean
}

type RunResult =
  | { kind: 'greedy'; trajectory: Trajectory }
  | { kind: 'sample'; mc: MonteCarloResult }

function caseVisits(item: CaseDefinition, diagnosisByCode: Map<string, Diagnosis>): Visit[] {
  return item.visits.map((visit) => ({
    uid: Math.random().toString(36).slice(2, 10),
    age: visit.age,
    intervalDays: visit.intervalDays,
    primary: diagnosisByCode.get(visit.primary) ?? null,
    secondary: visit.secondary.flatMap((code) => {
      const diagnosis = diagnosisByCode.get(code)
      return diagnosis ? [diagnosis] : []
    }),
  }))
}

function App() {
  const [config, setConfig] = useState<ModelConfig | null>(null)
  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>([])
  const [validation, setValidation] = useState<ValidationInfo | null>(null)
  const [accepted, setAccepted] = useState(false)
  const [modelCardOpen, setModelCardOpen] = useState(false)
  const [status, setStatus] = useState<ModelStatus>('loading')
  const [progressText, setProgressText] = useState('正在载入模型资源')
  const [visits, setVisits] = useState<Visit[]>([])
  const [gender, setGender] = useState(1)
  const [activeCaseId, setActiveCaseId] = useState('')
  const demoMode = new URLSearchParams(window.location.search).get('demo')
  const [mode, setMode] = useState<DecodingMode>(demoMode === 'greedy' ? 'greedy' : 'sample')
  const [samples, setSamples] = useState(Number(new URLSearchParams(window.location.search).get('samples')) || 20)
  const [seed] = useState(20261104)
  const [result, setResult] = useState<RunResult | null>(null)
  const [selectedPathKey, setSelectedPathKey] = useState<string | null>(null)
  const [activeStep, setActiveStep] = useState(0)
  const [latency, setLatency] = useState<number | null>(null)
  const [mcProgress, setMcProgress] = useState(0)
  const [error, setError] = useState('')

  const diagnosisByCode = useMemo(
    () => new Map(diagnoses.map((diagnosis) => [diagnosis.code, diagnosis])),
    [diagnoses],
  )

  const activeCase = CASES.find((item) => item.id === activeCaseId)
  const autoRan = useRef(false)
  const ready = status === 'ready'
  const busy = status === 'running'
  const canRun = ready && visits.length > 0 && visits.every((visit) => visit.primary)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch('/model/config.json').then((response) => response.json() as Promise<ModelConfig>),
      fetch('/model/diagnoses.json').then((response) => response.json() as Promise<Diagnosis[]>),
      fetch('/model/validation.json').then((response) => response.json() as Promise<ValidationInfo>),
    ])
      .then(async ([modelConfig, diagnosisList, validationInfo]) => {
        if (cancelled) return
        setConfig(modelConfig)
        setDiagnoses(diagnosisList)
        setValidation(validationInfo)
        setProgressText('正在载入浏览器推理模型')
        await loadModel(`/model/${modelConfig.model_file}`)
        if (cancelled) return
        const map = new Map(diagnosisList.map((diagnosis) => [diagnosis.code, diagnosis]))
        const initial = CASES[3]
        setVisits(caseVisits(initial, map))
        setGender(initial.gender)
        setActiveCaseId(initial.id)
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

  function loadCase(id: string) {
    const item = CASES.find((entry) => entry.id === id)
    if (!item) return
    setVisits(caseVisits(item, diagnosisByCode))
    setGender(item.gender)
    setActiveCaseId(id)
    setResult(null)
    setSelectedPathKey(null)
    setActiveStep(0)
    setError('')
  }

  function updateVisits(next: Visit[]) {
    setVisits(next)
    setActiveCaseId('')
    setResult(null)
    setSelectedPathKey(null)
    setError('')
  }

  function reset() {
    if (activeCase) loadCase(activeCase.id)
    else {
      setVisits([])
      setResult(null)
      setSelectedPathKey(null)
    }
  }

  useEffect(() => {
    if (!demoMode || autoRan.current) return
    if (status !== 'ready' || !canRun) return
    autoRan.current = true
    void runModel()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, visits, canRun, demoMode])

  async function runModel() {
    if (!config || !canRun) return
    setStatus('running')
    setError('')
    setResult(null)
    setSelectedPathKey(null)
    setActiveStep(0)
    setMcProgress(0)
    const started = Date.now()
    try {
      if (mode === 'greedy') {
        setProgressText('正在生成逐步贪心轨迹')
        const trajectory = await runGreedy(visits, gender, config, diagnoses)
        setResult({ kind: 'greedy', trajectory })
        setSelectedPathKey(trajectory.steps.map((step) => step.primary.code).join(' → '))
      } else {
        setProgressText('正在抽样候选轨迹')
        const mc = await runMonteCarlo(visits, gender, config, diagnoses, samples, seed, (completed, total) => {
          setMcProgress(completed / total)
          setProgressText(`已抽样 ${completed}/${total} 条候选轨迹`)
        })
        setResult({ kind: 'sample', mc })
        setSelectedPathKey(mc.paths[0]?.key ?? null)
      }
      setLatency(Date.now() - started)
      setStatus('ready')
      setProgressText('生成完成')
    } catch (reason) {
      setStatus('error')
      setProgressText('生成失败')
      setError(reason instanceof Error ? reason.message : '推理过程发生异常。')
    }
  }

  const trajectories: Trajectory[] =
    result?.kind === 'greedy' ? [result.trajectory] : result?.kind === 'sample' ? result.mc.trajectories : []
  const paths: PathSummary[] =
    result?.kind === 'greedy'
      ? [
          {
            key: result.trajectory.steps.map((step) => step.primary.code).join(' → '),
            label: result.trajectory.steps.map((step) => step.primary.code).join(' → '),
            count: 1,
            share: 1,
            steps: result.trajectory.steps,
          },
        ]
      : result?.kind === 'sample'
        ? result.mc.paths
        : []
  const sampleCount = result?.kind === 'sample' ? result.mc.samples : result?.kind === 'greedy' ? 1 : 0
  const modeLabel = result?.kind === 'sample' ? `Monte Carlo · ${samples} 条` : '逐步贪心 · 1 条'
  const selectedPath = paths.find((path) => path.key === selectedPathKey) ?? paths[0] ?? null
  const topShare = paths[0]?.share ?? 0

  if (!accepted) return <ConsentGate onAccept={() => setAccepted(true)} />

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">HTF</span>
          <div>
            <strong>HospTrajFormer</strong>
            <span>多步住院轨迹生成 · 研究演示</span>
          </div>
        </div>
        <div className="topbar-right">
          <span className="top-chip"><ShieldCheck size={14} /> 浏览器本地推理</span>
          <span className="top-chip">V7 · {config?.model_dimensions.diagnosis_vocabulary.toLocaleString('zh-CN') ?? '5,406'} 词元</span>
          <button type="button" className="top-chip top-chip-button" onClick={() => setModelCardOpen(true)}>
            <Info size={14} /> 模型卡
          </button>
          <span className={`status-pill ${status}`}>
            {status === 'loading' || status === 'running' ? <LoaderCircle size={14} className="spin" /> : <i />}
            {progressText}
          </span>
        </div>
      </header>

      <main className="workspace">
        <aside className="left-rail">
          <section className="case-panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">SYNTHETIC CASES</span>
                <h2>选择演示病例</h2>
              </div>
              <button type="button" className="icon-quiet" title="重置病例" aria-label="重置病例" onClick={reset}>
                <RotateCcw size={16} />
              </button>
            </div>
            <CasePicker cases={CASES} activeId={activeCaseId} onSelect={loadCase} />
            <p className="case-note">
              {activeCase ? activeCase.note : '当前为自定义轨迹；所有病例均为合成示例，不含真实患者信息。'}
            </p>
          </section>

          <TimelineEditor
            visits={visits}
            gender={gender}
            diagnoses={diagnoses}
            onGenderChange={setGender}
            onChange={updateVisits}
          />

          <section className="run-panel">
            <div className="mode-switch" role="group" aria-label="解码模式">
              <button type="button" className={mode === 'sample' ? 'active' : ''} onClick={() => setMode('sample')}>
                概率抽样
              </button>
              <button type="button" className={mode === 'greedy' ? 'active' : ''} onClick={() => setMode('greedy')}>
                逐步贪心
              </button>
            </div>
            {mode === 'sample' && (
              <label className="sample-control">
                <span>候选轨迹数</span>
                <select value={samples} onChange={(event) => setSamples(Number(event.target.value))}>
                  {[10, 20, 30, 50].map((value) => (
                    <option key={value} value={value}>{value} 条</option>
                  ))}
                </select>
              </label>
            )}
            <button type="button" className="primary-button" disabled={!canRun || busy} onClick={runModel}>
              {status === 'running' ? <LoaderCircle size={17} className="spin" /> : <Play size={17} fill="currentColor" />}
              {mode === 'sample' ? '生成候选轨迹' : '生成确定性轨迹'}
            </button>
            {status === 'running' && mode === 'sample' && (
              <div className="progress-track"><i style={{ width: `${mcProgress * 100}%` }} /></div>
            )}
            {error && <div className="error-banner"><AlertCircle size={16} />{error}</div>}
          </section>
        </aside>

        <section className="result-column" aria-live="polite">
          {!result ? (
            <div className="empty-state">
              <span className="empty-icon"><Sparkles size={28} /></span>
              <h2>从历史轨迹生成未来三步候选</h2>
              <p>
                左侧选择合成病例，或直接编辑年龄、住院间隔与诊断；模型将输出未来三次住院的时间间隔、
                主要诊断与次要诊断候选。概率抽样会生成多条候选轨迹，逐步贪心只给出一条确定性路径。
              </p>
              <div className="empty-points">
                <span><Check size={14} /> 浏览器内运行</span>
                <span><Check size={14} /> 不保存输入</span>
                <span><Check size={14} /> 结果非临床建议</span>
              </div>
              <div className="empty-diagram">
                <span>历史住院</span><i /><span>三步候选</span><i /><span>概率与频次</span>
              </div>
            </div>
          ) : (
            <div className="result-stack">
              <div className="result-summary">
                <div>
                  <span className="eyebrow">GENERATION SUMMARY</span>
                  <h2>未来三步候选轨迹</h2>
                </div>
                <div className="summary-stats">
                  <span><strong>{sampleCount}</strong> 条轨迹</span>
                  <span><strong>{paths.length}</strong> 条不同诊断序列</span>
                  <span><strong>{(topShare * 100).toFixed(0)}%</strong> 最高频路径</span>
                  <span><strong>{latency === null ? '—' : latency < 100 ? '<0.1' : (latency / 1000).toFixed(2)}</strong> s</span>
                  <span className="summary-mode">{modeLabel}</span>
                </div>
              </div>

              <TrajectoryFan paths={paths} selectedKey={selectedPathKey} onSelect={setSelectedPathKey} />

              <PathTable
                paths={paths}
                selectedKey={selectedPathKey}
                samples={sampleCount}
                onSelect={setSelectedPathKey}
              />

              <StepInspector
                trajectories={trajectories}
                buckets={config?.time_buckets ?? []}
                activeStep={activeStep}
                onStepChange={setActiveStep}
              />

              {selectedPath && (
                <section className="selected-path">
                  <span className="eyebrow">SELECTED PATH</span>
                  <div className="selected-content">
                    <strong>{selectedPath.steps.map((step) => step.primary.code).join(' → ')}</strong>
                    <span>
                      {selectedPath.steps
                        .map((step) => `${diagnosisLabel(step.primary.code)}（${step.interval.label}）`)
                        .join('；')}
                    </span>
                    <em>{selectedPath.count} 条 · {(selectedPath.share * 100).toFixed(1)}%</em>
                  </div>
                </section>
              )}

              <ReadingGuide />

              <div className="result-disclaimer">
                <ShieldCheck size={15} />
                <span>以上为研究演示输出；候选路径与百分比不是个体预测，不构成诊断或治疗建议。</span>
              </div>

              <TechnicalPanel
                config={config}
                validation={validation}
                latencyMs={latency}
                modeLabel={modeLabel}
                modelBytes={31330098}
              />
            </div>
          )}
        </section>
      </main>

      <footer>
        <span>HospTrajFormer · 研究演示</span>
        <p>仅供科研与教学；不用于临床诊断、治疗决策或个体预后判断。合成病例不含真实患者信息。</p>
      </footer>

      {modelCardOpen && <ModelCard onClose={() => setModelCardOpen(false)} />}
    </div>
  )
}

export default App
