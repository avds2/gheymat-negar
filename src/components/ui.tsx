import { useEffect, useId, useRef, type ReactNode } from 'react'
import { AlertTriangle, X } from 'lucide-react'

export function Modal({ open, title, onClose, children, wide = false }: { open: boolean; title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const dialogRef = useRef<HTMLElement>(null)
  const titleId = useId()
  const previousFocus = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  useEffect(() => {
    if (!open) return
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const frame = requestAnimationFrame(() => {
      const modalBody = dialogRef.current?.querySelector<HTMLElement>('.modal-body')
      const autoFocusTarget = modalBody?.querySelector<HTMLElement>('[autofocus]')
      const fallbackTarget = modalBody?.querySelector<HTMLElement>('input:not(:disabled), select:not(:disabled), textarea:not(:disabled), button:not(:disabled), [tabindex]:not([tabindex="-1"])')
      ;(autoFocusTarget ?? fallbackTarget ?? dialogRef.current)?.focus()
    })

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [href], [tabindex]:not([tabindex="-1"])')]
        .filter(el => !el.hasAttribute('hidden'))
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      previousFocus.current?.focus()
    }
  }, [open])

  if (!open) return null
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
    <section ref={dialogRef} className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
      <div className="modal-head"><h2 id={titleId}>{title}</h2><button className="icon-button" onClick={onClose} aria-label="بستن پنجره"><X size={20}/></button></div>
      <div className="modal-body">{children}</div>
    </section>
  </div>
}

export function ConfirmDialog({ open, title, body, confirmText = 'تأیید', danger = false, onConfirm, onClose }: { open: boolean; title: string; body: ReactNode; confirmText?: string; danger?: boolean; onConfirm: () => void; onClose: () => void }) {
  return <Modal open={open} title={title} onClose={onClose}>
    <div className="confirm-content">
      <div className={`confirm-icon ${danger ? 'danger' : ''}`}><AlertTriangle size={24}/></div>
      <div className="confirm-copy">{body}</div>
    </div>
    <div className="form-actions confirm-actions">
      <button type="button" className={`button ${danger ? 'danger solid-danger' : 'primary'}`} onClick={onConfirm}>{confirmText}</button>
      <button type="button" className="button ghost" onClick={onClose}>انصراف</button>
    </div>
  </Modal>
}

export function StatCard({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'up'|'down'|'neutral' }) {
  return <div className="stat-card">
    <div className="stat-label">{label}</div>
    <div className={`stat-value ${tone ? `tone-${tone}` : ''}`}>{value}</div>
    {hint ? <div className="stat-hint">{hint}</div> : null}
  </div>
}

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body: string; action?: ReactNode }) {
  return <div className="empty-state">
    {icon ? <div className="empty-icon">{icon}</div> : null}
    <h3>{title}</h3><p>{body}</p>{action ? <div className="empty-action">{action}</div> : null}
  </div>
}

export function Badge({ children, tone = 'default' }: { children: ReactNode; tone?: 'default'|'success'|'danger'|'info' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}
