import { Router } from 'express'
import { TextToSpeechClient } from '@google-cloud/text-to-speech'
import { authenticate } from '../middleware/authenticate.js'

const router = Router()
const supportedLanguages = new Set(['en', 'kn', 'hi'])
const MAX_CONTEXT_MESSAGES = 12
const MAX_MESSAGE_LENGTH = 2000
const MODEL = 'gemini-3.5-flash-lite'
const KANNADA_TTS_VOICE = 'kn-IN-Wavenet-A'
const MAX_TTS_INPUT_BYTES = 5000
let kannadaTtsClient

function getKannadaTtsClient() {
  kannadaTtsClient ??= new TextToSpeechClient()
  return kannadaTtsClient
}

function classifyTtsFailure(error) {
  const code = Number(error?.code)
  const message = String(error?.message ?? '').toLowerCase()
  if (code === 8 || /resource_exhausted|quota exceeded|rate limit/.test(message)) {
    return { status: 429, code: 'KANNADA_TTS_QUOTA_EXCEEDED', message: 'Kannada audio has reached its usage limit. The text response is still available.' }
  }
  if ([7, 16].includes(code) || /default credentials|authentication|unauthenticated|permission denied|texttospeech api has not been used/.test(message)) {
    return { status: 503, code: 'KANNADA_TTS_NOT_CONFIGURED', message: 'Kannada audio service is not configured. The text response is still available.' }
  }
  return { status: 502, code: 'KANNADA_TTS_FAILED', message: 'Could not create Kannada audio. The text response is still available; please try again.' }
}

function classifyProviderFailure(httpStatus, providerError = {}) {
  const providerStatus = String(providerError.status ?? '').toUpperCase()
  const providerMessage = String(providerError.message ?? '').toLowerCase()
  const providerCode = Number(providerError.code ?? httpStatus)
  if (providerCode === 429 || providerStatus === 'RESOURCE_EXHAUSTED' || /quota|rate.?limit|resource exhausted/.test(providerMessage)) {
    return { status: 429, code: 'AI_QUOTA_EXCEEDED', message: 'The assistant has reached its current usage limit. Please wait a little and try again.' }
  }
  if (providerCode === 401 || providerCode === 403 || /api key not valid|invalid api key|api_key_invalid/.test(providerMessage)) {
    return { status: 503, code: 'AI_CONFIGURATION_ERROR', message: 'The assistant service is not available right now. Please try again later.' }
  }
  if (providerCode === 404 || providerStatus === 'NOT_FOUND' || /model.*(not found|unavailable|not available)/.test(providerMessage)) {
    return { status: 503, code: 'AI_MODEL_UNAVAILABLE', message: 'The configured AI model is not available for this service right now.' }
  }
  if (providerCode === 503 || providerCode === 504 || providerStatus === 'UNAVAILABLE' || providerStatus === 'DEADLINE_EXCEEDED' || providerStatus === 'INTERNAL') {
    return { status: 503, code: 'AI_TEMPORARILY_UNAVAILABLE', message: 'The assistant service is temporarily unavailable. Please try again shortly.' }
  }
  return { status: 502, code: 'AI_REQUEST_FAILED', message: 'The assistant could not respond right now. Please try again.' }
}

function safeProviderMessage(message, apiKey) {
  return String(message ?? '')
    .replaceAll(apiKey, '[redacted]')
    .replace(/AIza[\w-]{20,}/g, '[redacted]')
    .replace(/(key|token|authorization)[\s:=]+[^\s,;]+/gi, '$1=[redacted]')
    .slice(0, 500)
}

function sanitizeConversation(history, message, language) {
  if (!Array.isArray(history)) return []

  return history
    .slice(-MAX_CONTEXT_MESSAGES)
    .flatMap((entry) => {
      if (!entry || (entry.role !== 'user' && entry.role !== 'assistant') || typeof entry.text !== 'string') return []
      if (entry.language && entry.language !== language) return []
      const text = entry.text.trim().slice(0, MAX_MESSAGE_LENGTH)
      return text ? [{ role: entry.role === 'assistant' ? 'model' : 'user', parts: [{ text }] }] : []
    })
    .filter((entry) => entry.parts[0].text !== message)
}

