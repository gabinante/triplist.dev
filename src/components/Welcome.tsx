import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ListChecks, Pencil, Shapes, TentTree } from 'lucide-react'
import { useStore } from '../store'
import { Button } from './ui'

const BEATS = [
  {
    icon: ListChecks,
    title: 'Your gear lives on lists',
    body: "Kitchen, Fire, LAN party — anything. We've started you with a sample camping kit so you can see how it works.",
  },
  {
    icon: Shapes,
    title: 'Trips are built by stacking lists',
    body: 'Pick cards in the wizard — car camping, fires allowed, cooking — and each card layers its lists onto your packing list.',
  },
  {
    icon: Pencil,
    title: 'Everything here is yours',
    body: "Rename lists, delete the cot, add your own gear and cards. The sample kit is a starting point, not a standard.",
  },
]

/** One-time first-visit explainer of the layered-lists premise. */
export function Welcome({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { dispatch } = useStore()

  const startBlank = () => {
    dispatch({ type: 'startBlank' })
    onClose()
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-50 overflow-y-auto"
        >
          <div className="ambient-fill" />
          <div className="relative z-[1] flex min-h-full flex-col items-center justify-center px-4 py-12">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.05 }}
              className="w-full max-w-lg"
            >
              <div className="mb-8 flex flex-col items-center gap-3 text-center">
                <div className="rounded-2xl bg-moss-500/20 p-3.5 text-moss-300">
                  <TentTree className="h-8 w-8" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight text-bark-50">
                  Welcome to Trip<span className="text-moss-300">List</span>
                </h1>
                <p className="text-sm text-bark-400">Layered lists for every kind of trip.</p>
              </div>

              <div className="space-y-3">
                {BEATS.map(({ icon: Icon, title, body }, i) => (
                  <motion.div
                    key={title}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: 0.15 + i * 0.12 }}
                    className="glass flex gap-4 rounded-2xl p-5"
                  >
                    <div className="h-fit rounded-xl bg-moss-500/15 p-2.5 text-moss-300">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-bark-50">{title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-bark-400">{body}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.55 }}
                className="mt-8 flex flex-col items-center gap-3"
              >
                <Button onClick={onClose} className="w-full max-w-xs !py-3">
                  Explore with the sample kit
                </Button>
                <button
                  onClick={startBlank}
                  className="text-sm text-bark-400 underline-offset-2 transition-colors hover:text-moss-300 hover:underline cursor-pointer"
                >
                  Start with empty lists instead
                </button>
                <p className="text-[11px] text-bark-600">
                  Empty keeps the lists and trip cards — just clears the sample gear.
                </p>
              </motion.div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
