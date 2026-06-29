// Messaging service — kirim WA dan update outbound_messages
// Semua fungsi idempotent: cek outbound_messages sebelum kirim.

import { createAdminClient } from '@/lib/supabase/admin'
import { sendDirectWa, isQontakConfigured } from '@/lib/qontak'

const CHANNEL_ID              = () => process.env.QONTAK_CHANNEL_ID ?? ''
const INVOICE_TEMPLATE_ID     = () => process.env.QONTAK_INVOICE_TEMPLATE_ID ?? ''
const BOOKING_TEMPLATE_ID     = () => process.env.QONTAK_BOOKING_CONFIRM_TEMPLATE_ID ?? ''
const ORDER_READY_TEMPLATE_ID = () => process.env.QONTAK_ORDER_READY_TEMPLATE_ID ?? ''

function normalizePhone(phone: string): string {
  // Konversi 08xxx → 628xxx
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('0')) return '62' + digits.slice(1)
  if (digits.startsWith('62')) return digits
  return '62' + digits
}

// ── Invoice setelah order paid ─────────────────────────────────────────────────
export async function sendInvoiceWa(orderId: string): Promise<void> {
  const admin = createAdminClient()

  // Cek apakah sudah pernah dikirim (idempotency via unique constraint)
  const { data: existing } = await admin
    .from('outbound_messages')
    .select('id, status')
    .eq('reference_type', 'orders')
    .eq('reference_id', orderId)
    .eq('purpose', 'invoice')
    .maybeSingle()

  if (existing?.status === 'sent') return  // sudah terkirim

  // Ambil data order + customer
  const { data: order } = await admin
    .from('orders')
    .select('id, order_number, total, paid_at, customer_id, customers!left(name, phone)')
    .eq('id', orderId)
    .single()

  const customer = (order?.customers as unknown) as { name: string | null; phone: string | null } | null
  const phone = customer?.phone
  if (!phone) return  // tidak ada nomor, skip

  // Upsert outbound_message record (enqueue)
  const msgId = existing?.id
  const payload = {
    order_number: order?.order_number,
    total:        order?.total,
    paid_at:      order?.paid_at,
  }

  let recordId: string
  if (msgId) {
    recordId = msgId
    await admin.from('outbound_messages').update({ status: 'queued', error: null }).eq('id', msgId)
  } else {
    const { data: inserted } = await admin.from('outbound_messages').insert({
      channel:        'whatsapp',
      to_phone:       phone,
      purpose:        'invoice',
      reference_type: 'orders',
      reference_id:   orderId,
      payload,
      status:         'queued',
    }).select('id').single()
    recordId = inserted!.id
  }

  if (!isQontakConfigured() || !INVOICE_TEMPLATE_ID()) {
    // Qontak belum dikonfigurasi — tetap queued, akan dikirim ulang nanti
    return
  }

  try {
    const result = await sendDirectWa({
      toNumber:   normalizePhone(phone),
      channelId:  CHANNEL_ID(),
      templateId: INVOICE_TEMPLATE_ID(),
      params: [
        { key: '1', value: customer?.name ?? 'Pelanggan' },
        { key: '2', value: order?.order_number ?? '' },
        { key: '3', value: new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(order?.total ?? 0) },
      ],
    })
    await admin.from('outbound_messages').update({
      status:       'sent',
      provider:     'qontak',
      provider_ref: result.message_id,
      sent_at:      new Date().toISOString(),
    }).eq('id', recordId)
  } catch (err) {
    await admin.from('outbound_messages').update({
      status: 'failed',
      error:  String(err),
    }).eq('id', recordId)
    // Tidak throw — jangan gagalkan alur utama karena WA gagal kirim
  }
}

