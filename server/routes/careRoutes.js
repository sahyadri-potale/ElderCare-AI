import { Router } from 'express'
import CarePlan from '../models/CarePlan.js'
import User from '../models/User.js'
import MedicineNotificationClaim from '../models/MedicineNotificationClaim.js'
import { authenticate } from '../middleware/authenticate.js'

const router = Router()
router.use(authenticate)
const today = () => new Date().toLocaleDateString('en-CA')
const serialize = (plan, user) => ({ reminders: (plan?.reminders ?? []).map((entry) => {
  const reminder = typeof entry.toObject === 'function' ? entry.toObject() : entry
  const kind = reminder.type ?? reminder.kind
  const title = (kind === 'medicine' ? reminder.medicineName : reminder.activityName) || reminder.title || ''
  return { ...reminder, kind, type: kind, title, ...(kind === 'medicine' ? { medicineName: title } : { activityName: title }) }
}), moods: plan?.moods ?? [], emergencyPhone: plan?.emergencyPhone ?? '', guardianName: plan?.guardianName ?? '', guardianPhone: plan?.guardianPhone ?? '', guardianRelationship: plan?.guardianRelationship ?? '', preferredLanguage: plan?.preferredLanguage ?? 'en', reminderPreferences: plan?.reminderPreferences ?? { notifications: true, sound: true }, specialCareInstructions: plan?.specialCareInstructions ?? '', additionalCareNotes: plan?.additionalCareNotes ?? '', ...(user ? { person: { id: String(user._id), fullName: user.name, age: user.age ?? '', phone: user.phone ?? '', address: user.address ?? '' } } : {}) })

router.get('/', async (req, res, next) => {
  try {
    const [plan, user] = await Promise.all([CarePlan.findOne({ user: req.auth.userId }).lean(), User.findById(req.auth.userId).select('name age phone address').lean()])
    return res.json({ status: 'ok', carePlan: serialize(plan, user) })
  }
  catch (error) { return next(error) }
})

router.put('/profile', async (req, res, next) => {
  try {
    const { fullName, age, phone, address, guardianName, guardianRelationship, guardianPhone, emergencyPhone, preferredLanguage, reminderPreferences, specialCareInstructions, additionalCareNotes } = req.body ?? {}
    const phonePattern = /^[+\d() .-]{7,20}$/
    if (typeof fullName !== 'string' || fullName.trim().length < 2 || fullName.trim().length > 100) return res.status(400).json({ status: 'error', message: 'Enter a name between 2 and 100 characters.' })
    if (age !== '' && age !== null && (!Number.isInteger(Number(age)) || Number(age) < 0 || Number(age) > 130)) return res.status(400).json({ status: 'error', message: 'Enter an age between 0 and 130.' })
    if (typeof phone !== 'string' || phone.length > 20 || (phone && !phonePattern.test(phone))) return res.status(400).json({ status: 'error', message: 'Check the elderly person phone number.' })
    if (typeof address !== 'string' || address.length > 300 || typeof guardianName !== 'string' || guardianName.length > 100 || typeof guardianRelationship !== 'string' || guardianRelationship.length > 50 || typeof emergencyPhone !== 'string' || emergencyPhone.length > 20 || typeof guardianPhone !== 'string' || guardianPhone.length > 20 || [emergencyPhone, guardianPhone].some((value) => value && !phonePattern.test(value))) return res.status(400).json({ status: 'error', message: 'Check the profile and contact details.' })
    if (!['en', 'kn', 'hi'].includes(preferredLanguage) || !reminderPreferences || typeof reminderPreferences.notifications !== 'boolean' || typeof reminderPreferences.sound !== 'boolean') return res.status(400).json({ status: 'error', message: 'Choose a supported language and reminder preferences.' })
    if (typeof specialCareInstructions !== 'string' || specialCareInstructions.length > 2000 || typeof additionalCareNotes !== 'string' || additionalCareNotes.length > 2000) return res.status(400).json({ status: 'error', message: 'Care notes must be 2000 characters or fewer.' })
    const user = await User.findByIdAndUpdate(req.auth.userId, { $set: { name: fullName.trim(), age: age === '' || age === null ? null : Number(age), phone: phone.trim(), address: address.trim() } }, { new: true, runValidators: true }).select('name age phone address').lean()
    if (!user) return res.status(404).json({ status: 'error', message: 'User profile not found.' })
    const plan = await CarePlan.findOneAndUpdate({ user: req.auth.userId }, { $set: { guardianName: guardianName.trim(), guardianRelationship: guardianRelationship.trim(), guardianPhone: guardianPhone.trim(), emergencyPhone: emergencyPhone.trim(), preferredLanguage, reminderPreferences, specialCareInstructions: specialCareInstructions.trim(), additionalCareNotes: additionalCareNotes.trim() }, $setOnInsert: { user: req.auth.userId } }, { upsert: true, new: true, runValidators: true }).lean()
    return res.json({ status: 'ok', carePlan: serialize(plan, user) })
  } catch (error) { return next(error) }
})

