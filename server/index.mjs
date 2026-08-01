import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const port = Number(process.env.PORT ?? 8080)

const app = express()
app.disable('x-powered-by')

// Lazy pool: only connects when DATABASE_URL is present (set by `fly mpg attach`).
let pool = null
async function db() {
  if (!process.env.DATABASE_URL) return null
  if (!pool) {
    const { default: pg } = await import('pg')
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5 })
  }
  return pool
}

app.get('/api/health', async (_req, res) => {
  const status = { ok: true, db: 'not configured' }
  try {
    const p = await db()
    if (p) {
      await p.query('select 1')
      status.db = 'ok'
    }
  } catch (err) {
    status.ok = false
    status.db = `error: ${err.message}`
  }
  res.status(status.ok ? 200 : 500).json(status)
})

// Hashed build assets can be cached forever; index.html must always revalidate
// so new deploys reach clients without a manual hard refresh.
app.use(express.static(dist, { index: false, immutable: true, maxAge: '1y' }))
app.use((_req, res) => {
  res.set('Cache-Control', 'no-store')
  res.sendFile(path.join(dist, 'index.html'))
})

app.listen(port, '0.0.0.0', () => {
  console.log(`triplist listening on :${port}`)
})
