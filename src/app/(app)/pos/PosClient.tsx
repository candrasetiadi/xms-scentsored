'use client'

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Product {
  id: string; sku: string; name: string; category: string | null
  type: 'ready_stock' | 'custom_racik'; price: number; image_url: string | null
}

interface ProductVariant { id: string; size_ml: number; price: number }

interface StaffMember { id: string; name: string; role: string }

interface EdcMachine { id: string; bank_name: string; terminal_id: string | null; label: string }

interface CartItem {
  product:             Product
  qty:                 number
  unit_price:          number
  is_custom:           boolean
  customization_notes: string
  variant_id:          string | null
  size_ml:             number | null
}

type PaymentMethod = 'cash' | 'debit_card' | 'credit_card' | 'bank_transfer' | 'qris'
type Screen = 'pos' | 'success'

interface SuccessData {
  id: string; order_number: string; queue_number: number; total: number
  method: PaymentMethod
}

interface Props {
  staffId:      string
  staffName:    string
  staffRole:    string
  branchId:     string
  branches:     { id: string; name: string }[]
  products:     Product[]
  variantMap:   Record<string, ProductVariant[]>
  stockMap:     Record<string, number>
  edcMachines:  EdcMachine[]
  qrisImageUrl: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const _rp = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 })
function formatRp(n: number) { return 'Rp ' + _rp.format(Math.round(n)) }

const METHOD_LABEL: Record<PaymentMethod, string> = {
  cash:          'Tunai',
  debit_card:    'Kartu Debit',
  credit_card:   'Kartu Kredit',
  bank_transfer: 'Transfer Bank',
  qris:          'QRIS',
}

const METHOD_ICON: Record<PaymentMethod, string> = {
  cash:          '💵',
  debit_card:    '💳',
  credit_card:   '💳',
  bank_transfer: '🏦',
  qris:          '📱',
}

// ── Main component ────────────────────────────────────────────────────────────

