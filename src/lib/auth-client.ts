import { createAuthClient } from 'better-auth/react'

// Same-origin in production; the Vite dev server proxies /api to the
// local Express server when one is running.
export const authClient = createAuthClient()

export const { useSession, signIn, signUp, signOut } = authClient