// This dedicated endpoint supports clients that request reminders separately
// from the full care plan. An optional date query limits results to that day.
router.get('/reminders', async (req, res, next) => {
  try {
    const filter = typeof req.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
      ? { user: req.auth.userId, 'reminders.date': req.query.date }
      : { user: req.auth.userId }
    const plan = await CarePlan.findOne(filter).select('reminders').lean()
    const reminders = (plan?.reminders ?? []).filter((reminder) => !req.query.date || reminder.date === req.query.date)
    return res.json({ status: 'ok', reminders })
  } catch (error) { return next(error) }
})

router.post('/reminders', async (req, res, next) => {
  try {
    const { time, date, dosage = '', instructions = '', description = '', frequency = 'daily', times } = req.body ?? {}
    const language = req.body?.language ?? 'en'
    if (!['en', 'hi', 'kn'].includes(language)) return res.status(400).json({ status: 'error', message: 'Choose a supported reminder language.' })
    const kind = req.body?.type ?? req.body?.kind
    const title = kind === 'medicine'
      ? (req.body?.medicineName ?? req.body?.title)
      : (req.body?.activityName ?? req.body?.title)
    const repeatDays = Array.isArray(req.body?.repeatDays) ? [...new Set(req.body.repeatDays)] : []
    const scheduledTimes = kind === 'medicine' ? (Array.isArray(times) && times.length ? [...new Set(times)] : [time]) : [time]
    if (typeof title !== 'string' || !title.trim() || title.trim().length > 100 || !['medicine', 'activity'].includes(kind) || !Array.isArray(scheduledTimes) || scheduledTimes.length < 1 || scheduledTimes.length > 6 || scheduledTimes.some((value) => typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value))) return res.status(400).json({ status: 'error', message: 'Enter a title, valid time, and reminder type.' })
    if (!['once', 'daily', 'weekdays', 'weekly', 'custom'].includes(frequency) || (frequency === 'custom' && kind !== 'activity')) return res.status(400).json({ status: 'error', message: 'Choose a valid repeat frequency.' })
    if (frequency === 'custom' && (!repeatDays.length || repeatDays.some((day) => !Number.isInteger(day) || day < 0 || day > 6))) return res.status(400).json({ status: 'error', message: 'Choose at least one valid repeat day.' })
    if (kind === 'medicine' && (typeof dosage !== 'string' || !dosage.trim() || dosage.trim().length > 60)) return res.status(400).json({ status: 'error', message: 'Enter the dosage.' })
    if (typeof instructions !== 'string' || instructions.length > 500) return res.status(400).json({ status: 'error', message: 'Additional instructions must be 500 characters or fewer.' })
    if (typeof description !== 'string' || description.length > 500) return res.status(400).json({ status: 'error', message: 'Activity description must be 500 characters or fewer.' })
    const primaryTime = scheduledTimes[0]
    const reminderDate = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : today()
    const existingPlan = await CarePlan.findOne({ user: req.auth.userId }).select('reminders').lean()
    const daysKey = [...repeatDays].sort().join(',')
    const isDuplicate = existingPlan?.reminders.some((item) => (item.type ?? item.kind) === kind && String(item.title || item.medicineName || item.activityName || '').trim().toLocaleLowerCase() === title.trim().toLocaleLowerCase() && item.date === reminderDate && item.frequency === frequency && [...(item.times?.length ? item.times : [item.time])].sort().join(',') === [...scheduledTimes].sort().join(',') && [...(item.repeatDays ?? [])].sort().join(',') === daysKey)
    if (kind === 'activity' && isDuplicate) return res.status(409).json({ status: 'error', message: 'This reminder is already saved.' })
    const plan = await CarePlan.findOneAndUpdate({ user: req.auth.userId }, { $setOnInsert: { user: req.auth.userId }, $push: { reminders: { title: title.trim(), type: kind, medicineName: kind === 'medicine' ? title.trim() : '', activityName: kind === 'activity' ? title.trim() : '', description: kind === 'activity' ? description.trim() : '', userId: req.auth.userId, language, time: primaryTime, times: scheduledTimes, kind, dosage: kind === 'medicine' ? dosage.trim() : '', instructions: kind === 'medicine' ? instructions.trim() : '', frequency, repeatDay: new Date(`${reminderDate}T12:00:00`).getDay(), repeatDays: frequency === 'custom' ? repeatDays : [], done: false, date: reminderDate, takenSlots: [], completedSlots: [] } } }, { upsert: true, new: true, runValidators: true })
    return res.status(201).json({ status: 'ok', carePlan: serialize(plan) })
  } catch (error) { return next(error) }
})

