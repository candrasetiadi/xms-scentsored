import crypto from 'crypto'

// ── Config ─────────────────────────────────────────────────────────────────────

const CALENDAR_ID    = () => process.env.GOOGLE_CALENDAR_ID ?? ''
const SA_EMAIL       = () => process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? ''
const SA_PRIVATE_KEY = () => (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? '').replace(/\\n/g, '\n')

export function isGoogleCalendarConfigured(): boolean {
  return Boolean(CALENDAR_ID() && SA_EMAIL() && SA_PRIVATE_KEY())
}

// ── JWT / token ────────────────────────────────────────────────────────────────

let _tokenCache: { token: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<string> {
  if (_tokenCache && Date.now() < _tokenCache.expiresAt - 60_000) {
    return _tokenCache.token
  }

  const now = Math.floor(Date.now() / 1000)
  const header  = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({
    iss:   SA_EMAIL(),
    scope: 'https://www.googleapis.com/auth/calendar',
    aud:   'https://oauth2.googleapis.com/token',
    iat:   now,
    exp:   now + 3600,
  })).toString('base64url')

  const sign = crypto.createSign('RSA-SHA256')
  sign.update(`${header}.${payload}`)
  const sig = sign.sign(SA_PRIVATE_KEY(), 'base64url')
  const jwt = `${header}.${payload}.${sig}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion:  jwt,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Google OAuth token error: ${err}`)
  }

  const data = await res.json() as { access_token: string; expires_in: number }
  _tokenCache = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 }
  return _tokenCache.token
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface CalendarEvent {
  summary:     string
  description: string
  location?:   string
  start:       { dateTime: string; timeZone: string }
  end:         { dateTime: string; timeZone: string }
}

// ── API helpers ────────────────────────────────────────────────────────────────

async function calendarFetch(
  method: string,
  path: string,
  body?: unknown,
  params?: Record<string, string>,
): Promise<Response> {
  const token  = await getAccessToken()
  const url    = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID())}${path}`)
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))

  return fetch(url.toString(), {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type':  'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
}

// ── Public API ─────────────────────────────────────────────────────────────────

interface BookingEntry {
  queueNumber: number
  name:        string
  phone:       string
}

function buildDescription(branchName: string, maxBookings: number, bookings: BookingEntry[]): string {
  const header = `Sesi konsultasi racik parfum Scentsored ${branchName}.\nKapasitas: ${maxBookings} orang.`
  if (bookings.length === 0) return header
  const list = bookings
    .sort((a, b) => a.queueNumber - b.queueNumber)
    .map(b => `${b.queueNumber}. ${b.name} · ${b.phone}`)
    .join('\n')
  return `${header}\n\nBooking (${bookings.length}/${maxBookings}):\n${list}`
}

/**
 * Buat event kosong untuk slot konsultasi.
 * Dipanggil saat slot dibuat (manual atau generate), sebelum ada booking.
 */
export async function createSlotEvent(opts: {
  slotDate:    string  // YYYY-MM-DD
  startTime:   string  // HH:MM
  endTime:     string  // HH:MM
  branchName:  string
  maxBookings: number
}): Promise<string> {
  const { slotDate, startTime, endTime, branchName, maxBookings } = opts

  const event: CalendarEvent = {
    summary:     `Konsultasi Parfum — ${branchName}`,
    description: buildDescription(branchName, maxBookings, []),
    location:    branchName,
    start:       { dateTime: `${slotDate}T${startTime}:00`, timeZone: 'Asia/Jakarta' },
    end:         { dateTime: `${slotDate}T${endTime}:00`,   timeZone: 'Asia/Jakarta' },
  }

  const res = await calendarFetch('POST', '/events', event)
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Calendar createEvent error: ${err}`)
  }

  const data = await res.json() as { id: string }
  return data.id
}

/**
 * Tambah booking ke deskripsi event.
 * Fetch list booking aktif dari DB lalu rebuild deskripsi.
 */
export async function updateEventDescription(opts: {
  eventId:     string
  branchName:  string
  maxBookings: number
  bookings:    BookingEntry[]
}): Promise<void> {
  const { eventId, branchName, maxBookings, bookings } = opts

  const patchRes = await calendarFetch('PATCH', `/events/${eventId}`, {
    description: buildDescription(branchName, maxBookings, bookings),
  })
  if (!patchRes.ok) throw new Error(`Calendar updateDescription error: ${await patchRes.text()}`)
}

/**
 * Hapus event (saat slot dinonaktifkan).
 */
export async function deleteSlotEvent(eventId: string): Promise<void> {
  await calendarFetch('DELETE', `/events/${eventId}`, undefined, { sendUpdates: 'none' })
}
