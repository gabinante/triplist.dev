import { useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, KeyRound, UserRound, X } from 'lucide-react'
import { authClient, useSession } from '../lib/auth-client'
import { Button, GlassPanel, inputClass } from './ui'
import { useDialog } from '../lib/useDialog'

function SectionStatus({ status }: { status: { ok: boolean; text: string } | null }) {
  if (!status) return null
  return (
    <p
      role={status.ok ? 'status' : 'alert'}
      className={`rounded-xl border px-3 py-2 text-sm ${
        status.ok
          ? 'border-moss-400/30 bg-moss-500/10 text-moss-300'
          : 'border-red-500/30 bg-red-900/20 text-red-300'
      }`}
    >
      {status.text}
    </p>
  )
}

/** Full-window account preferences: profile, security, notifications. */
export function PreferencesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: session } = useSession()
  const user = session?.user
  const dialogRef = useDialog(open && !!user, onClose)
  const id = useId()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [inviteEmails, setInviteEmails] = useState(true)
  const [profileStatus, setProfileStatus] = useState<{ ok: boolean; text: string } | null>(null)
  const [passwordStatus, setPasswordStatus] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [notificationStatus, setNotificationStatus] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    if (open && user) {
      setName(user.name ?? '')
      setEmail(user.email ?? '')
      setInviteEmails(user.inviteEmails ?? true)
      setProfileStatus(null)
      setPasswordStatus(null)
      setNotificationStatus(null)
      setCurrentPassword('')
      setNewPassword('')
    }
    // A session refresh after saving must not erase feedback or other edits.
  }, [open, user?.id])

  if (!user) return null

  const saveProfile = async () => {
    setBusy(true)
    setProfileStatus(null)
    try {
      const trimmedName = name.trim()
      if (trimmedName && trimmedName !== user.name) {
        const r = await authClient.updateUser({ name: trimmedName })
        if (r.error) throw new Error(r.error.message)
      }
      const trimmedEmail = email.trim().toLowerCase()
      if (trimmedEmail && trimmedEmail !== user.email.toLowerCase()) {
        const r = await authClient.changeEmail({ newEmail: trimmedEmail })
        if (r.error) throw new Error(r.error.message)
        setProfileStatus({
          ok: true,
          text: user.emailVerified
            ? `Saved. Check ${user.email} for a link to approve the email change.`
            : 'Saved — your email has been updated.',
        })
        return
      }
      setProfileStatus({ ok: true, text: 'Saved.' })
    } catch (err) {
      setProfileStatus({ ok: false, text: err instanceof Error ? err.message : 'Saving failed.' })
    } finally {
      setBusy(false)
    }
  }

  const changePassword = async () => {
    setBusy(true)
    setPasswordStatus(null)
    try {
      const r = await authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true })
      if (r.error) throw new Error(r.error.message ?? 'Password change failed.')
      setPasswordStatus({ ok: true, text: 'Password changed. Other devices were signed out.' })
      setCurrentPassword('')
      setNewPassword('')
    } catch (err) {
      setPasswordStatus({ ok: false, text: err instanceof Error ? err.message : 'Password change failed.' })
    } finally {
      setBusy(false)
    }
  }

  const toggleInviteEmails = async () => {
    const next = !inviteEmails
    setInviteEmails(next)
    setBusy(true)
    setNotificationStatus(null)
    try {
      const result = await authClient.updateUser({ inviteEmails: next })
      if (result.error) throw new Error(result.error.message ?? 'Could not save notifications.')
      setNotificationStatus({ ok: true, text: 'Notification preference saved.' })
    } catch (err) {
      setInviteEmails(!next)
      setNotificationStatus({ ok: false, text: err instanceof Error ? err.message : 'Could not save notifications.' })
    } finally {
      setBusy(false)
    }
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${id}-title`}
          tabIndex={-1}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 overflow-y-auto bg-bark-950"
        >
          <div className="ambient-fill" style={{ position: 'fixed' }} />
          <div className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-white/10 bg-bark-950/95 px-4 py-3 backdrop-blur-xl sm:px-6">
            <h1 id={`${id}-title`} className="text-xl font-bold text-bark-50">Preferences</h1>
          <button
            onClick={onClose}
            aria-label="Close preferences"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-bark-300 transition-colors hover:bg-white/10 hover:text-bark-100 cursor-pointer"
          >
            <X className="h-6 w-6" />
          </button>
          </div>
          <div className="relative z-[1] mx-auto max-w-xl px-4 py-6">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.25, delay: 0.05 }}
              className="space-y-6"
            >
              <GlassPanel className="p-6">
                <h2 className="mb-4 flex items-center gap-2 font-semibold text-bark-50">
                  <UserRound className="h-4 w-4 text-moss-400" /> Profile
                </h2>
                <div className="space-y-4">
                  <div>
                    <label htmlFor={`${id}-name`} className="mb-1.5 block text-xs font-medium text-bark-400">Name</label>
                    <input id={`${id}-name`} autoComplete="name" className={inputClass} value={name} onChange={e => setName(e.target.value)} />
                  </div>
                  <div>
                    <label htmlFor={`${id}-email`} className="mb-1.5 block text-xs font-medium text-bark-400">Email</label>
                    <input id={`${id}-email`} type="email" autoComplete="email" className={inputClass} value={email} onChange={e => setEmail(e.target.value)} />
                    {user.emailVerified && (
                      <p className="mt-1.5 text-[11px] text-bark-500">
                        Changing your email sends an approval link to your current address first.
                      </p>
                    )}
                  </div>
                  <SectionStatus status={profileStatus} />
                  <div className="flex justify-end">
                    <Button onClick={saveProfile} disabled={busy || !name.trim() || !email.includes('@')}>
                      Save profile
                    </Button>
                  </div>
                </div>
              </GlassPanel>

              <GlassPanel className="p-6">
                <h2 className="mb-4 flex items-center gap-2 font-semibold text-bark-50">
                  <KeyRound className="h-4 w-4 text-moss-400" /> Password
                </h2>
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor={`${id}-current-password`} className="mb-1.5 block text-xs font-medium text-bark-400">Current password</label>
                      <input
                        id={`${id}-current-password`}
                        autoComplete="current-password"
                        type="password"
                        className={inputClass}
                        value={currentPassword}
                        onChange={e => setCurrentPassword(e.target.value)}
                      />
                    </div>
                    <div>
                      <label htmlFor={`${id}-new-password`} className="mb-1.5 block text-xs font-medium text-bark-400">New password</label>
                      <input
                        id={`${id}-new-password`}
                        autoComplete="new-password"
                        type="password"
                        className={inputClass}
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        placeholder="At least 8 characters"
                      />
                    </div>
                  </div>
                  <SectionStatus status={passwordStatus} />
                  <div className="flex justify-end">
                    <Button
                      onClick={changePassword}
                      disabled={busy || currentPassword.length === 0 || newPassword.length < 8}
                    >
                      Change password
                    </Button>
                  </div>
                </div>
              </GlassPanel>

              <GlassPanel className="p-6">
                <h2 className="mb-4 flex items-center gap-2 font-semibold text-bark-50">
                  <Bell className="h-4 w-4 text-moss-400" /> Notifications
                </h2>
                <button type="button" role="switch" aria-checked={inviteEmails} disabled={busy} onClick={toggleInviteEmails} className="flex min-h-11 w-full items-center gap-3 rounded-xl p-2 text-left text-sm text-bark-200 hover:bg-white/5 disabled:opacity-50">
                  <span aria-hidden="true" className={`relative h-6 w-11 shrink-0 rounded-full border ${inviteEmails ? 'border-moss-400 bg-moss-500' : 'border-white/20 bg-white/10'}`}>
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${inviteEmails ? 'translate-x-6' : 'translate-x-1'}`} />
                  </span>
                  Email me about shared trips and connection requests
                </button>
                <p className="mt-2 text-xs text-bark-400">Invites always appear in the app.</p>
                <div className="mt-3"><SectionStatus status={notificationStatus} /></div>
              </GlassPanel>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
