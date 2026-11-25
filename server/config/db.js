import mongoose from 'mongoose'

const connectionStates = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
}

let hasConnectedBefore = false

export function getDatabaseStatus() {
  return connectionStates[mongoose.connection.readyState] ?? 'unknown'
}

function safeErrorMessage(error) {
  const message = String(error?.message ?? 'Unknown connection error').split(/\r?\n/, 1)[0]

  return message
    .replace(/mongodb(?:\+srv)?:\/\/[^\s"'<>]+/gi, '<MongoDB URI redacted>')
    .replace(/\b(password|passwd|pwd|username|user)(\s*[=:]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi, '$1$2[redacted]')
    .slice(0, 240)
}

function connectionHint(error) {
  const details = `${error?.name ?? ''} ${error?.code ?? ''} ${error?.message ?? ''}`

  if (/authentication|auth failed|bad auth|code 18/i.test(details) || error?.code === 18) {
    return ' Check the Atlas database username, password, and database-user permissions.'
  }

  if (/ENOTFOUND|ENODATA|ECONNREFUSED|ETIMEDOUT|EHOSTUNREACH|ENETUNREACH|server selection/i.test(details)) {
    return ' Check the Atlas cluster hostname, IP Access List, and network/DNS access.'
  }

  if (/invalid scheme|connection string|URI/i.test(details)) {
    return ' Check that MONGODB_URI is the Atlas driver URI and that its placeholders were replaced.'
  }

  return ''
}

function logConnectionError(error, context = 'connection failed') {
  const name = error?.name ?? 'Error'
  const code = error?.code !== undefined ? `, code ${error.code}` : ''
  const message = safeErrorMessage(error)

  console.error(`[database] MongoDB ${context} (${name}${code}): ${message}.${connectionHint(error)}`)
}

export async function connectDB() {
  const connectionString = process.env.MONGODB_URI?.trim()

  if (!connectionString || connectionString === 'your_mongodb_atlas_connection_string') {
    console.warn('[database] MONGODB_URI is missing or still has the example placeholder. Set it in server/.env.')
    return false
  }

  if (/clustername\.mongodb\.net/i.test(connectionString)) {
    console.error('[database] MONGODB_URI still uses the example Atlas host clustername.mongodb.net. Replace it with the hostname shown in your Atlas Connect dialog.')
    return false
  }

  if (!/^mongodb(?:\+srv)?:\/\//i.test(connectionString)) {
    console.error('[database] MONGODB_URI must start with mongodb:// or mongodb+srv://. The value was not printed.')
    return false
  }

  try {
    await mongoose.connect(connectionString)
    hasConnectedBefore = true
    console.info('[database] MongoDB connected.')
    return true
  } catch (error) {
    logConnectionError(error)
    return false
  }
}

mongoose.connection.on('connected', () => {
  hasConnectedBefore = true
})

mongoose.connection.on('disconnected', () => {
  if (hasConnectedBefore) {
    console.warn('[database] MongoDB connection was lost after a successful connection.')
  }
})

mongoose.connection.on('error', (error) => {
  if (hasConnectedBefore) {
    logConnectionError(error, 'reported an error')
  }
})
