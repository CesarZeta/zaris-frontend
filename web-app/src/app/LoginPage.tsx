import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/auth'
import { api } from '../lib/api'
import type { User } from '../lib/types'
import s from './LoginPage.module.css'

interface LoginResponse {
  access_token: string
  user: User
}

export function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const login    = useAuthStore((s) => s.login)
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.post<LoginResponse>('/api/v1/auth/login', { email, password })
      login(res.access_token, res.user)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={s.page}>
      <div className={s.card}>
        {/* Mark */}
        <div className={s.mark}>
          <svg width="20" height="20" viewBox="0 0 28 28" fill="none">
            <path d="M6 6h16L8 22h16" stroke="#f2f1ed" strokeWidth="2.8" strokeLinecap="square" />
          </svg>
        </div>

        <h1 className={s.title}>Iniciar sesión</h1>
        <p className={s.subtitle}>Ingresá tus credenciales para acceder al sistema ZARIS.</p>

        <form className={s.form} onSubmit={handleSubmit} noValidate>
          <div className={s.field}>
            <label className={s.label} htmlFor="email">Correo electrónico</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={s.input}
              placeholder="usuario@municipio.gob.ar"
              required
            />
          </div>

          <div className={s.field}>
            <label className={s.label} htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={s.input}
              placeholder="••••••••"
              required
            />
          </div>

          {error && <p className={s.error} role="alert">{error}</p>}

          <button type="submit" className={s.submit} disabled={loading}>
            {loading ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}
