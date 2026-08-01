import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { LogIn, TentTree, UserPlus, X } from 'lucide-react'
import { authClient, signIn, signUp } from '../lib/auth-client'
import { useStore } from '../store'
import { Button, inputClass } from './ui'

type AuthMode = 'signin' | 'signup' | 'forgot' | 'reset'

/** Full-window sign-in / sign-up / password-reset screen. */
export function AuthModal({
  open,
  onClose,
  initialMode = 'signin',
  prefillEmail,
  resetToken,
}: {
  open: boolean
  onClose: () => void
  initialMode?: AuthMode
  prefillEmail?: string
  resetToken?: string | null
}) {
  const { state } = useStore()
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setMode(initialMode)
      setNotice(null)
      setError(null)
      if (prefillEmail) setEmail(prefillEmail)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialMode, prefillEmail])

  const tripCount = state.trips.length

  const submit = async () => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      if (mode === 'forgot') {
        const r = await authClient.requestPasswordReset({ email, redirectTo: '/reset' })
        if (r.error) throw new Error(r.error.message)
        setNotice(`If an account exists for ${email}, a reset link is on its way.`)
        return
      }
      if (mode === 'reset') {
        const r = await authClient.resetPassword({ newPassword: password, token: resetToken ?? '' })
        if (r.error) throw new Error(r.error.message)
        setNotice('Password updated — sign in with your new password.')
        setPassword('')
        setMode('signin')
        return
      }
      const result =
        mode === 'signin'
          ? await signIn.email({ email, password })
          : await signUp.email({ email, password, name: name.trim() || email.split('@')[0] })
      if (result.error) throw new Error(result.error.message ?? undefined)
      onClose()
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Something went wrong — try again.')
    } finally {
      setBusy(false)
    }
  }

  const canSubmit =
    !busy &&
    (mode === 'forgot'
      ? email.includes('@')
      : mode === 'reset'
        ? password.length >= 8
        : email.includes('@') && password.length >= 8)

  const heading =
    mode === 'signin' ? 'Welcome back'
    : mode === 'signup' ? 'Create your account'
    : mode === 'forgot' ? 'Reset your password'
    : 'Choose a new password'

  const subtext =
    mode === 'signin'
      ? 'Sign in to get your lists and trips on every device. Anything you made in this browser comes with you.'
      : mode === 'signup'
        ? tripCount > 0
          ? `Everything you've built here — ${tripCount === 1 ? 'your trip' : `all ${tripCount} trips`}, gear, and lists — will be saved to your new account.`
          : 'An account keeps your lists and trips synced across devices — and unlocks sharing.'
        : mode === 'forgot'
          ? "Enter your account email and we'll send you a reset link."
          : 'Almost done — pick a new password for your account.'

  // Portal to <body>: ancestors with backdrop-filter (the sidebar) would
  // otherwise trap this fixed overlay in their containing block.
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
          <div className="relative z-[1] flex min-h-full flex-col items-center justify-center px-4 py-12">
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ duration: 0.25, delay: 0.05 }}
              className="w-full max-w-md"
            >
              <div className="mb-8 flex flex-col items-center gap-3">
                <div className="rounded-2xl bg-moss-500/20 p-3.5 text-moss-300">
                  <TentTree className="h-8 w-8" />
                </div>
                <span className="text-2xl font-bold tracking-tight text-bark-50">
                  Trip<span className="text-moss-300">List</span>
                </span>
              </div>

              <div className="glass rounded-3xl p-8">
                <h1 className="text-2xl font-bold text-bark-50">{heading}</h1>
                <p className="mt-2 mb-6 text-sm leading-relaxed text-bark-400">{subtext}</p>

                <div className="space-y-4">
                  {mode === 'signup' && (
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-bark-400">Name</label>
                      <input
                        className={inputClass}
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="What should we call you?"
                      />
                    </div>
                  )}
                  {mode !== 'reset' && (
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-bark-400">Email</label>
                      <input
                        autoFocus
                        type="email"
                        className={inputClass}
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        onKeyDown={e => e.key === 'Enter' && mode === 'forgot' && canSubmit && submit()}
                      />
                    </div>
                  )}
                  {mode !== 'forgot' && (
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-bark-400">
                        {mode === 'reset' ? 'New password' : 'Password'}
                      </label>
                      <input
                        type="password"
                        className={inputClass}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="At least 8 characters"
                        onKeyDown={e => e.key === 'Enter' && canSubmit && submit()}
                      />
                      {mode === 'signin' && (
                        <button
                          onClick={() => {
                            setMode('forgot')
                            setError(null)
                            setNotice(null)
                          }}
                          className="mt-1.5 text-xs text-bark-500 underline-offset-2 hover:text-moss-300 hover:underline cursor-pointer"
                        >
                          Forgot your password?
                        </button>
                      )}
                    </div>
                  )}
                  {notice && (
                    <p className="rounded-xl border border-moss-400/30 bg-moss-500/10 px-3 py-2 text-sm text-moss-300">
                      {notice}
                    </p>
                  )}
                  {error && (
                    <p className="rounded-xl border border-red-500/30 bg-red-900/20 px-3 py-2 text-sm text-red-300">
                      {error}
                    </p>
                  )}
                  <Button onClick={submit} disabled={!canSubmit} className="w-full !py-3">
                    <span className="flex items-center justify-center gap-2">
                      {mode === 'signin' ? (
                        <>
                          <LogIn className="h-4 w-4" /> {busy ? 'Signing in…' : 'Sign in'}
                        </>
                      ) : mode === 'signup' ? (
                        <>
                          <UserPlus className="h-4 w-4" /> {busy ? 'Creating…' : 'Create account'}
                        </>
                      ) : mode === 'forgot' ? (
                        <>{busy ? 'Sending…' : 'Send reset link'}</>
                      ) : (
                        <>{busy ? 'Saving…' : 'Set new password'}</>
                      )}
                    </span>
                  </Button>
                </div>
              </div>

              {mode !== 'reset' && (
                <button
                  onClick={() => {
                    setMode(mode === 'signin' || mode === 'forgot' ? 'signup' : 'signin')
                    setError(null)
                    setNotice(null)
                  }}
                  className="mx-auto mt-6 block text-sm text-bark-400 underline-offset-2 transition-colors hover:text-moss-300 hover:underline cursor-pointer"
                >
                  {mode === 'signup' ? 'Already have an account? Sign in' : 'New here? Create an account'}
                </button>
              )}
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
