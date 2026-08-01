import { useCallback, useEffect, useState } from 'react'
import type { Item, Tag, Trip } from '../types'
import { useSession } from './auth-client'

export interface TripSnapshot {
  trip: Trip
  items: Item[]
  tags: Tag[]
}

export interface Invite {
  id: string
  trip_name: string
  item_count: number
  owner_name: string
  owner_email: string
  message: string | null
  created_at: string
}

export async function shareTrip(email: string, message: string, snapshot: TripSnapshot) {
  const res = await fetch('/api/shares', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, message, snapshot }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error ?? 'sharing failed')
  return body as { ok: true; id: string; emailed: boolean }
}

export interface ShareLinkInfo {
  status: 'pending' | 'accepted' | 'declined'
  recipient_email: string
  trip_name: string
  item_count: number
  owner_name: string
  recipient_has_account: boolean
}

export async function fetchShareLink(id: string): Promise<ShareLinkInfo | null> {
  const res = await fetch(`/api/shares/link/${id}`)
  if (!res.ok) return null
  return res.json()
}

/** Transfer/attach a pending invite to the signed-in account (no-op if it already matches). */
export async function claimShare(id: string): Promise<boolean> {
  const res = await fetch(`/api/shares/${id}/claim`, { method: 'POST' })
  return res.ok
}

export async function respondToInvite(id: string, action: 'accept' | 'decline') {
  const res = await fetch(`/api/shares/${id}/respond`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error ?? 'response failed')
  return body as { ok: true; snapshot?: TripSnapshot }
}

/** Pending trip invites for the signed-in user, refreshed on focus + every 60s. */
export function useInbox() {
  const { data: session } = useSession()
  const [invites, setInvites] = useState<Invite[]>([])
  const userId = session?.user?.id ?? null

  const refresh = useCallback(async () => {
    if (!userId) {
      setInvites([])
      return
    }
    try {
      const res = await fetch('/api/shares/inbox')
      if (!res.ok) return
      const body = await res.json()
      setInvites(body.invites ?? [])
    } catch {
      // offline — leave the current list alone
    }
  }, [userId])

  useEffect(() => {
    refresh()
    if (!userId) return
    const interval = setInterval(refresh, 60_000)
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', onFocus)
    }
  }, [userId, refresh])

  return { invites, refresh }
}
