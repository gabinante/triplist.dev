import { betterAuth } from 'better-auth'
import pg from 'pg'
import { escapeHtml as esc, sendEmail } from './email.mjs'

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
      user: {
        additionalFields: {
          // Notification preference: branded emails for trip/friend invites.
          inviteEmails: { type: 'boolean', defaultValue: true, input: true },
        },
        changeEmail: {
          enabled: true,
          async sendChangeEmailVerification({ user, newEmail, url }) {
            await sendEmail({
              to: user.email,
              subject: 'Confirm your TripList email change',
              heading: 'Confirm your new email',
              bodyHtml: `You asked to change your TripList email from <strong style="color:#c8d6ac">${esc(user.email)}</strong> to <strong style="color:#c8d6ac">${esc(newEmail)}</strong>. Confirm from this (current) address to approve it.`,
              cta: { label: 'Approve email change', url },
              footnote: "If you didn't request this, you can ignore this email and nothing will change.",
            })
          },
        },
      },
      emailAndPassword: {
        enabled: true,
        async sendResetPassword({ user, url }) {
          await sendEmail({
            to: user.email,
            subject: 'Reset your TripList password',
            heading: 'Reset your password',
            bodyHtml: 'Click below to choose a new password for your TripList account. This link expires in an hour.',
            cta: { label: 'Reset password', url },
            footnote: "If you didn't request a reset, you can safely ignore this email.",
          })
        },
      },
      emailVerification: {
        sendOnSignUp: true,
        autoSignInAfterVerification: true,
        async sendVerificationEmail({ user, url }) {
          // Land back on the app with a confirmation toast after verifying.
          const verifyUrl = new URL(url)
          verifyUrl.searchParams.set('callbackURL', '/?verified=1')
          const firstName = (user.name || '').split(' ')[0]
          await sendEmail({
            to: user.email,
            subject: 'Welcome to TripList — confirm your email',
            preheader: 'Layered packing lists for every kind of trip.',
            heading: `Welcome to TripList${firstName ? `, ${esc(firstName)}` : ''} 🏕️`,
            bodyHtml:
              'Your lists and trips now sync to your account and follow you to every device. ' +
              'Confirm your email to secure the account and make sure trip invites from friends reach you.',
            cta: { label: 'Confirm my email', url: verifyUrl.toString() },
            footnote: "If you didn't create a TripList account, you can safely ignore this email.",
          })
        },
      },
    })
  : null
