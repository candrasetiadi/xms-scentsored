'use client'

import { useEffect } from 'react'

interface ReceiptItem {
  id:                  string
  qty:                 number
  unit_price:          number
  line_total:          number
  is_custom:           boolean
  customization_notes: string | null
  product:             { name: string; type: string } | null
}

interface ReceiptData {
  order: {
    id:           string
    order_number: string
    queue_number: number
    status:       string
    subtotal:     number
    discount:     number
    total:        number
    paid_at:      string | null
    created_at:   string
  }
  branch:   { name: string; address: string | null; phone: string | null }
  customer: { name: string | null; phone: string | null } | null
  driver:   { name: string; fee_value: number } | null
  staff:    { name: string } | null
  payment:  { method: string; status: string; paid_at: string | null } | null
  items:    ReceiptItem[]
}

function formatRp(n: number) {
  return 'Rp ' + new Intl.NumberFormat('id-ID').format(n)
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  })
}

const PAYMENT_LABEL: Record<string, string> = { cash: 'Tunai', qris: 'QRIS' }

export function ReceiptPrintClient({ data }: { data: ReceiptData }) {
  const { order, branch, customer, driver, staff, payment, items } = data

  useEffect(() => {
    // Tunda 400ms agar font dan layout selesai render
    const t = setTimeout(() => window.print(), 400)
    return () => clearTimeout(t)
  }, [])

  return (
    <>
      {/* Tombol aksi — hanya tampil di layar, tersembunyi saat cetak */}
      <div className="no-print fixed top-0 left-0 right-0 bg-white border-b border-line px-4 py-2 flex gap-2 items-center z-10 shadow-sm">
        <button
          onClick={() => window.print()}
          className="h-8 px-4 rounded-md bg-pine text-white text-xs font-medium hover:bg-pine-700"
        >
          Cetak Struk
        </button>
        <button
          onClick={() => window.close()}
          className="h-8 px-4 rounded-md border border-line-strong text-xs font-medium text-ink-700 hover:bg-sand-50"
        >
          Tutup
        </button>
        <span className="text-xs text-ink-400 ml-2">
          {order.order_number} · #{order.queue_number}
        </span>
      </div>

      {/* Receipt container */}
      <div className="receipt-root pt-14 pb-8 flex justify-center bg-sand-100 min-h-screen no-print-bg">
        <div className="receipt-paper">

          {/* ── HEADER ── */}
          <div className="receipt-center receipt-mb">
            <p className="receipt-brand">Scentsored</p>
            <p className="receipt-sub">{branch.name}</p>
            {branch.address && <p className="receipt-small">{branch.address}</p>}
            {branch.phone   && <p className="receipt-small">Telp: {branch.phone}</p>}
          </div>

          <div className="receipt-divider" />

          {/* ── ORDER INFO ── */}
          <div className="receipt-mb">
            <div className="receipt-row">
              <span>No. Order</span>
              <span className="receipt-mono">{order.order_number}</span>
            </div>
            <div className="receipt-row">
              <span>No. Antrian</span>
              <span className="receipt-bold">#{order.queue_number}</span>
            </div>
            <div className="receipt-row">
              <span>Tanggal</span>
              <span>{formatDateTime(order.created_at)}</span>
            </div>
            {staff && (
              <div className="receipt-row">
                <span>Kasir</span>
                <span>{staff.name}</span>
              </div>
            )}
            {customer?.name && (
              <div className="receipt-row">
                <span>Pelanggan</span>
                <span>{customer.name}</span>
              </div>
            )}
            {customer?.phone && (
              <div className="receipt-row">
                <span>No. HP</span>
                <span>{customer.phone}</span>
              </div>
            )}
            {driver && (
              <div className="receipt-row">
                <span>Driver</span>
                <span>{driver.name} ({driver.fee_value}%)</span>
              </div>
            )}
          </div>

          <div className="receipt-divider" />

          {/* ── ITEMS ── */}
          <div className="receipt-mb">
            {items.map((item) => (
              <div key={item.id} className="receipt-item-block">
                <div className="receipt-row">
                  <span className="receipt-item-name">
                    {item.product?.name ?? 'Produk'}
                    {item.is_custom && <span className="receipt-racik"> [Racik]</span>}
                  </span>
                  <span className="receipt-mono">{formatRp(item.line_total)}</span>
                </div>
                <div className="receipt-item-detail">
                  {item.qty} × {formatRp(item.unit_price)}
                </div>
                {item.is_custom && item.customization_notes && (
                  <div className="receipt-item-notes">* {item.customization_notes}</div>
                )}
              </div>
            ))}
          </div>

          <div className="receipt-divider-dashed" />

          {/* ── TOTALS ── */}
          <div className="receipt-mb">
            <div className="receipt-row">
              <span>Subtotal</span>
              <span className="receipt-mono">{formatRp(order.subtotal)}</span>
            </div>
            {order.discount > 0 && (
              <div className="receipt-row">
                <span>Diskon</span>
                <span className="receipt-mono">-{formatRp(order.discount)}</span>
              </div>
            )}
          </div>

          <div className="receipt-divider" />

          <div className="receipt-row receipt-total receipt-mb">
            <span>TOTAL</span>
            <span>{formatRp(order.total)}</span>
          </div>

          <div className="receipt-row receipt-mb">
            <span>Pembayaran</span>
            <span>{PAYMENT_LABEL[payment?.method ?? ''] ?? payment?.method ?? '—'}</span>
          </div>

          <div className="receipt-divider" />

          {/* ── FOOTER ── */}
          <div className="receipt-center receipt-mt">
            <p className="receipt-small">Terima kasih sudah berbelanja</p>
            <p className="receipt-brand-sm">Scentsored</p>
            <p className="receipt-tagline">Your Signature Scent</p>
          </div>

        </div>
      </div>

      {/* ── Thermal print styles ── */}
      <style>{`
        @import url('/fonts/chatime.otf');

        /* Screen preview */
        .receipt-root { font-family: 'Courier New', Courier, monospace; }
        .no-print-bg { background: #f4eee2; }

        .receipt-paper {
          width: 300px;
          background: white;
          padding: 16px 14px;
          font-size: 11px;
          line-height: 1.5;
          color: #000;
          box-shadow: 0 2px 12px rgba(0,0,0,.12);
        }

        .receipt-brand    { font-size: 18px; font-weight: bold; letter-spacing: .05em; }
        .receipt-brand-sm { font-size: 13px; font-weight: bold; margin-top: 4px; }
        .receipt-tagline  { font-size: 9px; letter-spacing: .15em; text-transform: uppercase; margin-top: 2px; color: #555; }
        .receipt-sub      { font-size: 11px; }
        .receipt-small    { font-size: 9.5px; color: #444; }
        .receipt-center   { text-align: center; }
        .receipt-mono     { font-family: 'Courier New', monospace; }
        .receipt-bold     { font-weight: bold; }
        .receipt-mb       { margin-bottom: 6px; }
        .receipt-mt       { margin-top: 6px; }

        .receipt-divider        { border-top: 1px solid #000; margin: 6px 0; }
        .receipt-divider-dashed { border-top: 1px dashed #000; margin: 6px 0; }

        .receipt-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 8px;
          margin-bottom: 1px;
        }
        .receipt-row span:first-child { flex: 1; }
        .receipt-row span:last-child  { text-align: right; white-space: nowrap; }

        .receipt-total {
          font-size: 14px;
          font-weight: bold;
          margin-bottom: 4px;
        }

        .receipt-item-block   { margin-bottom: 4px; }
        .receipt-item-name    { font-weight: 600; flex: 1; }
        .receipt-item-detail  { font-size: 9.5px; color: #555; padding-left: 2px; }
        .receipt-item-notes   { font-size: 9.5px; color: #333; font-style: italic; padding-left: 2px; }
        .receipt-racik        { font-size: 9px; color: #555; }

        /* ── THERMAL PRINT ── */
        @media print {
          * { -webkit-print-color-adjust: exact; color-adjust: exact; }

          @page {
            size: 80mm auto;
            margin: 4mm 2mm;
          }

          html, body { margin: 0; padding: 0; background: white !important; }

          .no-print    { display: none !important; }
          .no-print-bg { background: white !important; padding: 0 !important; }

          .receipt-paper {
            width: 72mm;
            padding: 0;
            box-shadow: none;
            font-size: 10pt;
          }

          .receipt-brand { font-size: 14pt; }
          .receipt-total { font-size: 12pt; }
        }
      `}</style>
    </>
  )
}
