'use client'

import { useEffect } from 'react'

interface Props {
  item: {
    id:                  string
    qty:                 number
    unit_price:          number
    is_custom:           boolean
    customization_notes: string | null
  }
  product:    { name: string; sku: string; category: string | null }
  order:      { order_number: string; queue_number: number; created_at: string }
  branchName: string
  printQty:   number
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    timeZone: 'Asia/Jakarta',
  })
}

function Label({ product, order, branchName, customization_notes, is_custom }: Omit<Props, 'item' | 'printQty'> & { customization_notes: string | null; is_custom: boolean }) {
  return (
    <div className="label-box">
      {/* Brand header */}
      <div className="label-header">
        <span className="label-brand">Scentsored</span>
        <span className="label-branch">{branchName}</span>
      </div>

      {/* Divider */}
      <div className="label-line" />

      {/* Product name — Chatime style */}
      <p className="label-product-name">{product.name}</p>
      {product.category && <p className="label-category">{product.category}</p>}

      {/* Kustomisasi (untuk racik) */}
      {is_custom && customization_notes && (
        <p className="label-notes">✦ {customization_notes}</p>
      )}

      {/* Divider */}
      <div className="label-line" />

      {/* Footer info */}
      <div className="label-footer">
        <span className="label-sku">{product.sku}</span>
        <span className="label-date">{formatDate(order.created_at)}</span>
      </div>
      <div className="label-order">#{order.queue_number} · {order.order_number}</div>
    </div>
  )
}

export function LabelPrintClient({ item, product, order, branchName, printQty }: Props) {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 400)
    return () => clearTimeout(t)
  }, [])

  const labels = Array.from({ length: printQty })

  return (
    <>
      {/* Kontrol — hanya layar */}
      <div className="no-print fixed top-0 left-0 right-0 bg-white border-b border-line px-4 py-2 flex gap-2 items-center z-10 shadow-sm">
        <button
          onClick={() => window.print()}
          className="h-8 px-4 rounded-md bg-pine text-white text-xs font-medium hover:bg-pine-700"
        >
          Cetak Label
        </button>
        <button
          onClick={() => window.close()}
          className="h-8 px-4 rounded-md border border-line-strong text-xs font-medium text-ink-700"
        >
          Tutup
        </button>
        <span className="text-xs text-ink-400 ml-2">{printQty} label · {product.name}</span>
      </div>

      {/* Label grid */}
      <div className="label-grid pt-14 p-4 bg-sand-100 min-h-screen no-print-bg">
        {labels.map((_, i) => (
          <Label key={i}
            product={product} order={order} branchName={branchName}
            customization_notes={item.customization_notes}
            is_custom={item.is_custom}
          />
        ))}
      </div>

      <style>{`
        /* ── Label: 5cm × 10cm ── */
        .label-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: flex-start;
        }

        .label-box {
          width: 189px;  /* ~5cm at 96dpi */
          height: 378px; /* ~10cm at 96dpi */
          background: white;
          border: 1px solid #ccc;
          padding: 10px 9px;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          font-family: 'Inter Tight', system-ui, sans-serif;
          font-size: 9px;
          color: #1d1610;
          overflow: hidden;
        }

        .label-header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 4px;
        }
        .label-brand  {
          font-family: 'Chatime', Georgia, serif;
          font-size: 15px;
          letter-spacing: .04em;
          color: #064733;
        }
        .label-branch { font-size: 7.5px; color: #6f6256; }

        .label-line   { border-top: 1px solid #064733; margin: 5px 0; }

        .label-product-name {
          font-family: 'Chatime', Georgia, serif;
          font-size: 19px;
          line-height: 1.25;
          color: #064733;
          flex: 1;
          display: flex;
          align-items: center;
        }
        .label-category { font-size: 8px; color: #948675; text-transform: uppercase; letter-spacing: .1em; margin-top: 2px; }

        .label-notes {
          font-size: 8px;
          color: #9a4316;
          font-style: italic;
          margin-top: 4px;
          line-height: 1.4;
          background: #fbf0e9;
          padding: 3px 5px;
          border-radius: 3px;
        }

        .label-footer {
          display: flex;
          justify-content: space-between;
          margin-top: 4px;
        }
        .label-sku    { font-family: 'Courier New', monospace; font-size: 7.5px; color: #6f6256; }
        .label-date   { font-size: 7.5px; color: #6f6256; }
        .label-order  { font-size: 7px; color: #948675; margin-top: 1px; font-family: 'Courier New', monospace; }

        /* ── THERMAL PRINT ── */
        @media print {
          @page {
            size: 50mm 100mm;
            margin: 1mm;
          }

          html, body { margin: 0; padding: 0; background: white !important; }

          .no-print    { display: none !important; }
          .no-print-bg { background: white !important; padding: 0 !important; }

          .label-grid {
            gap: 0;
            padding: 0;
            background: white;
          }

          .label-box {
            width: 48mm;
            height: 98mm;
            padding: 3mm;
            border: none;
            page-break-after: always;
            page-break-inside: avoid;
          }

          .label-brand        { font-size: 13pt; }
          .label-product-name { font-size: 16pt; }
        }
      `}</style>
    </>
  )
}
