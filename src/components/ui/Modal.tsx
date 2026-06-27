'use client'

import { useEffect, useRef } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-ink-900/40"
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className="bg-white w-full sm:max-w-md rounded-t-xl sm:rounded-xl shadow-lg flex flex-col max-h-[90dvh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-line shrink-0">
          <h2 className="text-base font-semibold text-ink-900">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="p-1 rounded-md text-ink-400 hover:text-ink-900 hover:bg-sand-100 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 3l12 12M3 15L15 3" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4">{children}</div>
      </div>
    </div>
  )
}
