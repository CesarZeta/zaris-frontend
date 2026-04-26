import type { LucideIcon } from 'lucide-react'
import type React from 'react'

export interface User {
  id_usuario: number
  nombre: string
  email: string
  nivel_acceso: 1 | 2 | 3 | 4
}

export interface SubNavItem {
  label: string
  path: string
}

export interface ModuleRoute {
  index?: boolean
  path?: string
  element: React.FC
  handle?: Record<string, unknown>
}

export interface ModuleManifest {
  id: string
  label: string
  icon: LucideIcon
  routes: ModuleRoute[]
  navItems?: SubNavItem[]
  permissions?: string[]
}

export interface Notification {
  id: string
  kind: 'info' | 'success' | 'error'
  title: string
  body?: string
  ttl?: number
}

export interface Notification {
  id: string
  kind: 'info' | 'success' | 'error'
  title: string
  body?: string
  ttl?: number // ms, default 4000
}
