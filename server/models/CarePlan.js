import mongoose from 'mongoose'

const carePlanSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  reminders: [{
    title: { type: String, default: '', maxlength: 100 },
    type: { type: String, enum: ['medicine', 'activity'] },
    medicineName: { type: String, default: '', maxlength: 100 },
    activityName: { type: String, default: '', maxlength: 100 },
    description: { type: String, default: '', maxlength: 500 },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    language: { type: String, enum: ['en', 'hi', 'kn'], default: 'en' },
    time: { type: String, required: true },
    times: [{ type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ }],
    kind: { type: String, enum: ['medicine', 'activity'] },
    dosage: { type: String, maxlength: 60, default: '' },
    instructions: { type: String, maxlength: 500, default: '' },
    frequency: { type: String, enum: ['once', 'daily', 'weekdays', 'weekly', 'custom'], default: 'daily' },
    repeatDay: { type: Number, min: 0, max: 6, default: 0 },
    repeatDays: [{ type: Number, min: 0, max: 6 }],
    done: { type: Boolean, default: false },
    date: { type: String, required: true },
    takenSlots: [{ type: String }],
    completedSlots: [{ type: String }],
    snoozedUntil: { type: Date, default: null },
    snoozedSlot: { type: String, default: '' },
  }],
  moods: [{ mood: { type: String, enum: ['happy', 'okay', 'sad', 'worried'], required: true }, date: { type: String, required: true } }],
  emergencyPhone: { type: String, default: '', maxlength: 20 },
  emergencyContacts: [{ name: { type: String, required: true, maxlength: 100 }, relationship: { type: String, required: true, maxlength: 50 }, phone: { type: String, required: true, maxlength: 20 } }],
  guardianName: { type: String, default: '', maxlength: 100 },
  guardianPhone: { type: String, default: '', maxlength: 20 },
  guardianRelationship: { type: String, default: '', maxlength: 50 },
  preferredLanguage: { type: String, enum: ['en', 'kn', 'hi'], default: 'en' },
  reminderPreferences: {
    notifications: { type: Boolean, default: true },
    sound: { type: Boolean, default: true },
  },
  specialCareInstructions: { type: String, default: '', maxlength: 2000 },
  additionalCareNotes: { type: String, default: '', maxlength: 2000 },
}, { timestamps: true })

export default mongoose.model('CarePlan', carePlanSchema)
