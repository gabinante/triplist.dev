import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { LogIn, TentTree, UserPlus, X } from 'lucide-react'
import { signIn, signUp } from '../lib/auth-client'
import { useStore } from '../store'
import { Button, inputClass } from './ui'

/** Full-window sign-in / sign-up screen with its own ambient backdrop. */
export function AuthModal({
  open,
  onClose,
  initialMode = 'signin',
  prefillEmail,
}: {
  open: boolean
  onClose: () => void
  initialMode?: 'signin' | 'signup'
  prefillEmail?: string
}) {
  const { state } = useStore()
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setMode(initialMode)
      if (prefillEmail) setEmail(prefillEmail)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialMode, prefillEmail])

  const tripCount = state.trips.length

  const submit = async () => {
    setBusy(true)
    setError(null)
    const result =
      mode === 'signin'
        ? await signIn.email({ email, password })
        : await signUp.email({ email, password, name: name.trim() || email.split('@')[0] })
    setBusy(false)
    if (result.error) {
      setError(result.error.message ?? 'Something went wrong — try again.')
    } else {
      onClose()
    }
  }

  const canSubmit = email.includes('@') && password.length >= 8 && !busy

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
                <h1 className="text-2xl font-bold text-bark-50">
                  {mode === 'signin' ? 'Welcome back' : 'Create your account'}
                </h1>
                <p className="mt-2 mb-6 text-sm leading-relaxed text-bark-400">
                  {mode === 'signin'
                    ? 'Sign in to get your lists and trips on every device. Anything you made in this browser comes with you.'
                    : tripCount > 0
                      ? `Everything you've built here — ${tripCount === 1 ? 'your trip' : `all ${tripCount} trips`}, gear, and lists — will be saved to your new account.`
                      : 'An account keeps your lists and trips synced across devices — and unlocks sharing.'}
                </p>

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
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-bark-400">Email</label>
                    <input
                      autoFocus
                      type="email"
                      className={inputClass}
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@example.com"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-bark-400">Password</label>
                    <input
                      type="password"
                      className={inputClass}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      onKeyDown={e => e.key === 'Enter' && canSubmit && submit()}
                    />
                  </div>
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
                      ) : (
                        <>
                          <UserPlus className="h-4 w-4" /> {busy ? 'Creating…' : 'Create account'}
                        </>
                      )}
                    </span>
                  </Button>
                </div>
              </div>

              <button
                onClick={() => {
                  setMode(mode === 'signin' ? 'signup' : 'signin')
                  setError(null)
                }}
                className="mx-auto mt-6 block text-sm text-bark-400 underline-offset-2 transition-colors hover:text-moss-300 hover:underline cursor-pointer"
              >
                {mode === 'signin' ? 'New here? Create an account' : 'Already have an account? Sign in'}
              </button>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
