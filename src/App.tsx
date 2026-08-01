import { useEffect, useState } from 'react'
import { Backpack, Map, Shapes, TentTree } from 'lucide-react'
import { StoreProvider } from './store'
import { PlanWizard } from './views/PlanWizard'
import { TripsView } from './views/Trips'
import { GearView } from './views/Gear'
import { StylesView } from './views/Styles'
import { AccountSection } from './components/Account'
import { claimShare, useInbox } from './lib/shares'
import { useSession } from './lib/auth-client'
import { AnimatePresence, motion } from 'framer-motion'
import { Check } from 'lucide-react'

type View = 'plan' | 'trips' | 'gear' | 'styles'

const NAV: { id: View; label: string; icon: typeof Map }[] = [
  { id: 'plan', label: 'Plan My Trip', icon: Map },
  { id: 'trips', label: 'My Trips', icon: TentTree },
  { id: 'gear', label: 'Gear & Lists', icon: Backpack },
  { id: 'styles', label: 'Trip Styles', icon: Shapes },
]

export default function App() {
  const [view, setView] = useState<View>('plan')
  const [selectedTrip, setSelectedTrip] = useState<string | null>(null)
  const [wizardKey, setWizardKey] = useState(0)
  const [shareLinkId, setShareLinkId] = useState<string | null>(null)
  const [verifiedToast, setVerifiedToast] = useState(false)
  const { invites, refresh: refreshInbox } = useInbox()
  const { data: session } = useSession()

  // Invite-email links land on /?share=… — go straight to My Trips.
  // Email-confirmation links land on /?verified=1.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.has('share')) {
      setShareLinkId(params.get('share'))
      setView('trips')
    }
    if (params.get('verified') === '1') {
      setVerifiedToast(true)
      setTimeout(() => setVerifiedToast(false), 5000)
    }
    if (params.has('share') || params.has('verified')) {
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
      <div className="flex min-h-screen">
        <aside className="sticky top-0 flex h-screen w-16 shrink-0 flex-col border-r border-white/5 bg-bark-950/50 backdrop-blur-xl md:w-60">
          <div className="flex items-center gap-2.5 px-3 py-5 md:px-5">
            <div className="rounded-xl bg-moss-500/20 p-2 text-moss-300">
              <TentTree className="h-5 w-5" />
            </div>
            <span className="hidden text-lg font-bold tracking-tight text-bark-50 md:inline">
              Trip<span className="text-moss-300">List</span>
            </span>
          </div>
          <nav className="flex flex-1 flex-col gap-1 px-2 py-2 md:px-3">
            {NAV.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => (id === 'plan' ? planNew() : setView(id))}
                title={label}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all cursor-pointer ${
                  view === id
                    ? 'bg-moss-500/20 text-moss-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_16px_rgba(143,166,92,0.12)] border border-moss-400/25'
                    : 'border border-transparent text-bark-400 hover:bg-white/5 hover:text-bark-100'
                }`}
              >
                <span className="relative">
                  <Icon className="h-[18px] w-[18px] shrink-0" />
                  {id === 'trips' && invites.length > 0 && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-moss-400 px-1 text-[10px] font-bold text-bark-950">
                      {invites.length}
                    </span>
                  )}
                </span>
                <span className="hidden md:inline">{label}</span>
              </button>
            ))}
          </nav>
          <AccountSection />
          <div className="hidden border-t border-white/5 px-5 py-4 text-[11px] leading-relaxed text-bark-600 md:block">
            Layered lists for every kind of trip.
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-8 pb-20 sm:px-8">
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
          {view === 'styles' && <StylesView />}
        </main>
        <AnimatePresence>
          {verifiedToast && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              className="glass fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-2xl px-4 py-3 text-sm text-moss-200"
            >
              <Check className="h-4 w-4 text-moss-300" /> Email confirmed — you're all set.
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </StoreProvider>
  )
}
