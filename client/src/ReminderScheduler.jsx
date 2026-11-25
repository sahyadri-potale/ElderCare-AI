import { useEffect, useLayoutEffect, useRef } from 'react'
import { claimReminderNotification, getCarePlan, synthesizeKannadaSpeech } from './api.js'
import { useLanguage } from './i18n.jsx'
import { indiaDate, reminderIsDueNow, reminderIsScheduledToday } from './reminderSchedule.js'
import { speakLocalized } from './speech.js'

let reminderAudioContext

function unlockReminderAudio() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) return
    reminderAudioContext ??= new AudioContextClass()
    void reminderAudioContext.resume().catch(() => {})
  } catch { /* Audio can be unavailable in some browsers. */ }
}

async function playReminderAlert() {
  try {
    const context = reminderAudioContext
    if (!context) return
    if (context.state !== 'running') await context.resume()
    if (context.state !== 'running') return
    const now = context.currentTime
    ;[0, 0.24, 0.48].forEach((offset) => {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.value = 880
      gain.gain.setValueAtTime(0.0001, now + offset)
      gain.gain.exponentialRampToValueAtTime(0.18, now + offset + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.18)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start(now + offset)
      oscillator.stop(now + offset + 0.2)
    })
  } catch (error) { console.error('Reminder sound could not be played.', error) }
}

async function playKannadaReminder(text) {
  const result = await synthesizeKannadaSpeech({ text, language: 'kn' })
  if (!result.audioContent) throw new Error('Kannada reminder audio was not returned.')
  const bytes = Uint8Array.from(atob(result.audioContent), (character) => character.charCodeAt(0))
  if (reminderAudioContext) {
    const context = reminderAudioContext
    if (context.state !== 'running') await context.resume()
    const audioBuffer = await context.decodeAudioData(bytes.buffer.slice(0))
    const source = context.createBufferSource()
    source.buffer = audioBuffer
    source.connect(context.destination)
    source.start()
    return
  }
  const url = URL.createObjectURL(new Blob([bytes], { type: result.mimeType || 'audio/mpeg' }))
  const audio = new Audio(url)
  const release = () => URL.revokeObjectURL(url)
  audio.onended = release
  audio.onerror = release
  try { await audio.play() } catch (error) { release(); throw error }
}

async function announceReminder(text, language) {
  if (language === 'kn') {
    try {
      await playKannadaReminder(text)
      return
    } catch (error) {
      console.error('Google Kannada reminder voice failed; trying the browser Kannada voice.', error)
    }
  }
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel()
    const started = await speakLocalized(text, language, {
      onerror: (error) => console.error('Reminder voice announcement failed.', error),
    })
    if (!started) console.warn(`No ${language} reminder voice is available in this browser.`)
  }
}

function localSlot(date, time) { return `${date}T${time}` }

