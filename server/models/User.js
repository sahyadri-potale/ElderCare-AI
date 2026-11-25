import mongoose from 'mongoose'

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required.'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters.'],
      maxlength: [100, 'Name must be 100 characters or fewer.'],
    },
    email: {
      type: String,
      required: [true, 'Email is required.'],
      trim: true,
      lowercase: true,
      maxlength: [254, 'Email must be 254 characters or fewer.'],
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Enter a valid email address.'],
      unique: true,
    },
    phone: { type: String, trim: true, default: '', maxlength: 20 },
    age: { type: Number, min: 0, max: 130, default: null },
    address: { type: String, trim: true, default: '', maxlength: 300 },
    password: {
      type: String,
      required: [true, 'Password is required.'],
      minlength: [8, 'Password must be at least 8 characters.'],
      select: false,
    },
  },
  { timestamps: true },
)

const User = mongoose.model('User', userSchema)

export default User
