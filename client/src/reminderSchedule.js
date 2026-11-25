const INDIA_TIME_ZONE = 'Asia/Kolkata'

function indiaDateParts(value) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: INDIA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value)
  return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map(({ type, value: partValue }) => [type, partValue]))
}

export function indiaDate(value = new Date()) {
  const { year, month, day } = indiaDateParts(value)
  return `${year}-${month}-${day}`
}

export function indiaMinute(value = new Date()) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: INDIA_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(value)
}

export function indiaWeekday(date) {
  return new Date(`${date}T12:00:00Z`).getUTCDay()
}

export function reminderIsScheduledToday(reminder, now = new Date()) {
  const date = indiaDate(now)
  const weekday = indiaWeekday(date)
  const frequency = reminder.frequency ?? 'once'
  if (!reminder.date || reminder.date > date) return false
  if (frequency === 'once') return reminder.date === date
  if (frequency === 'weekdays') return weekday >= 1 && weekday <= 5
  if (frequency === 'weekly') return weekday === (Number.isInteger(reminder.repeatDay) ? reminder.repeatDay : indiaWeekday(reminder.date))
  if (frequency === 'custom') return (reminder.repeatDays ?? []).includes(weekday)
  return frequency === 'daily'
}

export function reminderInstant(date, time) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null
  return new Date(`${date}T${time}:00+05:30`)
}

export function reminderIsDueNow(date, time, now = new Date(), graceMs = 5 * 60_000) {
  const scheduled = reminderInstant(date, time)
  if (!scheduled) return false
  const elapsed = now.getTime() - scheduled.getTime()
  return elapsed >= 0 && elapsed < graceMs
}
