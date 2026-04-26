import { useEffect } from 'react'
import { LayoutDashboard, Users, FileText, Activity } from 'lucide-react'
import { Card, Table, Badge, EmptyState } from '../../../ui'
import { useNotificationsStore } from '../../../stores/notifications'
import s from './Overview.module.css'

const STATS = [
  { label: 'Ciudadanos registrados', value: '1.284', icon: Users,          delta: '+12 esta semana' },
  { label: 'Módulos activos',        value: '4',     icon: LayoutDashboard, delta: 'BUC · Agenda · CRM · Admin' },
  { label: 'Reclamos abiertos',      value: '37',    icon: FileText,        delta: '5 vencen hoy' },
  { label: 'Actividad reciente',     value: '128',   icon: Activity,        delta: 'acciones en las últimas 24h' },
]

const RECENT_ACTIONS = [
  { id: 1, usuario: 'Cesar Zeta',     accion: 'Alta ciudadano',   tabla: 'ciudadanos', fecha: '2026-04-26 17:42' },
  { id: 2, usuario: 'Juan Pestto',    accion: 'Edición empresa',  tabla: 'empresas',   fecha: '2026-04-26 16:55' },
  { id: 3, usuario: 'Roy Manoss',     accion: 'Alta área',        tabla: 'area',       fecha: '2026-04-26 15:10' },
  { id: 4, usuario: 'Cesar Zeta',     accion: 'Baja tipo reclamo',tabla: 'tipo_reclamo',fecha:'2026-04-26 14:03' },
  { id: 5, usuario: 'Roberto Filad',  accion: 'Alta agente',      tabla: 'agentes',    fecha: '2026-04-26 11:30' },
]

export function Overview() {
  const push = useNotificationsStore((s) => s.push)

  useEffect(() => {
    push({ kind: 'success', title: 'Bienvenido al sistema ZARIS', ttl: 5000 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className={s.page}>
      <div className={s.header}>
        <h1 className={s.title}>dashboard</h1>
        <p className={s.subtitle}>Resumen del estado actual del sistema.</p>
      </div>

      {/* Stat cards */}
      <div className={s.statsGrid}>
        {STATS.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.label} variant="ambient" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 'var(--size-btn)', color: 'var(--fg-3)' }}>{stat.label}</span>
                <Icon size={16} strokeWidth={1.5} style={{ color: 'var(--fg-3)' }} />
              </div>
              <p style={{ fontSize: 'var(--size-subhead)', fontWeight: 400, letterSpacing: 'var(--track-subhead)', color: 'var(--fg-1)' }}>
                {stat.value}
              </p>
              <p style={{ fontSize: 11, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>{stat.delta}</p>
            </Card>
          )
        })}
      </div>

      {/* Recent activity table */}
      <Card variant="default" style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 'var(--size-btn)', fontWeight: 500, color: 'var(--fg-1)' }}>actividad reciente</h2>
          <Badge kind="neutral">últimas 24h</Badge>
        </div>
        <Table
          keyField="id"
          columns={[
            { key: 'usuario',  header: 'usuario',  width: '25%' },
            { key: 'accion',   header: 'acción' },
            { key: 'tabla',    header: 'tabla',   render: (r) => <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-3)' }}>{r.tabla as string}</code> },
            { key: 'fecha',    header: 'fecha',   render: (r) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{r.fecha as string}</span> },
          ]}
          rows={RECENT_ACTIONS as unknown as Record<string, unknown>[]}
        />
      </Card>

      {/* Empty state demo */}
      <Card variant="default" style={{ marginTop: 16 }}>
        <EmptyState
          title="No hay alertas pendientes."
          description="Las alertas del sistema aparecerán acá cuando haya eventos que requieran atención."
        />
      </Card>
    </div>
  )
}
