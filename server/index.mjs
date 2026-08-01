import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { toNodeHandler } from 'better-auth/node'
import { auth, authEnabled, pool } from './auth.mjs'
import { mountShares } from './shares.mjs'
import { mountFriends } from './friends.mjs'

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const port = Number(process.env.PORT ?? 8080)

const app = express()
app.disable('x-powered-by')
app.set('trust proxy', 1)

if (authEnabled) {
  // Better Auth handles everything under /api/auth/*. Mounted before any
  // body parser — it consumes the raw request itself.
  app.all('/api/auth/{*any}', toNodeHandler(auth))

  // Per-user copy of the app state doc; guests keep using localStorage only.
  await pool.query(`
    create table if not exists user_state (
      user_id text primary key references "user"(id) on delete cascade,
      doc jsonb not null,
      updated_at timestamptz not null default now()
    )
  `)

  const requireSession = async (req, res) => {
    const session = await auth.api.getSession({ headers: req.headers })
    if (!session) {
      res.status(401).json({ error: 'not signed in' })
      return null
    }
    return session
  }

  app.get('/api/state', async (req, res) => {
    const session = await requireSession(req, res)
    if (!session) return
    const { rows } = await pool.query('select doc, updated_at from user_state where user_id = $1', [
      session.user.id,
    ])
    res.json(rows[0] ?? { doc: null })
  })

  app.put('/api/state', express.json({ limit: '1mb' }), async (req, res) => {
    const session = await requireSession(req, res)
    if (!session) return
    await pool.query(
      `insert into user_state (user_id, doc, updated_at) values ($1, $2, now())
       on conflict (user_id) do update set doc = excluded.doc, updated_at = now()`,
      [session.user.id, req.body],
    )
    res.json({ ok: true })
  })

  await mountShares(app, { auth, pool })
  await mountFriends(app, { auth, pool })
}

app.get('/api/health', async (_req, res) => {
  const status = { ok: true, auth: authEnabled, db: 'not configured' }
  try {
    if (pool) {
      await pool.query('select 1')
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
  console.log(`triplist listening on :${port} (auth ${authEnabled ? 'enabled' : 'disabled'})`)
})
