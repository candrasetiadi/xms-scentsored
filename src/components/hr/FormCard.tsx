interface Props {
  children:  React.ReactNode
  className?: string
}

export function FormCard({ children, className }: Props) {
  return (
    <div className={`bg-white border border-line rounded-2xl p-5 shadow-sm ${className ?? ''}`}>
      {children}
    </div>
  )
}
