import { betterAuth } from 'better-auth'
import pg from 'pg'

// Auth requires the database; without DATABASE_URL (e.g. plain local dev)
// the server runs guest-only and auth endpoints are disabled.
export const authEnabled = Boolean(process.env.DATABASE_URL)

export const pool = authEnabled
  ? new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5 })
  : null

export const auth = authEnabled
  ? betterAuth({
      database: pool,
      secret: process.env.BETTER_AUTH_SECRET,
      baseURL: process.env.BETTER_AUTH_URL ?? 'https://triplist.dev',
      trustedOrigins: [
        'https://triplist.dev',
        'https://www.triplist.dev',
        'https://triplist.fly.dev',
        'http://localhost:8080',
        'http://localhost:5199',
      ],
      emailAndPassword: {
        enabled: true,
      },
    })
  : null
