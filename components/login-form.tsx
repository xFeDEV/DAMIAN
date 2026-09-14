'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { WalletCards } from 'lucide-react'
import { useAuth } from '@/components/providers'

export function LoginForm() {
  const { user, ready, login } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (ready && user) router.replace('/')
  }, [ready, user, router])

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(email.trim(), password)
      router.replace('/')
    } catch {
      setError('Correo o contraseña incorrectos.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={onSubmit}>
        <div className="login-brand">
          <div className="brand-icon">
            <WalletCards />
          </div>
          <div>
            <h1>Damián</h1>
            <p>Gestión de cartera</p>
          </div>
        </div>

        <label className="field">
          <span>Correo electrónico</span>
          <input
            type="email"
            autoComplete="username"
            placeholder="admin@damian.local"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>

        <label className="field">
          <span>Contraseña</span>
          <input
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        {error && <div className="login-error">{error}</div>}

        <button className="login-submit" type="submit" disabled={submitting}>
          {submitting ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </div>
  )
}
