'use client'

import { useState, useCallback, createContext, useContext } from 'react'

type ToastVariant = 'success' | 'error' | 'warning'

interface ToastItem {
  id:      string
  message: string
  variant: ToastVariant
}

interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant) => void
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const showToast = useCallback((message: string, variant: ToastVariant = 'success') => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, message, variant }])
    const duration = variant === 'error' ? 5000 : 3000
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, duration)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast container: top-center mobile, bottom-right desktop */}
      <div
        aria-live="polite"
        className="fixed top-4 left-1/2 -translate-x-1/2 sm:left-auto sm:right-4 sm:translate-x-0 sm:bottom-4 sm:top-auto z-[60] flex flex-col gap-2 items-center sm:items-end pointer-events-none"
      >
        {toasts.map(t => (
          <div
            key={t.id}
            className={[
              'bg-ink-900 text-white px-4 py-3 rounded-xl shadow-lg text-sm font-sans border-l-4 pointer-events-auto max-w-xs',
              t.variant === 'success' ? 'border-success' :
              t.variant === 'error'   ? 'border-danger'  :
                                        'border-warning',
            ].join(' ')}
          >
            <div className="flex items-center gap-2">
              <span>{t.message}</span>
              {t.variant === 'error' && (
                <button
                  onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
                  className="ml-2 text-white/60 hover:text-white shrink-0"
                  aria-label="Tutup"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M2 2l8 8M2 10L10 2"/>
                  </svg>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
