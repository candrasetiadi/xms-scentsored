import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'

export const metadata = { title: 'Slip Gaji — Cetak' }

const MONTHS = [
  'Januari','Februari','Maret','April','Mei','Juni',
  'Juli','Agustus','September','Oktober','November','Desember',
]

function formatRp(n: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
  }).format(n)
}

interface ComponentSnapshot {
  name:   string
  type:   'basic' | 'allowance' | 'deduction'
  amount: number
}

interface Props {
  params: Promise<{ id: string }>
}

export default async function PrintPayslipPage({ params }: Props) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: slip } = await supabase
    .from('payslips')
    .select(`
      id, gross, total_allowances, total_deductions, overtime_amount, tax_amount, net,
      components_snapshot,
      staff:staff_id ( name, branch:branch_id ( name ) ),
      payroll_run:payroll_run_id ( period_month, period_year )
    `)
    .eq('id', id)
    .single()

  if (!slip) redirect('/hr/payslips')

  const staffName  = (slip as any).staff?.name ?? '—'
  const branchName = (slip as any).staff?.branch?.name ?? '—'
  const month      = (slip as any).payroll_run?.period_month as number
  const year       = (slip as any).payroll_run?.period_year  as number
  const snapshots: ComponentSnapshot[] = (slip as any).components_snapshot ?? []

  const basics     = snapshots.filter(c => c.type === 'basic')
  const allowances = snapshots.filter(c => c.type === 'allowance')
  const deductions = snapshots.filter(c => c.type === 'deduction')

  return (
    <div className="min-h-screen bg-white">
      <style>{`
        @media print {
          body { -webkit-print-color-adjust: exact; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>

      {/* Print action bar */}
      <div className="print:hidden flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-gray-50">
        <p className="text-sm text-gray-600">
          Slip Gaji — {staffName} — {MONTHS[month - 1]} {year}
        </p>
        <button
          onClick={() => window.print()}
          className="bg-green-700 text-white rounded-lg px-5 py-2 text-sm font-semibold hover:bg-green-800 transition-colors"
        >
          Cetak
        </button>
      </div>

      {/* Slip */}
      <div className="max-w-md mx-auto border border-gray-200 my-8 p-8 rounded-lg shadow-sm print:shadow-none print:border-none print:my-0 print:rounded-none print:p-6">

        {/* Header */}
        <div className="text-center border-b border-gray-200 pb-5 mb-5">
          <p className="text-2xl font-bold text-green-800 tracking-tight">Scentsored</p>
          <p className="text-base font-semibold text-gray-900 mt-2">{staffName}</p>
          <p className="text-sm text-gray-500">{branchName}</p>
          <p className="text-sm text-gray-500 mt-0.5">
            Periode: {MONTHS[month - 1]} {year}
          </p>
        </div>

        {/* Gaji Pokok */}
        {basics.map((c, i) => (
          <div key={i} className="flex justify-between text-sm py-1.5">
            <span className="text-gray-700">{c.name}</span>
            <span className="tabular-nums font-medium text-gray-900">{formatRp(c.amount)}</span>
          </div>
        ))}

        {/* Tunjangan */}
        {allowances.length > 0 && (
          <>
            <p className="text-xs text-gray-400 uppercase tracking-widest mt-4 mb-1">Tunjangan</p>
            {allowances.map((c, i) => (
              <div key={i} className="flex justify-between text-sm py-1.5">
                <span className="text-gray-700">{c.name}</span>
                <span className="tabular-nums font-medium text-gray-900">{formatRp(c.amount)}</span>
              </div>
            ))}
          </>
        )}

        {/* Lembur */}
        {(slip as any).overtime_amount > 0 && (
          <div className="flex justify-between text-sm py-1.5">
            <span className="text-gray-700">Lembur</span>
            <span className="tabular-nums font-medium text-gray-900">{formatRp((slip as any).overtime_amount)}</span>
          </div>
        )}

        {/* Dashed separator */}
        <div className="border-t border-dashed border-gray-300 my-4" />

        {/* Potongan */}
        {(deductions.length > 0 || (slip as any).tax_amount > 0) && (
          <>
            <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Potongan</p>
            {deductions.map((c, i) => (
              <div key={i} className="flex justify-between text-sm py-1.5">
                <span className="text-gray-700">{c.name}</span>
                <span className="tabular-nums text-red-600">({formatRp(c.amount)})</span>
              </div>
            ))}
            {(slip as any).tax_amount > 0 && (
              <div className="flex justify-between text-sm py-1.5">
                <span className="text-gray-700">Pajak (PPh21)</span>
                <span className="tabular-nums text-red-600">({formatRp((slip as any).tax_amount)})</span>
              </div>
            )}
          </>
        )}

        {/* Net */}
        <div className="border-t-2 border-gray-900 mt-5 pt-4 flex justify-between items-center">
          <span className="text-sm font-semibold text-gray-900">NET GAJI</span>
          <span className="text-xl font-bold tabular-nums text-green-800">{formatRp((slip as any).net)}</span>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-400">Slip gaji ini diterbitkan secara elektronik oleh sistem Scentsored.</p>
        </div>
      </div>
    </div>
  )
}
