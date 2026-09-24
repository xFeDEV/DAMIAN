'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, Loader2, LogIn, WalletCards } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/components/providers'
import { ThemeToggle } from '@/components/theme-toggle'

export function LoginForm() {
  const { user, ready, login } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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
      setError('Correo o contraseña incorrectos. Revisa e inténtalo de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-fab">
        <ThemeToggle />
      </div>

      <form className="login-card" onSubmit={onSubmit} noValidate>
        <div className="login-brand">
          <div className="brand-icon">
            <WalletCards />
          </div>
          <div>
            <h1>Damián</h1>
            <p>Gestión de cartera</p>
          </div>
        </div>

        <div className="login-fields">
          <label className="field">
            <span>Correo electrónico</span>
            <input
              type="email"
              autoComplete="username"
              placeholder="admin@damian.local"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={!!error}
              required
            />
          </label>

          <div className="field">
            <label className="field-label-row" htmlFor="login-password">
              <span>Contraseña</span>
              <button
                type="button"
                className="login-eye"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </button>
            </label>
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={!!error}
              required
            />
          </div>
        </div>

        {error && (
          <div className="login-error" role="alert">
            {error}
          </div>
        )}

        <Button
          type="submit"
          variant="default"
          size="lg"
          disabled={submitting || !email || !password}
          className="login-submit h-11 w-full gap-2"
        >
          {submitting ? <Loader2 className="animate-spin" /> : <LogIn />}
          {submitting ? 'Ingresando…' : 'Ingresar'}
        </Button>

        <p className="login-footnote">
          Acceso reservado para operadores de Damián.
          <br />
          ¿Eres cliente? <Link href="/consulta">Consulta tu crédito</Link>
        </p>
      </form>
    </div>
  )
}
