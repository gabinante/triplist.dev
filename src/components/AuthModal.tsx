import { useState } from 'react'
import { LogIn, UserPlus } from 'lucide-react'
import { signIn, signUp } from '../lib/auth-client'
import { Button, Modal, inputClass } from './ui'

export function AuthModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

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

  return (
    <Modal open={open} onClose={onClose} title={mode === 'signin' ? 'Welcome back' : 'Create your account'}>
      <div className="space-y-4">
        <p className="text-sm text-bark-400">
          {mode === 'signin'
            ? 'Sign in to get your lists and trips on every device.'
            : 'An account keeps your lists and trips synced across devices — and unlocks sharing, soon.'}
        </p>
        {mode === 'signup' && (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-bark-400">Name</label>
            <input className={inputClass} value={name} onChange={e => setName(e.target.value)} placeholder="What should we call you?" />
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
          <p className="rounded-xl border border-red-500/30 bg-red-900/20 px-3 py-2 text-sm text-red-300">{error}</p>
        )}
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin')
              setError(null)
            }}
            className="text-xs text-bark-400 underline-offset-2 hover:text-moss-300 hover:underline cursor-pointer"
          >
            {mode === 'signin' ? 'New here? Create an account' : 'Already have an account? Sign in'}
          </button>
          <Button onClick={submit} disabled={!canSubmit}>
            <span className="flex items-center gap-1.5">
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
    </Modal>
  )
}
