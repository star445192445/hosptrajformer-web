import { Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { CHAPTER_NAMES, diagnosisLabel, diagnosisName } from './diagnosisNames'
import type { Diagnosis } from './types'

interface DiagnosisPickerProps {
  diagnoses: Diagnosis[]
  value: Diagnosis | null
  excludedIds?: number[]
  placeholder?: string
  onChange: (diagnosis: Diagnosis | null) => void
}

export default function DiagnosisPicker({
  diagnoses,
  value,
  excludedIds = [],
  placeholder = '检索诊断编码或名称',
  onChange,
}: DiagnosisPickerProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const excluded = useMemo(() => new Set(excludedIds), [excludedIds])

  const suggestions = useMemo(() => {
    const normalized = query.trim().toUpperCase()
    return diagnoses
      .filter((diagnosis) => !excluded.has(diagnosis.id))
      .filter((diagnosis) => {
        if (!normalized) return true
        return (
          diagnosis.code.toUpperCase().includes(normalized) ||
          diagnosisName(diagnosis.code).includes(query.trim())
        )
      })
      .sort((left, right) => right.frequency - left.frequency)
      .slice(0, 8)
  }, [diagnoses, excluded, query])

  if (value) {
    return (
      <div className="diagnosis-value">
        <div>
          <strong>{diagnosisLabel(value.code)}</strong>
          <span>{CHAPTER_NAMES[value.chapter] ?? '其他诊断'}</span>
        </div>
        <button
          type="button"
          className="icon-button quiet"
          title="移除诊断"
          aria-label="移除诊断"
          onClick={() => onChange(null)}
        >
          <X size={16} />
        </button>
      </div>
    )
  }

  return (
    <div className="diagnosis-picker">
      <Search size={17} aria-hidden="true" />
      <input
        value={query}
        placeholder={placeholder}
        aria-label={placeholder}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onChange={(event) => {
          setQuery(event.target.value)
          setOpen(true)
        }}
      />
      {open && (
        <div className="diagnosis-menu" role="listbox">
          {suggestions.length ? (
            suggestions.map((diagnosis) => (
              <button
                type="button"
                role="option"
                key={diagnosis.id}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(diagnosis)
                  setQuery('')
                  setOpen(false)
                }}
              >
                <span>
                  <strong>{diagnosisLabel(diagnosis.code)}</strong>
                  <small>{CHAPTER_NAMES[diagnosis.chapter] ?? diagnosis.chapter}</small>
                </span>
                <em>{diagnosis.frequency.toLocaleString('zh-CN')}</em>
              </button>
            ))
          ) : (
            <p>未找到匹配诊断</p>
          )}
        </div>
      )}
    </div>
  )
}
