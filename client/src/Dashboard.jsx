import { useEffect, useRef, useState } from 'react'
import { addCareReminder, addEmergencyContact, deleteCareReminder, deleteEmergencyContact, getCarePlan, getEmergencyContacts, markActivityCompleted, markMedicineTaken, saveCareProfile, sendAssistantMessage, snoozeMedicineReminder, updateCareReminder, updateEmergencyContact } from './api.js'
import { LanguageSelector, useLanguage } from './i18n.jsx'
import WeeklyReportPage from './WeeklyReportPage.jsx'
import { createWeeklyCareReport } from './weeklyCareReport.js'
import { indiaDate, reminderIsScheduledToday } from './reminderSchedule.js'
import { speakLocalized, SPEECH_LOCALES } from './speech.js'
import './Dashboard.css'

function localSlot(date, time) { return `${date}T${time}` }

function profileFrom(plan, language) {
  return {
    fullName: plan.person?.fullName || '', age: plan.person?.age ?? '', phone: plan.person?.phone || '', address: plan.person?.address || '',
    guardianName: plan.guardianName || '', guardianRelationship: plan.guardianRelationship || '', guardianPhone: plan.guardianPhone || '', emergencyPhone: plan.emergencyPhone || '',
    preferredLanguage: plan.preferredLanguage || language || 'en', reminderPreferences: plan.reminderPreferences || { notifications: true, sound: true },
    specialCareInstructions: plan.specialCareInstructions || '', additionalCareNotes: plan.additionalCareNotes || '',
  }
}

function VoiceAssistant() {
  const { language, t } = useLanguage()
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState([])
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const recognitionRef = useRef(null)
  const recognitionTimeoutRef = useRef(null)
  const mountedRef = useRef(true)
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (recognitionTimeoutRef.current !== null) window.clearTimeout(recognitionTimeoutRef.current)
      recognitionTimeoutRef.current = null
      recognitionRef.current?.stop()
      recognitionRef.current = null
      window.speechSynthesis?.cancel()
    }
  }, [])
  async function send(raw = message) {
    const text = raw.trim()
    if (!text || status === 'processing' || status === 'synthesizing') return
    const requestLanguage = language
    setMessage(''); setError(''); setMessages((current) => [...current, { role: 'user', text, language: requestLanguage }]); setStatus('processing')
    window.speechSynthesis?.cancel()
    try {
      const result = await sendAssistantMessage({ message: text, language: requestLanguage, history: messages.filter((entry) => !entry.language || entry.language === requestLanguage).slice(-12) })
      if (!mountedRef.current) return
      setMessages((current) => [...current, { role: 'assistant', text: result.reply, language: requestLanguage }])
      if (requestLanguage === 'kn') {
        setStatus('idle')
        return
      } else if ('speechSynthesis' in window) {
        setStatus('speaking')
        const started = await speakLocalized(result.reply, requestLanguage, {
          onend: () => setStatus('idle'),
          onerror: () => { setStatus('idle'); setError(t('assistantVoiceOutputFailed')) },
          onUnavailable: () => { setStatus('idle'); setError(t('assistantVoiceUnavailable')) },
        })
        if (!started) setStatus('idle')
      } else setStatus('idle')
    } catch (err) {
      if (!mountedRef.current) return
      const errorKey = err.code === 'KANNADA_TTS_NOT_CONFIGURED'
        ? 'assistantTtsNotConfigured'
        : err.code === 'KANNADA_TTS_QUOTA_EXCEEDED'
          ? 'assistantTtsQuota'
          : err.code === 'KANNADA_TTS_PLAYBACK_FAILED'
            ? 'assistantTtsPlaybackFailed'
              : err.code?.startsWith('KANNADA_TTS_')
              ? 'assistantTtsError'
              : err.code === 'AI_REQUEST_FAILED'
                ? 'assistantUnavailable'
                : err.code === 'AI_TEMPORARILY_UNAVAILABLE' || err.code === 'AI_TIMEOUT'
                  ? 'assistantUnavailable'
              : err.message?.includes('GEMINI_API_KEY') || err.code === 'AI_CONFIGURATION_ERROR'
                ? 'assistantConfig'
                : err.code === 'AI_QUOTA_EXCEEDED'
                  ? 'assistantQuota'
                  : err.code === 'AI_MODEL_UNAVAILABLE'
                    ? 'assistantModelUnavailable'
                    : err.name === 'TypeError'
                      ? 'assistantUnavailable'
                      : 'assistantUnavailable'
      setError(t(errorKey)); setStatus('idle')
    }
  }
  function listen() {
    if (!SpeechRecognition) return
    if (status === 'listening') {
      try { recognitionRef.current?.stop() } catch { /* Recognition may already have stopped. */ }
      if (recognitionTimeoutRef.current !== null) window.clearTimeout(recognitionTimeoutRef.current)
      recognitionTimeoutRef.current = null
      recognitionRef.current = null
      setStatus('idle')
      return
    }

    window.speechSynthesis?.cancel()
    let recognition
    let transcriptSubmitted = false
    let recognitionTimeout = null
    const finishRecognition = () => {
      if (recognitionTimeout !== null) window.clearTimeout(recognitionTimeout)
      if (recognitionTimeoutRef.current === recognitionTimeout) recognitionTimeoutRef.current = null
      if (recognitionRef.current === recognition) recognitionRef.current = null
    }

    try {
      recognition = new SpeechRecognition()
      recognition.lang = SPEECH_LOCALES[language] ?? SPEECH_LOCALES.en
      recognition.interimResults = false
      recognition.maxAlternatives = 1
      recognition.onresult = (event) => {
        if (transcriptSubmitted) return
        transcriptSubmitted = true
        const transcript = event.results?.[event.resultIndex ?? 0]?.[0]?.transcript?.trim()
        finishRecognition()
        if (transcript) void send(transcript)
        else { setStatus('idle'); setError(t('noSpeech')) }
      }
      recognition.onerror = (event) => {
        if (transcriptSubmitted) return
        transcriptSubmitted = true
        finishRecognition()
        setStatus('idle')
        if (event.error !== 'aborted') setError(t('noSpeech'))
      }
      recognition.onend = () => {
        finishRecognition()
        setStatus((value) => value === 'listening' ? 'idle' : value)
      }
      recognitionRef.current = recognition
      recognition.start()
      recognitionTimeout = window.setTimeout(() => {
        if (transcriptSubmitted) return
        transcriptSubmitted = true
        try { recognition.stop() } catch { /* Recognition may already have stopped. */ }
        finishRecognition()
        setStatus((value) => value === 'listening' ? 'idle' : value)
        setError(t('noSpeech'))
      }, 30_000)
      recognitionTimeoutRef.current = recognitionTimeout
      setStatus('listening')
      setError('')
    } catch {
      finishRecognition()
      setStatus('idle')
      setError(t('noSpeech'))
    }
  }
  const statusText = status === 'listening' ? t('listening') : status === 'processing' ? t('processing') : status === 'synthesizing' ? t('preparingKannadaAudio') : status === 'speaking' ? t('speaking') : t('ready')
  return <section className="assistant-card" id="voice-assistant" aria-labelledby="assistant-title"><div className="assistant-heading"><div><span className="assistant-eyebrow">ELDERCARE AI</span><h2 id="assistant-title">{t('assistantTitle')}</h2><p>{t('assistantHint')}</p></div><span className={`assistant-status assistant-status--${status}`} role="status"><i />{statusText}</span></div><div className="assistant-conversation" aria-live="polite">{messages.length === 0 && <p className="assistant-empty">{t('ready')}</p>}{messages.map((entry, index) => <article className={`chat-message chat-message--${entry.role}`} key={`${entry.role}-${index}`}><strong>{entry.role === 'user' ? t('you') : 'ElderCare AI'}</strong><p>{entry.text}</p></article>)}</div>{!SpeechRecognition && <p className="assistant-fallback">{t('noSpeech')}</p>}{error && <p className="assistant-error" role="alert">{error}</p>}<form className="assistant-controls" onSubmit={(event) => { event.preventDefault(); void send() }}><button className="assistant-mic" type="button" onClick={listen} disabled={!SpeechRecognition || status === 'processing' || status === 'synthesizing'} aria-label={t('startListening')}>{status === 'listening' ? '■' : '🎙'}</button><input value={message} onChange={(event) => setMessage(event.target.value)} placeholder={t('messagePlaceholder')} aria-label={t('messagePlaceholder')} maxLength={2000} /><button className="assistant-send" type="submit" disabled={!message.trim() || status === 'processing' || status === 'synthesizing'}>{t('send')}</button></form></section>
}

