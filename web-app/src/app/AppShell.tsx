import { Outlet, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { Sidebar } from '../shell/Sidebar/Sidebar'
import { TopBar } from '../shell/TopBar/TopBar'
import { CommandMenu } from '../shell/CommandMenu/CommandMenu'
import { Notifications } from '../shell/Notifications/Notifications'
import { useAuthStore } from '../stores/auth'
import { useUiStore } from '../stores/ui'
import s from './AppShell.module.css'

export function AppShell() {
  const user = useAuthStore((s) => s.user)
  const openCmdk = useUiStore((s) => s.openCmdk)
  const navigate = useNavigate()

  // Guard: si no hay sesión redirigir a login
  useEffect(() => {
    if (!user) navigate('/login', { replace: true })
  }, [user, navigate])

  // Atajo ⌘K / Ctrl+K global
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        openCmdk()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [openCmdk])

  if (!user) return null

  return (
    <div className={s.shell}>
      <Sidebar />
      <div className={s.main}>
        <TopBar />
        <main className={s.content}>
          <Outlet />
        </main>
      </div>
      <CommandMenu />
      <Notifications />
    </div>
  )
}
