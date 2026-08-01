import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Clock, HeartHandshake, UserPlus, X } from 'lucide-react'
import { useAuthAvailable, useSession } from '../lib/auth-client'
import type { FriendsData } from '../lib/friends'
import { addFriend, removeFriendLink, respondToFriendRequest } from '../lib/friends'
import { AuthModal } from '../components/AuthModal'
import { Button, GlassPanel, inputClass } from '../components/ui'

export function FriendsView({ data, onChange }: { data: FriendsData & { refresh?: () => void }; onChange: () => void }) {
  const authAvailable = useAuthAvailable()
  const { data: session } = useSession()
  const [authOpen, setAuthOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)

  if (!authAvailable || !session?.user) {
    return (
      <div className="mx-auto max-w-md pt-16 text-center">
        <div className="mx-auto mb-4 w-fit rounded-2xl bg-moss-500/15 p-4 text-moss-300">
          <HeartHandshake className="h-10 w-10" />
        </div>
        <h2 className="text-xl font-semibold text-bark-50">Friends & Family</h2>
        <p className="mt-2 mb-6 text-sm text-bark-400">
          Link up with other TripList users — connected friends can share packing lists with one tap.
          Sign in to get started.
        </p>
        <Button onClick={() => setAuthOpen(true)}>Sign in</Button>
        <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      </div>
    )
  }

  const invite = async () => {
    setBusy(true)
    setStatus(null)
    try {
      const result = await addFriend(email.trim())
      setStatus(
        result.autoAccepted
          ? { ok: true, text: "They'd already invited you — you're now connected!" }
          : result.emailed
            ? { ok: true, text: `Invite sent to ${email.trim()}.` }
            : { ok: true, text: `Request saved — they'll see it when they sign in as ${email.trim()}.` },
      )
      setEmail('')
      onChange()
    } catch (err) {
      setStatus({ ok: false, text: err instanceof Error ? err.message : 'Request failed.' })
    } finally {
      setBusy(false)
    }
  }

  const respond = async (id: string, action: 'accept' | 'decline') => {
    await respondToFriendRequest(id, action).catch(() => {})
    onChange()
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-2 text-2xl font-bold text-bark-50">Friends & Family</h1>
      <p className="mb-6 text-sm text-bark-400">
        Connected friends can share packing lists with one tap — and family features are coming.
      </p>

      <GlassPanel className="mb-6 p-5">
        <label className="mb-1.5 block text-xs font-medium text-bark-400">Connect with someone</label>
        <div className="flex gap-2">
          <input
            type="email"
            className={inputClass}
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="their@email.com"
            onKeyDown={e => e.key === 'Enter' && email.includes('@') && !busy && invite()}
          />
          <Button onClick={invite} disabled={!email.includes('@') || busy}>
            <span className="flex items-center gap-1.5">
              <UserPlus className="h-4 w-4" /> Invite
            </span>
          </Button>
        </div>
        {status && (
          <p
            className={`mt-3 rounded-xl border px-3 py-2 text-sm ${
              status.ok
                ? 'border-moss-400/30 bg-moss-500/10 text-moss-300'
                : 'border-red-500/30 bg-red-900/20 text-red-300'
            }`}
          >
            {status.text}
          </p>
        )}
      </GlassPanel>

      {data.incoming.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-2 px-1 text-sm font-semibold uppercase tracking-wider text-bark-300">
            Requests for you
          </h3>
          <div className="space-y-3">
            {data.incoming.map(req => (
              <motion.div
                key={req.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass flex flex-wrap items-center gap-3 rounded-2xl p-4"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-moss-500/25 text-sm font-bold text-moss-200">
                  {(req.name || req.email).charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-bark-50">{req.name || req.email}</p>
                  <p className="truncate text-xs text-bark-500">{req.email}</p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => respond(req.id, 'accept')}>
                    <span className="flex items-center gap-1.5">
                      <Check className="h-4 w-4" /> Accept
                    </span>
                  </Button>
                  <Button variant="ghost" onClick={() => respond(req.id, 'decline')}>
                    Decline
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {data.friends.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-2 px-1 text-sm font-semibold uppercase tracking-wider text-bark-300">
            Your people · {data.friends.length}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {data.friends.map(friend => (
              <GlassPanel key={friend.id} className="glass-hover flex items-center gap-3 p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-moss-500/25 text-sm font-bold text-moss-200">
                  {(friend.name || friend.email).charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-bark-50">{friend.name || friend.email}</p>
                  <p className="truncate text-xs text-bark-500">{friend.email}</p>
                </div>
                <button
                  onClick={() => {
                    if (confirm(`Remove ${friend.name || friend.email} from your people?`))
                      removeFriendLink(friend.id).then(onChange)
                  }}
                  className="rounded p-1.5 text-bark-600 hover:bg-red-900/30 hover:text-red-300 cursor-pointer"
                  title="Remove"
                >
                  <X className="h-4 w-4" />
                </button>
              </GlassPanel>
            ))}
          </div>
        </div>
      )}

      {data.outgoing.length > 0 && (
        <div>
          <h3 className="mb-2 px-1 text-sm font-semibold uppercase tracking-wider text-bark-300">Waiting on</h3>
          <GlassPanel className="divide-y divide-white/5 overflow-hidden">
            {data.outgoing.map(req => (
              <div key={req.id} className="flex items-center gap-3 px-4 py-2.5">
                <Clock className="h-4 w-4 shrink-0 text-bark-500" />
                <span className="flex-1 text-sm text-bark-300">{req.email}</span>
                <button
                  onClick={() => removeFriendLink(req.id).then(onChange)}
                  className="rounded p-1.5 text-bark-600 hover:bg-red-900/30 hover:text-red-300 cursor-pointer"
                  title="Cancel request"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </GlassPanel>
        </div>
      )}

      {data.friends.length === 0 && data.incoming.length === 0 && data.outgoing.length === 0 && (
        <p className="pt-4 text-center text-sm text-bark-500">
          No connections yet — invite someone by email to get started.
        </p>
      )}
    </div>
  )
}