const localDate = indiaDate

function readMoodCheckins(userId) {
  try {
    const saved = window.localStorage.getItem(`eldercare-moods:${userId}`)
    const entries = saved ? JSON.parse(saved) : []
    return Array.isArray(entries) ? entries.filter((entry) => ['happy', 'okay', 'sad', 'worried'].includes(entry.mood) && /^\d{4}-\d{2}-\d{2}$/.test(entry.date)) : []
  } catch { return [] }
}

export default function Dashboard({ user, onLogout, onNavigate, page = 'home' }) {
  const { language, t, dashboard } = useLanguage(); const words = dashboard.copy; const med = dashboard.medicationCopy; const activityText = dashboard.activityCopy; const contactText = dashboard.contactCopy; const navText = dashboard.dashboardNavigation; const extraText = dashboard.extraPageCopy; const carePlanTitle = t('carePlanTitle'); const weeklySummaryTitle = t('weeklySummary'); const [now, setNow] = useState(() => new Date())
  const [plan, setPlan] = useState({ reminders: [], moods: [], emergencyPhone: '', guardianName: '', guardianPhone: '' })
  const [dailyRoutine, setDailyRoutine] = useState(null)
  const [routineLoading, setRoutineLoading] = useState('')
  const [routineError, setRoutineError] = useState(null)
  const [profileDraft, setProfileDraft] = useState({ fullName: user.name || '', age: '', phone: '', address: '', guardianName: '', guardianRelationship: '', guardianPhone: '', emergencyPhone: '', preferredLanguage: language, reminderPreferences: { notifications: true, sound: true }, specialCareInstructions: '', additionalCareNotes: '' })
  const languageRef = useRef(language)
  useEffect(() => { languageRef.current = language }, [language])
  const [moodCheckins, setMoodCheckins] = useState(() => readMoodCheckins(user.id))
  const [loadedPage, setLoadedPage] = useState(''); const loading = page !== 'mood' && loadedPage !== page; const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [adding, setAdding] = useState(''); const [editingReminder, setEditingReminder] = useState(''); const [draft, setDraft] = useState(() => ({ title: '', medicineName: '', description: '', time: '09:00', date: localDate(new Date()), times: ['09:00'], repeatDays: [], dosage: '', instructions: '', frequency: 'daily', kind: 'medicine' })); const [emergencyContacts, setEmergencyContacts] = useState([]); const [contactDraft, setContactDraft] = useState({ name: '', relationship: '', phone: '' }); const [editingContact, setEditingContact] = useState(''); const [permission, setPermission] = useState(() => typeof window !== 'undefined' && 'Notification' in window ? window.Notification.permission : 'unsupported'); const [dueQueue, setDueQueue] = useState([])
  useEffect(() => {
    if (page === 'mood') return undefined
    let active = true
    const loadData = page === 'summary' || page === 'weeklyReport'
      ? getCarePlan().then(({ carePlan }) => { if (active) { setPlan(carePlan); setProfileDraft(profileFrom(carePlan, languageRef.current)) } })
      : Promise.all([getCarePlan(), getEmergencyContacts()]).then(([{ carePlan }, { contacts: savedContacts }]) => { if (active) { setPlan(carePlan); setProfileDraft(profileFrom(carePlan, languageRef.current)); setEmergencyContacts(savedContacts) } })
    loadData.catch(() => { if (active) setError(words.error) }).finally(() => { if (active) setLoadedPage(page) })
    return () => { active = false }
  }, [page, words.error])
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 60000); return () => window.clearInterval(timer) }, [])
  useEffect(() => {
    const onDue = (event) => setDueQueue((queue) => queue.some((item) => item.key === event.detail.key) ? queue : [...queue, event.detail])
    window.addEventListener('eldercare:reminder-due', onDue)
    return () => window.removeEventListener('eldercare:reminder-due', onDue)
  }, [])
  const today = localDate(now); const todayItems = plan.reminders.filter((item) => reminderIsScheduledToday(item, now)); const medicines = todayItems.filter((item) => item.kind === 'medicine'); const medicineReminders = plan.reminders.filter((item) => item.kind === 'medicine'); const activities = todayItems.filter((item) => item.kind === 'activity'); const allActivities = plan.reminders.filter((item) => item.kind === 'activity'); const moodToday = moodCheckins.some((entry) => entry.date === today)
  const medicineDoseTotal = medicines.reduce((total, item) => total + (item.times?.length || 1), 0)
  const medicineDoseTaken = medicines.reduce((total, item) => total + (item.times?.length ? item.times : [item.time]).filter((time) => (item.takenSlots ?? []).includes(localSlot(today, time))).length, 0)
  const weeklyReport = createWeeklyCareReport({ ...plan, moods: [...(plan.moods ?? []), ...moodCheckins] }, now, user.name, t)
  const hour = now.getHours(); const greeting = hour < 12 ? words.morning : hour < 18 ? words.afternoon : words.evening
  async function action(fn, success) { setError(''); setNotice(''); try { const result = await fn(); if (result?.carePlan) { setPlan((current) => ({ ...current, ...result.carePlan })); window.dispatchEvent(new Event('eldercare:reminders-updated')) } if (result?.contacts) setEmergencyContacts(result.contacts); if (success) setNotice(success); return true } catch { setError(words.error); return false } }
  async function generateDailyRoutine() {
    const requestLanguage = languageRef.current
    if (routineLoading === requestLanguage) return
    const languageName = { en: 'English', hi: 'Hindi', kn: 'Kannada' }[requestLanguage] ?? 'English'
    setRoutineLoading(requestLanguage); setRoutineError(null); setDailyRoutine(null)
    try {
      const result = await sendAssistantMessage({ message: `Suggest a gentle, practical one-day routine for an older adult. Write only in ${languageName}, using its normal script. Use a short list with simple time suggestions. Do not recommend medicines, doses, or medical treatment.`, language: requestLanguage, history: [] })
      if (languageRef.current === requestLanguage) setDailyRoutine({ language: requestLanguage, text: result.reply })
    } catch {
      if (languageRef.current === requestLanguage) setRoutineError({ language: requestLanguage, text: activityText.routineError })
    } finally {
      setRoutineLoading((current) => current === requestLanguage ? '' : current)
    }
  }
  async function saveProfile(event) { event.preventDefault(); setError(''); setNotice(''); try { const { carePlan } = await saveCareProfile(profileDraft); setPlan(carePlan); window.dispatchEvent(new Event('eldercare:reminders-updated')); setProfileDraft(profileFrom(carePlan, language)); setNotice(t('careProfileSaved')) } catch { setError(words.error) } }
  function checkInMood(mood) {
    const next = [...moodCheckins.filter((entry) => entry.date !== today), { mood, date: today }]
    setMoodCheckins(next)
    try { window.localStorage.setItem(`eldercare-moods:${user.id}`, JSON.stringify(next)) } catch { setError(words.error); return }
    setError(''); setNotice(words.moodSaved)
  }
  async function addReminder(event) { event.preventDefault(); if (adding === 'activity' && draft.frequency === 'custom' && !draft.repeatDays.length) { setError(activityText.chooseDays); return } const isMedicine = adding === 'medicine'; const medicineName = draft.medicineName.trim(); const payload = isMedicine ? { title: medicineName, medicineName, type: 'medicine', kind: 'medicine', language, dosage: draft.dosage.trim(), instructions: draft.instructions.trim(), time: draft.times[0], times: draft.times, date: draft.date, frequency: draft.frequency } : { title: draft.title.trim(), activityName: draft.title.trim(), description: draft.description.trim(), type: 'activity', kind: 'activity', language, time: draft.time, date: draft.date, frequency: draft.frequency, repeatDays: draft.repeatDays }; const ok = await action(() => editingReminder ? updateCareReminder(editingReminder, payload) : addCareReminder(payload)); if (ok) { setDraft({ title: '', medicineName: '', description: '', time: '09:00', date: today, times: ['09:00'], repeatDays: [], dosage: '', instructions: '', frequency: adding === 'activity' ? 'once' : 'daily', kind: adding }); setAdding(''); setEditingReminder('') } }
  async function saveEmergencyContact(event) { event.preventDefault(); const digits = contactDraft.phone.replace(/\D/g, ''); if (digits.length < 7 || digits.length > 15 || !contactDraft.name.trim() || !contactDraft.relationship.trim()) { setError(contactText.invalid); return } const ok = await action(() => editingContact ? updateEmergencyContact(editingContact, contactDraft) : addEmergencyContact(contactDraft)); if (ok) { setContactDraft({ name: '', relationship: '', phone: '' }); setEditingContact('') } }
  async function removeEmergencyContact(id) { if (!window.confirm(contactText.remove + '?')) return; await action(() => deleteEmergencyContact(id)) }
  async function enableNotifications() { if (!('Notification' in window)) { setPermission('unsupported'); return } const result = await window.Notification.requestPermission(); setPermission(result) }
  async function markTaken(dose) { const completedSlot = dose.reminder.snoozedSlot || dose.slot; const ok = await action(() => dose.reminder.kind === 'activity' ? markActivityCompleted(dose.reminder._id, completedSlot) : markMedicineTaken(dose.reminder._id, dose.slot, completedSlot), dose.reminder.kind === 'activity' ? activityText.completedShort : med.takenMessage); if (ok) setDueQueue((queue) => queue.filter((item) => item.key !== dose.key)) }
  async function snoozeDose(dose) { const result = await action(() => snoozeMedicineReminder(dose.reminder._id, dose.slot)); if (result) { setDueQueue((queue) => queue.filter((item) => item.key !== dose.key)); setNotice('') } }

  const currentDose = dueQueue[0]
  const renderList = (items, kind) => <div className="care-list">
    {kind === 'activity' && <div className="routine-suggestion-box"><p>{activityText.routineHint}</p><button type="button" className="care-add" onClick={() => void generateDailyRoutine()} disabled={routineLoading === language}>{routineLoading === language ? activityText.routineLoading : activityText.generateRoutine}</button>{routineError?.language === language && <p className="assistant-error" role="alert">{routineError.text}</p>}{dailyRoutine?.language === language && <p className="routine-suggestion" role="status">{dailyRoutine.text}</p>}</div>}
    {items.length === 0 && <p className="care-empty">{words.empty}</p>}
    {items.map((item) => {
      const time = item.times?.[0] ?? item.time
      const displayName = kind === 'medicine' ? (item.medicineName || item.title) : (item.activityName || item.title)
      const slotDate = reminderIsScheduledToday(item, now) ? today : item.date
      const slot = localSlot(slotDate, time)
      const completed = kind === 'medicine' ? (item.takenSlots ?? []).includes(slot) : (item.completedSlots ?? []).includes(slot) || item.done
      const completionDisabled = completed || slotDate !== today
      const repeatLabel = kind === 'activity' ? (activityText[item.frequency ?? 'once'] ?? med[item.frequency ?? 'once']) : med[item.frequency ?? 'once']
      const reminderDate = new Intl.DateTimeFormat(language === 'kn' ? 'kn-IN' : language === 'hi' ? 'hi-IN' : 'en-IN', { dateStyle: 'medium' }).format(new Date(`${item.date}T12:00:00`))
      return <article className={`care-item${item.done ? ' care-item--done' : ''}`} key={item._id}>
        <span className="care-item-time">{(item.times?.length ? item.times : [item.time]).join(' · ')}</span>
        <span className="care-item-title">{displayName}<small className="care-item-detail">{kind === 'medicine' ? `${item.dosage} · ${reminderDate} · ${repeatLabel}${item.instructions ? ` · ${item.instructions}` : ''}` : `${reminderDate} · ${repeatLabel}${item.description ? ` · ${item.description}` : ''}`}</small></span>
        <button type="button" className="care-item-toggle" disabled={completionDisabled} onClick={() => void action(() => kind === 'medicine' ? markMedicineTaken(item._id, slot) : markActivityCompleted(item._id, slot))}>{completed ? (kind === 'medicine' ? med.takenShort : activityText.completedShort) : (kind === 'medicine' ? med.taken : activityText.completed)}</button>
        {kind === 'medicine' && <button type="button" className="care-item-toggle" onClick={() => { setAdding('medicine'); setEditingReminder(item._id); setError(''); setDraft({ title: item.title || item.medicineName || '', medicineName: item.medicineName || item.title || '', time: item.times?.[0] || item.time, date: item.date, times: item.times?.length ? item.times : [item.time], repeatDays: [], dosage: item.dosage || '', instructions: item.instructions || '', frequency: item.frequency || 'daily', kind: 'medicine' }) }}>{med.edit}</button>}
        <button type="button" className="care-item-remove" aria-label={`${words.remove}: ${displayName}`} onClick={() => void action(() => deleteCareReminder(item._id))}>×</button>
      </article>
    })}
    <button type="button" className="care-add" onClick={() => { setEditingReminder(''); setDraft({ title: '', medicineName: '', description: '', time: '09:00', date: today, times: ['09:00'], repeatDays: [], dosage: '', instructions: '', frequency: kind === 'activity' ? 'once' : 'daily', kind }); setAdding(kind) }}>{kind === 'activity' ? `＋ ${activityText.generate}` : `＋ ${med.generate}`}</button>
  </div>

  const openCall = (event) => { if (!window.confirm(contactText.confirm)) event.preventDefault() }
  function goBack() {
    onNavigate('/dashboard')
  }

  return <main className="dashboard-page">
    <header className="dashboard-header"><a className="dashboard-brand" href="/" aria-label={t('brandHomeAria')}><span aria-hidden="true">♡</span> ElderCare <b>AI</b></a>
      <nav className="dashboard-nav" aria-label={t('dashboard')}>
        {[["home", "/dashboard", navText.home], ["medicine", "/reminders", words.medicines], ["activities", "/activities", words.activities], ["mood", "/mood", words.mood], ["assistant", "/assistant", words.assistant], ["contacts", "/contacts", contactText.title], ["carePlan", "/care-plan", carePlanTitle], ["summary", "/summary", weeklySummaryTitle]].map(([id, href, label]) => <a key={id} className={`${id === 'home' ? 'dashboard-home-link' : ''}${(page === id || (id === 'summary' && page === 'weeklyReport')) ? ' dashboard-nav-link--active' : ''}`} href={href} aria-current={page === id || (id === 'summary' && page === 'weeklyReport') ? 'page' : undefined}>{id === 'home' && <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V10Z" /></svg>}<span>{label}</span></a>)}
      </nav>
      <div className="dashboard-actions"><LanguageSelector /><button type="button" className="dashboard-logout" onClick={onLogout}>{t('logout')}</button></div>
    </header>
    <div className="dashboard-content">
      {page !== 'home' && <button type="button" className="dashboard-back-link dashboard-back-button" onClick={goBack}>{navText.back}</button>}
      <section className="dashboard-welcome"><span className="dashboard-kicker">{page === 'activities' ? words.activities : page === 'contacts' ? contactText.title : page === 'carePlan' ? carePlanTitle : page === 'summary' ? weeklySummaryTitle : page === 'medicine' ? words.medicines : page === 'mood' ? words.mood : page === 'assistant' ? words.assistant : words.today} · {new Intl.DateTimeFormat(language === 'kn' ? 'kn-IN' : language === 'hi' ? 'hi-IN' : 'en-IN', { dateStyle: 'full' }).format(now)}</span><h1>{greeting}, {user.name.split(' ')[0]}</h1><p>{words.subtitle}</p></section>
      {error && page !== 'weeklyReport' && <p className="care-notice care-notice--error" role="alert">{error}</p>}{notice && <p className="care-notice" role="status">{notice}</p>}{loading && page !== 'weeklyReport' && <p className="care-notice" role="status">{words.saving}</p>}

      {page === 'activities' && <section className="care-section"><div className="section-title"><span>🌿</span><div><h2>{words.activities}</h2><p>{words.subtitle}</p></div></div><p className="reminder-limit">{med.browserLimit}</p><button type="button" className="care-add" onClick={() => void enableNotifications()}>{permission === 'default' ? med.enable : med.activateSound}</button>{renderList(allActivities, 'activity')}</section>}

      {page === 'medicine' && <section className="care-section" id="reminders"><div className="section-title"><span>💊</span><div><h2>{words.medicines}</h2><p>{medicines.length} {words.due}</p></div></div><p className="reminder-limit">{med.browserLimit}</p><button type="button" className="care-add" onClick={() => void enableNotifications()}>{permission === 'default' ? med.enable : med.activateSound}</button>{permission === 'denied' && <p className="care-empty">{med.permission}</p>}{permission === 'unsupported' && <p className="care-empty">{med.permission}</p>}{renderList(medicineReminders, 'medicine')}</section>}

      {page === 'mood' && <section className="care-section mood-section" id="mood"><div className="section-title"><span>💛</span><div><h2>{words.mood}</h2><p>{words.chooseMood}</p></div></div><div className="mood-options">{['happy', 'okay', 'sad', 'worried'].map((mood) => <button key={mood} type="button" className={`mood-button${moodCheckins.find((entry) => entry.date === today)?.mood === mood ? ' mood-button--selected' : ''}`} aria-pressed={moodCheckins.find((entry) => entry.date === today)?.mood === mood} onClick={() => checkInMood(mood)}><span>{({ happy: '😊', okay: '🙂', sad: '😢', worried: '😟' })[mood]}</span>{words[mood]}</button>)}</div>{moodToday && <p className="mood-thanks" role="status">{words.moodSaved}</p>}</section>}

      {page === 'contacts' && <section className="care-section"><div className="section-title"><span>🆘</span><div><h2>{contactText.title}</h2><p>{words.emergency}</p></div></div>
        {emergencyContacts.length === 0 && <p className="care-empty">{contactText.empty}</p>}
        <div className="emergency-contact-list">{emergencyContacts.map((contact) => <article className="emergency-contact-card" key={contact._id}><div><h3>{contact.name}</h3><p>{contact.relationship} · {contact.phone}</p></div><div className="emergency-contact-actions"><a className="guardian-call" href={`tel:${contact.phone.replace(/[^+\d]/g, '')}`} onClick={openCall}>☎ {contactText.call}</a><button type="button" className="care-item-toggle" onClick={() => { setEditingContact(contact._id); setContactDraft({ name: contact.name, relationship: contact.relationship, phone: contact.phone }) }}>{contactText.edit}</button><button type="button" className="care-item-remove" onClick={() => void removeEmergencyContact(contact._id)}>{contactText.remove}</button></div></article>)}</div>
        <form className="contacts-form emergency-contact-form" onSubmit={saveEmergencyContact}><label>{contactText.name}<input required maxLength={100} value={contactDraft.name} onChange={(event) => setContactDraft({ ...contactDraft, name: event.target.value })} /></label><label>{contactText.relationship}<input required maxLength={50} value={contactDraft.relationship} onChange={(event) => setContactDraft({ ...contactDraft, relationship: event.target.value })} /></label><label>{contactText.phone}<input required type="tel" inputMode="tel" pattern="[+0-9() .-]{7,20}" maxLength={20} value={contactDraft.phone} onChange={(event) => setContactDraft({ ...contactDraft, phone: event.target.value })} /></label><div className="emergency-contact-actions"><button className="contact-save" type="submit">{editingContact ? contactText.save : contactText.add}</button>{editingContact && <button type="button" className="care-item-toggle" onClick={() => { setEditingContact(''); setContactDraft({ name: '', relationship: '', phone: '' }) }}>{contactText.cancel}</button>}</div></form>
      </section>}

      {page === 'carePlan' && <section className="care-section care-profile-section">
        <div className="section-title"><span>💚</span><div><h2>{carePlanTitle}</h2><p>{t('carePlanSubtitle')}</p></div></div>
        <form className="care-profile-form" onSubmit={saveProfile}>
          <fieldset><legend>{t('elderlyPerson')}</legend><div className="care-profile-fields">
            <label>{t('fullName')}<input required minLength={2} maxLength={100} value={profileDraft.fullName} onChange={(e) => setProfileDraft({ ...profileDraft, fullName: e.target.value })} /></label>
            <label>{t('age')}<input type="number" min="0" max="130" value={profileDraft.age} onChange={(e) => setProfileDraft({ ...profileDraft, age: e.target.value })} /></label>
            <label>{t('phoneNumber')}<input type="tel" maxLength={20} value={profileDraft.phone} onChange={(e) => setProfileDraft({ ...profileDraft, phone: e.target.value })} /></label>
            <label>{t('addressOptional')}<input maxLength={300} value={profileDraft.address} onChange={(e) => setProfileDraft({ ...profileDraft, address: e.target.value })} /></label>
          </div></fieldset>
          <fieldset><legend>{t('guardianContacts')}</legend><div className="care-profile-fields">
            <label>{t('guardianName')}<input maxLength={100} value={profileDraft.guardianName} onChange={(e) => setProfileDraft({ ...profileDraft, guardianName: e.target.value })} /></label>
            <label>{t('relationship')}<input maxLength={50} value={profileDraft.guardianRelationship} onChange={(e) => setProfileDraft({ ...profileDraft, guardianRelationship: e.target.value })} /></label>
            <label>{t('guardianPhone')}<input type="tel" maxLength={20} value={profileDraft.guardianPhone} onChange={(e) => setProfileDraft({ ...profileDraft, guardianPhone: e.target.value })} /></label>
            <label>{t('emergencyContactNumber')}<input type="tel" maxLength={20} value={profileDraft.emergencyPhone} onChange={(e) => setProfileDraft({ ...profileDraft, emergencyPhone: e.target.value })} /></label>
          </div></fieldset>
          <fieldset><legend>{t('carePreferences')}</legend><div className="care-profile-fields">
            <label>{t('preferredLanguage')}<select value={profileDraft.preferredLanguage} onChange={(e) => setProfileDraft({ ...profileDraft, preferredLanguage: e.target.value })}><option value="en">English</option><option value="kn">ಕನ್ನಡ</option><option value="hi">हिन्दी</option></select></label>
            <label className="care-profile-check"><input type="checkbox" checked={profileDraft.reminderPreferences.notifications} onChange={(e) => setProfileDraft({ ...profileDraft, reminderPreferences: { ...profileDraft.reminderPreferences, notifications: e.target.checked } })} /> {t('reminderNotifications')}</label>
            <label className="care-profile-check"><input type="checkbox" checked={profileDraft.reminderPreferences.sound} onChange={(e) => setProfileDraft({ ...profileDraft, reminderPreferences: { ...profileDraft.reminderPreferences, sound: e.target.checked } })} /> {t('reminderSound')}</label>
            <label>{t('specialCareInstructions')}<textarea rows="3" maxLength={2000} value={profileDraft.specialCareInstructions} onChange={(e) => setProfileDraft({ ...profileDraft, specialCareInstructions: e.target.value })} /></label>
            <label>{t('additionalCareNotes')}<textarea rows="3" maxLength={2000} value={profileDraft.additionalCareNotes} onChange={(e) => setProfileDraft({ ...profileDraft, additionalCareNotes: e.target.value })} /></label>
          </div></fieldset>
          <button className="contact-save" type="submit">{t('saveCareProfile')}</button>
        </form>
        <div className="care-profile-records">
          <section><h3>{t('savedMedicines')}</h3>{plan.reminders.filter((item) => item.kind === 'medicine').length ? <ul>{plan.reminders.filter((item) => item.kind === 'medicine').map((item) => <li key={item._id}><strong>{item.medicineName || item.title}</strong><span>{item.dosage || t('dosageNotRecorded')} · {(item.times?.length ? item.times : [item.time]).join(', ')} · {med[item.frequency] || item.frequency}</span></li>)}</ul> : <p className="care-empty">{t('noMedicineSaved')}</p>}</section>
          <section><h3>{t('dailyActivities')}</h3>{plan.reminders.filter((item) => item.kind === 'activity').length ? <ul>{plan.reminders.filter((item) => item.kind === 'activity').map((item) => <li key={item._id}><strong>{item.activityName || item.title}</strong><span>{item.times?.join(', ') || item.time} · {new Intl.DateTimeFormat(language === 'kn' ? 'kn-IN' : language === 'hi' ? 'hi-IN' : 'en-IN').format(new Date(`${item.date}T12:00:00`))} · {med[item.frequency] || item.frequency}</span></li>)}</ul> : <p className="care-empty">{t('noActivitiesSaved')}</p>}</section>
        </div>
        <p className="care-profile-source-note">{t('carePlanSourceNote')}</p>
      </section>}

      {page === 'assistant' && <VoiceAssistant key={language} />}

      {page === 'summary' && <section className="care-section weekly-summary-preview"><div className="section-title"><span>📈</span><div><h2>{weeklySummaryTitle}</h2><p>{t('weeklySummarySubtitle')}</p></div></div>{error ? <p className="care-empty">{t('reportLoadError')}</p> : <><div className="overview-strip summary-strip"><article><span className="overview-icon">💊</span><div><strong>{weeklyReport.medicineTotals.adherence === null ? '—' : `${weeklyReport.medicineTotals.adherence}%`}</strong><small>{t('medicineAdherence')}</small></div></article><article><span className="overview-icon">🌿</span><div><strong>{weeklyReport.activityTotals.completion === null ? '—' : `${weeklyReport.activityTotals.completion}%`}</strong><small>{t('activityCompletion')}</small></div></article><article><span className="overview-icon">💛</span><div><strong>{weeklyReport.moodCount}/7</strong><small>{t('moodCheckins')}</small></div></article></div><h3 className="summary-subheading">{t('importantObservations')}</h3><ul className="weekly-summary-observations">{weeklyReport.observations.map((item) => <li key={item}>{item}</li>)}</ul></>}<a className="care-add" href="/weekly-report">{t('viewFullReport')}</a></section>}

      {page === 'weeklyReport' && <WeeklyReportPage report={weeklyReport} loading={loading} error={error} language={language} />}

      {page === 'home' && <>
        <section className="overview-strip" aria-label={words.today}><article><span className="overview-icon">💊</span><div><strong>{medicineDoseTaken}/{medicineDoseTotal}</strong><small>{words.medicines}</small></div></article><article><span className="overview-icon">🌿</span><div><strong>{activities.reduce((sum, item) => sum + ((item.completedSlots ?? []).includes(localSlot(today, item.times?.[0] ?? item.time)) || item.done ? 1 : 0), 0)}/{activities.length}</strong><small>{words.activities}</small></div></article><article><span className="overview-icon">💛</span><div><strong>{moodToday ? '✓' : '—'}</strong><small>{words.mood}</small></div></article></section>
        <section className="dashboard-features" aria-label={t('features')}>
          {[
            { href: '/reminders', icon: '💊', title: words.medicines, hint: navText.medicineHint },
            { href: '/activities', icon: '🌿', title: words.activities, hint: navText.activitiesHint },
            { href: '/mood', icon: '💛', title: words.mood, hint: navText.moodHint },
            { href: '/contacts', icon: '🆘', title: words.emergency, hint: navText.emergencyHint },
            { href: '/care-plan', icon: '💚', title: carePlanTitle, hint: extraText.carePlanHint ?? extraText.emptyGuardian },
            { href: '/summary', icon: '📈', title: weeklySummaryTitle, hint: t('weeklySummarySubtitle') },
            { href: '/assistant', icon: '🎙', title: words.assistant, hint: navText.assistantHint },
          ].map((feature) => <a className="dashboard-feature-card" href={feature.href} key={feature.href}><span className="dashboard-feature-icon" aria-hidden="true">{feature.icon}</span><span className="dashboard-feature-text"><strong>{feature.title}</strong><small>{feature.hint}</small></span><span className="dashboard-feature-arrow" aria-hidden="true">→</span></a>)}
        </section>
      </>}
    </div>

    {currentDose && <div className="modal-backdrop"><section className="reminder-alert" role="alertdialog" aria-modal="true" aria-labelledby="due-title"><span className="due-icon">🔔</span><h2 id="due-title">{currentDose.reminder.kind === 'activity' ? activityText.speak : med.snoozePrefix}</h2><p className="due-medicine">{currentDose.reminder.title}</p><p>{currentDose.reminder.kind === 'activity' ? activityText.dateTime : `${currentDose.reminder.dosage} · ${currentDose.reminder.times?.join(', ') ?? currentDose.reminder.time}`}</p><div className="modal-actions"><button type="button" className="reminder-snooze" onClick={() => void snoozeDose(currentDose)}>{currentDose.reminder.kind === 'activity' ? activityText.snooze : med.snooze}</button><button type="button" className="contact-save" onClick={() => void markTaken(currentDose)}>{currentDose.reminder.kind === 'activity' ? activityText.completed : med.taken}</button></div></section></div>}

    {adding && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) { setAdding(''); setEditingReminder('') } }}><form className="reminder-modal" onSubmit={addReminder}><h2>{editingReminder ? `${med.edit} ${words.medicine}` : adding === 'medicine' ? med.generate : activityText.generate}</h2><label>{adding === 'medicine' ? med.name : activityText.name}<input autoFocus required maxLength={100} value={adding === 'medicine' ? draft.medicineName : draft.title} onChange={(event) => setDraft({ ...draft, ...(adding === 'medicine' ? { medicineName: event.target.value } : { title: event.target.value }) })} /></label>{adding === 'activity' && <label>{activityText.description}<textarea rows="3" maxLength={500} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>}
      {adding === 'medicine' ? <><label>{med.dosage}<input required maxLength={60} value={draft.dosage} onChange={(event) => setDraft({ ...draft, dosage: event.target.value })} placeholder="500 mg" /></label><label>{med.date}<input type="date" required value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} /></label><fieldset className="schedule-times"><legend>{med.times}</legend>{draft.times.map((time, index) => <div className="schedule-time-row" key={`time-${index}`}><input aria-label={`${med.times} ${index + 1}`} type="time" required value={time} onChange={(event) => setDraft({ ...draft, times: draft.times.map((value, timeIndex) => timeIndex === index ? event.target.value : value) })} />{draft.times.length > 1 && <button type="button" onClick={() => setDraft({ ...draft, times: draft.times.filter((_, timeIndex) => timeIndex !== index) })}>×</button>}</div>)}{draft.times.length < 6 && <button type="button" className="care-add" onClick={() => setDraft({ ...draft, times: [...draft.times, '18:00'] })}>＋ {med.addTime}</button>}</fieldset><label>{med.frequency}<select value={draft.frequency} onChange={(event) => setDraft({ ...draft, frequency: event.target.value })}>{['once', 'daily', 'weekly'].map((frequency) => <option key={frequency} value={frequency}>{med[frequency]}</option>)}</select></label><label>{med.instructions}<textarea rows="3" maxLength={500} value={draft.instructions} onChange={(event) => setDraft({ ...draft, instructions: event.target.value })} /></label></> : <><label>{words.time}<input type="time" required value={draft.time} onChange={(event) => setDraft({ ...draft, time: event.target.value })} /></label><label>{activityText.date}<input type="date" required value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} /></label><label>{activityText.repeat}<select value={draft.frequency} onChange={(event) => setDraft({ ...draft, frequency: event.target.value })}>{['once', 'daily', 'weekly', 'custom'].map((frequency) => <option key={frequency} value={frequency}>{activityText[frequency]}</option>)}</select></label>{draft.frequency === 'weekly' && <p className="repeat-hint">{t('repeatWeekdayHint')}</p>}{draft.frequency === 'custom' && <fieldset className="repeat-days"><legend>{activityText.repeatDays}</legend><div>{Array.from({ length: 7 }, (_, day) => { const label = new Intl.DateTimeFormat(language === 'kn' ? 'kn-IN' : language === 'hi' ? 'hi-IN' : 'en-IN', { weekday: 'long' }).format(new Date(2024, 0, 7 + day)); return <label key={day}><input type="checkbox" checked={draft.repeatDays.includes(day)} onChange={(event) => setDraft({ ...draft, repeatDays: event.target.checked ? [...draft.repeatDays, day].sort() : draft.repeatDays.filter((value) => value !== day) })} />{label}</label> })}</div></fieldset>}</>}
      <div className="modal-actions"><button type="button" onClick={() => { setAdding(''); setEditingReminder('') }}>{words.cancel}</button><button className="contact-save" type="submit">{words.save}</button></div></form></div>}
  </main>
}
