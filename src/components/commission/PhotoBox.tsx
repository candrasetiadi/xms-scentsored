'use client'

import { useId } from 'react'

interface PhotoBoxProps {
  label: string
  icon: string
  file: File | null
  previewUrl?: string | null
  onChange: (file: File | null) => void
}

export function PhotoBox({ label, icon, file, previewUrl, onChange }: PhotoBoxProps) {
  const inputId = useId()
  const localPreview = file ? URL.createObjectURL(file) : null
  const displayUrl = localPreview ?? previewUrl ?? null

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-xs font-medium text-ink-600">{label}</label>
      <label
        htmlFor={inputId}
        className="relative flex flex-col items-center justify-center gap-1 w-full h-24 rounded-xl border-2 border-dashed border-line hover:border-pine cursor-pointer transition-colors overflow-hidden bg-sand-50"
      >
        {displayUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={displayUrl} alt={label} className="absolute inset-0 w-full h-full object-cover rounded-xl" />
        ) : (
          <>
            <span className="text-2xl select-none">{icon}</span>
            <span className="text-xs text-ink-400">Klik untuk upload</span>
          </>
        )}
        <input
          id={inputId}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={e => onChange(e.target.files?.[0] ?? null)}
        />
      </label>
      {file && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-xs text-danger hover:underline text-left"
        >
          Hapus foto
        </button>
      )}
    </div>
  )
}
