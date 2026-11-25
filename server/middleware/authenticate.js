import { verifyAuthToken } from '../utils/jwt.js'

export function authenticate(req, res, next) {
  const [scheme, token] = String(req.headers.authorization ?? '').split(' ')
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ status: 'error', message: 'Please log in to continue.' })
  }

  const claims = verifyAuthToken(token)
  if (!claims) {
    return res.status(401).json({ status: 'error', message: 'Your session is invalid or has expired. Please log in again.' })
  }

  req.auth = { userId: claims.sub }
  return next()
}
