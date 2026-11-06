import { BrainCircuit, Check, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react'
import { useState } from 'react'

interface ConsentGateProps {
  onAccept: () => void
}

export default function ConsentGate({ onAccept }: ConsentGateProps) {
  const [checked, setChecked] = useState(false)
  return (
    <div className="consent-backdrop" role="dialog" aria-modal="true" aria-labelledby="consent-title">
      <div className="consent-card">
        <div className="consent-visual">
          <span className="consent-mark"><BrainCircuit size={24} /></span>
          <span className="eyebrow">HospTrajFormer · RESEARCH DEMO</span>
          <h1 id="consent-title">
            用历史住院轨迹，<br />生成未来三步候选
          </h1>
          <p>
            本页面是一个研究型演示工具。输入患者的既往住院序列后，模型会在浏览器内生成未来三次住院的
            时间间隔、主要诊断与次要诊断候选，并以多条候选路径展示不确定性。
          </p>
          <div className="consent-visual-foot">
            <span><Sparkles size={15} /> 多路径概率轨迹</span>
            <span><ShieldCheck size={15} /> 浏览器本地推理</span>
          </div>
        </div>

        <div className="consent-body">
          <div className="consent-points">
            <div className="consent-point">
              <span className="consent-icon"><LockKeyhole size={18} /></span>
              <div>
                <h3>输入不上传</h3>
                <p>所有计算在当前浏览器内完成；输入不写入服务器、数据库或本地存储。</p>
              </div>
            </div>
            <div className="consent-point">
              <span className="consent-icon"><ShieldCheck size={18} /></span>
              <div>
                <h3>请不要输入可识别信息</h3>
                <p>不要填写姓名、身份证号、住院号、联系方式等；建议使用脱敏或合成病例。</p>
              </div>
            </div>
            <div className="consent-point">
              <span className="consent-icon"><Check size={18} /></span>
              <div>
                <h3>研究演示，不是医疗建议</h3>
                <p>输出为统计候选轨迹，不构成诊断、治疗决策或个体预后判断，不能替代医生意见。</p>
              </div>
            </div>
          </div>

          <label className="consent-check">
            <input type="checkbox" checked={checked} onChange={(event) => setChecked(event.target.checked)} />
            <span>我已阅读上述说明，理解本页面仅用于研究演示，并同意在本地使用。</span>
          </label>

          <button type="button" className="primary-button consent-button" disabled={!checked} onClick={onAccept}>
            开始使用
          </button>
          <p className="consent-foot">
            继续即表示你已了解：本工具不提供医学建议；如出现急症，请立即就医。
          </p>
        </div>
      </div>
    </div>
  )
}
