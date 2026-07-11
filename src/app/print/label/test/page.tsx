'use client'

import { useState } from 'react'
import Image from 'next/image'
import { LabelPrintClient } from '../[id]/LabelPrintClient'

const CONCENTRATION_OPTIONS = [
  'EXTRAIT DE PARFUM',
  'EAU DE PARFUM',
  'EAU DE TOILETTE',
  'EAU DE COLOGNE',
  'PARFUM',
]

const SIZE_OPTIONS = ['35 ml', '50 ml', '100 ml']

export default function LabelTestPage() {
  const [name,   setName]   = useState('Rose Petal')
  const [size,   setSize]   = useState('50 ml')
  const [type,   setType]   = useState('EXTRAIT DE PARFUM')
  const [qty,    setQty]    = useState(1)
  const [show,   setShow]   = useState(false)

  const inputCls = 'w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:border-[#064733] focus:ring-2 focus:ring-[#064733]/10'

  if (show) {
    return (
      <div>
        {/* Back button overlay (screen only) */}
        <div style={{ position: 'fixed', top: 0, right: 0, zIndex: 20, padding: '8px' }} className="print:hidden">
          <button
            onClick={() => setShow(false)}
            style={{ height: 32, padding: '0 14px', borderRadius: 6, background: '#f5f0eb', color: '#3d2e26', fontSize: 12, fontWeight: 600, border: '1px solid #e0d8d0', cursor: 'pointer' }}
          >
            ← Edit
          </button>
        </div>
        <LabelPrintClient
          perfumeName={name.trim() || 'Sample'}
          perfumeSize={size}
          perfumeType={type}
          printQty={qty}
        />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f0eb', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px' }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ marginBottom: 24, textAlign: 'center' }}>
          <Image src="/brand/logo_web.png" alt="Scentsored" width={834} height={313} priority style={{ height: 48, width: 'auto', marginBottom: 8 }} />
          <p style={{ fontSize: 13, color: '#8a7060', margin: 0 }}>Isi data lalu preview sebelum cetak ke printer.</p>
        </div>

        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e8e0d8', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Nama parfum */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a7060', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
              Nama Parfum <span style={{ color: '#c0392b' }}>*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value.slice(0, 20))}
              placeholder="e.g. Rose Petal"
              maxLength={20}
              className={inputCls}
              autoFocus
            />
            <p style={{ fontSize: 11, color: '#aaa', marginTop: 4, textAlign: 'right' }}>{name.length}/20</p>
          </div>

          {/* Ukuran */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a7060', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
              Ukuran
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              {SIZE_OPTIONS.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSize(s)}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '2px solid',
                    borderColor: size === s ? '#064733' : '#e8e0d8',
                    background:  size === s ? '#edf4f0' : '#fafaf9',
                    color:       size === s ? '#064733' : '#6b5c4e',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Konsentrasi */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a7060', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
              Konsentrasi
            </label>
            <select
              value={type}
              onChange={e => setType(e.target.value)}
              style={{ width: '100%', borderRadius: 8, border: '1px solid #e0d8d0', padding: '10px 12px', fontSize: 13, color: '#3d2e26', background: '#fff', outline: 'none' }}
            >
              {CONCENTRATION_OPTIONS.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Jumlah label */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a7060', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
              Jumlah Label
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                type="button"
                onClick={() => setQty(q => Math.max(1, q - 1))}
                style={{ width: 40, height: 40, borderRadius: 8, border: '1px solid #e0d8d0', background: '#fafaf9', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3d2e26' }}
              >−</button>
              <span style={{ fontSize: 20, fontWeight: 700, color: '#3d2e26', minWidth: 32, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{qty}</span>
              <button
                type="button"
                onClick={() => setQty(q => Math.min(20, q + 1))}
                style={{ width: 40, height: 40, borderRadius: 8, border: '1px solid #e0d8d0', background: '#fafaf9', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3d2e26' }}
              >+</button>
              <span style={{ fontSize: 12, color: '#aaa' }}>maks. 20</span>
            </div>
          </div>

          <button
            onClick={() => { if (name.trim()) setShow(true) }}
            disabled={!name.trim()}
            style={{
              marginTop: 4, width: '100%', height: 48, borderRadius: 12, background: name.trim() ? '#064733' : '#ccc',
              color: '#fff', fontSize: 15, fontWeight: 700, border: 'none', cursor: name.trim() ? 'pointer' : 'default',
            }}
          >
            Preview Label →
          </button>
        </div>

        <p style={{ fontSize: 11, color: '#aaa', textAlign: 'center', marginTop: 12 }}>
          Halaman ini hanya untuk testing — tidak terhubung ke order nyata.
        </p>
      </div>
    </div>
  )
}
