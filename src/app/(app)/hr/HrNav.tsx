'use client'

import Link      from 'next/link'
import { usePathname } from 'next/navigation'

interface NavItem {
  label: string
  href:  string
  icon:  React.ReactNode
  admin: boolean
}

function ClockIcon()    { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M8 5v3l2 2"/></svg> }
function OvertimeIcon() { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 2v4l3 3"/><circle cx="8" cy="8" r="6"/><path d="M12 12l2 2"/></svg> }
function LeaveIcon()    { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="4" width="12" height="10" rx="1"/><path d="M5 2v3M11 2v3M2 8h12"/></svg> }
function PayslipIcon()  { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="2" width="10" height="12" rx="1"/><path d="M5 6h6M5 9h4M5 12h3"/></svg> }
function UsersIcon()    { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="6" cy="5" r="2.5"/><path d="M1 14c0-2.8 2.2-5 5-5s5 2.2 5 5"/><circle cx="12" cy="5" r="2"/><path d="M14 13c0-1.7-1.2-3.2-3-3.7"/></svg> }
function ShiftIcon()    { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="1" y="3" width="14" height="10" rx="1"/><path d="M1 7h14M5 3v10M11 3v10"/></svg> }
function SalaryIcon()   { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M8 5v1.5M8 9.5V11M6.5 7A1.5 1.5 0 0 1 8 5.5h0A1.5 1.5 0 0 1 9.5 7h0A1.5 1.5 0 0 1 8 8.5h0A1.5 1.5 0 0 1 9.5 10"/></svg> }
function PayrollIcon()  { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 4h12M2 8h8M2 12h5"/><path d="M11 9l2 2 3-3"/></svg> }
function SettingIcon()  { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="2.5"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6L13 13M3 13l1.4-1.4M11.6 4.4L13 3"/></svg> }
function VendorIcon()   { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 13V6l6-4 6 4v7"/><path d="M6 13V9h4v4"/><rect x="6" y="3" width="4" height="3" rx="0.5"/></svg> }
function VendorPayIcon(){ return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="1" y="4" width="14" height="9" rx="1"/><path d="M1 7h14"/><circle cx="8" cy="10.5" r="1.5"/></svg> }

const STAFF_ITEMS: NavItem[] = [
  { label: 'Absensi Saya', href: '/hr/attendance',        icon: <ClockIcon />,   admin: false },
  { label: 'Lembur',        href: '/hr/overtime',          icon: <OvertimeIcon />, admin: false },
  { label: 'Cuti',           href: '/hr/leave',             icon: <LeaveIcon />,   admin: false },
  { label: 'Slip Gaji',     href: '/hr/payslips',          icon: <PayslipIcon />, admin: false },
]

const ADMIN_ITEMS: NavItem[] = [
  { label: 'Rekap Absensi', href: '/hr/attendance/admin', icon: <UsersIcon />,   admin: true },
  { label: 'Lembur',        href: '/hr/overtime',          icon: <OvertimeIcon />, admin: true },
  { label: 'Cuti',           href: '/hr/leave',             icon: <LeaveIcon />,   admin: true },
  { label: 'Shift & Jadwal',href: '/hr/shifts',            icon: <ShiftIcon />,   admin: true },
  { label: 'Komponen Gaji', href: '/hr/salary',            icon: <SalaryIcon />,    admin: true },
  { label: 'Payroll',        href: '/hr/payroll',           icon: <PayrollIcon />,  admin: true },
  { label: 'Vendor',         href: '/hr/vendors',           icon: <VendorIcon />,   admin: true },
  { label: 'Pengaturan SDM',href: '/hr/settings',          icon: <SettingIcon />,  admin: true },
]

interface Props {
  role:     string
  staffId:  string
  branchId: string | null
  mobile?:  boolean
}

export function HrNav({ role, mobile }: Props) {
  const pathname = usePathname()
  const isAdmin  = role === 'owner' || role === 'admin'
  const items    = isAdmin ? ADMIN_ITEMS : STAFF_ITEMS

  function isActive(href: string) {
    if (href === '/hr/attendance' && pathname === '/hr/attendance') return true
    if (href === '/hr/attendance/admin' && pathname.startsWith('/hr/attendance')) return true
    return pathname.startsWith(href) && href !== '/hr/attendance'
  }

  if (mobile) {
    if (isAdmin) return null // admin uses desktop sidebar only
    return (
      <nav
        aria-label="SDM navigasi mobile"
        className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-line z-30 safe-bottom"
      >
        <div className="flex">
          {STAFF_ITEMS.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={[
                'flex-1 flex flex-col items-center gap-1 py-2 text-[10px] font-sans font-medium transition-colors',
                isActive(item.href) ? 'text-pine' : 'text-ink-400 hover:text-ink-700',
              ].join(' ')}
              aria-current={isActive(item.href) ? 'page' : undefined}
            >
              <span className="w-5 h-5">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    )
  }

  return (
    <nav aria-label="SDM navigasi" className="px-3 flex flex-col gap-0.5">
      <p className="px-2 py-2 text-xs font-sans font-semibold text-ink-400 uppercase tracking-widest">
        SDM
      </p>
      {items.map(item => (
        <Link
          key={item.href}
          href={item.href}
          className={[
            'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-sans font-medium transition-colors',
            isActive(item.href)
              ? 'bg-pine-50 text-pine'
              : 'text-sand-100 hover:bg-pine-700',
          ].join(' ')}
          aria-current={isActive(item.href) ? 'page' : undefined}
        >
          <span className="w-4 h-4 shrink-0">{item.icon}</span>
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
