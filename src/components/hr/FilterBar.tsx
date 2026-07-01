'use client'

export interface FilterBarField {
  key:         string
  type:        'select' | 'date' | 'text'
  label:       string
  value:       string
  onChange:    (v: string) => void
  options?:    { value: string; label: string }[]
  placeholder?: string
}

interface Props {
  fields:   FilterBarField[]
  onReset?: () => void
}

const inputCls =
  'border border-line-strong rounded-md px-3 py-2 text-sm font-sans text-ink-900 bg-white ' +
  'focus:border-pine-400 focus:ring-2 focus:ring-pine-100 outline-none placeholder:text-ink-400 ' +
  'min-w-[140px]'

export function FilterBar({ fields, onReset }: Props) {
  return (
    <div className="flex flex-wrap gap-2 mb-4 items-end">
      {fields.map(f => (
        <div key={f.key} className="flex flex-col gap-0.5">
          <label className="text-xs text-ink-500">{f.label}</label>
          {f.type === 'select' ? (
            <select
              value={f.value}
              onChange={e => f.onChange(e.target.value)}
              className={inputCls}
              aria-label={f.label}
            >
              {f.options?.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          ) : (
            <input
              type={f.type}
              value={f.value}
              onChange={e => f.onChange(e.target.value)}
              placeholder={f.placeholder}
              className={inputCls}
              aria-label={f.label}
            />
          )}
        </div>
      ))}
      {onReset && (
        <button
          onClick={onReset}
          className="px-3 py-2 text-sm font-sans text-ink-500 hover:text-ink-900 transition-colors self-end"
        >
          Reset
        </button>
      )}
    </div>
  )
}
