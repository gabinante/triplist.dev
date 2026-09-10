import { useEffect, useState } from 'react'
import { Backpack, Check, HeartHandshake, ListChecks, Map, Shapes, TentTree } from 'lucide-react'
import { StoreProvider, useStore } from './store'
import { PlanWizard } from './views/PlanWizard'
import { TripsView } from './views/Trips'
import { GearView } from './views/Gear'
import { ListsView } from './views/Lists'
import { StylesView } from './views/Styles'
import { FriendsView } from './views/Friends'
import { AccountSection } from './components/Account'
import { AuthModal } from './components/AuthModal'
import { Welcome } from './components/Welcome'
import { ThemeToggle } from './components/ThemeToggle'
import { claimShare, useInbox } from './lib/shares'
import { useFriends } from './lib/friends'
import { useSession } from './lib/auth-client'
import { AnimatePresence, motion } from 'framer-motion'

type View = 'plan' | 'trips' | 'gear' | 'lists' | 'styles' | 'friends'

const NAV: { id: View; label: string; icon: typeof Map }[] = [
  { id: 'plan', label: 'Plan My Trip', icon: Map },
  { id: 'trips', label: 'My Trips', icon: TentTree },
  { id: 'gear', label: 'Gear', icon: Backpack },
  { id: 'lists', label: 'Lists', icon: ListChecks },
  { id: 'styles', label: 'Trip Styles', icon: Shapes },
  { id: 'friends', label: 'Friends & Family', icon: HeartHandshake },
]

const WELCOMED_KEY = 'triplist-welcomed'

function WelcomeGate() {
  const { state } = useStore()
  // Only greet genuinely new users; anyone with trips predates the welcome.
  const [open, setOpen] = useState(
    () => !localStorage.getItem(WELCOMED_KEY) && state.trips.length === 0,
  )
  useEffect(() => {
    if (!open && !localStorage.getItem(WELCOMED_KEY)) localStorage.setItem(WELCOMED_KEY, '1')
  }, [open])
  const close = () => {
    localStorage.setItem(WELCOMED_KEY, '1')
    setOpen(false)
  }
  return <Welcome open={open} onClose={close} />
}

export default function App() {
  const [view, setView] = useState<View>('plan')
  const [selectedTrip, setSelectedTrip] = useState<string | null>(null)
  const [wizardKey, setWizardKey] = useState(0)
  const [shareLinkId, setShareLinkId] = useState<string | null>(null)
  const [verifiedToast, setVerifiedToast] = useState(false)
  const [resetToken, setResetToken] = useState<string | null>(null)
  const { invites, refresh: refreshInbox } = useInbox()
  const friends = useFriends()
  const { data: session } = useSession()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [view, selectedTrip])

  // Email links land here: /?share=… (trip invites), /?verified=1 (email
  // confirmation), /?friends=1 (friend requests), /reset?token=… (password).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (window.location.pathname === '/reset' && params.has('token')) {
      setResetToken(params.get('token'))
      window.history.replaceState(null, '', '/')
      return
    }
    if (params.has('share')) {
      setShareLinkId(params.get('share'))
      setView('trips')
    }
    if (params.get('friends') === '1') setView('friends')
    if (params.get('verified') === '1') {
      setVerifiedToast(true)
      setTimeout(() => setVerifiedToast(false), 5000)
    }
    if (params.has('share') || params.has('verified') || params.has('friends')) {
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [])

  // Once signed in while holding a share link, attach the invite to this
  // account — transferring it if it was sent to a different email.
  useEffect(() => {
    if (!shareLinkId || !session?.user) return
    claimShare(shareLinkId)
      .then(() => refreshInbox())
      .finally(() => setShareLinkId(null))
  }, [shareLinkId, session?.user, refreshInbox])

  const openTrip = (id: string | null) => {
    setSelectedTrip(id)
    setView('trips')
  }

  const planNew = () => {
    setWizardKey(k => k + 1)
    setView('plan')
  }

  return (
    <StoreProvider>
      <div className="ambient" />
      <a href="#main-content" className="skip-link">Skip to content</a>
      <div className="flex min-h-screen flex-col md:flex-row">
        <aside className="app-sidebar fixed inset-x-0 top-0 z-30 flex h-16 shrink-0 items-center border-b border-white/10 md:sticky md:inset-auto md:top-0 md:h-dvh md:w-60 md:flex-col md:items-stretch md:overflow-y-auto md:border-b-0 md:border-r">
          <div className="flex flex-1 items-center gap-2.5 px-3 py-3 md:flex-none md:px-5 md:py-5">
            <div className="rounded-xl bg-moss-500/20 p-2 text-moss-300">
              <TentTree className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold tracking-tight text-bark-50">
              Trip<span className="text-moss-300">List</span>
            </span>
          </div>
          <nav aria-label="Main navigation" className="app-nav fixed inset-x-0 bottom-0 grid grid-cols-6 gap-1 border-t border-white/10 px-1 pt-2 md:static md:flex md:flex-1 md:flex-col md:border-0 md:px-3 md:py-2">
            {NAV.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => (id === 'plan' ? planNew() : setView(id))}
                title={label}
                aria-label={label}
                aria-current={view === id ? 'page' : undefined}
                className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[10px] font-medium transition-all cursor-pointer md:flex-row md:justify-start md:gap-3 md:px-3 md:py-2.5 md:text-sm ${
                  view === id
                    ? 'bg-moss-500/20 text-moss-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_16px_rgba(143,166,92,0.12)] border border-moss-400/25'
                    : 'border border-transparent text-bark-400 hover:bg-white/5 hover:text-bark-100'
                }`}
              >
                <span className="relative">
                  <Icon className="h-[18px] w-[18px] shrink-0" />
                  {((id === 'trips' && invites.length > 0) ||
                    (id === 'friends' && friends.incoming.length > 0)) && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-moss-400 px-1 text-[10px] font-bold text-bark-950">
                      {id === 'trips' ? invites.length : friends.incoming.length}
                    </span>
                  )}
                </span>
                <span className="hidden md:inline">{label}</span>
                <span className="md:hidden">{{ plan: 'Plan', trips: 'Trips', gear: 'Gear', lists: 'Lists', styles: 'Styles', friends: 'People' }[id]}</span>
              </button>
            ))}
          </nav>
          <ThemeToggle />
          <AccountSection />
          <div className="hidden border-t border-white/5 px-5 py-4 text-[11px] leading-relaxed text-bark-600 md:block">
            Layered lists for every kind of trip.
          </div>
        </aside>

        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 px-4 pt-24 pb-28 sm:px-8 md:pt-8 md:pb-20">
          {view === 'plan' && <PlanWizard key={wizardKey} onDone={openTrip} />}
          {view === 'trips' && (
            <TripsView
              selectedId={selectedTrip}
              onSelect={setSelectedTrip}
              onPlanNew={planNew}
              invites={invites}
              onInboxChange={refreshInbox}
              shareLinkId={shareLinkId}
            />
          )}
          {view === 'gear' && <GearView />}
          {view === 'lists' && <ListsView />}
          {view === 'styles' && <StylesView />}
          {view === 'friends' && <FriendsView data={friends} onChange={friends.refresh} />}
        </main>
        <AuthModal
          open={resetToken !== null}
          onClose={() => setResetToken(null)}
          initialMode="reset"
          resetToken={resetToken}
        />
        <WelcomeGate />
        <AnimatePresence>
          {verifiedToast && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              className="glass fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-2xl px-4 py-3 text-sm text-moss-200"
            >
              <Check className="h-4 w-4 text-moss-300" /> Email confirmed — you're signed in.
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </StoreProvider>
  )
}
