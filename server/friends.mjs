import crypto from 'node:crypto'
import express from 'express'
import { emailEnabled, escapeHtml as esc, sendEmail } from './email.mjs'

const APP_URL = process.env.BETTER_AUTH_URL ?? 'https://triplist.dev'

/** Does this address belong to an account that has invite emails turned off? */
export async function emailOptedOut(pool, email) {
  const { rows } = await pool.query('select "inviteEmails" from "user" where lower(email) = $1', [email])
  return rows.length > 0 && rows[0].inviteEmails === false
}

/** Mounts the friends/family linking API. Requires auth to be enabled. */
export async function mountFriends(app, { auth, pool }) {
  await pool.query(`
    create table if not exists friend_link (
      id text primary key,
      requester_id text not null references "user"(id) on delete cascade,
      recipient_email text not null,
      status text not null default 'pending',
      created_at timestamptz not null default now(),
      responded_at timestamptz,
      unique (requester_id, recipient_email)
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

  app.get('/api/friends', async (req, res) => {
    const session = await requireSession(req, res)
    if (!session) return
    const me = session.user.email.toLowerCase()
    const { rows: incoming } = await pool.query(
      `select f.id, u.name, u.email, f.created_at from friend_link f
       join "user" u on u.id = f.requester_id
       where f.recipient_email = $1 and f.status = 'pending'
       order by f.created_at desc`,
      [me],
    )
    const { rows: outgoing } = await pool.query(
      `select id, recipient_email as email, created_at from friend_link
       where requester_id = $1 and status = 'pending' order by created_at desc`,
      [session.user.id],
    )
    const { rows: friends } = await pool.query(
      `select f.id, u.name, u.email, f.responded_at as since from friend_link f
       join "user" u on lower(u.email) = f.recipient_email
       where f.requester_id = $1 and f.status = 'accepted'
       union
       select f.id, u.name, u.email, f.responded_at as since from friend_link f
       join "user" u on u.id = f.requester_id
       where f.recipient_email = $2 and f.status = 'accepted'
       order by since desc`,
      [session.user.id, me],
    )
    res.json({ incoming, outgoing, friends })
  })

  app.post('/api/friends', express.json(), async (req, res) => {
    const session = await requireSession(req, res)
    if (!session) return
    const recipient = String(req.body?.email ?? '').trim().toLowerCase()
    const me = session.user.email.toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient))
      return res.status(400).json({ error: 'valid email required' })
    if (recipient === me) return res.status(400).json({ error: "that's your own email" })

    // If they already asked us, connect immediately instead of double-requesting.
    const { rows: reverse } = await pool.query(
      `update friend_link set status = 'accepted', responded_at = now()
       where recipient_email = $1 and status = 'pending'
         and requester_id = (select id from "user" where lower(email) = $2)
       returning id`,
      [me, recipient],
    )
    if (reverse.length > 0) return res.json({ ok: true, autoAccepted: true })

    const existing = await pool.query(
      `select status from friend_link where requester_id = $1 and recipient_email = $2`,
      [session.user.id, recipient],
    )
    if (existing.rows.some(r => r.status === 'accepted'))
      return res.status(409).json({ error: "you're already connected" })
    if (existing.rows.some(r => r.status === 'pending'))
      return res.status(409).json({ error: 'request already pending' })

    const id = crypto.randomBytes(12).toString('hex')
    await pool.query(
      `insert into friend_link (id, requester_id, recipient_email) values ($1, $2, $3)
       on conflict (requester_id, recipient_email)
       do update set status = 'pending', responded_at = null, created_at = now()`,
      [id, session.user.id, recipient],
    )

    let emailed = false
    if (emailEnabled && !(await emailOptedOut(pool, recipient))) {
      const name = session.user.name || session.user.email
      emailed = await sendEmail({
        to: recipient,
        subject: `${name} wants to connect on TripList`,
        heading: `${esc(name)} wants to connect`,
        bodyHtml: `${esc(name)} (${esc(session.user.email)}) invited you to link up on TripList — connected friends can share packing lists with one tap.`,
        cta: { label: 'View the request', url: `${APP_URL}/?friends=1` },
        footnote: `Sign in (or create an account) with this email address — ${esc(recipient)} — to accept.`,
      })
    }
    res.json({ ok: true, emailed })
  })

  app.post('/api/friends/:id/respond', express.json(), async (req, res) => {
    const session = await requireSession(req, res)
    if (!session) return
    const action = req.body?.action
    if (action !== 'accept' && action !== 'decline')
      return res.status(400).json({ error: 'action must be accept or decline' })
    const { rows } = await pool.query(
      `update friend_link set status = $1, responded_at = now()
       where id = $2 and recipient_email = $3 and status = 'pending' returning id`,
      [action === 'accept' ? 'accepted' : 'declined', req.params.id, session.user.email.toLowerCase()],
    )
    if (rows.length === 0) return res.status(404).json({ error: 'request not found' })
    res.json({ ok: true })
  })

  // Cancel a pending request you sent, or remove an existing connection.
  app.delete('/api/friends/:id', async (req, res) => {
    const session = await requireSession(req, res)
    if (!session) return
    const { rows } = await pool.query(
      `delete from friend_link
       where id = $1 and (requester_id = $2 or recipient_email = $3) returning id`,
      [req.params.id, session.user.id, session.user.email.toLowerCase()],
    )
    if (rows.length === 0) return res.status(404).json({ error: 'not found' })
    res.json({ ok: true })
  })
}
