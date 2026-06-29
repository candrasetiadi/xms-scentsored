// Mekari Qontak WhatsApp Business API client

const QONTAK_BASE     = 'https://app.qontak.com'
const QONTAK_MSG_BASE = 'https://service-chat.qontak.com'

interface QontakToken {
  access_token: string
  expires_at:   number  // unix ms
}

// Module-level token cache (lives for the lifetime of the serverless warm instance)
let _tokenCache: QontakToken | null = null

async function getAccessToken(): Promise<string> {
  const clientId     = process.env.QONTAK_CLIENT_ID
  const clientSecret = process.env.QONTAK_CLIENT_SECRET
  const username     = process.env.QONTAK_USERNAME
  const password     = process.env.QONTAK_PASSWORD

  if (!clientId || !clientSecret || !username || !password) {
    throw new Error('Qontak credentials not configured')
  }

  // Return cached token if still valid (with 60s buffer)
  if (_tokenCache && _tokenCache.expires_at > Date.now() + 60_000) {
    return _tokenCache.access_token
  }

  const res = await fetch(`${QONTAK_BASE}/oauth/token`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type:    'password',
      client_id:     clientId,
      client_secret: clientSecret,
      username,
      password,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Qontak auth failed: ${err}`)
  }

  const json = await res.json()
  _tokenCache = {
    access_token: json.access_token as string,
    expires_at:   Date.now() + (json.expires_in ?? 3600) * 1000,
  }
  return _tokenCache.access_token
}

export interface QontakTemplateParam {
  key:   string   // e.g. "1", "2"
  value: string
}

export interface SendDirectWaOptions {
  toNumber:       string       // format: "628123456789"
  channelId:      string       // QONTAK_CHANNEL_ID
  templateId:     string       // template message ID
  params:         QontakTemplateParam[]
}

export interface SendDirectWaResult {
  message_id: string
  status:     string
}

export async function sendDirectWa(opts: SendDirectWaOptions): Promise<SendDirectWaResult> {
  const token = await getAccessToken()

  const body = {
    to_number:              opts.toNumber,
    to_name:                opts.toNumber,  // fallback if no name
    message_template_id:    opts.templateId,
    channel_integration_id: opts.channelId,
    language: { code: 'id' },
    parameters: {
      body: opts.params.map(p => ({
        key:       p.key,
        value_text: p.value,
        value:      p.value,
      })),
    },
  }

  const res = await fetch(`${QONTAK_MSG_BASE}/api/open/v1/broadcasts/whatsapp/direct`, {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type':  'application/json',
      'Accept':        'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Qontak send failed (${res.status}): ${err}`)
  }

  const json = await res.json()
  return {
    message_id: json.data?.id ?? json.id ?? '',
    status:     json.data?.status ?? 'sent',
  }
}

export function isQontakConfigured(): boolean {
  return !!(
    process.env.QONTAK_CLIENT_ID &&
    process.env.QONTAK_CLIENT_SECRET &&
    process.env.QONTAK_USERNAME &&
    process.env.QONTAK_PASSWORD &&
    process.env.QONTAK_CHANNEL_ID
  )
}
