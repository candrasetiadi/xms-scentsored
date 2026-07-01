interface Props {
  icon?:     React.ReactNode
  heading:   string
  subtext?:  string
  children?: React.ReactNode
}

export function EmptyState({ icon, heading, subtext, children }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-10 h-10 rounded-xl bg-sand-100 flex items-center justify-center mb-3 text-ink-400">
        {icon ?? (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="10" cy="10" r="8"/>
            <path d="M10 6v4M10 14h.01"/>
          </svg>
        )}
      </div>
      <p className="font-sans font-medium text-sm text-ink-900 mb-1">{heading}</p>
      {subtext && <p className="font-sans text-sm text-ink-500">{subtext}</p>}
      {children}
    </div>
  )
}
