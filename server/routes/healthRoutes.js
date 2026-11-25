import { Router } from 'express'
import { getDatabaseStatus } from '../config/db.js'

const router = Router()

router.get('/', (req, res) => {
  const database = getDatabaseStatus()

  res.status(200).json({
    status: 'ok',
    message: 'ElderCare AI backend is running.',
    database: {
      status: database,
      connected: database === 'connected',
    },
  })
})

export default router
