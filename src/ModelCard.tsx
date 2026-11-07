import { X } from 'lucide-react'

interface ModelCardProps {
  onClose: () => void
}

export default function ModelCard({ onClose }: ModelCardProps) {
  return (
    <div className="model-card-backdrop" role="dialog" aria-modal="true" aria-labelledby="model-card-title">
      <div className="model-card">
        <div className="model-card-head">
          <div>
            <span className="eyebrow">MODEL CARD</span>
            <h2 id="model-card-title">HospTrajFormer V7</h2>
          </div>
          <button type="button" className="icon-quiet" onClick={onClose} aria-label="关闭模型卡">
            <X size={17} />
          </button>
        </div>

        <div className="model-card-grid">
          <section>
            <h3>模型与输入</h3>
            <p>
              基于 Transformer 的多任务住院轨迹模型；输入为最近至多 10 次住院事件（连续年龄、性别、
              时间间隔、主要诊断、次要诊断），输出未来三个住院位置的时间间隔、主要诊断 Top-k 与次要诊断集合。
              页面不估计患者是否还会再次住院，也不估计未来住院次数；它是在“未来仍有住院事件”的条件下生成三个位置的候选输出。
            </p>
          </section>
          <section>
            <h3>训练与评价</h3>
            <p>
              河南省 2019—2025 年住院病案首页数据；多步评价使用独立测试集中 285,171 名具有连续三次
              后续住院的患者（855,513 个未来事件），患者级划分，未使用目标住院信息。
              诊断词表为 5,404 个诊断编码，对应 1,414 个不同 ICD-3 前缀；不应把 5,404 全部称为 ICD-3 类别。
            </p>
          </section>
          <section>
            <h3>参考性能</h3>
            <p>
              离线完全递归生成第 1→3 步：时间间隔准确率 33.38%→27.15%，主要诊断 Top1 33.32%→20.87%、
              Top5 56.07%→42.64%，次要诊断 F1 38.99%→33.06%。这些是论文中的群体离线评价指标，不是网页端到端性能，
              也不是个体准确率；网页端到端一致性仍需逐例核验。
            </p>
          </section>
          <section>
            <h3>边界与限制</h3>
            <p>
              回顾性、单区域数据；诊断编码受病案质量与诊疗流程影响；概率轨迹与候选频率不是校准后的
              个体发病概率；网页采样使用时间桶中位天数回填，离线使用经验间隔池，连续天数口径为网页简化版；
              未开展前瞻性验证与临床效用评价。
            </p>
          </section>
        </div>

        <div className="model-card-note">
          <strong>使用声明</strong>
          <p>
            本页面为研究演示，不是医疗器械，不用于诊断、治疗决策或个体预后判断。请勿输入姓名、身份证号、
            住院号等可识别信息；建议使用合成或脱敏病例。
          </p>
        </div>
      </div>
    </div>
  )
}
