'use client'

import { useState, useRef, useEffect, useId } from 'react'

export interface AutocompleteOption { id: string; name: string }

interface AutocompleteInputProps {
  options: AutocompleteOption[]
  value: string
  inputValue: string
  onChange: (id: string, name: string) => void
  onInputChange: (val: string) => void
  placeholder?: string
  allowCreate?: boolean
  onCreateNew?: (name: string) => Promise<void>
  label?: string
  disabled?: boolean
}

export function AutocompleteInput({
  options,
  value,
  inputValue,
  onChange,
  onInputChange,
  placeholder,
  allowCreate = false,
  onCreateNew,
  label,
  disabled = false,
}: AutocompleteInputProps) {
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputId = useId()

  const filtered = options.filter(o =>
    o.name.toLowerCase().includes(inputValue.toLowerCase())
  )

  const exactMatch = options.some(
    o => o.name.toLowerCase() === inputValue.toLowerCase()
  )

  const showCreate = allowCreate && inputValue.trim().length > 0 && !exactMatch

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  async function handleCreate() {
    if (!onCreateNew || !inputValue.trim()) return
    setCreating(true)
    try {
      await onCreateNew(inputValue.trim())
    } finally {
      setCreating(false)
      setOpen(false)
    }
  }

  function handleSelect(opt: AutocompleteOption) {
    onChange(opt.id, opt.name)
    onInputChange(opt.name)
    setOpen(false)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    onInputChange(val)
    const exactOpt = options.find(o => o.name.toLowerCase() === val.trim().toLowerCase())
    onChange(exactOpt ? exactOpt.id : '', val)
    setOpen(true)
  }

  function handleClear() {
    onChange('', '')
    onInputChange('')
  }

  const inputCls =
    'w-full h-10 rounded-lg border border-line-strong px-3 pr-8 text-sm text-ink-900 bg-white focus:outline-none focus:border-pine focus:ring-2 focus:ring-pine-100 disabled:opacity-50 disabled:cursor-not-allowed'

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label htmlFor={inputId} className="text-xs font-medium text-ink-600 block mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          id={inputId}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          disabled={disabled || creating}
          className={inputCls}
          autoComplete="off"
        />
        {inputValue && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-900"
            aria-label="Hapus"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 3l8 8M3 11L11 3" />
            </svg>
          </button>
        )}
      </div>

      {open && (filtered.length > 0 || showCreate) && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-line rounded-xl shadow-md z-50 max-h-48 overflow-y-auto">
          {filtered.map(opt => (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleSelect(opt)}
              className={[
                'w-full text-left px-3 py-2 text-sm hover:bg-sand-50 transition-colors',
                opt.id === value ? 'bg-pine-50 text-pine font-medium' : 'text-ink-900',
              ].join(' ')}
            >
              {opt.name}
            </button>
          ))}
          {showCreate && (
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating}
              className="w-full text-left px-3 py-2 text-sm text-pine hover:bg-pine-50 transition-colors border-t border-line disabled:opacity-50"
            >
              {creating ? 'Menambahkan...' : `Tambah "${inputValue.trim()}" sebagai baru`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
