import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// POST /api/v1/webhooks/qontak — publik, dikecualikan dari middleware auth
// Callback status pengiriman WA dari Mekari Qontak.

export async function POST(request: Request) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Qontak mengirim message_id (provider_ref) dan status
  const providerId  = body.message_id as string | undefined
  const rawStatus   = body.status    as string | undefined

  if (!providerId) return NextResponse.json({ received: true })

  const statusMap: Record<string, 'sent' | 'failed'> = {
    sent:      'sent',
    delivered: 'sent',
    read:      'sent',
    failed:    'failed',
    rejected:  'failed',
  }
  const status = rawStatus ? statusMap[rawStatus] : undefined

  if (status) {
    const admin = createAdminClient()
    await admin
      .from('outbound_messages')
      .update({
        status,
        sent_at:      status === 'sent' ? new Date().toISOString() : null,
        provider_ref: providerId,
      })
      .eq('provider_ref', providerId)
  }

  return NextResponse.json({ received: true })
}
