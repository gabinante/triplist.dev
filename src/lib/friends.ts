import { useCallback, useEffect, useState } from 'react'
import { useSession } from './auth-client'

export interface FriendRequest {
  id: string
  name?: string
  email: string
  created_at: string
}

export interface Friend {
  id: string
  name: string
  email: string
  since: string
}

export interface FriendsData {
  incoming: FriendRequest[]
  outgoing: FriendRequest[]
  friends: Friend[]
}

const EMPTY: FriendsData = { incoming: [], outgoing: [], friends: [] }

export async function addFriend(email: string) {
  const res = await fetch('/api/friends', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error ?? 'request failed')
  return body as { ok: true; emailed?: boolean; autoAccepted?: boolean }
}

export async function respondToFriendRequest(id: string, action: 'accept' | 'decline') {
  const res = await fetch(`/api/friends/${id}/respond`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  })
  if (!res.ok) throw new Error('response failed')
}

export async function removeFriendLink(id: string) {
  await fetch(`/api/friends/${id}`, { method: 'DELETE' })
}

/** Friends, incoming, and outgoing requests; refreshed on focus + every 60s. */
export function useFriends() {
  const { data: session } = useSession()
  const [data, setData] = useState<FriendsData>(EMPTY)
  const userId = session?.user?.id ?? null

  const refresh = useCallback(async () => {
    if (!userId) {
      setData(EMPTY)
      return
    }
    try {
      const res = await fetch('/api/friends')
      if (!res.ok) return
      setData(await res.json())
    } catch {
      // offline — keep the current list
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

  return { ...data, refresh }
}
