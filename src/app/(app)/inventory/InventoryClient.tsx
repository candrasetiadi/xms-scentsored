'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { BatchInputModal } from './BatchInputModal'
import type { RawStockRow } from '@/types/database'

type Tab = 'raw' | 'product'

interface Props {
  staffId:        string
  staffRole:      string
  branchId:       string | null
  branches:       { id: string; name: string }[]
  rawStock:       RawStockRow[]
  productStock:   { product_id: string; current_stock: number; updated_at: string }[]
  products:       { id: string; name: string; sku: string; type: string }[]
  allRawMaterials: { id: string; name: string; unit: string }[]
}

const STATUS_STYLE: Record<string, string> = {
  aman:   'bg-success-bg text-success border-success-bd',
  rendah: 'bg-warning-bg text-warning border-warning-bd',
  habis:  'bg-danger-bg text-danger border-danger-bd',
}

const STATUS_LABEL: Record<string, string> = { aman: 'Aman', rendah: 'Rendah', habis: 'Habis' }

function formatRp(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

function formatNum(n: number) {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 3 }).format(n)
}

export function InventoryClient({
  staffId, staffRole, branchId, branches,
  rawStock, productStock, products, allRawMaterials,
}: Props) {
  const router    = useRouter()
  const pathname  = usePathname()
  const [tab, setTab]           = useState<Tab>('raw')
  const [search, setSearch]     = useState('')
  const [batchModal, setBatchModal] = useState(false)

  const canInputBatch = ['owner', 'admin', 'stock_keeper'].includes(staffRole)

  function onBranchChange(id: string) {
    router.push(`${pathname}?branch=${id}`)
  }

  const filteredRaw = rawStock.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase())
  )

  const productMap = new Map(products.map(p => [p.id, p]))
  const filteredProducts = productStock
    .map(ps => ({ ...ps, product: productMap.get(ps.product_id) }))
    .filter(ps => ps.product?.name.toLowerCase().includes(search.toLowerCase()))

  const totalValuation = rawStock.reduce((s, r) => s + r.valuation, 0)
  const lowCount       = rawStock.filter(r => r.stock_status !== 'aman').length

  const inputCls = "h-10 rounded-md border border-line-strong px-3 text-sm text-ink-900 focus:outline-none focus:border-pine-400 focus:ring-2 focus:ring-pine-100"

  return (
    <>
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
          <div>
            <h1 className="font-display text-[28px] text-pine">Inventory</h1>
            {!branchId && <p className="text-sm text-ink-400 mt-1">Pilih cabang untuk melihat stok.</p>}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {branches.length > 0 && (
              <select className={inputCls} value={branchId ?? ''} onChange={e => onBranchChange(e.target.value)}>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            )}
            {canInputBatch && branchId && (
              <button onClick={() => setBatchModal(true)}
                className="h-10 px-4 rounded-md bg-rust text-white text-sm font-medium hover:bg-rust-600 transition-colors whitespace-nowrap">
                + Input Batch
              </button>
            )}
          </div>
        </div>

        {branchId && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
              <div className="bg-white border border-line rounded-lg shadow-sm p-4">
                <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">Bahan Baku</p>
                <p className="text-2xl font-semibold tabular-nums text-ink-900">{rawStock.length}</p>
                <p className="text-xs text-ink-400 mt-0.5">item terdaftar</p>
              </div>
              <div className="bg-white border border-line rounded-lg shadow-sm p-4">
                <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">Valuasi FIFO</p>
                <p className="text-lg font-semibold tabular-nums text-ink-900">{formatRp(totalValuation)}</p>
                <p className="text-xs text-ink-400 mt-0.5">total nilai stok</p>
              </div>
              <div className={`bg-white border rounded-lg shadow-sm p-4 col-span-2 sm:col-span-1 ${
                lowCount > 0 ? 'border-warning-bd' : 'border-line'
              }`}>
                <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">Perlu Perhatian</p>
                <p className={`text-2xl font-semibold tabular-nums ${lowCount > 0 ? 'text-warning' : 'text-ink-900'}`}>
                  {lowCount}
                </p>
                <p className="text-xs text-ink-400 mt-0.5">stok rendah / habis</p>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-4 border-b border-line pb-0">
              {([['raw', 'Bahan Baku'], ['product', 'Produk Jadi']] as [Tab, string][]).map(([t, label]) => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    tab === t
                      ? 'border-pine text-pine'
                      : 'border-transparent text-ink-500 hover:text-ink-900'
                  }`}>
                  {label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="mb-4">
              <input placeholder={tab === 'raw' ? 'Cari bahan baku…' : 'Cari produk…'}
                value={search} onChange={e => setSearch(e.target.value)} className={`${inputCls} w-full max-w-sm`} />
            </div>

            {/* Raw material table */}
            {tab === 'raw' && (
              <div className="bg-white border border-line rounded-lg shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-sand-100 text-xs uppercase tracking-wider text-ink-500 text-left">
                      <th className="px-4 py-3 font-medium">Bahan Baku</th>
                      <th className="px-4 py-3 font-medium text-right tabular-nums">Stok</th>
                      <th className="px-4 py-3 font-medium hidden sm:table-cell text-right tabular-nums">Valuasi</th>
                      <th className="px-4 py-3 font-medium text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {filteredRaw.length === 0 && (
                      <tr><td colSpan={4} className="px-4 py-10 text-center text-ink-400">
                        {rawStock.length === 0 ? 'Belum ada batch masuk. Gunakan tombol "Input Batch" untuk menambah stok.' : 'Tidak ada hasil.'}
                      </td></tr>
                    )}
                    {filteredRaw.map(r => (
                      <tr key={r.raw_material_id} className="hover:bg-sand-50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-ink-900">{r.name}</p>
                          <p className="text-xs text-ink-400 mt-0.5">Reorder ≤ {formatNum(r.reorder_level)} {r.unit}</p>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          <span className="font-semibold text-ink-900">{formatNum(r.current_stock)}</span>
                          <span className="text-ink-400 ml-1 text-xs">{r.unit}</span>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-ink-700 hidden sm:table-cell">
                          {formatRp(r.valuation)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${STATUS_STYLE[r.stock_status]}`}>
                            {STATUS_LABEL[r.stock_status]}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {filteredRaw.length > 0 && (
                    <tfoot>
                      <tr className="bg-sand-50 border-t border-line-strong">
                        <td className="px-4 py-2 text-xs font-medium text-ink-500">Total valuasi</td>
                        <td />
                        <td className="px-4 py-2 text-right tabular-nums text-sm font-semibold text-ink-900 hidden sm:table-cell">
                          {formatRp(totalValuation)}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}

            {/* Product stock table */}
            {tab === 'product' && (
              <div className="bg-white border border-line rounded-lg shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-sand-100 text-xs uppercase tracking-wider text-ink-500 text-left">
                      <th className="px-4 py-3 font-medium">Produk</th>
                      <th className="px-4 py-3 font-medium hidden sm:table-cell">SKU</th>
                      <th className="px-4 py-3 font-medium hidden md:table-cell">Tipe</th>
                      <th className="px-4 py-3 font-medium text-right tabular-nums">Stok</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {filteredProducts.length === 0 && (
                      <tr><td colSpan={4} className="px-4 py-10 text-center text-ink-400">
                        Belum ada stok produk jadi. Stok bertambah setelah order paid (ready stock) atau produksi selesai.
                      </td></tr>
                    )}
                    {filteredProducts.map(({ product_id, current_stock, product }) => (
                      <tr key={product_id} className="hover:bg-sand-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-ink-900">{product?.name ?? '—'}</td>
                        <td className="px-4 py-3 font-mono text-xs text-ink-500 hidden sm:table-cell">{product?.sku ?? '—'}</td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          {product && (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
                              product.type === 'custom_racik'
                                ? 'bg-rust-50 text-rust border-rust-100'
                                : 'bg-pine-50 text-pine border-pine-100'
                            }`}>
                              {product.type === 'custom_racik' ? 'Racik' : 'Ready'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold text-ink-900">
                          {formatNum(current_stock)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {branchId && (
        <BatchInputModal
          open={batchModal}
          onClose={() => setBatchModal(false)}
          branchId={branchId}
          rawMaterials={allRawMaterials}
          onSuccess={() => { setBatchModal(false); router.refresh() }}
        />
      )}
    </>
  )
}
