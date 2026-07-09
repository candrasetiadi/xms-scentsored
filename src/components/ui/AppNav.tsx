'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { BrandLogo } from './BrandLogo'
import { createClient } from '@/lib/supabase/client'
import type { Role } from '@/types/domain'

interface NavItem { label: string; href: string; roles: Role[] }

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',   href: '/dashboard',        roles: ['owner', 'admin', 'cashier', 'perfumer', 'stock_keeper'] },
  { label: 'POS',         href: '/pos',              roles: ['owner', 'admin', 'cashier'] },
  { label: 'Riwayat',     href: '/pos/history',      roles: ['owner', 'admin', 'cashier'] },
  { label: 'Inventory',   href: '/inventory',        roles: ['owner', 'admin', 'stock_keeper'] },
  { label: 'Produksi',    href: '/production',       roles: ['owner', 'admin', 'perfumer'] },
  { label: 'Procurement', href: '/procurement',      roles: ['owner', 'admin', 'stock_keeper'] },
  { label: 'Komisi',      href: '/admin/commissions',   roles: ['owner', 'admin'] },
  { label: 'Laporan',     href: '/reporting',           roles: ['owner', 'admin'] },
  { label: 'Custom Perfume Schedule', href: '/admin/slots', roles: ['owner', 'admin'] },
  { label: 'Master Data', href: '/admin/products',   roles: ['owner', 'admin', 'stock_keeper'] },
  { label: 'Workshop',    href: '/admin/workshop',   roles: ['owner', 'admin', 'cashier', 'perfumer', 'stock_keeper'] },
  { label: 'SDM',         href: '/hr',               roles: ['owner', 'admin', 'cashier', 'perfumer', 'stock_keeper'] },
]

// Halaman-halaman yang masuk ke dalam Master Data (sub-nav /admin/*)
const MASTER_DATA_PREFIXES = [
  '/admin/products', '/admin/raw-materials', '/admin/workshop-materials',
  '/admin/recipes', '/admin/suppliers', '/admin/drivers',
  '/admin/travel-agencies', '/admin/customers',
]

function isNavActive(pathname: string, href: string): boolean {
  // POS: hanya exact /pos — jangan match /pos/history
  if (href === '/pos') return pathname === '/pos'
  // Master Data: aktif untuk semua halaman master data, bukan /admin/commissions, /admin/slots, /admin/workshop
  if (href === '/admin/products')
    return MASTER_DATA_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))
  // Default: exact match atau sub-path
  return pathname === href || pathname.startsWith(href + '/')
}

const ROLE_LABEL: Record<Role, string> = {
  owner: 'Owner', admin: 'Admin', cashier: 'Kasir',
  perfumer: 'Peracik', stock_keeper: 'Stock Keeper',
}

// Roles that receive notifications (per CLAUDE.md rule #8)
const NOTIF_ROLES: Role[] = ['owner', 'admin', 'stock_keeper']

// ── Notification types ────────────────────────────────────────────────────────

