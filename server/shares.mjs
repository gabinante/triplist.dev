import crypto from 'node:crypto'
import express from 'express'
import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const FROM = process.env.RESEND_FROM ?? 'TripList <invites@triplist.dev>'
const APP_URL = process.env.BETTER_AUTH_URL ?? 'https://triplist.dev'

const esc = s =>
  String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

function inviteEmail({ ownerName, ownerEmail, tripName, itemCount, message, shareId, recipient }) {
  const link = `${APP_URL}/?share=${shareId}`
  return {
    subject: `${ownerName} shared "${tripName}" with you on TripList`,
    html: `
<div style="background:#161814;color:#e5e7e2;font-family:-apple-system,'Segoe UI',sans-serif;padding:40px 24px;border-radius:16px;max-width:520px;margin:0 auto">
  <p style="font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#8fa65c;margin:0 0 8px">🏕️ TripList</p>
  <h1 style="font-size:22px;margin:0 0 16px;color:#f5f6f4">${esc(ownerName)} invited you to pack for<br>&ldquo;${esc(tripName)}&rdquo;</h1>
  <p style="color:#a8b0a1;font-size:14px;line-height:1.6;margin:0 0 12px">
    A packing list with <strong style="color:#c8d6ac">${itemCount} items</strong> is waiting for you,
    shared by ${esc(ownerName)} (${esc(ownerEmail)}).
  </p>
  ${message ? `<p style="border-left:3px solid #74893f;padding:8px 14px;margin:0 0 16px;color:#cbd0c6;font-size:14px;font-style:italic">&ldquo;${esc(message)}&rdquo;</p>` : ''}
  <a href="${link}" style="display:inline-block;background:#74893f;color:#f3f6ee;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:12px;margin:8px 0 20px">View the invite</a>
  <p style="color:#697263;font-size:12px;line-height:1.6;margin:0">
    Sign in (or create an account) with this email address — ${esc(recipient)} — to accept or decline.
  </p>
</div>`,
  }
}

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
    const recipient = String(email ?? '').trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient))
      return res.status(400).json({ error: 'valid email required' })
    if (!snapshot?.trip?.id || !snapshot.trip.name || !Array.isArray(snapshot.items) || !Array.isArray(snapshot.tags))
      return res.status(400).json({ error: 'invalid trip snapshot' })
    if (snapshot.items.length > 500 || snapshot.tags.length > 100)
      return res.status(400).json({ error: 'snapshot too large' })
    if (recipient === session.user.email.toLowerCase())
      return res.status(400).json({ error: "that's your own email" })

    const dupe = await pool.query(
      `select 1 from trip_share where owner_id = $1 and trip_id = $2 and recipient_email = $3 and status = 'pending'`,
      [session.user.id, snapshot.trip.id, recipient],
    )
    if (dupe.rowCount > 0) return res.status(409).json({ error: 'already invited — still pending' })

    const { rows: pendingCount } = await pool.query(
      `select count(*)::int as n from trip_share where owner_id = $1 and status = 'pending'`,
      [session.user.id],
    )
    if (pendingCount[0].n >= 50) return res.status(429).json({ error: 'too many pending invites' })

    const id = crypto.randomBytes(12).toString('hex')
    await pool.query(
      `insert into trip_share (id, owner_id, trip_id, recipient_email, trip_snapshot, message)
       values ($1, $2, $3, $4, $5, $6)`,
      [id, session.user.id, snapshot.trip.id, recipient, snapshot, message?.slice(0, 500) ?? null],
    )

    let emailed = false
    if (resend) {
      try {
        const { subject, html } = inviteEmail({
          ownerName: session.user.name || session.user.email,
          ownerEmail: session.user.email,
          tripName: snapshot.trip.name,
          itemCount: snapshot.items.length,
          message: message?.slice(0, 500),
          shareId: id,
          recipient,
        })
        const { error } = await resend.emails.send({ from: FROM, to: recipient, subject, html })
        emailed = !error
        if (error) console.error('resend error:', error)
      } catch (err) {
        console.error('resend send failed:', err.message)
      }
    }
    res.json({ ok: true, id, emailed })
  })

  app.get('/api/shares/inbox', async (req, res) => {
    const session = await requireSession(req, res)
    if (!session) return
    const { rows } = await pool.query(
      `select s.id, s.message, s.created_at,
              s.trip_snapshot->'trip'->>'name' as trip_name,
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
