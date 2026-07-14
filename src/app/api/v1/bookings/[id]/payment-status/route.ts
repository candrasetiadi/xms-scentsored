import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { isMidtransConfigured, checkTransactionStatus } from '@/lib/midtrans'

// GET /api/v1/bookings/:id/payment-status
// Publik — dipakai polling countdown timer di halaman booking
// Returns: { status: 'pending_payment'|'confirmed'|'expired'|'cancelled', paid_at? }
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const admin   = createAdminClient()

  const { data: booking, error } = await admin
    .from('consultation_bookings')
    .select('id, slot_id, status, expires_at, paid_at, amount, payment_external_id')
    .eq('id', id)
    .single()

  if (error || !booking) return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 })

  // Sudah settled — kembalikan langsung
  if (booking.status !== 'pending_payment') {
    return NextResponse.json({ data: { status: booking.status, paid_at: booking.paid_at } })
  }

  // Cek apakah sudah expired secara waktu
  const isTimeExpired = booking.expires_at && new Date(booking.expires_at) < new Date()

  // Cek status Midtrans secara real-time (jika ada external_id)
  if (isMidtransConfigured() && booking.payment_external_id && booking.amount > 0) {
    try {
      const mt = await checkTransactionStatus(booking.payment_external_id)

      if (mt.transaction_status === 'settlement' || mt.transaction_status === 'capture') {
        const paidAt = new Date().toISOString()
        await admin
          .from('consultation_bookings')
          .update({ status: 'confirmed', paid_at: paidAt })
          .eq('id', id)

        return NextResponse.json({ data: { status: 'confirmed', paid_at: paidAt } })
      }

      if (mt.transaction_status === 'expire' || mt.transaction_status === 'cancel' || isTimeExpired) {
        await admin
          .from('consultation_bookings')
          .update({ status: 'expired' })
          .eq('id', id)
        return NextResponse.json({ data: { status: 'expired', paid_at: null } })
      }
    } catch (err) {
      console.error('[Midtrans] status check error:', err)
      // Lanjut dengan data lokal
    }
  } else if (isTimeExpired) {
    await admin
      .from('consultation_bookings')
      .update({ status: 'expired' })
      .eq('id', id)
    return NextResponse.json({ data: { status: 'expired', paid_at: null } })
  }

  return NextResponse.json({
    data: {
      status:     'pending_payment',
      expires_at: booking.expires_at,
      paid_at:    null,
    },
  })
}