export function PosClient({
  staffId, staffName, staffRole, branchId, branches, products, variantMap, stockMap,
  edcMachines, qrisImageUrl,
}: Props) {
  const router   = useRouter()
  const pathname = usePathname()

  // Cart state
  const [cart,      setCart]      = useState<CartItem[]>([])
  const [discount,  setDiscount]  = useState(0)
  const [custName,  setCustName]  = useState('')
  const [custPhone, setCustPhone] = useState('')

  // UI state
  const [search,    setSearch]    = useState('')
  const [category,  setCategory]  = useState<string>('semua')
  const [cartOpen,  setCartOpen]  = useState(false)
  const [screen,    setScreen]    = useState<Screen>('pos')

  // Payment modal state
  const [payModalOpen,  setPayModalOpen]  = useState(false)
  const [payMethod,     setPayMethod]     = useState<PaymentMethod | null>(null)
  const [edcMachineId,  setEdcMachineId]  = useState<string>('')
  const [loading,       setLoading]       = useState(false)
  const [errorMsg,      setErrorMsg]      = useState<string | null>(null)

  // Success data
  const [successData, setSuccessData] = useState<SuccessData | null>(null)


  // Sales/PIC state — auto-fill dengan akun login, bisa diubah
  const [salesStaffId,   setSalesStaffId]   = useState<string>(staffId)
  const [salesStaffName, setSalesStaffName] = useState<string>(staffName)
  const [staffList,      setStaffList]      = useState<StaffMember[]>([])

  // Custom racik modal
  const [customProduct, setCustomProduct] = useState<Product | null>(null)
  const [customNotes,   setCustomNotes]   = useState('')

  // Variant picker
  const [variantProduct,  setVariantProduct]  = useState<Product | null>(null)
  const [variantNotes,    setVariantNotes]    = useState('')

  // ── Derived ────────────────────────────────────────────────────────────────

  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category).filter(Boolean) as string[])
    return ['semua', ...Array.from(cats).sort()]
  }, [products])

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase())
        || p.sku.toLowerCase().includes(search.toLowerCase())
      const matchCat = category === 'semua' || p.category === category
      return matchSearch && matchCat
    })
  }, [products, search, category])

  const subtotal     = cart.reduce((s, i) => s + i.qty * i.unit_price, 0)
  const total        = Math.max(0, subtotal - discount)
  const cartCount    = cart.reduce((s, i) => s + i.qty, 0)
  const canCheckout  = cart.length > 0 && custName.trim() !== '' && custPhone.trim() !== ''

  const needsEdc   = payMethod === 'debit_card' || payMethod === 'credit_card'
  const canConfirm = payMethod !== null && (!needsEdc || edcMachineId !== '')

  // Load staff list untuk SalesPicker
  useEffect(() => {
    fetch(`/api/v1/staff?branch_id=${branchId}`)
      .then(r => r.json())
      .then(j => { if (Array.isArray(j.data)) setStaffList(j.data) })
      .catch(() => {})
  }, [branchId])

  // ── Cart ops ───────────────────────────────────────────────────────────────

  function addToCart(product: Product) {
    const variants = variantMap[product.id] ?? []
    if (variants.length > 0) {
      setVariantProduct(product)
      setVariantNotes('')
      return
    }
    if (product.type === 'custom_racik') {
      setCustomProduct(product)
      setCustomNotes('')
      return
    }
    setCart(prev => {
      const idx = prev.findIndex(i => i.product.id === product.id && !i.is_custom)
      if (idx >= 0) {
        const updated = [...prev]
        updated[idx] = { ...updated[idx], qty: updated[idx].qty + 1 }
        return updated
      }
      return [...prev, { product, qty: 1, unit_price: product.price, is_custom: false, customization_notes: '', variant_id: null, size_ml: null }]
    })
  }

  function addVariantToCart(variant: ProductVariant, notes: string) {
    if (!variantProduct) return
    const product = variantProduct
    setCart(prev => {
      const idx = prev.findIndex(i => i.product.id === product.id && i.variant_id === variant.id)
      if (idx >= 0) {
        const updated = [...prev]
        updated[idx] = { ...updated[idx], qty: updated[idx].qty + 1 }
        return updated
      }
      return [...prev, {
        product,
        qty:                 1,
        unit_price:          variant.price,
        is_custom:           true,
        customization_notes: notes.trim() || `${variant.size_ml}ml`,
        variant_id:          variant.id,
        size_ml:             variant.size_ml,
      }]
    })
    setVariantProduct(null)
    setVariantNotes('')
  }

  function addCustomToCart() {
    if (!customProduct) return
    setCart(prev => [...prev, {
      product: customProduct, qty: 1, unit_price: customProduct.price,
      is_custom: true, customization_notes: customNotes, variant_id: null, size_ml: null,
    }])
    setCustomProduct(null)
    setCustomNotes('')
  }

  function updateQty(idx: number, delta: number) {
    setCart(prev => {
      const updated = [...prev]
      const newQty  = updated[idx].qty + delta
      if (newQty <= 0) return updated.filter((_, i) => i !== idx)
      updated[idx] = { ...updated[idx], qty: newQty }
      return updated
    })
  }

  function removeItem(idx: number) {
    setCart(prev => prev.filter((_, i) => i !== idx))
  }

  function clearCart() {
    setCart([])
    setDiscount(0)
    setCustName('')
    setCustPhone('')
    setCartOpen(false)
    setPayModalOpen(false)
    setPayMethod(null)
    setEdcMachineId('')
    setScreen('pos')
  }

  function selectSalesStaff(id: string, name: string) {
    setSalesStaffId(id)
    setSalesStaffName(name)
  }

  function openPayModal() {
    if (cart.length === 0) return
    if (!custName.trim() || !custPhone.trim()) return
    setPayMethod(null)
    setEdcMachineId('')
    setErrorMsg(null)
    setPayModalOpen(true)
    setCartOpen(false)
  }

  // ── Payment ───────────────────────────────────────────────────────────────

  async function handlePay() {
    if (!payMethod || !canConfirm) return
    setLoading(true)
    setErrorMsg(null)

    try {
      // 1. Buat order
      const createRes = await fetch('/api/v1/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch_id:      branchId,
          driver_id:      null,
          sales_staff_id: salesStaffId || null,
          customer_name:  custName || null,
          customer_phone: custPhone || null,
          discount,
          items: cart.map(i => ({
            product_id:          i.product.id,
            qty:                 i.qty,
            unit_price:          i.unit_price,
            is_custom:           i.is_custom,
            customization_notes: i.customization_notes || null,
            variant_id:          i.variant_id || null,
            size_ml:             i.size_ml || null,
          })),
        }),
      })

      const createJson = await createRes.json()
      if (!createRes.ok) {
        setErrorMsg(createJson.error?.message ?? 'Gagal membuat order.')
        return
      }

      const orderId = createJson.data.id

      // 2. Proses pembayaran
      const payRes = await fetch(`/api/v1/orders/${orderId}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method:         payMethod,
          edc_machine_id: needsEdc ? edcMachineId : undefined,
        }),
      })
      const payJson = await payRes.json()
      if (!payRes.ok) {
        setErrorMsg(payJson.error?.message ?? 'Gagal memproses pembayaran.')
        return
      }

      setSuccessData({
        id:           createJson.data.id,
        order_number: createJson.data.order_number,
        queue_number: createJson.data.queue_number,
        total:        createJson.data.total,
        method:       payMethod,
      })
      setPayModalOpen(false)
      setScreen('success')
    } catch {
      setErrorMsg('Koneksi gagal. Coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  // ── CSS helpers ────────────────────────────────────────────────────────────

  const inputCls = 'bg-sand-50 border border-line rounded-lg px-3 py-2 text-[13px] text-ink-900 focus:outline-none focus:border-pine-400 focus:ring-2 focus:ring-pine-100 focus:bg-white'

  // ── SUCCESS SCREEN ─────────────────────────────────────────────────────────

  if (screen === 'success' && successData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-pine text-white px-4 py-12">
        <div className="w-16 h-16 rounded-full bg-white/15 flex items-center justify-center mb-6">
          <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <p className="text-[11px] text-white/60 uppercase tracking-widest mb-2">Pembayaran Berhasil</p>
        <h2 className="font-display text-[80px] text-white leading-none">#{successData.queue_number}</h2>
        <p className="text-[12px] text-white/50 uppercase tracking-wider mt-1">No. antrian hari ini</p>

        <div className="bg-white/10 border border-white/20 rounded-xl p-4 mt-6 w-full max-w-xs space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-white/60">No. Order</span>
            <span className="font-mono font-medium text-white">{successData.order_number}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/60">Total</span>
            <span className="font-medium text-white">{formatRp(successData.total)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/60">Metode</span>
            <span className="text-white">{METHOD_LABEL[successData.method]}</span>
          </div>
        </div>

        <div className="flex gap-3 mt-8">
          <a
            href={`/print/receipt/${successData.id}`}
            target="_blank" rel="noreferrer"
            className="border border-white/30 text-white/80 rounded-xl px-6 py-3 font-medium hover:bg-white/10 transition-colors"
          >
            Cetak Struk
          </a>
          <button
            onClick={() => { clearCart(); router.refresh() }}
            className="bg-white text-pine font-semibold rounded-xl px-8 py-3 hover:bg-sand-100 transition-colors"
          >
            Transaksi Baru
          </button>
        </div>
      </div>
    )
  }

  // ── POS LAYOUT ─────────────────────────────────────────────────────────────

  return (
    <div className="h-[calc(100vh-56px)] flex flex-col lg:flex-row overflow-hidden">

      {/* ── LEFT: Product grid ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-sand-50">

        {/* Toolbar: branch select + search */}
        <div className="bg-white border-b border-line px-4 py-0 h-14 flex items-center gap-3 flex-shrink-0">
          {/* Search with icon */}
          <div className="relative flex-1">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400 pointer-events-none"
              fill="none" viewBox="0 0 20 20" stroke="currentColor" strokeWidth={2}
            >
              <circle cx="9" cy="9" r="6"/><path d="M15 15l3 3" strokeLinecap="round"/>
            </svg>
            <input
              className="bg-sand-50 border border-line-strong rounded-xl pl-9 pr-4 py-2 text-sm w-full focus:outline-none focus:border-pine-400 focus:ring-2 focus:ring-pine-100 focus:bg-white text-ink-900 placeholder:text-ink-400"
              placeholder="Cari produk atau SKU…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Customer bar — selalu visible */}
        <div className="bg-white border-b border-line px-3 py-2 flex-shrink-0">
          <CustomerSearchInput
            name={custName}
            phone={custPhone}
            onNameChange={setCustName}
            onPhoneChange={setCustPhone}
            inputCls={inputCls}
          />
        </div>

        {/* Category pills */}
        {categories.length > 2 && (
          <div className="flex gap-2 px-4 py-2.5 overflow-x-auto scrollbar-none bg-white border-b border-line flex-shrink-0">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`whitespace-nowrap shrink-0 text-xs font-medium rounded-full px-3.5 py-1.5 transition-colors ${
                  category === cat
                    ? 'bg-pine text-white'
                    : 'bg-sand-100 text-ink-700 border border-transparent hover:bg-sand-200'
                }`}
              >
                {cat === 'semua' ? 'Semua' : cat}
              </button>
            ))}
          </div>
        )}

        {/* Product list */}
        <div className="flex-1 overflow-y-auto p-2 sm:p-3">
          {filteredProducts.length === 0 && (
            <div className="py-16 text-center text-ink-400 text-sm">
              Tidak ada produk ditemukan.
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-1.5">
            {filteredProducts.map(product => {
              const stock    = stockMap[product.id] ?? null
              const cartItem = cart.find(i => i.product.id === product.id)
              const isRacik  = product.type === 'custom_racik'
              const lowStock = stock !== null && stock <= 5

              const productVariants = variantMap[product.id] ?? []
              const hasVariants = productVariants.length > 0
              const priceLabel = hasVariants
                ? (() => {
                    const prices = productVariants.map(v => v.price).filter(p => p > 0)
                    if (prices.length === 0) return 'Pilih ukuran'
                    const min = Math.min(...prices)
                    const max = Math.max(...prices)
                    return min === max ? formatRp(min) : `${formatRp(min)}+`
                  })()
                : formatRp(product.price)

              return (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  aria-label={cartItem ? `${product.name}, ${cartItem.qty} di keranjang` : product.name}
                  className={[
                    'relative flex items-center gap-3 rounded-xl px-3.5 py-3 text-left transition-all duration-150 cursor-pointer select-none active:scale-[0.98]',
                    cartItem
                      ? 'bg-pine-50 border-2 border-pine shadow-sm'
                      : 'bg-white border border-line hover:border-pine-200 hover:shadow-sm',
                  ].join(' ')}
                >
                  {/* Type dot */}
                  <span className={`shrink-0 w-2 h-2 rounded-full mt-0.5 ${isRacik ? 'bg-rust' : 'bg-pine'}`} />

                  {/* Name + SKU */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-ink-900 leading-snug truncate">{product.name}</p>
                    <p className="text-[10px] text-ink-400 font-mono mt-0.5 truncate">{product.sku}</p>
                  </div>

                  {/* Price + stock */}
                  <div className="shrink-0 text-right">
                    <p className="text-[13px] font-bold text-pine tabular-nums">{priceLabel}</p>
                    {product.type === 'ready_stock' && stock !== null && (
                      <p className={`text-[10px] tabular-nums mt-0.5 ${lowStock ? 'text-warning font-medium' : 'text-ink-400'}`}>
                        {stock <= 0 ? '⚠ Habis' : `stok ${stock}`}
                      </p>
                    )}
                  </div>

                  {/* Cart qty badge */}
                  {cartItem && (
                    <span className="shrink-0 bg-pine text-white text-[11px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                      {cartItem.qty}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── RIGHT: Cart panel (desktop) ─────────────────────────────────────── */}
      <div className="hidden lg:flex lg:flex-col w-[380px] bg-white border-l border-line">
        <CartPanel
          cart={cart} subtotal={subtotal} discount={discount} total={total}
          canCheckout={canCheckout} stockMap={stockMap}
          setDiscount={setDiscount}
          updateQty={updateQty} removeItem={removeItem}
          onCheckout={openPayModal}
          inputCls={inputCls}
          staffList={staffList}
          salesStaffId={salesStaffId}
          salesStaffName={salesStaffName}
          onSalesSelect={selectSalesStaff}
        />
      </div>

      {/* ── MOBILE: Floating cart button ────────────────────────────────────── */}
      {cartCount > 0 && !cartOpen && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30">
          <button
            onClick={() => setCartOpen(true)}
            className="w-full h-14 rounded-none bg-pine text-white font-semibold flex items-center justify-between px-5"
          >
            <span className="bg-white text-pine text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
              {cartCount}
            </span>
            <span>Lihat Keranjang</span>
            <span className="tabular-nums">{formatRp(total)}</span>
          </button>
        </div>
      )}

      {/* Mobile Cart Drawer */}
      {cartOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex flex-col">
          <button className="flex-1 bg-black/30" onClick={() => setCartOpen(false)} />
          <div className="bg-white rounded-t-2xl shadow-xl flex flex-col max-h-[88vh]">
            <div className="flex-1 overflow-y-auto">
              <CartPanel
                cart={cart} subtotal={subtotal} discount={discount} total={total}
                canCheckout={canCheckout} stockMap={stockMap}
                setDiscount={setDiscount}
                updateQty={updateQty} removeItem={removeItem}
                onCheckout={openPayModal}
                inputCls={inputCls}
                staffList={staffList}
                salesStaffId={salesStaffId}
                salesStaffName={salesStaffName}
                onSalesSelect={selectSalesStaff}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Variant Picker Modal ────────────────────────────────────────────── */}
      {variantProduct && (() => {
        const variants = variantMap[variantProduct.id] ?? []
        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <button className="absolute inset-0 bg-ink-900/50" onClick={() => setVariantProduct(null)} />
            <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
              {/* Header */}
              <div className="px-5 pt-5 pb-4 border-b border-line">
                <p className="text-[11px] font-semibold text-rust uppercase tracking-widest mb-0.5">Pilih Ukuran</p>
                <h3 className="font-semibold text-ink-900 text-[15px] leading-snug">{variantProduct.name}</h3>
              </div>

              {/* Variant options */}
              <div className="p-4 flex flex-col gap-2.5">
                {variants.map(v => (
                  <button
                    key={v.id}
                    onClick={() => addVariantToCart(v, variantNotes)}
                    className="flex items-center justify-between w-full px-4 py-3.5 rounded-xl border border-line hover:border-pine hover:bg-pine-50 active:scale-[0.98] transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-10 h-10 rounded-full bg-sand-100 group-hover:bg-pine-100 flex items-center justify-center text-[13px] font-bold text-ink-700 group-hover:text-pine transition-colors">
                        {v.size_ml}
                      </span>
                      <div className="text-left">
                        <p className="text-[14px] font-semibold text-ink-900">{v.size_ml} ml</p>
                        {v.price === 0 && <p className="text-[11px] text-ink-400">Harga belum diset</p>}
                      </div>
                    </div>
                    <p className="text-[15px] font-bold text-pine tabular-nums">
                      {v.price > 0 ? formatRp(v.price) : '–'}
                    </p>
                  </button>
                ))}
              </div>

              {/* Notes */}
              <div className="px-4 pb-4">
                <label className="text-[11px] font-medium text-ink-500 block mb-1.5">Catatan peracik (opsional)</label>
                <textarea
                  className="w-full rounded-lg border border-line-strong px-3 py-2 text-sm text-ink-900 resize-none focus:outline-none focus:border-pine-400 focus:ring-2 focus:ring-pine-100"
                  rows={2}
                  placeholder="mis. lebih woody, kurangi bunga…"
                  value={variantNotes}
                  onChange={e => setVariantNotes(e.target.value)}
                />
              </div>

              <div className="px-4 pb-4">
                <button
                  onClick={() => setVariantProduct(null)}
                  className="w-full border border-line-strong text-ink-700 rounded-xl py-2.5 text-sm font-medium hover:bg-sand-50 transition-colors"
                >
                  Batal
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Custom Racik Modal ──────────────────────────────────────────────── */}
      {customProduct && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <button className="absolute inset-0 bg-ink-900/50" onClick={() => setCustomProduct(null)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-5">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="font-semibold text-ink-900 text-[16px]">{customProduct.name}</h3>
              <span className="text-[11px] text-rust bg-rust-50 rounded-full px-2 py-0.5">Racik</span>
            </div>
            <label className="text-sm font-medium text-ink-700 block mb-1.5">Catatan untuk peracik</label>
            <textarea
              className="w-full rounded-lg border border-line-strong px-3 py-2.5 text-sm text-ink-900 resize-none focus:outline-none focus:border-pine-400 focus:ring-2 focus:ring-pine-100"
              rows={3}
              placeholder="mis. lebih woody, kurangi bunga, tambah vanilla…"
              value={customNotes}
              onChange={e => setCustomNotes(e.target.value)}
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setCustomProduct(null)}
                className="flex-1 border border-line-strong text-ink-700 rounded-xl px-4 py-2.5 font-medium hover:bg-sand-50 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={addCustomToCart}
                className="flex-1 bg-rust text-white rounded-xl px-4 py-2.5 font-semibold hover:bg-rust-600 transition-colors"
              >
                Tambah ke Keranjang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Payment Modal ────────────────────────────────────────────────────── */}
      {payModalOpen && (
        <div className="fixed inset-0 bg-ink-900/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <button className="absolute inset-0" onClick={() => setPayModalOpen(false)} />
          <div className="relative bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col max-h-[92vh]">

            {/* Header */}
            <div className="px-5 pt-5 pb-4 border-b border-line flex-shrink-0 relative">
              <button
                onClick={() => setPayModalOpen(false)}
                className="absolute top-4 right-4 text-ink-400 hover:text-ink-900 p-1"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4l12 12M4 16L16 4" strokeLinecap="round"/>
                </svg>
              </button>
              <p className="text-[11px] text-ink-400 uppercase tracking-widest mb-1">Total Pesanan</p>
              <p className="text-[36px] font-bold text-ink-900 tabular-nums leading-none">{formatRp(total)}</p>
              <p className="text-[13px] text-ink-500 mt-1">Pilih metode pembayaran</p>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">

              {/* Method grid */}
              <div className="grid grid-cols-3 gap-2.5">
                {(['cash', 'debit_card', 'credit_card', 'bank_transfer', 'qris'] as PaymentMethod[]).map(m => (
                  <button
                    key={m}
                    onClick={() => { setPayMethod(m); setEdcMachineId('') }}
                    className={`flex flex-col items-center gap-2 rounded-xl border-2 px-2 py-4 cursor-pointer transition-all duration-100 ${
                      payMethod === m
                        ? 'border-pine bg-pine-50'
                        : 'border-line bg-sand-50 hover:bg-sand-100 hover:border-line-strong'
                    }`}
                  >
                    <span className="text-xl">{METHOD_ICON[m]}</span>
                    <span className={`text-[11px] font-semibold text-center leading-tight ${
                      payMethod === m ? 'text-pine' : 'text-ink-600'
                    }`}>
                      {METHOD_LABEL[m]}
                    </span>
                  </button>
                ))}
              </div>

              {/* EDC Machine selector (debit/credit) */}
              {needsEdc && (
                <div>
                  <p className="text-sm font-medium text-ink-700 mb-2">Pilih Mesin EDC</p>
                  {edcMachines.length === 0 ? (
                    <p className="text-xs text-warning bg-warning-bg border border-warning-bd rounded-lg px-3 py-2.5">
                      Belum ada mesin EDC terdaftar untuk cabang ini. Hubungi admin.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {edcMachines.map(edc => (
                        <button
                          key={edc.id}
                          onClick={() => setEdcMachineId(edc.id)}
                          className={`w-full flex items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-all ${
                            edcMachineId === edc.id
                              ? 'border-pine bg-pine-50'
                              : 'border-line hover:border-pine-200 hover:bg-sand-50'
                          }`}
                        >
                          <div>
                            <p className={`text-sm font-medium ${edcMachineId === edc.id ? 'text-pine' : 'text-ink-900'}`}>
                              {edc.label}
                            </p>
                            {edc.terminal_id && (
                              <p className="text-xs text-ink-400 font-mono mt-0.5">TID: {edc.terminal_id}</p>
                            )}
                          </div>
                          {edcMachineId === edc.id && (
                            <svg className="w-5 h-5 text-pine flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* QRIS info */}
              {payMethod === 'qris' && (
                <div className="bg-sand-100 rounded-lg border border-line px-3 py-2.5 text-sm text-ink-700">
                  <p className="font-medium mb-1">Pembayaran QRIS</p>
                  <p className="text-xs text-ink-500">Minta pelanggan scan QR statis cabang, lalu tekan Konfirmasi setelah pembayaran diterima.</p>
                </div>
              )}

              {/* Bank transfer info */}
              {payMethod === 'bank_transfer' && (
                <div className="bg-sand-100 rounded-lg border border-line px-3 py-2.5 text-sm text-ink-700">
                  <p className="font-medium mb-1">Konfirmasi setelah transfer diterima</p>
                  <p className="text-xs text-ink-500">Tekan Konfirmasi setelah bukti transfer dikonfirmasi oleh kasir.</p>
                </div>
              )}

              {errorMsg && (
                <p className="bg-danger-bg border border-danger-bd text-danger text-xs rounded-lg px-3 py-2.5">{errorMsg}</p>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 pb-6 pt-3 border-t border-line flex-shrink-0 space-y-2">
              <button
                onClick={handlePay}
                disabled={!canConfirm || loading}
                className="w-full bg-rust hover:bg-rust-600 text-white font-semibold rounded-xl py-3.5 text-[15px] disabled:opacity-40 disabled:pointer-events-none transition-colors"
              >
                {loading
                  ? 'Memproses…'
                  : payMethod
                    ? `Konfirmasi ${METHOD_LABEL[payMethod]} · ${formatRp(total)}`
                    : 'Pilih metode pembayaran'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── CustomerSearchInput ───────────────────────────────────────────────────────

interface CustomerResult { id: string; name: string; phone: string | null }

function CustomerSearchInput({
  name, phone, onNameChange, onPhoneChange, inputCls,
}: {
  name: string
  phone: string
  onNameChange: (v: string) => void
  onPhoneChange: (v: string) => void
  inputCls: string
}) {
  const [query,     setQuery]     = useState('')
  const [results,   setResults]   = useState<CustomerResult[]>([])
  const [open,      setOpen]      = useState(false)
  const [searching, setSearching] = useState(false)
  const [selected,  setSelected]  = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const timerRef     = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); setOpen(false); return }
    setSearching(true)
    try {
      const res  = await fetch(`/api/v1/customers?q=${encodeURIComponent(q)}&limit=8`)
      const json = await res.json()
      setResults(json.data ?? [])
      setOpen(true)
    } catch { /* ignore */ } finally {
      setSearching(false)
    }
  }, [])

  function handleQueryChange(val: string) {
    setQuery(val)
    setSelected(false)
    // Also update name field directly so user can still submit free-form
    onNameChange(val)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => search(val), 300)
  }

  function handleSelect(c: CustomerResult) {
    onNameChange(c.name)
    onPhoneChange(c.phone ?? '')
    setQuery(c.name)
    setSelected(true)
    setOpen(false)
    setResults([])
  }

  function handleClear() {
    setQuery('')
    onNameChange('')
    onPhoneChange('')
    setSelected(false)
    setResults([])
    setOpen(false)
  }

  // Sync query field if name was cleared externally (e.g. clearCart)
  useEffect(() => {
    if (!name) { setQuery(''); setSelected(false) }
  }, [name])

  return (
    <div ref={containerRef} className="space-y-1.5">
      {/* Search / name input */}
      <div className="relative">
        <input
          className={`${inputCls} w-full pr-8`}
          placeholder="Nama / No. HP pelanggan *"
          value={query}
          onChange={e => handleQueryChange(e.target.value)}
          onFocus={() => { if (results.length > 0) setOpen(true) }}
          autoComplete="off"
        />
        {/* Right icon: spinner, check, or clear */}
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none">
          {searching
            ? <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
            : selected
              ? <button type="button" onClick={handleClear} className="pointer-events-auto hover:text-danger">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4l8 8M4 12l8-8" strokeLinecap="round"/>
                  </svg>
                </button>
              : query
                ? <button type="button" onClick={handleClear} className="pointer-events-auto hover:text-danger">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="2">
                      <path d="M4 4l8 8M4 12l8-8" strokeLinecap="round"/>
                    </svg>
                  </button>
                : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 20 20" stroke="currentColor" strokeWidth="2">
                    <circle cx="9" cy="9" r="6"/><path d="M15 15l3 3" strokeLinecap="round"/>
                  </svg>
          }
        </span>

        {/* Dropdown */}
        {open && results.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-line rounded-lg shadow-lg overflow-hidden">
            {results.map(c => (
              <button
                key={c.id}
                type="button"
                onMouseDown={e => { e.preventDefault(); handleSelect(c) }}
                className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-sand-50 text-left transition-colors"
              >
                <span className="text-[13px] font-medium text-ink-900 truncate">{c.name}</span>
                {c.phone && (
                  <span className="text-xs text-ink-400 font-mono ml-2 shrink-0">{c.phone}</span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* No results hint */}
        {open && !searching && results.length === 0 && query.length >= 2 && (
          <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-line rounded-lg shadow-lg px-3 py-2.5">
            <p className="text-xs text-ink-400">Tidak ditemukan — akan dibuat sebagai pelanggan baru.</p>
          </div>
        )}
      </div>

      {/* Phone input — always visible for manual entry / override */}
      <input
        className={`${inputCls} w-full`}
        placeholder="No. HP WhatsApp *"
        type="tel"
        value={phone}
        onChange={e => onPhoneChange(e.target.value)}
      />
    </div>
  )
}

// ── SalesPicker ───────────────────────────────────────────────────────────────

const STAFF_ROLE_LABEL: Record<string, string> = {
  owner: 'Owner', admin: 'Admin', cashier: 'Kasir',
  perfumer: 'Peracik', stock_keeper: 'Stock Keeper',
}

interface SalesPickerProps {
  staffList:     StaffMember[]
  salesStaffId:  string
  salesStaffName: string
  onSelect:      (id: string, name: string) => void
  inputCls:      string
}

function SalesPicker({ staffList, salesStaffId, salesStaffName, onSelect }: SalesPickerProps) {
  const [open,   setOpen]   = useState(false)
  const [query,  setQuery]  = useState('')
  const containerRef        = useRef<HTMLDivElement>(null)
  const searchRef           = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50)
    else setQuery('')
  }, [open])

  const filtered = query.trim()
    ? staffList.filter(s => s.name.toLowerCase().includes(query.toLowerCase()))
    : staffList

  return (
    <div ref={containerRef} className="relative">
      {salesStaffId ? (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="bg-pine-50 border border-pine-200 text-pine text-xs rounded-full px-3 py-1 font-medium flex items-center gap-1.5">
            <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="2">
              <circle cx="8" cy="6" r="3"/>
              <path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6" strokeLinecap="round"/>
            </svg>
            {salesStaffName}
          </span>
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            className="p-1 text-ink-400 hover:text-pine transition-colors"
            title="Ganti Sales/PIC"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="2">
              <path d="M11 2l3 3-8 8H3v-3l8-8z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button
            type="button"
            onClick={() => onSelect('', '')}
            className="p-1 text-ink-400 hover:text-danger transition-colors"
            title="Hapus Sales/PIC"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="2">
              <path d="M4 4l8 8M4 12l8-8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2 text-ink-400 hover:text-ink-700 transition-colors w-full"
        >
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="2">
            <circle cx="8" cy="6" r="3"/>
            <path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6" strokeLinecap="round"/>
          </svg>
          <span className="text-[13px]">Pilih Sales/PIC</span>
        </button>
      )}

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-line rounded-lg shadow-lg overflow-hidden">
          {/* Search input */}
          <div className="px-2 py-2 border-b border-line">
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Cari nama sales..."
              className="w-full text-[13px] px-2.5 py-1.5 border border-line rounded-md outline-none focus:border-pine-400 focus:ring-1 focus:ring-pine-100 placeholder:text-ink-300 text-ink-900 bg-white"
            />
          </div>
          {/* List */}
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-xs text-ink-400 px-3 py-2.5">
                {query ? `Tidak ada hasil untuk "${query}".` : 'Tidak ada staff tersedia.'}
              </p>
            ) : (
              filtered.map(s => (
                <button
                  key={s.id}
                  type="button"
                  onMouseDown={e => { e.preventDefault(); onSelect(s.id, s.name); setOpen(false); setQuery('') }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 hover:bg-sand-50 text-left transition-colors ${
                    s.id === salesStaffId ? 'bg-pine-50' : ''
                  }`}
                >
                  <span className="text-[13px] font-medium text-ink-900 truncate">{s.name}</span>
                  <span className="text-[11px] text-ink-400 ml-2 shrink-0">
                    {STAFF_ROLE_LABEL[s.role] ?? s.role}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── CartPanel ─────────────────────────────────────────────────────────────────

