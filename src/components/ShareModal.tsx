import { useState } from 'react'
import { Check, Send } from 'lucide-react'
import type { ListSnapshot, ShareKind, TripSnapshot } from '../lib/shares'
import { share } from '../lib/shares'
import { useFriends } from '../lib/friends'
import { Button, Chip, Modal, inputClass } from './ui'

/** Share a trip or a list with someone by email (friends are one tap). */
export function ShareModal({
  open,
  onClose,
  kind,
  name,
  itemCount,
  buildSnapshot,
}: {
  open: boolean
  onClose: () => void
  kind: ShareKind
  name: string
  itemCount: number
  buildSnapshot: () => TripSnapshot | ListSnapshot
}) {
  const { friends } = useFriends()
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<{ emailed: boolean } | null>(null)

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const result = await share(kind, email.trim(), message.trim(), buildSnapshot())
      setSent({ emailed: result.emailed })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sharing failed — try again.')
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    setEmail('')
    setMessage('')
    setSent(null)
    setError(null)
    onClose()
  }

  return (
    <Modal open={open} onClose={reset} title={kind === 'trip' ? `Share "${name}"` : `Share the "${name}" list`}>
      {sent ? (
        <div className="space-y-4 text-center">
          <div className="mx-auto w-fit rounded-2xl bg-moss-500/20 p-4 text-moss-300">
            <Check className="h-8 w-8" />
          </div>
          <p className="text-sm text-bark-200">
            {sent.emailed
              ? `Invite sent to ${email.trim()} — they can accept it from the email or from their My Trips inbox.`
              : `Invite saved. When ${email.trim()} signs in with that email, it'll be waiting in their My Trips inbox.`}
          </p>
          <Button onClick={reset}>Done</Button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-bark-400">
            {kind === 'trip'
              ? `They'll get their own copy of this packing list — ${itemCount} items — to accept or decline.`
              : `They'll get their own copy of this list and its ${itemCount} items to accept or decline.`}
          </p>
          {friends.length > 0 && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-bark-400">Your people</label>
              <div className="flex flex-wrap gap-1.5">
                {friends.map(f => (
                  <Chip key={f.id} active={email === f.email} onClick={() => setEmail(f.email)}>
                    {f.name || f.email}
                  </Chip>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-bark-400">Their email</label>
            <input
              autoFocus
              type="email"
              className={inputClass}
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="friend@example.com"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-bark-400">Message (optional)</label>
            <input
              className={inputClass}
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="See you at the lake!"
              onKeyDown={e => e.key === 'Enter' && email.includes('@') && !busy && submit()}
            />
          </div>
          {error && (
            <p className="rounded-xl border border-red-500/30 bg-red-900/20 px-3 py-2 text-sm text-red-300">{error}</p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={reset}>Cancel</Button>
            <Button onClick={submit} disabled={!email.includes('@') || busy}>
              <span className="flex items-center gap-1.5">
                <Send className="h-4 w-4" /> {busy ? 'Sending…' : 'Send invite'}
              </span>
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
