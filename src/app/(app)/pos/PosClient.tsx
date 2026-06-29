'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Product {
  id: string; sku: string; name: string; category: string | null
  type: 'ready_stock' | 'custom_racik'; price: number; image_url: string | null
}

interface Driver { id: string; name: string; fee_value: number; type: string }

interface EdcMachine { id: string; bank_name: string; terminal_id: string | null; label: string }

interface CartItem {
  product: Product
  qty: number
  unit_price: number
  is_custom: boolean
  customization_notes: string
}

type PaymentMethod = 'cash' | 'debit_card' | 'credit_card' | 'bank_transfer' | 'qris'
type Screen = 'pos' | 'success'

interface SuccessData {
  id: string; order_number: string; queue_number: number; total: number
  method: PaymentMethod
}

interface Props {
  staffId:      string
  staffRole:    string
  branchId:     string
  branches:     { id: string; name: string }[]
  products:     Product[]
  drivers:      Driver[]
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
  staffId, staffRole, branchId, branches, products, drivers, stockMap,
  edcMachines, qrisImageUrl,
}: Props) {
  const router   = useRouter()
  const pathname = usePathname()

  // Cart state
  const [cart,      setCart]      = useState<CartItem[]>([])
  const [discount,  setDiscount]  = useState(0)
  const [driverId,  setDriverId]  = useState<string>('')
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

  // QRIS dynamic state
  const [qrisOrderId,  setQrisOrderId]  = useState<string | null>(null)
  const [qrisOrderData, setQrisOrderData] = useState<{ order_number: string; queue_number: number; total: number } | null>(null)
  const [qrisString,   setQrisString]   = useState<string | null>(null)
  const [qrisPolling,  setQrisPolling]  = useState(false)
  const qrisTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Custom racik modal
  const [customProduct, setCustomProduct] = useState<Product | null>(null)
  const [customNotes,   setCustomNotes]   = useState('')

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

  const subtotal       = cart.reduce((s, i) => s + i.qty * i.unit_price, 0)
  const total          = Math.max(0, subtotal - discount)
  const cartCount      = cart.reduce((s, i) => s + i.qty, 0)
  const selectedDriver = drivers.find(d => d.id === driverId)

  const needsEdc     = payMethod === 'debit_card' || payMethod === 'credit_card'
  const canConfirm   = payMethod !== null && payMethod !== 'qris' && (!needsEdc || edcMachineId !== '')

  // Cleanup QRIS polling on unmount
  useEffect(() => () => { if (qrisTimerRef.current) clearInterval(qrisTimerRef.current) }, [])

  // ── Cart ops ───────────────────────────────────────────────────────────────

  function addToCart(product: Product) {
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
      return [...prev, { product, qty: 1, unit_price: product.price, is_custom: false, customization_notes: '' }]
    })
  }

  function addCustomToCart() {
    if (!customProduct) return
    setCart(prev => [...prev, {
      product: customProduct, qty: 1, unit_price: customProduct.price,
      is_custom: true, customization_notes: customNotes,
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
    setDriverId('')
    setCustName('')
    setCustPhone('')
    setCartOpen(false)
    setPayModalOpen(false)
    setPayMethod(null)
    setEdcMachineId('')
    setScreen('pos')
    stopQrisPolling()
    setQrisOrderId(null)
    setQrisOrderData(null)
    setQrisString(null)
    setQrisPolling(false)
  }

  function stopQrisPolling() {
    if (qrisTimerRef.current) { clearInterval(qrisTimerRef.current); qrisTimerRef.current = null }
  }

  async function handleQrisGenerate() {
    setLoading(true)
    setErrorMsg(null)
    stopQrisPolling()

    try {
      // 1. Buat order
      const createRes = await fetch('/api/v1/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch_id: branchId, driver_id: driverId || null,
          customer_name: custName || null, customer_phone: custPhone || null,
          discount,
          items: cart.map(i => ({
            product_id: i.product.id, qty: i.qty, unit_price: i.unit_price,
            is_custom: i.is_custom, customization_notes: i.customization_notes || null,
          })),
        }),
      })
      const createJson = await createRes.json()
      if (!createRes.ok) { setErrorMsg(createJson.error?.message ?? 'Gagal membuat order.'); return }

      const orderId = createJson.data.id

      // 2. Generate QRIS via checkout
      const checkoutRes = await fetch(`/api/v1/orders/${orderId}/checkout`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'qris' }),
      })
      const checkoutJson = await checkoutRes.json()
      if (!checkoutRes.ok) {
        // Batalkan order yang terlanjur dibuat
        await fetch(`/api/v1/orders/${orderId}/cancel`, { method: 'POST' }).catch(() => {})
        setErrorMsg(checkoutJson.error?.message ?? 'Gagal generate QRIS.')
        return
      }

      setQrisOrderId(orderId)
      setQrisOrderData({ order_number: createJson.data.order_number, queue_number: createJson.data.queue_number, total: createJson.data.total })
      setQrisString(checkoutJson.data.qris_string)

      // 3. Mulai polling status setiap 3 detik
      setQrisPolling(true)
      qrisTimerRef.current = setInterval(async () => {
        const r = await fetch(`/api/v1/orders/${orderId}`).catch(() => null)
        if (!r?.ok) return
        const j = await r.json()
        const status = j.data?.status
        if (status === 'paid' || status === 'in_production' || status === 'ready' || status === 'completed') {
          stopQrisPolling()
          setQrisPolling(false)
          setQrisString(null)
          setSuccessData({
            id: orderId, order_number: createJson.data.order_number,
            queue_number: createJson.data.queue_number,
            total: createJson.data.total, method: 'qris',
          })
          setPayModalOpen(false)
          setScreen('success')
        }
      }, 3000)
    } catch {
      setErrorMsg('Koneksi gagal. Coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  function openPayModal() {
    if (cart.length === 0) return
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
          driver_id:      driverId || null,
          customer_name:  custName || null,
          customer_phone: custPhone || null,
          discount,
          items: cart.map(i => ({
            product_id:          i.product.id,
            qty:                 i.qty,
            unit_price:          i.unit_price,
            is_custom:           i.is_custom,
            customization_notes: i.customization_notes || null,
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

  const inputCls = 'h-10 rounded-md border border-line-strong px-3 text-sm text-ink-900 focus:outline-none focus:border-pine-400 focus:ring-2 focus:ring-pine-100'

  // ── SUCCESS SCREEN ─────────────────────────────────────────────────────────

  if (screen === 'success' && successData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-sand-50 px-4 py-12">
        <div className="bg-white rounded-xl border border-line shadow-md max-w-sm w-full p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-success-bg border border-success-bd flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-xs text-ink-400 uppercase tracking-widest mb-1">Pembayaran Berhasil</p>
          <h2 className="font-display text-[32px] text-pine leading-none">#{successData.queue_number}</h2>
          <p className="text-sm text-ink-400 mt-1">No. antrian hari ini</p>

          <div className="mt-6 rounded-lg bg-sand-100 border border-line p-4 text-left space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-ink-500">No. Order</span>
              <span className="font-mono font-medium text-ink-900">{successData.order_number}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-ink-500">Total</span>
              <span className="font-semibold text-ink-900">{formatRp(successData.total)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-ink-500">Metode</span>
              <span className="text-ink-700">{METHOD_LABEL[successData.method]}</span>
            </div>
          </div>

          <div className="flex gap-2 mt-6">
            <a
              href={`/print/receipt/${successData.id}`}
              target="_blank" rel="noreferrer"
              className="flex-1 h-11 rounded-md border border-line-strong text-sm font-medium text-ink-700 hover:bg-sand-50 flex items-center justify-center"
            >
              Cetak Struk
            </a>
            <button
              onClick={() => { clearCart(); router.refresh() }}
              className="flex-1 h-11 rounded-md bg-pine text-white font-medium hover:bg-pine-700 transition-colors"
            >
              Transaksi Baru
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── POS LAYOUT ─────────────────────────────────────────────────────────────

  return (
    <div className="h-[calc(100vh-56px)] flex flex-col lg:flex-row overflow-hidden">

      {/* ── LEFT: Product grid ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Toolbar */}
        <div className="bg-white border-b border-line px-3 py-2 flex gap-2 flex-wrap items-center">
          {branches.length > 0 && (
            <select className={`${inputCls} text-xs h-8`} value={branchId}
              onChange={e => router.push(`${pathname}?branch=${e.target.value}`)}>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          <input
            className={`${inputCls} flex-1 min-w-[140px] h-8 text-xs`}
            placeholder="Cari produk atau SKU…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {categories.length > 2 && (
            <div className="flex gap-1 flex-wrap">
              {categories.map(cat => (
                <button key={cat} onClick={() => setCategory(cat)}
                  className={`h-7 px-2.5 rounded-full text-xs font-medium transition-colors ${
                    category === cat
                      ? 'bg-pine text-white'
                      : 'bg-sand-100 text-ink-600 hover:bg-sand-200'
                  }`}>
                  {cat === 'semua' ? 'Semua' : cat}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 p-3 content-start">
          {filteredProducts.length === 0 && (
            <div className="col-span-4 py-16 text-center text-ink-400 text-sm">
              Tidak ada produk ditemukan.
            </div>
          )}
          {filteredProducts.map(product => {
            const stock = stockMap[product.id] ?? null
            const cartItem = cart.find(i => i.product.id === product.id)
            const isOutOfStock = product.type === 'ready_stock' && stock !== null && stock <= 0

            return (
              <button
                key={product.id}
                onClick={() => !isOutOfStock && addToCart(product)}
                disabled={isOutOfStock}
                aria-label={cartItem ? `${product.name}, ${cartItem.qty} di keranjang` : product.name}
                className={[
                  'relative rounded-lg text-left transition-all duration-150 shadow-sm',
                  cartItem ? 'border border-pine bg-pine-50' : 'border border-line bg-white',
                  isOutOfStock
                    ? 'opacity-40 cursor-not-allowed'
                    : 'hover:border-pine-300 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.97] active:shadow-sm',
                ].join(' ')}
              >
                {/* Gambar 4:3 */}
                <div className="relative w-full aspect-[4/3] rounded-t-lg overflow-hidden">
                  {product.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-sand-100 flex items-center justify-center">
                      <div className="absolute inset-0 flex items-center justify-center text-sand-300">
                        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <rect x="10" y="14" width="12" height="14" rx="2" fill="currentColor"/>
                          <rect x="13" y="10" width="6" height="5" rx="1" fill="currentColor"/>
                          <rect x="12" y="8" width="8" height="3" rx="1" fill="currentColor"/>
                          <circle cx="16" cy="7" r="2" fill="currentColor"/>
                        </svg>
                      </div>
                    </div>
                  )}

                  {/* Badge tipe */}
                  <span className={`absolute top-2 left-2 text-[10px] px-1.5 py-0.5 rounded-full font-medium border ${
                    product.type === 'custom_racik'
                      ? 'bg-rust-50 border-rust-100 text-rust'
                      : 'bg-pine-50 border-pine-100 text-pine'
                  }`}>
                    {product.type === 'custom_racik' ? 'Racik' : 'Ready'}
                  </span>

                  {/* Qty badge */}
                  {cartItem && (
                    <span className="absolute top-2 right-2 min-w-[22px] h-[22px] rounded-full bg-rust text-white text-[11px] font-bold flex items-center justify-center px-1.5">
                      {cartItem.qty}
                    </span>
                  )}
                </div>

                {/* Teks */}
                <div className="px-3 pt-2.5 pb-3">
                  <p className="text-[13px] font-medium text-ink-900 leading-snug line-clamp-2">{product.name}</p>
                  <p className="text-[11px] text-ink-400 font-mono mt-0.5">{product.sku}</p>
                  <div className="mt-2 mb-2 border-t border-line" />
                  <div className="flex justify-between items-end">
                    <p className="text-sm font-semibold text-pine">{formatRp(product.price)}</p>
                    {product.type === 'ready_stock' && stock !== null && (
                      <p className={`text-[11px] ${
                        stock <= 0 ? 'text-danger' : stock <= 5 ? 'text-warning font-medium' : 'text-ink-400'
                      }`}>
                        {stock <= 0 ? 'Habis' : stock}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── RIGHT: Cart panel (desktop) ─────────────────────────────────────── */}
      <div className="hidden lg:flex lg:flex-col lg:w-80 xl:w-96 bg-white border-l border-line">
        <CartPanel
          cart={cart} subtotal={subtotal} discount={discount} total={total}
          driverId={driverId} custName={custName} custPhone={custPhone}
          drivers={drivers} selectedDriver={selectedDriver}
          setDiscount={setDiscount} setDriverId={setDriverId}
          setCustName={setCustName} setCustPhone={setCustPhone}
          updateQty={updateQty} removeItem={removeItem}
          onCheckout={openPayModal}
          inputCls={inputCls}
        />
      </div>

      {/* ── MOBILE: Cart button + drawer ────────────────────────────────────── */}
      {cartCount > 0 && !cartOpen && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 p-3 bg-white border-t border-line shadow-lg z-30">
          <button
            onClick={() => setCartOpen(true)}
            className="w-full h-12 rounded-lg bg-pine text-white font-medium flex items-center justify-between px-4"
          >
            <span className="bg-white text-pine text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
              {cartCount}
            </span>
            <span>Lihat Keranjang</span>
            <span className="font-semibold">{formatRp(total)}</span>
          </button>
        </div>
      )}

      {/* Mobile Cart Drawer */}
      {cartOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex flex-col">
          <button className="flex-1 bg-black/30" onClick={() => setCartOpen(false)} />
          <div className="bg-white rounded-t-2xl shadow-xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-line">
              <h2 className="font-semibold text-ink-900">Keranjang</h2>
              <button onClick={() => setCartOpen(false)} className="text-ink-400 p-1">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4l12 12M4 16L16 4" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <CartPanel
                cart={cart} subtotal={subtotal} discount={discount} total={total}
                driverId={driverId} custName={custName} custPhone={custPhone}
                drivers={drivers} selectedDriver={selectedDriver}
                setDiscount={setDiscount} setDriverId={setDriverId}
                setCustName={setCustName} setCustPhone={setCustPhone}
                updateQty={updateQty} removeItem={removeItem}
                onCheckout={openPayModal}
                inputCls={inputCls}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Custom Racik Modal ──────────────────────────────────────────────── */}
      {customProduct && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <button className="absolute inset-0 bg-black/40" onClick={() => setCustomProduct(null)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-5">
            <h3 className="font-semibold text-ink-900 mb-1">{customProduct.name}</h3>
            <p className="text-xs text-rust mb-3">Produk Racik — masukkan catatan kustomisasi</p>
            <label className="text-sm font-medium text-ink-700 block mb-1.5">Catatan untuk peracik</label>
            <textarea
              className="w-full rounded-md border border-line-strong px-3 py-2 text-sm text-ink-900 resize-none focus:outline-none focus:border-pine-400 focus:ring-2 focus:ring-pine-100"
              rows={3}
              placeholder="mis. lebih woody, kurangi bunga, tambah vanilla…"
              value={customNotes}
              onChange={e => setCustomNotes(e.target.value)}
            />
            <div className="flex gap-2 mt-4">
              <button onClick={() => setCustomProduct(null)}
                className="flex-1 h-10 rounded-md border border-line-strong text-sm font-medium text-ink-700 hover:bg-sand-50">
                Batal
              </button>
              <button onClick={addCustomToCart}
                className="flex-1 h-10 rounded-md bg-rust text-white text-sm font-medium hover:bg-rust-600">
                Tambah ke Keranjang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Payment Method Modal ────────────────────────────────────────────── */}
      {payModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <button className="absolute inset-0 bg-black/40" onClick={() => setPayModalOpen(false)} />
          <div className="relative bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-md flex flex-col max-h-[92vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-line flex-shrink-0">
              <div>
                <h3 className="font-semibold text-ink-900">Pilih Metode Pembayaran</h3>
                <p className="text-xs text-ink-400 mt-0.5">Total: <span className="font-semibold text-pine">{formatRp(total)}</span></p>
              </div>
              <button onClick={() => setPayModalOpen(false)} className="text-ink-400 p-1">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4l12 12M4 16L16 4" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-4 space-y-3">
              {/* Method grid */}
              <div className="grid grid-cols-3 gap-2">
                {(['cash', 'debit_card', 'credit_card', 'bank_transfer', 'qris'] as PaymentMethod[]).map(m => (
                  <button
                    key={m}
                    onClick={() => { setPayMethod(m); setEdcMachineId('') }}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border-2 px-2 py-3 transition-all ${
                      payMethod === m
                        ? 'border-pine bg-pine-50 text-pine'
                        : 'border-line text-ink-600 hover:border-pine-200 hover:bg-sand-50'
                    }`}
                  >
                    <span className="text-xl">{METHOD_ICON[m]}</span>
                    <span className="text-[11px] font-medium leading-tight text-center">{METHOD_LABEL[m]}</span>
                  </button>
                ))}
              </div>

              {/* EDC Machine selector (debit/credit) */}
              {needsEdc && (
                <div className="mt-1">
                  <p className="text-sm font-medium text-ink-700 mb-2">Pilih Mesin EDC</p>
                  {edcMachines.length === 0 ? (
                    <p className="text-xs text-warning bg-warning-bg border border-warning-bd rounded-md px-3 py-2">
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

              {/* QRIS display */}
              {payMethod === 'qris' && (
                <div className="flex flex-col items-center gap-3 pt-1">
                  {qrisString ? (
                    <>
                      {/* Dynamic QR via canvas — render qris_string as QR code */}
                      <div className="border-2 border-pine-100 rounded-xl p-3 bg-white text-center">
                        <p className="text-xs text-ink-400 mb-2 font-mono break-all max-w-[200px]">
                          {/* Show as text fallback; in production pair with a QR lib */}
                          QR Data aktif
                        </p>
                        <div className="w-48 h-48 rounded-lg border border-pine-100 bg-sand-50 flex flex-col items-center justify-center gap-2">
                          {qrisPolling && (
                            <svg className="w-6 h-6 text-pine animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                            </svg>
                          )}
                          <p className="text-xs text-ink-500 text-center px-2">
                            {qrisPolling ? 'Menunggu pembayaran...' : 'QR siap di-scan'}
                          </p>
                          <p className="text-[10px] text-ink-400 font-mono text-center px-2 break-all">
                            {qrisString.slice(0, 40)}…
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-ink-500 text-center">
                        Minta pelanggan scan QRIS,<br/>pembayaran otomatis terkonfirmasi.
                      </p>
                      {qrisOrderData && (
                        <p className="text-xs text-pine font-medium">
                          Order #{qrisOrderData.order_number} · {formatRp(qrisOrderData.total)}
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      {qrisImageUrl ? (
                        <div className="border-2 border-pine-100 rounded-xl p-3 bg-white">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={qrisImageUrl} alt="QRIS Scentsored" width={200} height={200} className="block" />
                        </div>
                      ) : (
                        <div className="w-48 h-48 rounded-xl border-2 border-dashed border-line flex items-center justify-center text-ink-300 text-sm">
                          Klik Buat QRIS
                        </div>
                      )}
                      <p className="text-xs text-ink-500 text-center">
                        Tekan <strong>Buat QRIS</strong> untuk generate QR dinamis,<br/>atau gunakan QR statis cabang di atas.
                      </p>
                    </>
                  )}
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
                <p className="text-xs text-danger bg-danger-bg border border-danger-bd rounded-md px-2.5 py-2">{errorMsg}</p>
              )}
            </div>

            {/* Footer: confirm button */}
            <div className="px-4 pb-4 pt-2 border-t border-line flex-shrink-0 space-y-2">
              {payMethod === 'qris' && !qrisString && (
                <button
                  onClick={handleQrisGenerate}
                  disabled={loading}
                  className="w-full h-12 rounded-xl bg-pine text-white font-semibold text-sm hover:bg-pine-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Membuat QRIS…' : `Buat QRIS · ${formatRp(total)}`}
                </button>
              )}
              {payMethod === 'qris' && qrisString && (
                <button
                  onClick={() => { stopQrisPolling(); setQrisString(null); setQrisPolling(false); setQrisOrderId(null) }}
                  className="w-full h-10 rounded-xl border border-line text-ink-500 text-sm hover:bg-sand-50"
                >
                  Batalkan & Buat Ulang
                </button>
              )}
              {payMethod !== 'qris' && (
                <button
                  onClick={handlePay}
                  disabled={!canConfirm || loading}
                  className="w-full h-12 rounded-xl bg-pine text-white font-semibold text-sm hover:bg-pine-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {loading
                    ? 'Memproses…'
                    : payMethod
                      ? `Konfirmasi ${METHOD_LABEL[payMethod]} · ${formatRp(total)}`
                      : 'Pilih metode pembayaran'}
                </button>
              )}
            </div>
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
  driverId:       string
  custName:       string
  custPhone:      string
  drivers:        Driver[]
  selectedDriver: Driver | undefined
  setDiscount:    (v: number) => void
  setDriverId:    (v: string) => void
  setCustName:    (v: string) => void
  setCustPhone:   (v: string) => void
  updateQty:      (idx: number, delta: number) => void
  removeItem:     (idx: number) => void
  onCheckout:     () => void
  inputCls:       string
}

function CartPanel({
  cart, subtotal, discount, total,
  driverId, custName, custPhone,
  drivers, selectedDriver,
  setDiscount, setDriverId, setCustName, setCustPhone,
  updateQty, removeItem, onCheckout,
  inputCls,
}: CartPanelProps) {
  const isEmpty = cart.length === 0

  return (
    <div className="flex flex-col h-full">
      {/* Items list */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        {isEmpty && (
          <div className="py-12 text-center text-ink-400 text-sm">
            <p className="text-3xl mb-2">🛒</p>
            <p>Keranjang kosong.</p>
            <p className="text-xs mt-1">Tap produk untuk menambahkan.</p>
          </div>
        )}
        {cart.map((item, idx) => (
          <div key={idx} className="flex items-start gap-2 py-2 border-b border-line last:border-0">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-ink-900 leading-snug">{item.product.name}</p>
              {item.is_custom && item.customization_notes && (
                <p className="text-xs text-rust mt-0.5 italic truncate">{item.customization_notes}</p>
              )}
              <p className="text-xs text-ink-400 mt-0.5">{formatRp(item.unit_price)}</p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button onClick={() => updateQty(idx, -1)}
                className="w-6 h-6 rounded-md bg-sand-100 text-ink-700 text-base font-medium hover:bg-sand-200 flex items-center justify-center leading-none">
                −
              </button>
              <span className="w-6 text-center text-sm font-medium tabular-nums">{item.qty}</span>
              <button onClick={() => updateQty(idx, +1)}
                className="w-6 h-6 rounded-md bg-sand-100 text-ink-700 text-base font-medium hover:bg-sand-200 flex items-center justify-center leading-none">
                +
              </button>
              <button onClick={() => removeItem(idx)} className="ml-1 text-ink-300 hover:text-danger">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M4 4l8 8M4 12L12 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      {!isEmpty && (
        <div className="border-t border-line px-3 py-3 space-y-2.5 bg-white">
          {/* Customer */}
          <div className="grid grid-cols-2 gap-2">
            <input className={`${inputCls} h-9 text-xs`} placeholder="Nama pelanggan"
              value={custName} onChange={e => setCustName(e.target.value)} />
            <input className={`${inputCls} h-9 text-xs`} placeholder="No. HP (opsional)"
              type="tel" value={custPhone} onChange={e => setCustPhone(e.target.value)} />
          </div>

          {/* Driver */}
          {drivers.length > 0 && (
            <select className={`${inputCls} w-full h-9 text-xs`} value={driverId}
              onChange={e => setDriverId(e.target.value)}>
              <option value="">— Tanpa driver —</option>
              {drivers.map(d => (
                <option key={d.id} value={d.id}>{d.name} ({d.fee_value}%)</option>
              ))}
            </select>
          )}

          {/* Discount */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-ink-500 whitespace-nowrap">Diskon (Rp)</label>
            <input className={`${inputCls} flex-1 h-9 text-xs`} type="number" min={0}
              value={discount || ''} placeholder="0"
              onChange={e => setDiscount(Math.max(0, parseInt(e.target.value) || 0))} />
          </div>

          {/* Totals */}
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-ink-500">
              <span>Subtotal</span>
              <span className="tabular-nums">{formatRp(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-success">
                <span>Diskon</span>
                <span className="tabular-nums">−{formatRp(discount)}</span>
              </div>
            )}
            {selectedDriver && (
              <div className="flex justify-between text-ink-400 text-xs">
                <span>Fee {selectedDriver.name} ({selectedDriver.fee_value}%)</span>
                <span className="tabular-nums">{formatRp(Math.round(total * selectedDriver.fee_value / 100))}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-ink-900 pt-1 border-t border-line-strong">
              <span>Total</span>
              <span className="tabular-nums">{formatRp(total)}</span>
            </div>
          </div>

          {/* Checkout → open payment modal */}
          <button
            onClick={onCheckout}
            className="w-full h-11 rounded-lg bg-pine text-white font-medium text-sm hover:bg-pine-700 transition-colors"
          >
            Lanjut Bayar · {formatRp(total)}
          </button>
        </div>
      )}
    </div>
  )
}