interface Notification {
  id:             string
  type:           string
  severity:       'low' | 'critical'
  title:          string
  body:           string
  reference_type: string | null
  reference_id:   string | null
  resolved_at:    string | null
  created_at:     string
  is_read:        boolean
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'baru saja'
  if (m < 60) return `${m} mnt lalu`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} jam lalu`
  return `${Math.floor(h / 24)} hari lalu`
}

// ── NotificationBell ──────────────────────────────────────────────────────────

interface BellProps {
  branchId: string | null
}

function NotificationBell({ branchId }: BellProps) {
  const [notifs,    setNotifs]    = useState<Notification[]>([])
  const [open,      setOpen]      = useState(false)
  const [loading,   setLoading]   = useState(false)
  const dropRef                   = useRef<HTMLDivElement>(null)

  const fetchNotifs = useCallback(async () => {
    if (!branchId) return
    setLoading(true)
    try {
      const res  = await fetch(`/api/v1/notifications?unread_only=false&limit=20&branch_id=${branchId}`)
      const json = await res.json()
      if (json.data) setNotifs(json.data)
    } catch {
      // silent — bell is non-critical
    } finally {
      setLoading(false)
    }
  }, [branchId])

  // Fetch awal + polling 30 detik
  useEffect(() => {
    if (!branchId) return
    fetchNotifs()
    const interval = setInterval(fetchNotifs, 30_000)
    return () => clearInterval(interval)
  }, [branchId, fetchNotifs])

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  async function markRead(id: string) {
    await fetch(`/api/v1/notifications/${id}/read`, { method: 'POST' })
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
  }

  async function markAllRead() {
    const unread = notifs.filter(n => !n.is_read)
    await Promise.all(unread.map(n => fetch(`/api/v1/notifications/${n.id}/read`, { method: 'POST' })))
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  const unreadCount = notifs.filter(n => !n.is_read).length

  return (
    <div className="relative" ref={dropRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Notifikasi"
        className="relative p-2 rounded-md text-ink-400 hover:text-ink-900 hover:bg-sand-100 transition-colors"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 2a5 5 0 0 1 5 5v2.5l1.5 2.5H2.5L4 9.5V7a5 5 0 0 1 5-5Z" />
          <path d="M7 14.5a2 2 0 0 0 4 0" />
        </svg>
        {unreadCount > 0 && (
          <span
            aria-label={`${unreadCount} notifikasi belum dibaca`}
            className="absolute top-1 right-1 min-w-[16px] h-4 px-0.5 rounded-full bg-danger text-white text-[10px] font-bold leading-4 text-center"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 mt-1 w-80 bg-white rounded-xl border border-line shadow-lg z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-line">
            <span className="text-sm font-semibold text-ink-900">Notifikasi</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-pine hover:underline"
              >
                Tandai semua dibaca
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-line">
            {loading && notifs.length === 0 ? (
              <div className="px-4 py-6 text-center text-ink-400 text-sm">Memuat…</div>
            ) : notifs.length === 0 ? (
              <div className="px-4 py-6 text-center text-ink-400 text-sm">Tidak ada notifikasi</div>
            ) : (
              notifs.map(n => (
                <button
                  key={n.id}
                  onClick={() => markRead(n.id)}
                  className={[
                    'w-full text-left px-4 py-3 transition-colors hover:bg-sand-50',
                    !n.is_read ? 'bg-pine-50/50' : '',
                  ].join(' ')}
                >
                  <div className="flex items-start gap-2.5">
                    {/* Severity dot */}
                    <span
                      className={[
                        'mt-1 w-2 h-2 rounded-full shrink-0',
                        n.severity === 'critical' ? 'bg-danger' : 'bg-warning',
                      ].join(' ')}
                    />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-snug ${!n.is_read ? 'font-semibold text-ink-900' : 'text-ink-700'}`}>
                        {n.title}
                      </p>
                      <p className="text-xs text-ink-400 mt-0.5 leading-snug line-clamp-2">{n.body}</p>
                      <p className="text-[10px] text-ink-300 mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                    {!n.is_read && (
                      <span className="mt-1.5 w-2 h-2 rounded-full bg-pine shrink-0" aria-hidden="true" />
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── AppNav ─────────────────────────────────────────────────────────────────────

interface AppNavProps {
  staffName: string
  role: Role
  branchName: string | null
  branchId?: string | null
}

