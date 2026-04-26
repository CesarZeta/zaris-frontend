import { X } from 'lucide-react'
import { useNotificationsStore } from '../../stores/notifications'
import type { Notification } from '../../lib/types'
import s from './Notifications.module.css'

const KIND_STYLES: Record<Notification['kind'], { bar: string }> = {
  info:    { bar: 'var(--zaris-orange)' },
  success: { bar: 'var(--color-success)' },
  error:   { bar: 'var(--color-error)' },
}

export function Notifications() {
  const { items, dismiss } = useNotificationsStore()

  return (
    <div className={s.container} aria-live="polite" aria-label="Notificaciones">
      {items.map((n) => (
        <div key={n.id} className={s.toast}>
          <div className={s.bar} style={{ background: KIND_STYLES[n.kind].bar }} />
          <div className={s.content}>
            <p className={s.title}>{n.title}</p>
            {n.body && <p className={s.body}>{n.body}</p>}
          </div>
          <button className={s.close} onClick={() => dismiss(n.id)} aria-label="Cerrar">
            <X size={13} strokeWidth={1.5} />
          </button>
        </div>
      ))}
    </div>
  )
}
