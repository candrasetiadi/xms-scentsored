'use client'

interface Tab {
  key:   string
  label: string
}

interface Props {
  tabs:     Tab[]
  active:   string
  onChange: (key: string) => void
}

export function PageTabs({ tabs, active, onChange }: Props) {
  return (
    <div className="flex gap-1 bg-sand-100 rounded-lg p-1 mb-6" role="tablist">
      {tabs.map(tab => (
        <button
          key={tab.key}
          role="tab"
          aria-selected={active === tab.key}
          onClick={() => onChange(tab.key)}
          className={[
            'flex-1 py-1.5 px-3 rounded-md text-sm font-sans font-medium transition-colors',
            active === tab.key
              ? 'bg-white text-ink-900 shadow-sm'
              : 'text-ink-500 hover:text-ink-700',
          ].join(' ')}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