export function AppNav({ staffName, role, branchName, branchId = null }: AppNavProps) {
  const pathname  = usePathname()
  const router    = useRouter()
  const [open, setOpen] = useState(false)

  const visibleItems = NAV_ITEMS.filter(item => item.roles.includes(role))
  const showBell     = NOTIF_ROLES.includes(role)

  // Change password
  const [showPw,   setShowPw]   = useState(false)
  const [pw,       setPw]       = useState({ newPw: '', confirmPw: '' })
  const [pwSaving, setPwSaving] = useState(false)
  const [pwError,  setPwError]  = useState('')
  const [pwOk,     setPwOk]     = useState(false)

  function openChangePw() {
    setPw({ newPw: '', confirmPw: '' })
    setPwError(''); setPwOk(false); setShowPw(true); setOpen(false)
  }

  async function handleChangePw() {
    if (pw.newPw.length < 6) { setPwError('Password minimal 6 karakter.'); return }
    if (pw.newPw !== pw.confirmPw) { setPwError('Password tidak cocok.'); return }
    setPwSaving(true); setPwError('')
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: pw.newPw })
    setPwSaving(false)
    if (error) { setPwError(error.message); return }
    setPwOk(true)
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const inputCls = 'w-full h-10 rounded-lg border border-line-strong px-3 text-sm text-ink-900 focus:outline-none focus:border-pine-400 focus:ring-2 focus:ring-pine-100'

  return (
    <header className="bg-white border-b border-line sticky top-0 z-40">
      <div className="px-4 h-14 flex items-center gap-4">
        <BrandLogo variant="light" size="sm" className="shrink-0" />

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1 ml-4 flex-1">
          {visibleItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={[
                'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                isNavActive(pathname, item.href)
                  ? 'bg-pine-50 text-pine'
                  : 'text-ink-500 hover:text-ink-900 hover:bg-sand-100',
              ].join(' ')}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Desktop user info */}
        <div className="hidden md:flex items-center gap-2.5 ml-auto">
          {showBell && <NotificationBell branchId={branchId} />}

          {/* Divider */}
          <div className="w-px h-6 bg-line shrink-0" aria-hidden="true" />

          {/* Avatar */}
          <div
            aria-hidden="true"
            className="w-8 h-8 rounded-full bg-pine-100 text-pine flex items-center justify-center text-sm font-semibold leading-none select-none shrink-0"
          >
            {staffName.charAt(0).toUpperCase()}
          </div>

          {/* Name + role */}
          <div className="text-right">
            <p className="text-sm font-semibold text-ink-900 leading-none">{staffName}</p>
            <p className="text-xs text-ink-400 mt-0.5 leading-none">
              {ROLE_LABEL[role]}{branchName ? ` · ${branchName}` : ''}
            </p>
          </div>

          {/* Divider */}
          <div className="w-px h-6 bg-line shrink-0" aria-hidden="true" />

          {/* Change password button */}
          <button
            onClick={openChangePw}
            title="Ganti Password"
            className="p-1.5 rounded-md text-ink-400 hover:text-pine hover:bg-pine-50 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="7" width="10" height="7" rx="1.5"/>
              <path d="M5 7V5a3 3 0 0 1 6 0v2"/>
            </svg>
          </button>

          {/* Logout button */}
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium text-ink-500 border border-line hover:border-danger-bd hover:text-danger hover:bg-danger-bg transition-colors"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 2H2.5A.5.5 0 0 0 2 2.5v9a.5.5 0 0 0 .5.5H5" />
              <path d="M9.5 4.5L12 7l-2.5 2.5" />
              <path d="M12 7H5.5" />
            </svg>
            Keluar
          </button>
        </div>

        {/* Mobile: bell + hamburger */}
        <div className="md:hidden ml-auto flex items-center gap-1">
          {showBell && <NotificationBell branchId={branchId} />}
          <button
            onClick={() => setOpen(o => !o)}
            aria-label="Menu"
            className="p-2 rounded-md text-ink-500 hover:bg-sand-100"
          >
            {open ? (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4l12 12M4 16L16 4" strokeLinecap="round"/>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 5h14M3 10h14M3 15h14" strokeLinecap="round"/>
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-line bg-white px-4 py-3 flex flex-col gap-1">
          {visibleItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={[
                'px-3 py-2.5 rounded-md text-sm font-medium transition-colors',
                isNavActive(pathname, item.href)
                  ? 'bg-pine-50 text-pine'
                  : 'text-ink-700 hover:bg-sand-100',
              ].join(' ')}
            >
              {item.label}
            </Link>
          ))}
          <div className="mt-2 pt-2 border-t border-line flex items-center justify-between gap-3">
            {/* Avatar + name */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                aria-hidden="true"
                className="w-8 h-8 rounded-full bg-pine-100 text-pine flex items-center justify-center text-sm font-semibold leading-none select-none shrink-0"
              >
                {staffName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink-900 truncate">{staffName}</p>
                <p className="text-xs text-ink-400 truncate">
                  {ROLE_LABEL[role]}{branchName ? ` · ${branchName}` : ''}
                </p>
              </div>
            </div>

            {/* Change password + Logout */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={openChangePw}
                title="Ganti Password"
                className="p-1.5 rounded-md text-ink-400 hover:text-pine hover:bg-pine-50 transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="7" width="10" height="7" rx="1.5"/>
                  <path d="M5 7V5a3 3 0 0 1 6 0v2"/>
                </svg>
              </button>
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium text-ink-500 border border-line hover:border-danger-bd hover:text-danger hover:bg-danger-bg transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 2H2.5A.5.5 0 0 0 2 2.5v9a.5.5 0 0 0 .5.5H5" />
                  <path d="M9.5 4.5L12 7l-2.5 2.5" />
                  <path d="M12 7H5.5" />
                </svg>
                Keluar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Change Password Modal ─────────────────────────────────────── */}
      {showPw && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/40">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-line">
              <h2 className="font-semibold text-ink-900">Ganti Password</h2>
              <p className="text-xs text-ink-400 mt-0.5">Password baru minimal 6 karakter</p>
            </div>

            {pwOk ? (
              <div className="px-6 py-8 text-center">
                <p className="text-success font-semibold mb-1">Password berhasil diubah!</p>
                <p className="text-xs text-ink-400 mb-4">Gunakan password baru saat login berikutnya.</p>
                <button
                  onClick={() => setShowPw(false)}
                  className="h-10 px-6 rounded-lg bg-pine text-white text-sm font-medium hover:bg-pine-600 transition-colors"
                >
                  Tutup
                </button>
              </div>
            ) : (
              <>
                <div className="px-6 py-5 space-y-4">
                  <div>
                    <label className="text-xs font-medium text-ink-600 block mb-1">Password Baru *</label>
                    <input
                      type="password"
                      value={pw.newPw}
                      onChange={e => setPw(p => ({ ...p, newPw: e.target.value }))}
                      placeholder="Minimal 6 karakter"
                      className={inputCls}
                      autoComplete="new-password"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-ink-600 block mb-1">Konfirmasi Password *</label>
                    <input
                      type="password"
                      value={pw.confirmPw}
                      onChange={e => setPw(p => ({ ...p, confirmPw: e.target.value }))}
                      placeholder="Ulangi password baru"
                      className={inputCls}
                      autoComplete="new-password"
                    />
                  </div>
                  {pwError && (
                    <p className="text-sm text-danger bg-danger-bg border border-danger-bd rounded-lg px-3 py-2">{pwError}</p>
                  )}
                </div>
                <div className="px-6 pb-5 flex gap-2">
                  <button
                    onClick={() => setShowPw(false)}
                    disabled={pwSaving}
                    className="flex-1 h-10 rounded-lg border border-line text-sm font-medium text-ink-700 hover:bg-sand-50 transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleChangePw}
                    disabled={pwSaving}
                    className="flex-1 h-10 rounded-lg bg-pine text-white text-sm font-medium hover:bg-pine-600 disabled:opacity-50 transition-colors"
                  >
                    {pwSaving ? 'Menyimpan...' : 'Simpan'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
