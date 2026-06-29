const MIDTRANS_BASE_URL = process.env.MIDTRANS_IS_PRODUCTION === 'true'
  ? 'https://app.midtrans.com'
  : 'https://app.sandbox.midtrans.com'

const MIDTRANS_API_BASE_URL = process.env.MIDTRANS_IS_PRODUCTION === 'true'
  ? 'https://api.midtrans.com'
  : 'https://api.sandbox.midtrans.com'

function authHeader() {
  const key = process.env.MIDTRANS_SERVER_KEY ?? ''
  return 'Basic ' + Buffer.from(key + ':').toString('base64')
}

export function isMidtransConfigured() {
  return !!process.env.MIDTRANS_SERVER_KEY
}

// ── Snap (untuk website eksternal) ────────────────────────────────────────────

export interface SnapResult {
  token:       string
  redirect_url: string
}

export async function createSnapToken(opts: {
  orderId:     string
  amount:      number
  customerName: string
  customerPhone: string
  customerEmail?: string
}): Promise<SnapResult> {
  const res = await fetch(`${MIDTRANS_BASE_URL}/snap/v1/transactions`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
    body:    JSON.stringify({
      transaction_details: { order_id: opts.orderId, gross_amount: opts.amount },
      customer_details: {
        first_name: opts.customerName,
        phone:      opts.customerPhone,
        email:      opts.customerEmail ?? undefined,
      },
      expiry: {
        unit:     'minutes',
        duration: Number(process.env.BOOKING_PAYMENT_EXPIRY_MINUTES ?? 30),
      },
      enabled_payments: ['qris', 'bank_transfer', 'credit_card'],
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Midtrans Snap error: ${err}`)
  }
  return res.json() as Promise<SnapResult>
}

// ── QRIS Dinamis (untuk halaman booking internal) ──────────────────────────────

export interface QrisResult {
  qr_string:   string
  external_id: string
  expire_time: string
}

export async function createQris(opts: {
  orderId:      string
  amount:       number
  customerName: string
}): Promise<QrisResult> {
  const res = await fetch(`${MIDTRANS_API_BASE_URL}/v2/charge`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: authHeader() },
    body:    JSON.stringify({
      payment_type: 'qris',
      transaction_details: { order_id: opts.orderId, gross_amount: opts.amount },
      customer_details: { first_name: opts.customerName },
      qris: { acquirer: 'gopay' },
      custom_expiry: {
        expiry_duration: Number(process.env.BOOKING_PAYMENT_EXPIRY_MINUTES ?? 30),
        unit:            'minute',
      },
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Midtrans QRIS error: ${err}`)
  }
  const data = await res.json() as {
    qr_string:        string
    transaction_id:   string
    expiry_time:      string
  }
  return {
    qr_string:   data.qr_string,
    external_id: opts.orderId,
    expire_time: data.expiry_time,
  }
}

// ── Status check ───────────────────────────────────────────────────────────────

export interface MidtransStatusResult {
  transaction_status: string  // pending | settlement | expire | cancel | deny
  fraud_status?:      string
  payment_type?:      string
}

export async function checkTransactionStatus(orderId: string): Promise<MidtransStatusResult> {
  const res = await fetch(`${MIDTRANS_API_BASE_URL}/v2/${orderId}/status`, {
    headers: { Authorization: authHeader() },
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Midtrans status error: ${err}`)
  }
  return res.json() as Promise<MidtransStatusResult>
}

// ── Webhook signature verification ────────────────────────────────────────────

import { createHash } from 'crypto'

export function verifyMidtransSignature(opts: {
  orderId:           string
  statusCode:        string
  grossAmount:       string
  signatureKey:      string   // dari webhook header atau body
}): boolean {
  const serverKey = process.env.MIDTRANS_SERVER_KEY ?? ''
  const expected  = createHash('sha512')
    .update(opts.orderId + opts.statusCode + opts.grossAmount + serverKey)
    .digest('hex')
  return expected === opts.signatureKey
}
