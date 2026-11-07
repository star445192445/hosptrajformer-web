import { BookOpen } from 'lucide-react'

export default function ReadingGuide() {
  return (
    <section className="reading-guide">
      <div className="reading-guide-head">
        <span className="reading-icon"><BookOpen size={18} /></span>
        <div>
          <span className="eyebrow">HOW TO READ</span>
          <h3>如何阅读这些结果</h3>
        </div>
      </div>
      <div className="reading-steps">
        <div>
          <strong>01</strong>
          <p><b>候选路径不是确定未来。</b> 每条线是一种可能的诊断序列，展示模型认为哪些路径更常见，不表示患者一定会沿该路径发展。</p>
        </div>
        <div>
          <strong>02</strong>
          <p><b>先分清两种百分比。</b> 概率抽样模式显示有限次抽样中的出现频率；逐步贪心模式显示该步模型概率。两者都不是经过个体校准的发病概率或预后风险。</p>
        </div>
        <div>
          <strong>03</strong>
          <p><b>诊断、时间和不确定性一起看。</b> 路径表只汇总主要诊断序列，时间桶是其中一条抽样示例；单步命中率较高不代表完整序列准确。</p>
        </div>
      </div>
    </section>
  )
}