router.post('/reminders/:id/claim', async (req, res, next) => {
  try {
    const { slot } = req.body ?? {}
    if (typeof slot !== 'string' || slot.length < 8 || slot.length > 120) return res.status(400).json({ status: 'error', message: 'A valid reminder time is required.' })
    const plan = await CarePlan.findOne({ user: req.auth.userId, reminders: { $elemMatch: { _id: req.params.id, kind: { $in: ['medicine', 'activity'] } } } }).select('_id').lean()
    if (!plan) return res.status(404).json({ status: 'error', message: 'Reminder not found.' })
    await MedicineNotificationClaim.init()
    try {
      await MedicineNotificationClaim.create({ user: req.auth.userId, reminder: req.params.id, slot, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) })
    } catch (error) {
      if (error?.code === 11000) return res.json({ status: 'ok', claimed: false })
      throw error
    }
    await CarePlan.updateOne({ user: req.auth.userId, reminders: { $elemMatch: { _id: req.params.id, snoozedSlot: { $ne: '' } } } }, { $set: { 'reminders.$.snoozedUntil': null, 'reminders.$.snoozedSlot': '' } })
    return res.json({ status: 'ok', claimed: true })
  } catch (error) { return next(error) }
})

router.patch('/reminders/:id/taken', async (req, res, next) => {
  try {
    const { slot, takenSlot = slot } = req.body ?? {}
    if (typeof slot !== 'string' || slot.length < 8 || slot.length > 120 || typeof takenSlot !== 'string' || takenSlot.length < 8 || takenSlot.length > 120) return res.status(400).json({ status: 'error', message: 'A valid reminder time is required.' })
    const plan = await CarePlan.findOneAndUpdate({ user: req.auth.userId, reminders: { $elemMatch: { _id: req.params.id, kind: 'medicine' } } }, { $push: { 'reminders.$.takenSlots': { $each: [takenSlot], $slice: -400 } }, $set: { 'reminders.$.snoozedUntil': null, 'reminders.$.snoozedSlot': '' } }, { new: true, runValidators: true })
    if (!plan) return res.status(404).json({ status: 'error', message: 'Medicine reminder not found.' })
    return res.json({ status: 'ok', carePlan: serialize(plan) })
  } catch (error) { return next(error) }
})

router.patch('/reminders/:id/completed', async (req, res, next) => {
  try {
    const { slot } = req.body ?? {}
    if (typeof slot !== 'string' || slot.length < 8 || slot.length > 120) return res.status(400).json({ status: 'error', message: 'A valid activity time is required.' })
    const plan = await CarePlan.findOneAndUpdate({ user: req.auth.userId, reminders: { $elemMatch: { _id: req.params.id, kind: 'activity' } } }, { $push: { 'reminders.$.completedSlots': { $each: [slot], $slice: -400 } }, $set: { 'reminders.$.snoozedUntil': null, 'reminders.$.snoozedSlot': '' } }, { new: true, runValidators: true })
    if (!plan) return res.status(404).json({ status: 'error', message: 'Activity not found.' })
    return res.json({ status: 'ok', carePlan: serialize(plan) })
  } catch (error) { return next(error) }
})

