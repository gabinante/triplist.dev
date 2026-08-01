import { useEffect } from 'react'
import { createPortal } from 'react-dom'

export interface PrintItem {
  name: string
  checked?: boolean
  qty?: number | null
}

export interface PrintSheetData {
  title: string
  subtitle?: string
  groups: { heading: string; items: PrintItem[] }[]
}

/**
 * Hidden on screen, becomes the whole document in print. Setting `sheet`
 * opens the browser print dialog (which includes Save as PDF); onDone fires
 * after printing/cancel so the caller can clear the sheet.
 */
export function PrintSheet({ sheet, onDone }: { sheet: PrintSheetData | null; onDone: () => void }) {
  useEffect(() => {
    if (!sheet) return
    const done = () => onDone()
    window.addEventListener('afterprint', done)
    // Give the portal a frame to paint before opening the dialog.
    const timer = setTimeout(() => window.print(), 60)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('afterprint', done)
    }
  }, [sheet, onDone])

  if (!sheet) return null

  return createPortal(
    <div className="print-sheet">
      <header>
        <h1>{sheet.title}</h1>
        {sheet.subtitle && <p className="print-subtitle">{sheet.subtitle}</p>}
      </header>
      {sheet.groups.map(group => (
        <section key={group.heading}>
          <h2>{group.heading}</h2>
          <ul>
            {group.items.map(item => (
              <li key={item.name}>
                <span className={`print-box${item.checked ? ' print-box-checked' : ''}`} />
                <span className="print-name">{item.name}</span>
                {item.qty != null && item.qty > 1 && <span className="print-qty">×{item.qty}</span>}
              </li>
            ))}
          </ul>
        </section>
      ))}
      <footer>Packed with TripList · triplist.dev</footer>
    </div>,
    document.body,
  )
}
