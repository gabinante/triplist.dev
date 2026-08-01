import { useEffect, useState } from 'react'
import { createAuthClient } from 'better-auth/react'
import { inferAdditionalFields } from 'better-auth/client/plugins'

// Same-origin in production; the Vite dev server proxies /api to the
// local Express server when one is running.
export const authClient = createAuthClient({
  plugins: [
    inferAdditionalFields({
      user: { inviteEmails: { type: 'boolean', required: false } },
    }),
  ],
})

export const { useSession, signIn, signUp, signOut } = authClient

let authAvailablePromise: Promise<boolean> | null = null

/** Whether the server has auth configured (false in guest-only local dev). */
export function useAuthAvailable(): boolean {
  const [available, setAvailable] = useState(false)
  useEffect(() => {
    authAvailablePromise ??= fetch('/api/health')
      .then(r => r.json())
      .then(h => Boolean(h.auth))
      .catch(() => false)
    authAvailablePromise.then(setAvailable)
  }, [])
  return available
}
