import { create } from 'zustand'

interface UiState {
  sidebarCollapsed: boolean
  cmdkOpen: boolean
  toggleSidebar: () => void
  openCmdk: () => void
  closeCmdk: () => void
}

export const useUiStore = create<UiState>()((set) => ({
  sidebarCollapsed: false,
  cmdkOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  openCmdk:  () => set({ cmdkOpen: true }),
  closeCmdk: () => set({ cmdkOpen: false }),
}))
