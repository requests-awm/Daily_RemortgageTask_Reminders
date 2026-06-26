// Gmail sender via OAuth2 refresh token. No deps — builds RFC822 + base64url
// and calls the Gmail REST API. Only invoked when SEND_MODE=live.

async function getAccessToken() {
  const body = new URLSearchParams({
    client_id: process.env.GMAIL_CLIENT_ID || '',
    client_secret: process.env.GMAIL_CLIENT_SECRET || '',
    refresh_token: process.env.GMAIL_REFRESH_TOKEN || '',
    grant_type: 'refresh_token',
  })
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const json = await res.json()
  if (!res.ok) throw new Error(`Google token ${res.status}: ${json.error_description || json.error}`)
  return json.access_token
}

function b64url(str) {
  return Buffer.from(str, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

// Encode a header value containing non-ASCII as RFC2047 (UTF-8 base64).
function encodeHeader(value) {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(value)) return value
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`
}

export async function sendEmail({ fromName, fromAddress, to, cc = [], bcc = [], replyTo, subject, html }) {
  const token = await getAccessToken()

  const headers = [
    `From: ${encodeHeader(fromName)} <${fromAddress}>`,
    `To: ${to.join(', ')}`,
    cc.length ? `Cc: ${cc.join(', ')}` : null,
    bcc.length ? `Bcc: ${bcc.join(', ')}` : null,
    replyTo ? `Reply-To: ${replyTo}` : null,
    `Subject: ${encodeHeader(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
  ].filter(Boolean)

  const raw = b64url(`${headers.join('\r\n')}\r\n\r\n${html}`)

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(`Gmail send ${res.status}: ${json.error?.message || JSON.stringify(json)}`)
  return { id: json.id, threadId: json.threadId }
}
