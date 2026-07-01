interface Props {
  children: React.ReactNode
}

export function TableWrapper({ children }: Props) {
  return (
    <div className="w-full overflow-x-auto rounded-2xl border border-line bg-white shadow-sm">
      <table className="w-full min-w-[600px] border-collapse font-sans text-sm">
        {children}
      </table>
    </div>
  )
}

export function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      scope="col"
      className={`px-4 py-3 text-xs font-semibold text-ink-500 uppercase tracking-wide bg-sand-100 border-b border-line ${right ? 'text-right' : 'text-left'}`}
    >
      {children}
    </th>
  )
}

export function Td({ children, right, className }: { children: React.ReactNode; right?: boolean; className?: string }) {
  return (
    <td className={`px-4 py-3 text-ink-900 ${right ? 'text-right tabular-nums' : ''} ${className ?? ''}`}>
      {children}
    </td>
  )
}
