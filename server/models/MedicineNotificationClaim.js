import mongoose from 'mongoose'

const claimSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, required: true },
  reminder: { type: mongoose.Schema.Types.ObjectId, required: true },
  slot: { type: String, required: true },
  expiresAt: { type: Date, required: true, expires: 0 },
}, { timestamps: true })

claimSchema.index({ user: 1, reminder: 1, slot: 1 }, { unique: true })

export default mongoose.model('MedicineNotificationClaim', claimSchema)
