import { useEffect, useRef, useState } from 'react'
import { LogIn, LogOut, Settings } from 'lucide-react'
import { signOut, useAuthAvailable, useSession } from '../lib/auth-client'
import type { State } from '../store'
import { mergeStates, useStore } from '../store'
import { AuthModal } from './AuthModal'
import { PreferencesModal } from './Preferences'

async function putState(state: State) {
  await fetch('/api/state', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state),
  })
}

/**
 * Sidebar account section. Guests keep working entirely from localStorage;
 * signing in hydrates from (or seeds) the server copy and then mirrors every
 * change up with a debounce.
 */
export function AccountSection() {
  const { data: session } = useSession()
  const { state, dispatch } = useStore()
  const authAvailable = useAuthAvailable()
  const [modalOpen, setModalOpen] = useState(false)
  const [prefsOpen, setPrefsOpen] = useState(false)
  const syncedFor = useRef<string | null>(null)
  const stateRef = useRef(state)
  stateRef.current = state

  const userId = session?.user?.id ?? null

  // On sign-in: merge the server copy with local guest work (local-only trips,
  // gear, lists, and cards survive; server wins on conflicts). On first signup
  // there is no server doc yet, so the local state seeds the account.
  useEffect(() => {
    if (!userId) {
      syncedFor.current = null
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/state')
        if (!res.ok || cancelled) return
        const { doc } = await res.json()
        if (cancelled) return
        const next = doc ? mergeStates(doc, stateRef.current) : stateRef.current
        if (doc) dispatch({ type: 'hydrate', state: next })
        await putState(next)
        syncedFor.current = userId
      } catch {
        // offline or server hiccup — localStorage still has everything
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId, dispatch])

  // Mirror changes to the server while signed in.
  useEffect(() => {
    if (!userId || syncedFor.current !== userId) return
    const timer = setTimeout(() => putState(state).catch(() => {}), 800)
    return () => clearTimeout(timer)
  }, [state, userId])

  if (!authAvailable) return null

  if (!session?.user) {
    return (
      <div className="border-t border-white/5 px-2 py-3 md:px-3">
        <button
          onClick={() => setModalOpen(true)}
          className="flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-sm font-medium text-bark-400 transition-all hover:bg-white/5 hover:text-bark-100 cursor-pointer"
          title="Sign in"
        >
          <LogIn className="h-[18px] w-[18px] shrink-0" />
          <span className="hidden md:inline">Sign in</span>
        </button>
        <AuthModal open={modalOpen} onClose={() => setModalOpen(false)} />
      </div>
    )
  }

  const initial = (session.user.name || session.user.email || '?').charAt(0).toUpperCase()
  return (
    <div className="border-t border-white/5 px-2 py-3 md:px-3">
      <div className="flex items-center gap-3 rounded-xl px-3 py-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-moss-500/30 text-sm font-bold text-moss-200">
          {initial}
        </span>
        <div className="hidden min-w-0 flex-1 md:block">
          <p className="truncate text-sm font-medium text-bark-100">{session.user.name}</p>
          <p className="truncate text-[11px] text-bark-500">{session.user.email}</p>
        </div>
        <button
          onClick={() => setPrefsOpen(true)}
          className="rounded-lg p-1.5 text-bark-500 hover:bg-white/10 hover:text-bark-100 cursor-pointer"
          title="Preferences"
        >
          <Settings className="h-4 w-4" />
        </button>
        <button
          onClick={() => signOut()}
          className="rounded-lg p-1.5 text-bark-500 hover:bg-white/10 hover:text-bark-100 cursor-pointer"
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
      <PreferencesModal open={prefsOpen} onClose={() => setPrefsOpen(false)} />
    </div>
  )
}
