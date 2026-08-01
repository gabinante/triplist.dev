import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, KeyRound, UserRound, X } from 'lucide-react'
import { authClient, useSession } from '../lib/auth-client'
import { Button, Chip, GlassPanel, inputClass } from './ui'

function SectionStatus({ status }: { status: { ok: boolean; text: string } | null }) {
  if (!status) return null
  return (
    <p
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
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [inviteEmails, setInviteEmails] = useState(true)
  const [profileStatus, setProfileStatus] = useState<{ ok: boolean; text: string } | null>(null)
  const [passwordStatus, setPasswordStatus] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open && user) {
      setName(user.name ?? '')
      setEmail(user.email ?? '')
      setInviteEmails(user.inviteEmails ?? true)
      setProfileStatus(null)
      setPasswordStatus(null)
      setCurrentPassword('')
      setNewPassword('')
    }
  }, [open, user])

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
    const r = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    })
    setBusy(false)
    if (r.error) {
      setPasswordStatus({ ok: false, text: r.error.message ?? 'Password change failed.' })
    } else {
      setPasswordStatus({ ok: true, text: 'Password changed. Other devices were signed out.' })
      setCurrentPassword('')
      setNewPassword('')
    }
  }

  const toggleInviteEmails = async () => {
    const next = !inviteEmails
    setInviteEmails(next)
    await authClient.updateUser({ inviteEmails: next }).catch(() => setInviteEmails(!next))
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 overflow-y-auto"
        >
          <div className="ambient-fill" />
          <button
            onClick={onClose}
            className="fixed right-5 top-5 z-10 rounded-xl p-2 text-bark-400 transition-colors hover:bg-white/10 hover:text-bark-100 cursor-pointer"
          >
            <X className="h-6 w-6" />
          </button>
          <div className="relative z-[1] mx-auto max-w-xl px-4 py-14">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.25, delay: 0.05 }}
              className="space-y-6"
            >
              <h1 className="text-2xl font-bold text-bark-50">Preferences</h1>

              <GlassPanel className="p-6">
                <h2 className="mb-4 flex items-center gap-2 font-semibold text-bark-50">
                  <UserRound className="h-4 w-4 text-moss-400" /> Profile
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-bark-400">Name</label>
                    <input className={inputClass} value={name} onChange={e => setName(e.target.value)} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-bark-400">Email</label>
                    <input type="email" className={inputClass} value={email} onChange={e => setEmail(e.target.value)} />
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
                      <label className="mb-1.5 block text-xs font-medium text-bark-400">Current password</label>
                      <input
                        type="password"
                        className={inputClass}
                        value={currentPassword}
                        onChange={e => setCurrentPassword(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-bark-400">New password</label>
                      <input
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
                <Chip active={inviteEmails} onClick={toggleInviteEmails}>
                  {inviteEmails
                    ? 'Email me when someone shares a trip or wants to connect'
                    : 'Invite emails are off — invites only appear in the app'}
                </Chip>
              </GlassPanel>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
