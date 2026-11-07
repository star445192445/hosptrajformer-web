import {
  AlertCircle,
  BarChart3,
  Check,
  Info,
  LoaderCircle,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Table2,
  Waypoints,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import CasePicker from './CasePicker'
import ConsentGate from './ConsentGate'
import GreedyTimeline from './GreedyTimeline'
import ModelCard from './ModelCard'
import PathTable from './PathTable'
import ReadingGuide from './ReadingGuide'
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

type ResultTab = 'paths' | 'steps' | 'branches'
type MobileView = 'input' | 'result'

const SAMPLE_OPTIONS = [10, 20, 30, 50] as const
const DEFAULT_SAMPLE = 20

function parseSampleCount(raw: string | null): number {
  const value = Number(raw)
  return SAMPLE_OPTIONS.includes(value as (typeof SAMPLE_OPTIONS)[number]) ? value : DEFAULT_SAMPLE
}

function parseMode(raw: string | null): DecodingMode {
  return raw === 'greedy' ? 'greedy' : 'sample'
}

function emptyVisit(age = 45): Visit {
  return {
    uid: Math.random().toString(36).slice(2, 10),
    age,
    intervalDays: 0,
    primary: null,
    secondary: [],
  }
}

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
  const [progressText, setProgressText] = useState('等待开始')
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [visits, setVisits] = useState<Visit[]>([])
  const [gender, setGender] = useState(1)
  const [activeCaseId, setActiveCaseId] = useState('')
  const [mode, setMode] = useState<DecodingMode>(() => parseMode(new URLSearchParams(window.location.search).get('demo')))
  const [samples, setSamples] = useState(() => parseSampleCount(new URLSearchParams(window.location.search).get('samples')))
  const [seed] = useState(20261104)
  const [result, setResult] = useState<RunResult | null>(null)
  const [resultTab, setResultTab] = useState<ResultTab>('paths')
  const [mobileView, setMobileView] = useState<MobileView>('input')
  const [selectedPathKey, setSelectedPathKey] = useState<string | null>(null)
  const [activeStep, setActiveStep] = useState(0)
  const [latency, setLatency] = useState<number | null>(null)
  const [mcProgress, setMcProgress] = useState(0)
  const [error, setError] = useState('')
  const runToken = useRef(0)
  const autoRan = useRef(false)

  const demoMode = new URLSearchParams(window.location.search).get('demo')
  const diagnosisByCode = useMemo(
    () => new Map(diagnoses.map((diagnosis) => [diagnosis.code, diagnosis])),
    [diagnoses],
  )

  const activeCase = CASES.find((item) => item.id === activeCaseId)
  const ready = status === 'ready'
  const busy = status === 'running'
  const canRun = ready && visits.length > 0 && visits.every((visit) => visit.primary)

  useEffect(() => {
    if (!accepted) return
    let cancelled = false
    setStatus('loading')
    setError('')
    setProgressText('正在载入模型资源')
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
        await loadModel()
        if (cancelled) return
        if (visits.length === 0) {
          const initial = CASES[3]
          const map = new Map(diagnosisList.map((diagnosis) => [diagnosis.code, diagnosis]))
          setVisits(caseVisits(initial, map))
          setGender(initial.gender)
          setActiveCaseId(initial.id)
        }
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
  }, [accepted, loadAttempt])

  function clearResult() {
    runToken.current += 1
    setResult(null)
    setSelectedPathKey(null)
    setActiveStep(0)
    setResultTab('paths')
    setError('')
  }

  function loadCase(id: string) {
    if (busy) return
    const item = CASES.find((entry) => entry.id === id)
    if (!item) return
    setVisits(caseVisits(item, diagnosisByCode))
    setGender(item.gender)
    setActiveCaseId(id)
    setMobileView('input')
    clearResult()
  }

  function startCustom() {
    if (busy) return
    if (!activeCaseId && visits.length > 0) {
      setMobileView('input')
      document.querySelector('.editor-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    setVisits([emptyVisit(50)])
    setGender(1)
    setActiveCaseId('')
    setMobileView('input')
    clearResult()
    window.setTimeout(() => {
      document.querySelector('.editor-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  function updateVisits(next: Visit[]) {
    if (busy) return
    setVisits(next)
    setActiveCaseId('')
    clearResult()
  }

  function changeGender(value: number) {
    if (busy) return
    setGender(value)
    setActiveCaseId('')
    clearResult()
  }

  function changeMode(value: DecodingMode) {
    if (busy) return
    setMode(value)
    clearResult()
  }

  function changeSamples(value: number) {
    if (busy) return
    setSamples(value)
    clearResult()
  }

  function reset() {
    if (busy) return
    if (activeCase) {
      loadCase(activeCase.id)
      return
    }
    setVisits([emptyVisit()])
    setActiveCaseId('')
    clearResult()
  }

  function retryLoad() {
    setLoadAttempt((value) => value + 1)
  }

  useEffect(() => {
    if (!accepted || !demoMode || autoRan.current) return
    if (status !== 'ready' || !canRun) return
    autoRan.current = true
    void runModel()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accepted, demoMode, status, canRun])

  async function runModel() {
    if (!config || !canRun || busy) return
    const token = runToken.current + 1
    runToken.current = token
    const snapshot = { visits, gender, mode, samples }
    setStatus('running')
    setError('')
    setResult(null)
    setSelectedPathKey(null)
    setActiveStep(0)
    setResultTab('paths')
    setMcProgress(0)
    const started = Date.now()
    try {
      if (snapshot.mode === 'greedy') {
        setProgressText('正在生成逐步贪心轨迹')
        const trajectory = await runGreedy(snapshot.visits, snapshot.gender, config, diagnoses)
        if (token !== runToken.current) return
        setResult({ kind: 'greedy', trajectory })
      } else {
        setProgressText('正在抽样候选轨迹')
        const mc = await runMonteCarlo(
          snapshot.visits,
          snapshot.gender,
          config,
          diagnoses,
          snapshot.samples,
          seed,
          (completed, total) => {
            if (token !== runToken.current) return
            setMcProgress(completed / total)
            setProgressText(`已抽样 ${completed}/${total} 条候选轨迹`)
          },
        )
        if (token !== runToken.current) return
        setResult({ kind: 'sample', mc })
        setSelectedPathKey(mc.paths[0]?.key ?? null)
      }
      setLatency(Date.now() - started)
      setStatus('ready')
      setProgressText('生成完成')
      setMobileView('result')
    } catch (reason) {
      if (token !== runToken.current) return
      setStatus('ready')
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
  const sampleCount = result?.kind === 'sample' ? result.mc.samples : 0
  const modeLabel = result?.kind === 'sample' ? `概率抽样 · ${sampleCount} 条` : '逐步贪心 · 1 条'
  const selectedPath = result?.kind === 'sample' ? paths.find((path) => path.key === selectedPathKey) ?? paths[0] ?? null : null

  if (!accepted) return <ConsentGate onAccept={() => setAccepted(true)} />

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">HTF</span>
          <div>
            <strong>HospTrajFormer</strong>
            <span>研究演示 · 浏览器本地推理</span>
          </div>
        </div>
        <div className="topbar-right">
          <button type="button" className="top-chip top-chip-button" onClick={() => setModelCardOpen(true)}>
            <Info size={14} /> 模型卡
          </button>
          <span className={`status-pill ${status}`}>
            {status === 'loading' || status === 'running' ? <LoaderCircle size={14} className="spin" /> : <i />}
            {progressText}
          </span>
          {status === 'error' && (
            <button type="button" className="ghost-button compact-button" onClick={retryLoad}>
              <RefreshCw size={14} /> 重试
            </button>
          )}
        </div>
      </header>

      <div className="mobile-view-tabs" role="tablist" aria-label="手机视图切换">
        <button type="button" role="tab" aria-selected={mobileView === 'input'} className={mobileView === 'input' ? 'active' : ''} onClick={() => setMobileView('input')}>
          输入
        </button>
        <button type="button" role="tab" aria-selected={mobileView === 'result'} className={mobileView === 'result' ? 'active' : ''} onClick={() => setMobileView('result')} disabled={!result}>
          结果
        </button>
      </div>

      <main className={`workspace mobile-${mobileView}`}>
        <aside className="left-rail">
          <section className="case-panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">SYNTHETIC CASES</span>
                <h2>选择病例或输入自己的记录</h2>
              </div>
              <button type="button" className="icon-quiet" title="重置病例" aria-label="重置病例" onClick={reset} disabled={busy}>
                <RotateCcw size={16} />
              </button>
            </div>
            <CasePicker
              cases={CASES}
              activeId={activeCaseId}
              customActive={!activeCaseId && visits.length > 0}
              onSelect={loadCase}
              onCustom={startCustom}
            />
            <p className="case-note">
              所有示例均为合成病例；也可以点“输入自己的病史”，从空白记录开始逐条填写。请勿输入姓名、住院号等可识别信息。
            </p>
          </section>

          <TimelineEditor
            visits={visits}
            gender={gender}
            diagnoses={diagnoses}
            onGenderChange={changeGender}
            onChange={updateVisits}
            busy={busy}
          />

          <section className="run-panel">
            <div className="run-heading">
              <span className="eyebrow">GENERATE</span>
              {busy && <small>推理中，输入已锁定</small>}
            </div>
            <div className="mode-switch" role="group" aria-label="解码模式">
              <button type="button" className={mode === 'sample' ? 'active' : ''} onClick={() => changeMode('sample')} disabled={busy}>
                概率抽样
              </button>
              <button type="button" className={mode === 'greedy' ? 'active' : ''} onClick={() => changeMode('greedy')} disabled={busy}>
                逐步贪心
              </button>
            </div>
            {mode === 'sample' && (
              <label className="sample-control">
                <span>候选轨迹数</span>
                <select value={samples} onChange={(event) => changeSamples(Number(event.target.value))} disabled={busy}>
                  {SAMPLE_OPTIONS.map((value) => (
                    <option key={value} value={value}>{value} 条</option>
                  ))}
                </select>
              </label>
            )}
            <button type="button" className="primary-button" disabled={!canRun || busy} onClick={runModel}>
              {busy ? <LoaderCircle size={17} className="spin" /> : <Play size={17} fill="currentColor" />}
              {mode === 'sample' ? '生成候选轨迹' : '生成贪心轨迹'}
            </button>
            {busy && mode === 'sample' && (
              <div className="progress-track"><i style={{ width: `${mcProgress * 100}%` }} /></div>
            )}
            {error && (
              <div className="error-banner">
                <AlertCircle size={16} />
                <span>{error}</span>
                {status === 'error' && <button type="button" onClick={retryLoad}>重新加载</button>}
              </div>
            )}
          </section>
        </aside>

        <section className="result-column" aria-live="polite">
          {!result ? (
            <div className="empty-state">
              <span className="empty-icon"><Sparkles size={26} /></span>
              <h2>从历史轨迹生成未来三步候选</h2>
              <p>
                选择左侧合成病例，或点“输入自己的病史”从空白记录开始填写年龄、间隔与诊断。模型会生成未来三个住院位置的
                时间间隔、主要诊断与次要诊断候选；它不预测患者是否还会再次住院。
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
                  <span className="eyebrow">GENERATION RESULT</span>
                  <h2>{result.kind === 'sample' ? '未来三步候选路径' : '逐步贪心候选路径'}</h2>
                  <p className="result-subline">显示三步候选，不预测是否会再次住院；仅供研究演示。</p>
                </div>
                <div className="summary-stats">
                  {result.kind === 'sample' ? (
                    <>
                      <span><strong>{sampleCount}</strong> 条抽样</span>
                      <span><strong>{paths.length}</strong> 种主要诊断序列</span>
                      <span><strong>{paths[0]?.count ?? 0}/{sampleCount}</strong> 最高频序列</span>
                    </>
                  ) : (
                    <span><strong>1</strong> 条贪心轨迹</span>
                  )}
                  <span className="summary-mode">{modeLabel}</span>
                </div>
              </div>

              <div className="result-tabs" role="tablist" aria-label="结果视图">
                <button type="button" role="tab" aria-selected={resultTab === 'paths'} className={resultTab === 'paths' ? 'active' : ''} onClick={() => setResultTab('paths')}>
                  <Table2 size={15} /> {result.kind === 'sample' ? '候选路径' : '贪心轨迹'}
                </button>
                <button type="button" role="tab" aria-selected={resultTab === 'steps'} className={resultTab === 'steps' ? 'active' : ''} onClick={() => setResultTab('steps')}>
                  <BarChart3 size={15} /> 逐步分布
                </button>
                {result.kind === 'sample' && (
                  <button type="button" role="tab" aria-selected={resultTab === 'branches'} className={resultTab === 'branches' ? 'active' : ''} onClick={() => setResultTab('branches')}>
                    <Waypoints size={15} /> 分支图
                  </button>
                )}
              </div>

              {resultTab === 'paths' && result.kind === 'sample' && (
                <PathTable paths={paths} selectedKey={selectedPathKey} samples={sampleCount} onSelect={setSelectedPathKey} />
              )}
              {resultTab === 'paths' && result.kind === 'greedy' && <GreedyTimeline trajectory={result.trajectory} />}
              {resultTab === 'steps' && (
                <StepInspector
                  trajectories={trajectories}
                  buckets={config?.time_buckets ?? []}
                  activeStep={activeStep}
                  onStepChange={setActiveStep}
                />
              )}
              {resultTab === 'branches' && result.kind === 'sample' && (
                <TrajectoryFan paths={paths} selectedKey={selectedPathKey} onSelect={setSelectedPathKey} />
              )}

              {result.kind === 'sample' && selectedPath && resultTab === 'paths' && (
                <section className="selected-path">
                  <span className="eyebrow">SELECTED SEQUENCE</span>
                  <div className="selected-content">
                    <strong>{selectedPath.steps.map((step) => step.primary.code).join(' → ')}</strong>
                    <span>{selectedPath.steps.map((step) => diagnosisLabel(step.primary.code)).join('；')}</span>
                    <em>{selectedPath.count}/{sampleCount} 条 · 一条抽样示例的时间桶：{selectedPath.steps.map((step) => step.interval.label).join(' / ')}</em>
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