export default function ReminderScheduler({ userId }) {
  const { language, options, dashboardForLanguage } = useLanguage()
  const planRef = useRef({ reminders: [], reminderPreferences: { notifications: true, sound: true } })
  const languageDataRef = useRef({ language, options, dashboardForLanguage })
  const inFlightRef = useRef(false)
  useLayoutEffect(() => { languageDataRef.current = { language, options, dashboardForLanguage } }, [language, options, dashboardForLanguage])

  useEffect(() => {
    document.addEventListener('pointerdown', unlockReminderAudio)
    document.addEventListener('keydown', unlockReminderAudio)
    return () => {
      document.removeEventListener('pointerdown', unlockReminderAudio)
      document.removeEventListener('keydown', unlockReminderAudio)
      window.speechSynthesis?.cancel()
    }
  }, [])

  useEffect(() => {
    if (!userId) return undefined
    let active = true
    const loadPlan = async () => {
      try {
        const { carePlan } = await getCarePlan()
        if (active) planRef.current = carePlan
      } catch (error) {
        if (active) console.error('Saved reminders could not be loaded.', error)
      }
    }
    const onRemindersUpdated = () => { void loadPlan() }
    void loadPlan()
    const refreshTimer = window.setInterval(() => void loadPlan(), 60_000)
    window.addEventListener('eldercare:reminders-updated', onRemindersUpdated)
    return () => {
      active = false
      window.clearInterval(refreshTimer)
      window.removeEventListener('eldercare:reminders-updated', onRemindersUpdated)
    }
  }, [userId])

  useEffect(() => {
    if (!userId) return undefined
    let active = true
    const checkDue = async () => {
      if (inFlightRef.current) return
      inFlightRef.current = true
      try {
        const now = new Date()
        const date = indiaDate(now)
        const candidates = []
        for (const reminder of planRef.current.reminders ?? []) {
          if (!['medicine', 'activity'].includes(reminder.kind)) continue
          if (reminder.snoozedUntil && new Date(reminder.snoozedUntil) <= now) {
            const slot = `snooze:${reminder.snoozedSlot}:${new Date(reminder.snoozedUntil).toISOString()}`
            candidates.push({ reminder, slot, key: `${reminder._id}:${slot}` })
            continue
          }
          if (!reminderIsScheduledToday(reminder, now)) continue
          const times = Array.isArray(reminder.times) && reminder.times.length ? reminder.times : [reminder.time]
          for (const time of times) {
            const slot = localSlot(date, time)
            const completed = reminder.kind === 'activity' ? (reminder.completedSlots ?? []) : (reminder.takenSlots ?? [])
            if (reminderIsDueNow(date, time, now) && !completed.includes(slot) && !(reminder.kind === 'activity' && reminder.done)) candidates.push({ reminder, slot, key: `${reminder._id}:${slot}` })
          }
        }

        for (const dose of candidates) {
          if (!active) return
          try {
            const reminder = dose.reminder
            const { language: selectedLanguage, dashboardForLanguage: getDashboard } = languageDataRef.current
            const reminderLanguage = ['en', 'hi', 'kn'].includes(selectedLanguage) ? selectedLanguage : 'en'
            const reminderCopy = getDashboard(reminderLanguage)
            const medicationCopy = reminderCopy.medicationCopy
            const activityCopy = reminderCopy.activityCopy
            const reminderName = reminder.kind === 'medicine' ? reminder.medicineName || reminder.title : reminder.activityName || reminder.title
            const spoken = reminder.kind === 'activity'
              ? `${activityCopy.speak} ${reminderName}.`
              : reminderLanguage === 'kn'
                ? `${reminderName}, ${reminder.dosage} ಔಷಧಿ ತೆಗೆದುಕೊಳ್ಳುವ ಸಮಯ.`
                : reminderLanguage === 'hi'
                  ? `${medicationCopy.snoozePrefix} ${reminderName}, खुराक ${reminder.dosage}.`
                  : `${medicationCopy.snoozePrefix} ${reminderName}, dosage ${reminder.dosage}.`
            if (typeof reminderName !== 'string' || !reminderName.trim() || typeof spoken !== 'string' || !spoken.trim()) {
              console.error('Reminder details are incomplete; the reminder claim was not recorded.', reminder)
              continue
            }

            // Use a new claim key so a prior client that crashed after claiming
            // (before delivering the alert) cannot permanently suppress this due occurrence.
            const { claimed } = await claimReminderNotification(reminder._id, `delivery-v2:${dose.slot}`)
            if (!active) return
            if (!claimed) continue

            if (planRef.current.reminderPreferences?.sound !== false) void playReminderAlert()
            void announceReminder(spoken, reminderLanguage).catch((error) => console.error('Reminder voice announcement could not start.', error))

            if (planRef.current.reminderPreferences?.notifications !== false && 'Notification' in window && window.Notification.permission === 'granted') {
              const title = reminder.kind === 'activity' ? activityCopy.speak : medicationCopy.snoozePrefix
              const detail = reminder.kind === 'activity' ? `${activityCopy.dateTime} · ${reminder.time}` : `${reminder.dosage} · ${(reminder.times?.length ? reminder.times : [reminder.time]).join(', ')}`
              try { new window.Notification(title, { body: `${reminderName} · ${detail}`, tag: dose.key }) }
              catch (error) { console.error('Browser reminder notification failed.', error) }
            }
            window.dispatchEvent(new CustomEvent('eldercare:reminder-due', { detail: dose }))
            if (dose.slot.startsWith('snooze:')) {
              planRef.current = { ...planRef.current, reminders: planRef.current.reminders.map((item) => item._id === reminder._id ? { ...item, snoozedUntil: null, snoozedSlot: '' } : item) }
            }
          } catch (error) {
            console.error('This reminder could not be delivered; checking other reminders.', error)
          }
        }
      } catch (error) {
        console.error('Reminder scheduling check failed.', error)
      } finally { inFlightRef.current = false }
    }
    void checkDue()
    const timer = window.setInterval(() => void checkDue(), 15_000)
    const onVisible = () => { if (document.visibilityState === 'visible') void checkDue() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      active = false
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [userId])

  return null
}
