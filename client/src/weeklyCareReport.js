function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function isScheduledOn(reminder, date) {
  const day = dateKey(date)
  if (!reminder.date || day < reminder.date) return false
  const frequency = reminder.frequency ?? 'once'
  if (frequency === 'once') return day === reminder.date
  if (frequency === 'weekdays') return date.getDay() >= 1 && date.getDay() <= 5
  if (frequency === 'weekly') {
    const repeatDay = Number.isInteger(reminder.repeatDay) ? reminder.repeatDay : new Date(`${reminder.date}T12:00:00`).getDay()
    return date.getDay() === repeatDay
  }
  return frequency === 'daily'
}

function isDue(date, time, now) {
  const day = dateKey(date)
  const today = dateKey(now)
  if (day < today) return true
  if (day > today) return false
  return time <= `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

function getOccurrences(reminder, dates) {
  return dates.filter((date) => isScheduledOn(reminder, date))
}

export function createWeeklyCareReport(carePlan = {}, now = new Date(), userName = '', translate = (key) => key) {
  const tr = (key, values = {}) => Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), translate(key))
  const dates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now)
    date.setHours(12, 0, 0, 0)
    date.setDate(date.getDate() - (6 - index))
    return date
  })
  const reminders = Array.isArray(carePlan.reminders) ? carePlan.reminders : []
  const moodRecords = Array.isArray(carePlan.moods) ? carePlan.moods : []
  const dailyMoods = dates.map((date) => {
    const day = dateKey(date)
    const entry = moodRecords.filter((mood) => mood.date === day).at(-1)
    return { date: day, mood: entry?.mood ?? null }
  })
  const moodCounts = dailyMoods.reduce((counts, entry) => {
    if (entry.mood) counts[entry.mood] = (counts[entry.mood] ?? 0) + 1
    return counts
  }, {})

  const medicines = reminders.filter((reminder) => reminder.kind === 'medicine').flatMap((reminder) => {
    const times = Array.isArray(reminder.times) && reminder.times.length ? reminder.times : [reminder.time].filter(Boolean)
    const slots = getOccurrences(reminder, dates).flatMap((date) => times.map((time) => ({
      date: dateKey(date),
      time,
      slot: `${dateKey(date)}T${time}`,
      due: isDue(date, time, now),
    })))
    if (!slots.length) return []
    const takenSlots = Array.isArray(reminder.takenSlots) ? reminder.takenSlots : []
    const completed = slots.filter((slot) => takenSlots.includes(slot.slot)).length
    const due = slots.filter((slot) => slot.due || takenSlots.includes(slot.slot)).length
    return [{
      name: reminder.medicineName || reminder.title,
      dosage: reminder.dosage || '',
      times,
      completed,
      missed: due - completed,
      upcoming: slots.length - due,
    }]
  })

  const activities = reminders.filter((reminder) => reminder.kind === 'activity').flatMap((reminder) => {
    const occurrences = getOccurrences(reminder, dates)
    if (!occurrences.length) return []
    const completedSlots = Array.isArray(reminder.completedSlots) ? reminder.completedSlots : []
    let completed = occurrences.filter((date) => completedSlots.includes(`${dateKey(date)}T${reminder.time}`)).length
    if (reminder.done && (reminder.frequency ?? 'once') === 'once' && occurrences.some((date) => dateKey(date) === reminder.date) && completed === 0) completed = 1
    return [{ name: reminder.activityName || reminder.title, time: reminder.time || '', planned: occurrences.length, completed, pending: occurrences.length - completed }]
  })

  const medicineTotals = medicines.reduce((totals, item) => ({ completed: totals.completed + item.completed, missed: totals.missed + item.missed, upcoming: totals.upcoming + item.upcoming }), { completed: 0, missed: 0, upcoming: 0 })
  const activityTotals = activities.reduce((totals, item) => ({ planned: totals.planned + item.planned, completed: totals.completed + item.completed, pending: totals.pending + item.pending }), { planned: 0, completed: 0, pending: 0 })
  const medicineDue = medicineTotals.completed + medicineTotals.missed
  const adherence = medicineDue ? Math.round((medicineTotals.completed / medicineDue) * 100) : null
  const activityCompletion = activityTotals.planned ? Math.round((activityTotals.completed / activityTotals.planned) * 100) : null
  const topMood = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  const observations = []
  if (!medicineDue) observations.push(tr('observationNoMedicine'))
  else if (medicineTotals.missed) observations.push(tr(medicineTotals.missed === 1 ? 'observationMedicineMissedOne' : 'observationMedicineMissedMany', { count: medicineTotals.missed }))
  else observations.push(tr('observationMedicineAllTaken'))
  if (!activityTotals.planned) observations.push(tr('observationNoActivities'))
  else if (activityTotals.pending) observations.push(tr(activityTotals.pending === 1 ? 'observationActivityPendingOne' : 'observationActivityPendingMany', { count: activityTotals.pending }))
  else observations.push(tr('observationActivitiesComplete'))
  if (topMood) observations.push(tr('observationTopMood', { mood: translate(topMood) }))
  else observations.push(tr('observationNoMood'))

  return {
    startDate: dateKey(dates[0]),
    endDate: dateKey(dates[6]),
    userName,
    dates: dates.map((date) => ({ date: dateKey(date), mood: dailyMoods.find((entry) => entry.date === dateKey(date))?.mood ?? null })),
    moodCounts,
    moodCount: dailyMoods.filter((entry) => entry.mood).length,
    topMood,
    medicines,
    medicineTotals: { ...medicineTotals, due: medicineDue, adherence },
    activities,
    activityTotals: { ...activityTotals, completion: activityCompletion },
    guardian: { name: carePlan.guardianName?.trim() ?? '', phone: carePlan.guardianPhone?.trim() ?? '' },
    observations,
    hasData: dailyMoods.some((entry) => entry.mood) || medicines.length > 0 || activities.length > 0 || Boolean(carePlan.guardianName || carePlan.guardianPhone),
  }
}
