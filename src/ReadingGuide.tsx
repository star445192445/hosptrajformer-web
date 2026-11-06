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
          <p><b>百分比是抽样频率。</b> 它来自本次有限次 Monte Carlo 抽样，不是经过个体校准的发病概率或预后风险。</p>
        </div>
        <div>
          <strong>03</strong>
          <p><b>诊断、时间和不确定性一起看。</b> 单步命中率较高不代表完整序列准确；完整三步联合序列的覆盖率通常更低。</p>
        </div>
      </div>
    </section>
  )
}
