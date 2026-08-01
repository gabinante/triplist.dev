import { useState } from 'react'
import { Backpack, Map, TentTree } from 'lucide-react'
import { StoreProvider } from './store'
import { PlanWizard } from './views/PlanWizard'
import { TripsView } from './views/Trips'
import { GearView } from './views/Gear'

type View = 'plan' | 'trips' | 'gear'

const NAV: { id: View; label: string; icon: typeof Map }[] = [
  { id: 'plan', label: 'Plan My Trip', icon: Map },
  { id: 'trips', label: 'My Trips', icon: TentTree },
  { id: 'gear', label: 'Gear & Lists', icon: Backpack },
]

export default function App() {
  const [view, setView] = useState<View>('plan')
  const [selectedTrip, setSelectedTrip] = useState<string | null>(null)
  const [wizardKey, setWizardKey] = useState(0)

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
                <Icon className="h-[18px] w-[18px] shrink-0" />
                <span className="hidden md:inline">{label}</span>
              </button>
            ))}
          </nav>
          <div className="hidden border-t border-white/5 px-5 py-4 text-[11px] leading-relaxed text-bark-600 md:block">
            Layered lists for every kind of trip.
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-8 pb-20 sm:px-8">
          {view === 'plan' && <PlanWizard key={wizardKey} onDone={openTrip} />}
          {view === 'trips' && (
            <TripsView selectedId={selectedTrip} onSelect={setSelectedTrip} onPlanNew={planNew} />
          )}
          {view === 'gear' && <GearView />}
        </main>
      </div>
    </StoreProvider>
  )
}
