import crypto from 'node:crypto'
import express from 'express'
import { emailEnabled, escapeHtml as esc, sendEmail } from './email.mjs'
import { emailOptedOut } from './friends.mjs'

const APP_URL = process.env.BETTER_AUTH_URL ?? 'https://triplist.dev'

/** Mounts the trip-sharing API. Requires auth to be enabled. */
export async function mountShares(app, { auth, pool }) {
  await pool.query(`
    create table if not exists trip_share (
      id text primary key,
      owner_id text not null references "user"(id) on delete cascade,
      trip_id text not null,
      recipient_email text not null,
      status text not null default 'pending',
      trip_snapshot jsonb not null,
      message text,
      created_at timestamptz not null default now(),
      responded_at timestamptz
    )
  `)
  await pool.query(
    `create index if not exists trip_share_inbox on trip_share (recipient_email, status)`,
  )
  // Shares carry either a trip or a list; trip_id doubles as the list id.
  await pool.query(`alter table trip_share add column if not exists kind text not null default 'trip'`)

  const requireSession = async (req, res) => {
    const session = await auth.api.getSession({ headers: req.headers })
    if (!session) {
      res.status(401).json({ error: 'not signed in' })
      return null
    }
    return session
  }

  app.post('/api/shares', express.json({ limit: '1mb' }), async (req, res) => {
    const session = await requireSession(req, res)
    if (!session) return
    const { email, message, snapshot } = req.body ?? {}
    const kind = req.body?.kind === 'list' ? 'list' : 'trip'
    const recipient = String(email ?? '').trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient))
      return res.status(400).json({ error: 'valid email required' })
    if (kind === 'trip') {
      if (!snapshot?.trip?.id || !snapshot.trip.name || !Array.isArray(snapshot.items) || !Array.isArray(snapshot.tags))
        return res.status(400).json({ error: 'invalid trip snapshot' })
    } else {
      if (!snapshot?.tag?.id || !snapshot.tag.name || !Array.isArray(snapshot.items))
        return res.status(400).json({ error: 'invalid list snapshot' })
    }
    if (snapshot.items.length > 500 || (snapshot.tags?.length ?? 0) > 100)
      return res.status(400).json({ error: 'snapshot too large' })
    if (recipient === session.user.email.toLowerCase())
      return res.status(400).json({ error: "that's your own email" })
    const subjectId = kind === 'trip' ? snapshot.trip.id : snapshot.tag.id
    const subjectName = kind === 'trip' ? snapshot.trip.name : snapshot.tag.name

    const dupe = await pool.query(
      `select 1 from trip_share where owner_id = $1 and trip_id = $2 and kind = $4 and recipient_email = $3 and status = 'pending'`,
      [session.user.id, subjectId, recipient, kind],
    )
    if (dupe.rowCount > 0) return res.status(409).json({ error: 'already invited — still pending' })

    const { rows: pendingCount } = await pool.query(
      `select count(*)::int as n from trip_share where owner_id = $1 and status = 'pending'`,
      [session.user.id],
    )
    if (pendingCount[0].n >= 50) return res.status(429).json({ error: 'too many pending invites' })

    const id = crypto.randomBytes(12).toString('hex')
    await pool.query(
      `insert into trip_share (id, owner_id, trip_id, kind, recipient_email, trip_snapshot, message)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [id, session.user.id, subjectId, kind, recipient, snapshot, message?.slice(0, 500) ?? null],
    )

    let emailed = false
    if (emailEnabled && !(await emailOptedOut(pool, recipient))) {
      const ownerName = session.user.name || session.user.email
      const trimmed = message?.slice(0, 500)
      emailed = await sendEmail({
        to: recipient,
        subject:
          kind === 'trip'
            ? `${ownerName} shared "${subjectName}" with you on TripList`
            : `${ownerName} shared their "${subjectName}" list with you on TripList`,
        preheader: `${snapshot.items.length} items are waiting for you.`,
        heading:
          kind === 'trip'
            ? `${esc(ownerName)} invited you to pack for<br>&ldquo;${esc(subjectName)}&rdquo;`
            : `${esc(ownerName)} shared their<br>&ldquo;${esc(subjectName)}&rdquo; list with you`,
        bodyHtml: `${kind === 'trip' ? 'A packing list' : 'A gear list'} with <strong style="color:#c8d6ac">${snapshot.items.length} items</strong> is waiting for you, shared by ${esc(ownerName)} (${esc(session.user.email)}).`,
        quote: trimmed ? esc(trimmed) : undefined,
        cta: { label: 'View the invite', url: `${APP_URL}/?share=${id}` },
        footnote: `Sign in (or create an account) with this email address — ${esc(recipient)} — to accept or decline.`,
      })
    }
    res.json({ ok: true, id, emailed })
  })

  // Public metadata for the share-link landing flow. The share id is an
  // unguessable capability delivered by email, so the holder is treated as
  // the intended recipient.
  app.get('/api/shares/link/:id', async (req, res) => {
    const { rows } = await pool.query(
      `select s.status, s.kind, s.recipient_email,
              coalesce(s.trip_snapshot->'trip'->>'name', s.trip_snapshot->'tag'->>'name') as name,
              jsonb_array_length(s.trip_snapshot->'items') as item_count,
              u.name as owner_name,
              exists(select 1 from "user" r where lower(r.email) = s.recipient_email) as recipient_has_account
       from trip_share s join "user" u on u.id = s.owner_id
       where s.id = $1`,
      [req.params.id],
    )
    if (rows.length === 0) return res.status(404).json({ error: 'invite not found' })
    res.json(rows[0])
  })

  // Transfer a pending invite to the signed-in account. No-op when the
  // session email already matches; requires possession of the share link.
  app.post('/api/shares/:id/claim', async (req, res) => {
    const session = await requireSession(req, res)
    if (!session) return
    const { rows } = await pool.query(
      `update trip_share set recipient_email = $1
       where id = $2 and status = 'pending'
       returning id`,
      [session.user.email.toLowerCase(), req.params.id],
    )
    if (rows.length === 0) return res.status(404).json({ error: 'invite not found or already handled' })
    res.json({ ok: true })
  })

  app.get('/api/shares/inbox', async (req, res) => {
    const session = await requireSession(req, res)
    if (!session) return
    const { rows } = await pool.query(
      `select s.id, s.kind, s.message, s.created_at,
              coalesce(s.trip_snapshot->'trip'->>'name', s.trip_snapshot->'tag'->>'name') as name,
              jsonb_array_length(s.trip_snapshot->'items') as item_count,
              u.name as owner_name, u.email as owner_email
       from trip_share s join "user" u on u.id = s.owner_id
       where s.recipient_email = $1 and s.status = 'pending'
       order by s.created_at desc`,
      [session.user.email.toLowerCase()],
    )
    res.json({ invites: rows })
  })

  app.post('/api/shares/:id/respond', express.json(), async (req, res) => {
    const session = await requireSession(req, res)
    if (!session) return
    const action = req.body?.action
    if (action !== 'accept' && action !== 'decline')
      return res.status(400).json({ error: 'action must be accept or decline' })
    const { rows } = await pool.query(
      `update trip_share set status = $1, responded_at = now()
       where id = $2 and recipient_email = $3 and status = 'pending'
       returning trip_snapshot`,
      [action === 'accept' ? 'accepted' : 'declined', req.params.id, session.user.email.toLowerCase()],
    )
    if (rows.length === 0) return res.status(404).json({ error: 'invite not found' })
    res.json({ ok: true, snapshot: action === 'accept' ? rows[0].trip_snapshot : undefined })
  })
}