interface CartPanelProps {
  cart:           CartItem[]
  subtotal:       number
  discount:       number
  total:          number
  canCheckout:    boolean
  stockMap:       Record<string, number>
  setDiscount:    (v: number) => void
  updateQty:      (idx: number, delta: number) => void
  removeItem:     (idx: number) => void
  onCheckout:     () => void
  inputCls:       string
  staffList:      StaffMember[]
  salesStaffId:   string
  salesStaffName: string
  onSalesSelect:  (id: string, name: string) => void
}

function CartPanel({
  cart, subtotal, discount, total,
  canCheckout, stockMap,
  setDiscount,
  updateQty, removeItem, onCheckout,
  inputCls,
  staffList, salesStaffId, salesStaffName, onSalesSelect,
}: CartPanelProps) {
  const isEmpty       = cart.length === 0
  const cartCount     = cart.reduce((s, i) => s + i.qty, 0)
  const lowStockItems = cart.filter(i =>
    i.product.type === 'ready_stock' && (stockMap[i.product.id] ?? 1) <= 0
  )

  return (
    <div className="flex flex-col h-full">

      {/* Cart header */}
      <div className="bg-pine text-white px-4 py-3 flex items-center justify-between flex-shrink-0">
        <span className="font-semibold text-sm tracking-wide">Pesanan</span>
        {cartCount > 0 && (
          <span className="bg-white/20 text-white text-xs font-bold rounded-full px-2 py-0.5 ml-2">
            {cartCount}
          </span>
        )}
      </div>

      {/* Sales/PIC section — always visible */}
      <div className="px-3 py-2 border-b border-line flex-shrink-0">
        <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-widest mb-1.5">Sales / PIC</p>
        <SalesPicker
          staffList={staffList}
          salesStaffId={salesStaffId}
          salesStaffName={salesStaffName}
          onSelect={onSalesSelect}
          inputCls={inputCls}
        />
      </div>

      {/* Items list */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
        {isEmpty && (
          <div className="py-12 text-center text-ink-400 text-sm">
            <div className="flex justify-center mb-3">
              <svg className="w-10 h-10 text-sand-300" width="40" height="40" viewBox="0 0 32 32" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <rect x="10" y="14" width="12" height="14" rx="2"/>
                <rect x="13" y="10" width="6" height="5" rx="1"/>
                <rect x="12" y="8" width="8" height="3" rx="1"/>
                <circle cx="16" cy="7" r="2"/>
              </svg>
            </div>
            <p>Keranjang kosong.</p>
            <p className="text-xs mt-1">Tap produk untuk menambahkan.</p>
          </div>
        )}
        {lowStockItems.length > 0 && (
          <div className="mx-3 mb-2 px-3 py-2 rounded-lg bg-warning-bg border border-warning-bd text-[11px] text-warning leading-snug">
            ⚠ Stok bahan baku mungkin tidak mencukupi untuk:{' '}
            {lowStockItems.map(i => i.product.name).join(', ')}. Transaksi tetap bisa dilanjutkan.
          </div>
        )}
        {cart.map((item, idx) => (
          <div key={idx} className="flex items-start gap-2 bg-sand-50 rounded-lg px-3 py-2.5">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-[13px] font-medium text-ink-900 leading-snug">{item.product.name}</p>
                {item.size_ml && (
                  <span className="text-[10px] font-semibold bg-pine-50 text-pine rounded-full px-1.5 py-0.5 shrink-0">
                    {item.size_ml}ml
                  </span>
                )}
              </div>
              {item.is_custom && item.customization_notes && !item.size_ml && (
                <p className="text-[11px] text-rust italic truncate mt-0.5">{item.customization_notes}</p>
)}
              <p className="text-[11px] text-ink-400 mt-0.5">{formatRp(item.unit_price)}</p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => updateQty(idx, -1)}
                className="w-6 h-6 rounded-md bg-white border border-line text-ink-700 font-semibold text-sm flex items-center justify-center leading-none"
              >
                −
              </button>
              <span className="w-6 text-center text-sm font-semibold tabular-nums">{item.qty}</span>
              <button
                onClick={() => updateQty(idx, +1)}
                className="w-6 h-6 rounded-md bg-white border border-line text-ink-700 font-semibold text-sm flex items-center justify-center leading-none"
              >
                +
              </button>
              <button onClick={() => removeItem(idx)} className="ml-1 text-ink-300 hover:text-danger">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M4 4l8 8M4 12l8-8"/>
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      {!isEmpty && (
        <div className="border-t border-line px-3 pt-3 pb-4 bg-white flex-shrink-0 space-y-2">

          {/* Discount */}
          <div className="flex items-center gap-2">
            <label className="text-[12px] text-ink-500 whitespace-nowrap">Diskon (Rp)</label>
            <input
              className="bg-sand-50 border border-line rounded-lg px-3 py-2 text-[13px] text-ink-900 flex-1 focus:outline-none focus:border-pine-400 focus:ring-2 focus:ring-pine-100"
              type="number"
              min={0}
              value={discount || ''}
              placeholder="0"
              onChange={e => setDiscount(Math.max(0, parseInt(e.target.value) || 0))}
            />
          </div>

          {/* Totals */}
          <div className="space-y-1">
            <div className="flex justify-between text-[13px] text-ink-500">
              <span>Subtotal</span>
              <span className="tabular-nums">{formatRp(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-[13px] text-success">
                <span>Diskon</span>
                <span className="tabular-nums">−{formatRp(discount)}</span>
              </div>
            )}
            <div className="flex justify-between items-baseline pt-1.5 border-t border-line">
              <span className="text-[13px] font-semibold text-ink-700 uppercase tracking-wider">Total</span>
              <span className="text-[22px] font-bold text-ink-900 tabular-nums leading-none">{formatRp(total)}</span>
            </div>
          </div>

          {/* Checkout CTA */}
          <button
            onClick={onCheckout}
            disabled={!canCheckout}
            className="w-full bg-rust hover:bg-rust-600 text-white font-semibold text-[15px] rounded-xl py-3.5 mt-2 transition-colors active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none"
          >
            Bayar · {formatRp(total)}
          </button>
        </div>
      )}
    </div>
  )
}
