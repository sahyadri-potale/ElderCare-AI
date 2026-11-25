import { Router } from 'express'
import bcrypt from 'bcryptjs'
import User from '../models/User.js'
import { authenticate } from '../middleware/authenticate.js'
import { createAuthToken } from '../utils/jwt.js'

const router = Router()
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body ?? {}

    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) {
      return res.status(400).json({ status: 'error', message: 'Enter a name between 2 and 100 characters.' })
    }

    if (typeof email !== 'string' || email.trim().length > 254 || !emailPattern.test(email.trim())) {
      return res.status(400).json({ status: 'error', message: 'Enter a valid email address.' })
    }

    if (typeof password !== 'string' || password.length < 8 || password.length > 72) {
      return res.status(400).json({ status: 'error', message: 'Password must be between 8 and 72 characters.' })
    }

    const normalizedEmail = email.trim().toLowerCase()
    const existingUser = await User.findOne({ email: normalizedEmail }).select('_id').lean()
    if (existingUser) {
      return res.status(409).json({ status: 'error', message: 'An account with this email already exists.' })
    }

    const hashedPassword = await bcrypt.hash(password, 12)
    const user = await User.create({ name: name.trim(), email: normalizedEmail, password: hashedPassword })

    return res.status(201).json({
      status: 'ok',
      message: 'Your account has been created successfully.',
      user: { id: user.id, name: user.name, email: user.email },
    })
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ status: 'error', message: 'An account with this email already exists.' })
    }
    if (error?.name === 'ValidationError') {
      return res.status(400).json({ status: 'error', message: 'Please check your registration details.' })
    }
    return next(error)
  }
})

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {}
    if (typeof email !== 'string' || !emailPattern.test(email.trim()) || typeof password !== 'string' || !password) {
      return res.status(400).json({ status: 'error', message: 'Enter a valid email address and password.' })
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+password')
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ status: 'error', message: 'Email or password is incorrect.' })
    }

    const token = createAuthToken(user.id)
    return res.json({
      status: 'ok',
      message: 'You are now signed in.',
      token,
      user: { id: user.id, name: user.name, email: user.email },
    })
  } catch (error) {
    return next(error)
  }
})

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await User.findById(req.auth.userId).select('name email').lean()
    if (!user) return res.status(401).json({ status: 'error', message: 'Your account could not be found. Please log in again.' })
    return res.json({ status: 'ok', user: { id: String(user._id), name: user.name, email: user.email } })
  } catch (error) {
    return next(error)
  }
})

export default router
