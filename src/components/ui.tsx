import type { ReactNode } from 'react'
import {
  Armchair, Backpack, Bed, Bike, Briefcase, Building2, Car, Coffee, Compass, CookingPot, Dog,
  Droplets, Fish, Flame, Gamepad2, Laptop, MapPin, Moon, Mountain, Music, Package, PartyPopper,
  Plane, Ship, Snowflake, Sparkles, Star, Sun, Tent, TreePine, User, Users, Waves, Wifi, X, Zap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const ICONS: Record<string, LucideIcon> = {
  Armchair, Backpack, Bed, Bike, Briefcase, Building2, Car, Coffee, Compass, CookingPot, Dog,
  Droplets, Fish, Flame, Gamepad2, Laptop, MapPin, Moon, Mountain, Music, Package, PartyPopper,
  Plane, Ship, Snowflake, Sparkles, Star, Sun, Tent, TreePine, User, Users, Waves, Wifi, Zap,
}

/** Icon names offered in list/card editors — everything in the dynamic icon registry. */
export const ICON_CHOICES = Object.keys(ICONS)

export function DynamicIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Package
  return <Icon className={className} />
}

export function GlassPanel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`glass rounded-2xl ${className}`}>{children}</div>
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  className = '',
  disabled,
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'ghost' | 'danger'
  className?: string
  disabled?: boolean
}) {
  const styles = {
    primary:
      'bg-moss-500/80 hover:bg-moss-400/90 text-moss-50 border border-moss-400/40 shadow-[0_0_20px_rgba(143,166,92,0.25)]',
    ghost: 'glass glass-hover text-bark-100',
    danger: 'bg-red-900/40 hover:bg-red-800/50 text-red-200 border border-red-500/30',
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl px-4 py-2 text-sm font-medium transition-all duration-150 disabled:opacity-40 disabled:pointer-events-none cursor-pointer ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  )
}

export function Chip({
  children,
  active,
  onClick,
  className = '',
}: {
  children: ReactNode
  active?: boolean
  onClick?: () => void
  className?: string
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all duration-150 ${
        onClick ? 'cursor-pointer' : 'cursor-default'
      } ${
        active
          ? 'border-moss-400/60 bg-moss-500/25 text-moss-200 shadow-[0_0_12px_rgba(143,166,92,0.2)]'
          : 'border-white/10 bg-white/5 text-bark-300 hover:border-white/20'
      } ${className}`}
    >
      {children}
    </button>
  )
}

export function ProgressRing({ packed, total, size = 44 }: { packed: number; total: number; size?: number }) {
  const pct = total === 0 ? 0 : packed / total
  const r = (size - 6) / 2
  const c = 2 * Math.PI * r
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={4} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={pct === 1 ? '#aabd7f' : '#8fa65c'}
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          className="transition-all duration-500"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-bark-200">
        {total === 0 ? '—' : `${Math.round(pct * 100)}%`}
      </span>
    </div>
  )
}

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.18 }}
            className="glass rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-bark-50">{title}</h2>
              <button onClick={onClose} className="rounded-lg p-1 text-bark-400 hover:bg-white/10 hover:text-bark-100 cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export const inputClass =
  'w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-bark-50 placeholder-bark-500 outline-none transition-colors focus:border-moss-400/50 focus:bg-white/[0.07]'