router.post('/reminders/:id/snooze', async (req, res, next) => {
  try {
    const { slot } = req.body ?? {}
    if (typeof slot !== 'string' || slot.length < 8 || slot.length > 120) return res.status(400).json({ status: 'error', message: 'A valid reminder time is required.' })
    const until = new Date(Date.now() + 10 * 60 * 1000)
    const plan = await CarePlan.findOneAndUpdate({ user: req.auth.userId, reminders: { $elemMatch: { _id: req.params.id, kind: { $in: ['medicine', 'activity'] } } } }, { $set: { 'reminders.$.snoozedUntil': until, 'reminders.$.snoozedSlot': slot } }, { new: true, runValidators: true })
    if (!plan) return res.status(404).json({ status: 'error', message: 'Reminder not found.' })
    return res.json({ status: 'ok', carePlan: serialize(plan), snoozedUntil: until })
  } catch (error) { return next(error) }
})

router.patch('/reminders/:id', async (req, res, next) => {
  try {
    const plan = await CarePlan.findOne({ user: req.auth.userId })
    const reminder = plan?.reminders.id(req.params.id)
    if (!reminder) return res.status(404).json({ status: 'error', message: 'Reminder not found.' })
    if (typeof req.body?.done === 'boolean') reminder.done = req.body.done
    if (req.body?.type === 'medicine' || req.body?.medicineName !== undefined) {
      const medicineName = req.body.medicineName ?? req.body.title
      const times = Array.isArray(req.body.times) && req.body.times.length ? [...new Set(req.body.times)] : [req.body.time]
      const { dosage, date, frequency = 'daily', instructions = '' } = req.body
      if (reminder.type !== 'medicine' && reminder.kind !== 'medicine') return res.status(400).json({ status: 'error', message: 'Only medicine reminders can be updated with medicine details.' })
      if (typeof medicineName !== 'string' || !medicineName.trim() || medicineName.trim().length > 100 || typeof dosage !== 'string' || !dosage.trim() || dosage.trim().length > 60 || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Array.isArray(times) || times.length < 1 || times.length > 6 || times.some((value) => typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) || !['once', 'daily', 'weekly', 'weekdays'].includes(frequency) || typeof instructions !== 'string' || instructions.length > 500) return res.status(400).json({ status: 'error', message: 'Check the medicine name, dosage, date, time, repeat schedule, and instructions.' })
      reminder.set({ title: medicineName.trim(), medicineName: medicineName.trim(), type: 'medicine', kind: 'medicine', userId: req.auth.userId, dosage: dosage.trim(), instructions: instructions.trim(), date, time: times[0], times, frequency, repeatDay: new Date(`${date}T12:00:00`).getDay(), repeatDays: [] })
    }
    await plan.save()
    return res.json({ status: 'ok', carePlan: serialize(plan) })
  } catch (error) { return next(error) }
})

router.delete('/reminders/:id', async (req, res, next) => {
  try {
    const plan = await CarePlan.findOne({ user: req.auth.userId })
    const reminder = plan?.reminders.id(req.params.id)
    if (!reminder) return res.status(404).json({ status: 'error', message: 'Reminder not found.' })
    reminder.deleteOne(); await plan.save()
    return res.json({ status: 'ok', carePlan: serialize(plan) })
  } catch (error) { return next(error) }
})

router.post('/moods', async (req, res, next) => {
  try {
    const { mood, date } = req.body ?? {}
    if (!['happy', 'okay', 'sad', 'worried'].includes(mood)) return res.status(400).json({ status: 'error', message: 'Choose a mood to check in.' })
    const entryDate = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : today()
    const plan = await CarePlan.findOneAndUpdate({ user: req.auth.userId }, { $setOnInsert: { user: req.auth.userId }, $push: { moods: { mood, date: entryDate } } }, { upsert: true, new: true, runValidators: true })
    return res.status(201).json({ status: 'ok', carePlan: serialize(plan) })
  } catch (error) { return next(error) }
})

