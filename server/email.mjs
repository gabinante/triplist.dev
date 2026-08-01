import { Resend } from 'resend'

/**
 * TripList email style guide — mirrors the site theme (src/index.css):
 *   bark-950 #161814  page background       bark-100 #e5e7e2  body text
 *   bark-900 #242722  card surface          bark-400 #858e7d  muted text
 *   bark-600 #525a4e  footer text           moss-200 #c8d6ac  emphasis
 *   moss-300 #aabd7f  accent / wordmark     moss-500 #74893f  buttons
 * Email clients can't do backdrop-filter, so the site's glassmorphism is
 * emulated: bark-900 card, 1px translucent border, soft moss glow shadow.
 * All styles must stay inline; system font stack matches the app.
 */

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const FROM = process.env.RESEND_FROM ?? 'TripList <invites@triplist.dev>'

export const emailEnabled = Boolean(resend)

export const escapeHtml = s =>
  String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif"

/**
 * Branded email shell. `heading`/`bodyHtml`/`quote` are already-escaped HTML;
 * use escapeHtml() on any user-provided text before interpolating.
 */
export function renderEmail({ preheader, heading, bodyHtml, quote, cta, footnote }) {
  return `<!doctype html>
<html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#161814">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden">${preheader}</div>` : ''}
<div style="background:#161814;padding:36px 16px;font-family:${FONT}">
  <div style="max-width:520px;margin:0 auto">
    <p style="font-size:12px;letter-spacing:2px;text-transform:uppercase;margin:0 0 14px;text-align:center">
      <span style="color:#e5e7e2;font-weight:700">🏕️ Trip</span><span style="color:#aabd7f;font-weight:700">List</span>
    </p>
    <div style="background:#242722;border:1px solid rgba(255,255,255,0.09);border-radius:16px;padding:32px 28px;box-shadow:0 8px 32px rgba(0,0,0,0.35),0 0 24px rgba(143,166,92,0.10)">
      <h1 style="font-size:21px;line-height:1.35;margin:0 0 14px;color:#f5f6f4">${heading}</h1>
      <div style="color:#a8b0a1;font-size:14px;line-height:1.65">${bodyHtml}</div>
      ${quote ? `<p style="border-left:3px solid #74893f;padding:8px 14px;margin:16px 0 0;color:#cbd0c6;font-size:14px;font-style:italic">&ldquo;${quote}&rdquo;</p>` : ''}
      ${cta ? `<div style="margin:24px 0 4px"><a href="${cta.url}" style="display:inline-block;background:#74893f;color:#f3f6ee;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:12px">${cta.label}</a></div>` : ''}
      ${footnote ? `<p style="color:#697263;font-size:12px;line-height:1.6;margin:18px 0 0">${footnote}</p>` : ''}
    </div>
    <p style="color:#525a4e;font-size:11px;text-align:center;margin:18px 0 0">
      Layered lists for every kind of trip · <a href="https://triplist.dev" style="color:#8fa65c;text-decoration:none">triplist.dev</a>
    </p>
  </div>
</div>
</body></html>`
}

/** Send a branded email; returns true when delivered to Resend without error. */
export async function sendEmail({ to, subject, ...template }) {
  if (!resend) return false
  try {
    const { error } = await resend.emails.send({ from: FROM, to, subject, html: renderEmail(template) })
    if (error) console.error('resend error:', error)
    return !error
  } catch (err) {
    console.error('resend send failed:', err.message)
    return false
  }
}