// ── Konfirmasi booking ─────────────────────────────────────────────────────────
export async function sendBookingConfirmWa(bookingId: string): Promise<void> {
  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('outbound_messages')
    .select('id, status')
    .eq('reference_type', 'consultation_bookings')
    .eq('reference_id', bookingId)
    .eq('purpose', 'booking_confirm')
    .maybeSingle()

  if (existing?.status === 'sent') return

  const { data: booking } = await admin
    .from('consultation_bookings')
    .select(`
      id, customer_name, customer_phone, queue_number, notes,
      consultation_slots!inner(date, start_time, end_time, branches!inner(name))
    `)
    .eq('id', bookingId)
    .single()

  const phone = booking?.customer_phone
  if (!phone) return

  const slot    = (booking?.consultation_slots as unknown) as { date: string; start_time: string; end_time: string; branches: { name: string } } | null
  const payload = { booking_id: bookingId, customer_name: booking?.customer_name, slot }

  let recordId: string
  if (existing?.id) {
    recordId = existing.id
    await admin.from('outbound_messages').update({ status: 'queued', error: null }).eq('id', existing.id)
  } else {
    const { data: inserted } = await admin.from('outbound_messages').insert({
      channel:        'whatsapp',
      to_phone:       phone,
      purpose:        'booking_confirm',
      reference_type: 'consultation_bookings',
      reference_id:   bookingId,
      payload,
      status:         'queued',
    }).select('id').single()
    recordId = inserted!.id
  }

  if (!isQontakConfigured() || !BOOKING_TEMPLATE_ID()) return

  try {
    const result = await sendDirectWa({
      toNumber:   normalizePhone(phone),
      channelId:  CHANNEL_ID(),
      templateId: BOOKING_TEMPLATE_ID(),
      params: [
        { key: '1', value: booking?.customer_name ?? 'Pelanggan' },
        { key: '2', value: slot?.branches?.name ?? '' },
        { key: '3', value: slot?.date ?? '' },
        { key: '4', value: `${slot?.start_time ?? ''} – ${slot?.end_time ?? ''}` },
        { key: '5', value: String(booking?.queue_number ?? '') },
      ],
    })
    await admin.from('outbound_messages').update({
      status: 'sent', provider: 'qontak',
      provider_ref: result.message_id, sent_at: new Date().toISOString(),
    }).eq('id', recordId)
  } catch (err) {
    await admin.from('outbound_messages').update({ status: 'failed', error: String(err) }).eq('id', recordId)
  }
}

// ── Order siap diambil ─────────────────────────────────────────────────────────
export async function sendOrderReadyWa(orderId: string): Promise<void> {
  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('outbound_messages')
    .select('id, status')
    .eq('reference_type', 'orders')
    .eq('reference_id', orderId)
    .eq('purpose', 'order_ready')
    .maybeSingle()

  if (existing?.status === 'sent') return

  const { data: order } = await admin
    .from('orders')
    .select('id, order_number, queue_number, customer_id, customers!left(name, phone)')
    .eq('id', orderId)
    .single()

  const customer = (order?.customers as unknown) as { name: string | null; phone: string | null } | null
  const phone = customer?.phone
  if (!phone) return

  const payload = { order_number: order?.order_number, queue_number: order?.queue_number }

  let recordId: string
  if (existing?.id) {
    recordId = existing.id
    await admin.from('outbound_messages').update({ status: 'queued', error: null }).eq('id', existing.id)
  } else {
    const { data: inserted } = await admin.from('outbound_messages').insert({
      channel: 'whatsapp', to_phone: phone, purpose: 'order_ready',
      reference_type: 'orders', reference_id: orderId, payload, status: 'queued',
    }).select('id').single()
    recordId = inserted!.id
  }

  if (!isQontakConfigured() || !ORDER_READY_TEMPLATE_ID()) return

  try {
    const result = await sendDirectWa({
      toNumber:   normalizePhone(phone),
      channelId:  CHANNEL_ID(),
      templateId: ORDER_READY_TEMPLATE_ID(),
      params: [
        { key: '1', value: customer?.name ?? 'Pelanggan' },
        { key: '2', value: order?.order_number ?? '' },
        { key: '3', value: String(order?.queue_number ?? '') },
      ],
    })
    await admin.from('outbound_messages').update({
      status: 'sent', provider: 'qontak',
      provider_ref: result.message_id, sent_at: new Date().toISOString(),
    }).eq('id', recordId)
  } catch (err) {
    await admin.from('outbound_messages').update({ status: 'failed', error: String(err) }).eq('id', recordId)
  }
}
