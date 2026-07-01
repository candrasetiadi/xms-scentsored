'use client'

import { useEffect } from 'react'

interface Props {
  open:      boolean
  onClose:   () => void
  title?:    string
  children:  React.ReactNode
}

export function BottomSheet({ open, onClose, title, children }: Props) {
  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-ink-900/40 z-40"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Sheet — bottom on mobile, centered modal on desktop */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="fixed bottom-0 inset-x-0 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-sm bg-white rounded-t-2xl md:rounded-2xl shadow-lg p-5 z-50"
      >
        {/* Handle bar (mobile only) */}
        <div className="w-10 h-1 bg-sand-300 rounded-full mx-auto mb-4 md:hidden" aria-hidden="true" />
        {title && (
          <p className="text-sm font-sans font-semibold text-ink-900 mb-4">{title}</p>
        )}
        {children}
      </div>
    </>
  )
}
