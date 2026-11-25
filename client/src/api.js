const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001').replace(/\/+$/, '')
const AUTH_TOKEN_KEY = 'eldercare-auth-token'

export function getAuthToken() {
  return window.localStorage.getItem(AUTH_TOKEN_KEY) || window.sessionStorage.getItem(AUTH_TOKEN_KEY)
}

export function saveAuthToken(token, remember = false) {
  window.localStorage.removeItem(AUTH_TOKEN_KEY)
  window.sessionStorage.removeItem(AUTH_TOKEN_KEY)
  ;(remember ? window.localStorage : window.sessionStorage).setItem(AUTH_TOKEN_KEY, token)
}

export function clearAuthToken() {
  window.localStorage.removeItem(AUTH_TOKEN_KEY)
  window.sessionStorage.removeItem(AUTH_TOKEN_KEY)
}

async function requestJson(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, options)
  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(result.message || `Request failed with HTTP ${response.status}`)
    error.status = response.status
    error.code = result.code
    throw error
  }
  return result
}

export async function registerUser({ name, email, password }) {
  return requestJson('/api/auth/register', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  })
}

export async function loginUser({ email, password }) {
  return requestJson('/api/auth/login', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
}

export async function getCurrentUser() {
  return requestJson('/api/auth/me', {
    headers: { Accept: 'application/json', Authorization: `Bearer ${getAuthToken()}` },
  })
}

export async function sendAssistantMessage({ message, language, history }) {
  return requestJson('/api/assistant/chat', {
    method: 'POST',
    signal: AbortSignal.timeout(45_000),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getAuthToken()}`,
    },
    body: JSON.stringify({ message, language, history }),
  })
}

export async function synthesizeKannadaSpeech({ text, language }) {
  return requestJson('/api/assistant/speech', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getAuthToken()}`,
    },
    body: JSON.stringify({ text, language }),
  })
}

async function careRequest(path, options = {}) {
  return requestJson(`/api/care${path}`, {
    ...options,
    headers: { Accept: 'application/json', Authorization: `Bearer ${getAuthToken()}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
  })
}

export const getCarePlan = () => careRequest('/')
export const addCareReminder = (reminder) => {
  const name = reminder.kind === 'medicine' ? reminder.medicineName ?? reminder.title : reminder.activityName ?? reminder.title
  const { language = 'en', ...fields } = reminder
  const payload = reminder.kind === 'medicine'
    ? { ...fields, language, type: 'medicine', medicineName: name }
    : { ...fields, language, type: 'activity', activityName: name }
  return careRequest('/reminders', { method: 'POST', body: JSON.stringify(payload) })
}
export const updateCareReminder = (id, reminder) => careRequest(`/reminders/${id}`, { method: 'PATCH', body: JSON.stringify(reminder) })
export const deleteCareReminder = (id) => careRequest(`/reminders/${id}`, { method: 'DELETE' })
export const claimMedicineNotification = (id, slot) => careRequest(`/reminders/${id}/claim`, { method: 'POST', body: JSON.stringify({ slot }) })
export const claimReminderNotification = claimMedicineNotification
export const markMedicineTaken = (id, slot, takenSlot = slot) => careRequest(`/reminders/${id}/taken`, { method: 'PATCH', body: JSON.stringify({ slot, takenSlot }) })
export const snoozeMedicineReminder = (id, slot) => careRequest(`/reminders/${id}/snooze`, { method: 'POST', body: JSON.stringify({ slot }) })
export const markActivityCompleted = (id, slot) => careRequest(`/reminders/${id}/completed`, { method: 'PATCH', body: JSON.stringify({ slot }) })
export const getEmergencyContacts = () => careRequest('/emergency-contacts')
export const addEmergencyContact = (contact) => careRequest('/emergency-contacts', { method: 'POST', body: JSON.stringify(contact) })
export const updateEmergencyContact = (id, contact) => careRequest(`/emergency-contacts/${id}`, { method: 'PUT', body: JSON.stringify(contact) })
export const deleteEmergencyContact = (id) => careRequest(`/emergency-contacts/${id}`, { method: 'DELETE' })
export const saveMoodCheckin = (mood, date) => careRequest('/moods', { method: 'POST', body: JSON.stringify({ mood, date }) })
export const saveCareContacts = (contacts) => careRequest('/contacts', { method: 'PUT', body: JSON.stringify(contacts) })
export const saveCareProfile = (profile) => careRequest('/profile', { method: 'PUT', body: JSON.stringify(profile) })

export async function getBackendHealth() {
  const response = await fetch(`${API_BASE_URL}/api/health`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error(`Health check failed with HTTP ${response.status}`)
  }

  const result = await response.json()

  if (result.status !== 'ok') {
    throw new Error('Backend health check returned an unsuccessful status')
  }

  return {
    api: 'online',
    database: result.database?.status ?? 'unknown',
  }
}
