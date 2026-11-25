import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import { fileURLToPath } from 'node:url'
import { connectDB } from './config/db.js'
import { errorHandler } from './middleware/errorHandler.js'
import { notFoundHandler } from './middleware/notFound.js'
import healthRoutes from './routes/healthRoutes.js'
import authRoutes from './routes/authRoutes.js'
import assistantRoutes from './routes/assistantRoutes.js'
import careRoutes from './routes/careRoutes.js'

// Resolve .env relative to this file so startup works from either the repo root or server/.
// Meaningful process environment values take precedence, while blank inherited values
// are filled from server/.env.
const dotenvResult = dotenv.config({ path: fileURLToPath(new URL('./.env', import.meta.url)) })
const fileGeminiApiKey = dotenvResult.parsed?.GEMINI_API_KEY?.trim()
if (!process.env.GEMINI_API_KEY?.trim() && fileGeminiApiKey) {
  process.env.GEMINI_API_KEY = fileGeminiApiKey
}

const app = express()
const PORT = Number(process.env.PORT) || 5001
const geminiApiKeyConfigured = Boolean(process.env.GEMINI_API_KEY?.trim())

app.use(cors({ origin: 'http://localhost:5173' }))
app.use(express.json())

app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'ElderCare AI API. Check /api/health for service status.',
  })
})

app.use('/api/health', healthRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/assistant', assistantRoutes)
app.use('/api/care', careRoutes)

app.use(notFoundHandler)
app.use(errorHandler)

async function startServer() {
  console.info(`[server] Gemini API key ${geminiApiKeyConfigured ? 'configured' : 'not configured'}.`)

  // Wait for the initial MongoDB attempt so startup logs show its result first.
  await connectDB()

  const server = app.listen(PORT)

  await new Promise((resolve, reject) => {
    server.once('listening', resolve)
    server.once('error', reject)
  })

  console.info(`[server] ElderCare AI API listening on http://localhost:${PORT}`)
}

startServer().catch((error) => {
  const code = error?.code ? ` (${error.code})` : ''
  console.error(`[server] API failed to start${code}.`)
  process.exitCode = 1
})