router.put('/contacts', async (req, res, next) => {
  try {
    const { emergencyPhone = '', guardianName = '', guardianPhone = '' } = req.body ?? {}
    const phonePattern = /^[+\d() .-]{7,20}$/
    if ([emergencyPhone, guardianPhone].some((value) => typeof value !== 'string' || (value && !phonePattern.test(value))) || typeof guardianName !== 'string' || guardianName.length > 100) return res.status(400).json({ status: 'error', message: 'Check the contact details and phone numbers.' })
    const plan = await CarePlan.findOneAndUpdate({ user: req.auth.userId }, { $set: { emergencyPhone: emergencyPhone.trim(), guardianName: guardianName.trim(), guardianPhone: guardianPhone.trim() }, $setOnInsert: { user: req.auth.userId } }, { upsert: true, new: true, runValidators: true })
    return res.json({ status: 'ok', carePlan: serialize(plan) })
  } catch (error) { return next(error) }
})

router.get('/emergency-contacts', async (req, res, next) => {
  try {
    const plan = await CarePlan.findOne({ user: req.auth.userId }).select('emergencyContacts').lean()
    return res.json({ status: 'ok', contacts: plan?.emergencyContacts ?? [] })
  } catch (error) { return next(error) }
})

router.post('/emergency-contacts', async (req, res, next) => {
  try {
    const { name, relationship, phone } = req.body ?? {}
    const phonePattern = /^\+?[\d() .-]{7,20}$/
    const digitCount = typeof phone === 'string' ? phone.replace(/\D/g, '').length : 0
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 100 || typeof relationship !== 'string' || !relationship.trim() || relationship.trim().length > 50 || typeof phone !== 'string' || !phonePattern.test(phone.trim()) || digitCount < 7 || digitCount > 15) return res.status(400).json({ status: 'error', message: 'Enter a contact name, relationship, and valid mobile number.' })
    const plan = await CarePlan.findOneAndUpdate({ user: req.auth.userId }, { $setOnInsert: { user: req.auth.userId }, $push: { emergencyContacts: { name: name.trim(), relationship: relationship.trim(), phone: phone.trim() } } }, { upsert: true, new: true, runValidators: true })
    return res.status(201).json({ status: 'ok', contacts: plan.emergencyContacts })
  } catch (error) { return next(error) }
})

router.put('/emergency-contacts/:contactId', async (req, res, next) => {
  try {
    const { name, relationship, phone } = req.body ?? {}
    const phonePattern = /^\+?[\d() .-]{7,20}$/
    const digitCount = typeof phone === 'string' ? phone.replace(/\D/g, '').length : 0
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 100 || typeof relationship !== 'string' || !relationship.trim() || relationship.trim().length > 50 || typeof phone !== 'string' || !phonePattern.test(phone.trim()) || digitCount < 7 || digitCount > 15) return res.status(400).json({ status: 'error', message: 'Enter a contact name, relationship, and valid mobile number.' })
    const plan = await CarePlan.findOne({ user: req.auth.userId })
    const contact = plan?.emergencyContacts.id(req.params.contactId)
    if (!contact) return res.status(404).json({ status: 'error', message: 'Emergency contact not found.' })
    contact.set({ name: name.trim(), relationship: relationship.trim(), phone: phone.trim() })
    await plan.save()
    return res.json({ status: 'ok', contacts: plan.emergencyContacts })
  } catch (error) { return next(error) }
})

router.delete('/emergency-contacts/:contactId', async (req, res, next) => {
  try {
    const plan = await CarePlan.findOne({ user: req.auth.userId })
    const contact = plan?.emergencyContacts.id(req.params.contactId)
    if (!contact) return res.status(404).json({ status: 'error', message: 'Emergency contact not found.' })
    contact.deleteOne()
    await plan.save()
    return res.json({ status: 'ok', contacts: plan.emergencyContacts })
  } catch (error) { return next(error) }
})

export default router
