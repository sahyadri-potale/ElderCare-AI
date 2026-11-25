import { getDatabaseStatus } from '../config/db.js'

export function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error)
  }

  const requestedStatus = error.statusCode ?? error.status
  const databaseDisconnected = getDatabaseStatus() !== 'connected'
  const databaseConnectionError = databaseDisconnected && (
    ['MongooseError', 'MongoServerSelectionError', 'MongoNetworkError', 'MongoNotConnectedError'].includes(error.name)
    || /buffering timed out|topology is closed|not connected to a mongodb/i.test(String(error.message ?? ''))
  )
  const statusCode = databaseConnectionError ? 503 : Number.isInteger(requestedStatus) ? requestedStatus : 500
  console.error(`[server] Request failed with status ${statusCode} (${error.name ?? 'Error'}).`)

  return res.status(statusCode).json({
    status: 'error',
    code: databaseConnectionError ? 'DATABASE_UNAVAILABLE' : undefined,
    message: databaseConnectionError
      ? 'The database is temporarily unavailable. Check MongoDB Atlas Network Access, cluster status, and the server MONGODB_URI configuration.'
      : statusCode >= 500 ? 'An unexpected server error occurred.' : error.message,
  })
}
