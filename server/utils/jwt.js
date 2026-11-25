import { createHmac, timingSafeEqual } from 'node:crypto'

const TOKEN_LIFETIME_SECONDS = 60 * 60 * 24 * 7

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

function getSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32) {
    const error = new Error('JWT_SECRET must contain at least 32 characters.')
    error.statusCode = 503
    throw error
  }
  return secret
}

export function createAuthToken(userId) {
  const now = Math.floor(Date.now() / 1000)
  const payload = encode({ sub: String(userId), iat: now, exp: now + TOKEN_LIFETIME_SECONDS })
  const signingInput = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${payload}`
  const signature = createHmac('sha256', getSecret()).update(signingInput).digest('base64url')
  return `${signingInput}.${signature}`
}

export function verifyAuthToken(token) {
  const [header, payload, signature, extra] = String(token).split('.')
  if (!header || !payload || !signature || extra) return null

  try {
    const expected = createHmac('sha256', getSecret()).update(`${header}.${payload}`).digest()
    const actual = Buffer.from(signature, 'base64url')
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null

    const decodedHeader = JSON.parse(Buffer.from(header, 'base64url').toString())
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString())
    if (decodedHeader.alg !== 'HS256' || typeof claims.sub !== 'string' || claims.exp <= Math.floor(Date.now() / 1000)) return null
    return claims
  } catch {
    return null
  }
}