router.post('/speech', authenticate, async (req, res) => {
  const { text, language } = req.body ?? {}
  if (language !== 'kn') return res.status(400).json({ status: 'error', code: 'UNSUPPORTED_TTS_LANGUAGE', message: 'This speech endpoint accepts Kannada text only.' })
  if (typeof text !== 'string' || !text.trim()) return res.status(400).json({ status: 'error', code: 'INVALID_TTS_TEXT', message: 'Kannada text is required.' })
  if (Buffer.byteLength(text, 'utf8') > MAX_TTS_INPUT_BYTES) return res.status(413).json({ status: 'error', code: 'TTS_TEXT_TOO_LONG', message: 'This response is too long to read aloud.' })

  try {
    const [response] = await getKannadaTtsClient().synthesizeSpeech({
      input: { text },
      voice: { languageCode: 'kn-IN', name: KANNADA_TTS_VOICE },
      audioConfig: { audioEncoding: 'MP3', speakingRate: 0.92 },
    }, { timeout: 20_000 })
    if (!response.audioContent) throw new Error('Text-to-Speech returned no audio content.')
    const audioContent = Buffer.isBuffer(response.audioContent)
      ? response.audioContent.toString('base64')
      : Buffer.from(response.audioContent).toString('base64')
    return res.json({ status: 'ok', language: 'kn-IN', voice: KANNADA_TTS_VOICE, mimeType: 'audio/mpeg', audioContent })
  } catch (error) {
    const failure = classifyTtsFailure(error)
    console.error('[assistant-tts] Kannada synthesis failed', {
      code: error?.code ?? null,
      errorName: error?.name ?? 'Error',
      mappedCode: failure.code,
    })
    return res.status(failure.status).json({ status: 'error', code: failure.code, message: failure.message })
  }
})

router.post('/chat', authenticate, async (req, res) => {
  const { message, history, language = 'en' } = req.body ?? {}
  if (typeof message !== 'string' || !message.trim() || message.trim().length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ status: 'error', message: 'Enter a message of up to 2,000 characters.' })
  }
  if (!supportedLanguages.has(language)) {
    return res.status(400).json({ status: 'error', message: 'Choose English, Kannada, or Hindi.' })
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) {
    return res.status(503).json({ status: 'error', message: 'The voice assistant is not configured yet. Add GEMINI_API_KEY to server/.env.' })
  }

  try {
    const languageNames = { en: 'English', kn: 'Kannada', hi: 'Hindi' }
    const userMessage = message.trim()
    const context = sanitizeConversation(history, userMessage, language)
    const responseLanguage = language === 'kn' ? 'Kannada (ಕನ್ನಡ script)' : language === 'hi' ? 'Hindi (देवनागरी script)' : 'English (Latin script)'
    const requestBody = JSON.stringify({
      systemInstruction: {
        parts: [{ text: `You are ElderCare AI, a warm, respectful everyday companion for older adults. The selected response language is ${responseLanguage}. Write every response exclusively in that language and its named script, even when the user's message or older context uses another language. Never code-switch. Keep personal names, medicine names, brands, and phone numbers exactly as supplied. Use simple, friendly wording and short paragraphs. Continue the conversation naturally using only relevant supplied conversation history. Do not diagnose, prescribe treatment, or replace professional medical advice. If someone describes urgent symptoms, immediate danger, self-harm, or a medical emergency, encourage them to contact local emergency services and a trusted family member or caregiver now.` }],
      },
      contents: [...context, { role: 'user', parts: [{ text: userMessage }] }],
      generationConfig: { maxOutputTokens: 500, temperature: 0.7 },
    })
    let response
    for (let attempt = 0; attempt < 2; attempt += 1) {
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: requestBody,
        signal: AbortSignal.timeout(20000),
      })
      if (response.status !== 503 || attempt === 1) break
      await new Promise((resolve) => setTimeout(resolve, 250))
    }

    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
      const providerError = result?.error ?? {}
      console.error('[assistant] Gemini upstream request failed', {
        model: MODEL,
        language,
        httpStatus: response.status,
        providerCode: providerError.code ?? null,
        providerStatus: providerError.status ?? null,
        providerMessage: safeProviderMessage(providerError.message, apiKey),
      })
      const failure = classifyProviderFailure(response.status, providerError)
      return res.status(failure.status).json({ status: 'error', code: failure.code, message: failure.message })
    }

    const reply = result.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim()
    if (!reply) {
      console.error('[assistant] Gemini returned no text candidate', {
        model: MODEL,
        language,
        finishReason: result.candidates?.[0]?.finishReason ?? null,
        promptFeedback: result.promptFeedback?.blockReason ?? null,
      })
      return res.status(502).json({ status: 'error', code: 'AI_EMPTY_RESPONSE', message: 'The assistant returned no response. Please try again.' })
    }
    return res.json({ status: 'ok', reply })
  } catch (error) {
    const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError'
    console.error('[assistant] Gemini transport failure', {
      model: MODEL,
      language,
      errorName: error?.name ?? 'Error',
      errorCode: error?.cause?.code ?? null,
      timedOut,
    })
    return res.status(timedOut ? 504 : 503).json({
      status: 'error',
      code: timedOut ? 'AI_TIMEOUT' : 'AI_TEMPORARILY_UNAVAILABLE',
      message: 'The assistant service is temporarily unavailable. Please try again shortly.',
    })
  }
})

export default router
