import { create } from 'zustand'
import type { Notification } from '../lib/types'

interface NotificationsState {
  items: Notification[]
  push: (n: Omit<Notification, 'id'>) => void
  dismiss: (id: string) => void
}

export const useNotificationsStore = create<NotificationsState>()((set) => ({
  items: [],

  push(n) {
    const id = crypto.randomUUID()
    set((s) => ({ items: [...s.items, { ...n, id }] }))
    const ttl = n.ttl ?? 4000
    setTimeout(() => set((s) => ({ items: s.items.filter((i) => i.id !== id) })), ttl)
  },

  dismiss(id) {
    set((s) => ({ items: s.items.filter((i) => i.id !== id) }))
  },
}))
