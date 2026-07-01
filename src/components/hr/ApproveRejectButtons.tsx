'use client'

interface Props {
  onApprove: () => void
  onReject:  () => void
  loading?:  boolean
  disabled?: boolean
}

function Spinner() {
  return (
    <svg
      className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
      viewBox="0 0 16 16"
      aria-hidden="true"
    />
  )
}

export function ApproveRejectButtons({ onApprove, onReject, loading, disabled }: Props) {
  const isDisabled = disabled || loading

  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <button
        onClick={onApprove}
        disabled={isDisabled}
        className="inline-flex items-center justify-center gap-1.5 bg-pine text-white rounded-md px-3 py-1.5 text-sm font-sans font-medium hover:bg-pine-700 focus-visible:outline-2 focus-visible:outline-pine disabled:opacity-45 transition-colors"
      >
        {loading ? <Spinner /> : null}
        Setujui
      </button>
      <button
        onClick={onReject}
        disabled={isDisabled}
        className="inline-flex items-center justify-center gap-1.5 bg-white border border-line-strong text-danger rounded-md px-3 py-1.5 text-sm font-sans font-medium hover:bg-danger-bg focus-visible:outline-2 focus-visible:outline-danger disabled:opacity-45 transition-colors"
      >
        {loading ? <Spinner /> : null}
        Tolak
      </button>
    </div>
  )
}
