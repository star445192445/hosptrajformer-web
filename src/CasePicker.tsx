import type { CaseDefinition } from './types'

interface CasePickerProps {
  cases: CaseDefinition[]
  activeId: string
  onSelect: (id: string) => void
}

export default function CasePicker({ cases, activeId, onSelect }: CasePickerProps) {
  return (
    <div className="case-picker" role="list">
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
