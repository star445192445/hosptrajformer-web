import { PenLine } from 'lucide-react'
import type { CaseDefinition } from './types'

interface CasePickerProps {
  cases: CaseDefinition[]
  activeId: string
  customActive: boolean
  onSelect: (id: string) => void
  onCustom: () => void
}

export default function CasePicker({ cases, activeId, customActive, onSelect, onCustom }: CasePickerProps) {
  return (
    <div className="case-picker" role="list">
      <button
        type="button"
        role="listitem"
        className={`case-card case-card-custom ${customActive ? 'active' : ''}`}
        onClick={onCustom}
      >
        <span className="case-title"><PenLine size={14} /> 输入自己的病史</span>
        <span className="case-subtitle">从空白记录开始，逐条添加年龄、间隔和诊断；全程只在浏览器本地处理。</span>
      </button>
      {cases.map((item) => (
        <button
          type="button"
          key={item.id}
          role="listitem"
          className={`case-card ${item.id === activeId ? 'active' : ''}`}
          onClick={() => onSelect(item.id)}
        >
          <span className="case-title">{item.title}</span>
          <span className="case-subtitle">{item.subtitle}</span>
        </button>
      ))}
    </div>
  )
}
