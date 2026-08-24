/**
 * 共享 UI 原子组件（dap-* 样式）。
 */
import { useState } from 'react'
import type { ReactNode } from 'react'

/** 行内 label + 控件场。 */
export function Field({
  label,
  hint,
  children,
}: {
  label?: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="dap-field">
      {label !== undefined && <span className="dap-field-label">{label}</span>}
      {children}
      {hint !== undefined && <span className="dap-field-hint">{hint}</span>}
    </div>
  )
}

/** 开关。 */
export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label?: string
}) {
  return (
    <label className="dap-check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label !== undefined && <span>{label}</span>}
    </label>
  )
}

/** 文本输入。 */
export function TextInput({
  value,
  onChange,
  placeholder,
  style,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  style?: React.CSSProperties
}) {
  return (
    <input
      className="dap-text"
      value={value}
      placeholder={placeholder}
      style={{ width: '100%', ...style }}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

/** 数字输入（值可空）。 */
export function NumberInput({
  value,
  onChange,
  placeholder,
  min,
  step,
}: {
  value: number | null
  onChange: (v: number | null) => void
  placeholder?: string
  min?: number
  step?: number
}) {
  return (
    <input
      className="dap-number"
      type="number"
      value={value === null ? '' : value}
      placeholder={placeholder}
      min={min}
      step={step}
      style={{ width: '100%' }}
      onChange={(e) => {
        const raw = e.target.value
        if (raw === '') return onChange(null)
        const n = Number(raw)
        if (Number.isFinite(n)) onChange(n)
      }}
    />
  )
}

/** 下拉选择（值含 '' 空选项）。 */
export function Select({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
}) {
  return (
    <select className="dap-select" value={value} style={{ width: '100%' }} onChange={(e) => onChange(e.target.value)}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

/** 滑块（显示当前值）。 */
export function Slider({
  value,
  onChange,
  min,
  max,
  step,
  format,
}: {
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step: number
  format?: (v: number) => string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <input
        className="dap-range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="dap-range-val">{format ? format(value) : value}</span>
    </div>
  )
}

/** 标签编辑器：输入 + 回车添加 + 删除。 */
export function TagEditor({
  tags,
  onChange,
}: {
  tags: string[]
  onChange: (tags: string[]) => void
}) {
  const [draft, setDraft] = useState('')
  const add = () => {
    const t = draft.trim()
    if (!t) return
    if (tags.includes(t)) {
      setDraft('')
      return
    }
    onChange([...tags, t])
    setDraft('')
  }
  return (
    <div>
      <div className="dap-tag-input-row">
        <input
          className="dap-text"
          value={draft}
          placeholder="输入标签，回车添加"
          style={{ flex: 1 }}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
        />
        <button type="button" className="dap-btn small" onClick={add}>添加</button>
      </div>
      {tags.length > 0 && (
        <div className="dap-chips">
          {tags.map((t) => (
            <span key={t} className="dap-chip">
              {t}
              <button type="button" aria-label="删除" onClick={() => onChange(tags.filter((x) => x !== t))}>×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/** 通用错误条。 */
export function ErrorNote({ message }: { message: string }) {
  return <div className="dap-empty" style={{ color: '#e5484d' }}>{message}</div>
}

/** 加载条。 */
export function LoadingNote({ text }: { text?: string }) {
  return (
    <div className="dap-loading">
      <span className="dap-spinner" />
      <span>{text ?? '加载中…'}</span>
    </div>
  )
}

/** 空态。 */
export function EmptyNote({ children }: { children: ReactNode }) {
  return <div className="dap-empty">{children}</div>
}
