import { ChevronDown, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import type { ModelConfig } from './types'

interface ValidationInfo {
  cases: number
  max_absolute_error: Record<string, number>
  passed: boolean
}

interface TechnicalPanelProps {
  config: ModelConfig | null
  validation: ValidationInfo | null
  latencyMs: number | null
  modeLabel: string
  modelBytes: number
}

export default function TechnicalPanel({
  config,
  validation,
  latencyMs,
  modeLabel,
  modelBytes,
}: TechnicalPanelProps) {
  const [open, setOpen] = useState(false)
  return (
    <section className={`technical-panel ${open ? 'open' : ''}`}>
      <button type="button" className="technical-toggle" onClick={() => setOpen((value) => !value)}>
        <span>
          <ShieldCheck size={16} /> 技术验证与已知差异
        </span>
        <ChevronDown size={16} className="chevron" />
      </button>
      {open && (
        <div className="technical-body">
          <dl>
            <div><dt>模型</dt><dd>{config?.display_name ?? '—'} · {config?.model_version ?? '—'} · {config?.model_dimensions.diagnosis_vocabulary.toLocaleString('zh-CN') ?? '—'} 词元</dd></div>
            <div><dt>推理</dt><dd>ONNX Runtime Web（wasm），浏览器本地运行；本次{latencyMs ? ` ${(latencyMs / 1000).toFixed(2)} s` : '—'}，模式：{modeLabel}</dd></div>
            <div><dt>模型体积</dt><dd>{(modelBytes / 1024 / 1024).toFixed(1)} MB</dd></div>
            <div>
              <dt>数值一致性</dt>
              <dd>
                {validation
                  ? `${validation.cases} 组合成输入 PyTorch vs ONNX，最大绝对误差 ${
                      Math.max(...Object.values(validation.max_absolute_error)).toExponential(1)
                    }`
                  : '验证记录载入中'}
              </dd>
            </div>
          </dl>
          <div className="technical-note">
            <strong>已知差异</strong>
            <p>
              历史首条记录按“首次住院、前次间隔 0 天”标准化，而非直接置 0；若输入的是截断历史，页面无法还原真实前次间隔。
              候选轨迹递归时使用所抽时间桶的中位天数，离线脚本默认从桶内经验间隔池抽取，因此连续天数口径为网页简化版；
              离散时间桶与主要诊断序列的分桶/分类口径一致，但网页端到端逐例一致性仍需另行核验。
            </p>
            <p>
              页面仅用于研究演示与教学，不用于临床诊断、治疗决策或个体预后判断；技术验证不等于临床效用评价。
            </p>
          </div>
        </div>
      )}
    </section>
  )
}
