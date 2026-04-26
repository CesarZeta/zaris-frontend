import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '../lib/types'

interface AuthState {
  user: User | null
  accessToken: string | null
  login: (token: string, user: User) => void
  logout: () => void
  hasPermission: (minLevel: number) => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,

      login(token, user) {
        set({ accessToken: token, user })
      },

      logout() {
        set({ accessToken: null, user: null })
      },

      hasPermission(minLevel) {
        const level = get().user?.nivel_acceso
        return level !== undefined && level <= minLevel
      },
    }),
    {
      name: 'zaris_session',
      // solo persistir token y user, no las funciones
      partialize: (s) => ({ accessToken: s.accessToken, user: s.user }),
    }
  )
)
