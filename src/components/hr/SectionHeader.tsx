interface Props {
  title:    string
  children?: React.ReactNode
}

export function SectionHeader({ title, children }: Props) {
  return (
    <div className="flex items-center justify-between mb-6">
      <h1 className="font-display text-[28px] text-pine">{title}</h1>
      {children && <div className="flex gap-2">{children}</div>}
    </div>
  )
}
