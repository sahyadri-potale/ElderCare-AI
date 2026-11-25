export const SPEECH_LOCALES = { en: 'en-IN', hi: 'hi-IN', kn: 'kn-IN' }

function findLocalizedVoice(voices, language) {
  const locale = SPEECH_LOCALES[language].toLowerCase()
  const exactVoice = voices.find((voice) => voice.lang?.toLowerCase() === locale)
  if (exactVoice) return exactVoice

  // English has widely available regional voices (for example en-US when en-IN
  // is absent). For Hindi and Kannada, require the exact script/language voice.
  if (language === 'en') return voices.find((voice) => /^en(?:-|$)/i.test(voice.lang ?? '')) ?? null
  return null
}

function loadVoices(synthesis, waitMs = 1200) {
  return new Promise((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      synthesis.removeEventListener?.('voiceschanged', onChanged)
      window.clearTimeout(timer)
      resolve(synthesis.getVoices())
    }
    const onChanged = () => finish()
    const timer = window.setTimeout(finish, waitMs)
    synthesis.addEventListener?.('voiceschanged', onChanged, { once: true })
  })
}

export async function speakLocalized(text, language, { onend, onerror, onUnavailable } = {}) {
  if (typeof text !== 'string' || !text.trim() || !SPEECH_LOCALES[language]) return false
  const synthesis = window.speechSynthesis
  if (!synthesis || typeof window.SpeechSynthesisUtterance !== 'function') {
    onUnavailable?.('speech-unavailable')
    return false
  }

  const utterance = new window.SpeechSynthesisUtterance(text.trim())
  utterance.lang = SPEECH_LOCALES[language]
  if (onend) utterance.onend = onend
  if (onerror) utterance.onerror = onerror

  let voices = synthesis.getVoices()
  let voice = findLocalizedVoice(voices, language)
  if (!voice) {
    voices = await loadVoices(synthesis)
    voice = findLocalizedVoice(voices, language)
  }
  // Never allow a browser default to silently speak another language.
  if (!voice) {
    console.warn(`No ${SPEECH_LOCALES[language]} speech voice is available in this browser.`)
    onUnavailable?.(`${language}-voice-unavailable`)
    return false
  }
  utterance.voice = voice

  try {
    synthesis.speak(utterance)
    return true
  } catch (error) {
    onerror?.(error)
    return false
  }
}
