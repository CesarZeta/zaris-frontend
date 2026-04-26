import { LayoutDashboard } from 'lucide-react'
import type { ModuleManifest } from '../../lib/types'
import { Overview } from './pages/Overview'

export const dashboardModule: ModuleManifest = {
  id:    'dashboard',
  label: 'dashboard',
  icon:  LayoutDashboard,
  routes: [
    {
      index:   true,
      element: Overview,
      handle:  { breadcrumb: 'dashboard' },
    },
  ],
}
