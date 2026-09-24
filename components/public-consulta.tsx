'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Search, SearchX, ShieldCheck, TriangleAlert } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { ThemeToggle } from '@/components/theme-toggle'
import { WhatsAppIcon } from '@/components/ui/whatsapp-button'
import { PB_URL } from '@/lib/pocketbase'
import { formatDate, money, whatsappUrl } from '@/lib/format'

interface ConsultaLoan {
  code: string
  total: number
  paid_total: number
  balance: number
  installments_count: number
  paid_count: number
  next_due_date: string
  next_due_amount: number
  status: 'en_mora' | 'activo'
  mora_count: number
  mora_total: number
}

interface ConsultaResult {
  found: boolean
  business?: { name: string; phone: string }
  client?: { name: string }
  totals?: { balance: number; mora: number; count: number }
  loans?: ConsultaLoan[]
  message?: string
}

export function PublicConsulta() {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<ConsultaResult | null>(null)
  const [business, setBusiness] = useState<{ name: string; phone: string }>({ name: 'Damián', phone: '' })
  const [error, setError] = useState('')

  // Trae marca y contacto del negocio (respuesta pública, sin datos de nadie).
  useEffect(() => {
    let active = true
    fetch(`${PB_URL}/api/damian/consulta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: '' }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ConsultaResult | null) => {
        if (active && data?.business) setBusiness(data.business)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  async function onSearch(event: React.FormEvent) {
    event.preventDefault()
    const value = query.trim()
    if (!value) return
    setStatus('loading')
    setResult(null)
    setError('')
    try {
      const res = await fetch(`${PB_URL}/api/damian/consulta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: value }),
      })
      const data = (await res.json().catch(() => ({}))) as ConsultaResult
      if (res.status === 429) {
        setError(data.message || 'Demasiadas consultas. Espera un minuto e inténtalo de nuevo.')
        setStatus('error')
        return
      }
      if (!res.ok) throw new Error('bad response')
      if (data.business) setBusiness(data.business)
      setResult(data)
      setStatus('done')
    } catch {
      setError('No pudimos consultar tu cuenta. Revisa tu conexión e inténtalo de nuevo.')
      setStatus('error')
    }
  }

  const loading = status === 'loading'
  const contact = business.phone
    ? whatsappUrl(business.phone, 'Hola, quiero consultar sobre mi crédito.')
    : ''

  return (
    <div className="public-page">
      <header className="public-top">
        <div className="public-brand">
          <span className="public-logo">
            <ShieldCheck />
          </span>
          {business.name}
        </div>
        <ThemeToggle />
      </header>

      <main className="public-main">
        <div className="public-hero">
          <h1>Consulta tu crédito</h1>
          <p>Ingresa tu cédula o tu número de teléfono y mira el estado de tu cuenta.</p>
        </div>

        <Card className="public-form-card">
          <CardContent>
            <form onSubmit={onSearch}>
              <Field>
                <FieldLabel htmlFor="consulta-q">Cédula o teléfono</FieldLabel>
                <div className="public-input-row">
                  <Input
                    id="consulta-q"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="Ej. 1045123456"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                  <Button type="submit" disabled={loading || !query.trim()}>
                    {loading ? <Spinner /> : <Search />}
                    Consultar
                  </Button>
                </div>
                <FieldDescription>Sin puntos ni espacios. Solo tú ves tu información.</FieldDescription>
              </Field>
            </form>
          </CardContent>
        </Card>

        {loading && (
          <Card className="public-result">
            <CardContent className="public-skeleton">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-10 w-52" />
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        )}

        {status === 'error' && (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>No pudimos consultar</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {status === 'done' && result?.found && result.client && result.totals && (
          <ResultCard result={result} contact={contact} businessName={business.name} />
        )}

        {status === 'done' && result && !result.found && (
          <Card>
            <CardContent>
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <SearchX />
                  </EmptyMedia>
                  <EmptyTitle>No encontramos tu cuenta</EmptyTitle>
                  <EmptyDescription>
                    {contact
                      ? 'Revisa que el número esté bien escrito o escríbenos por WhatsApp y te ayudamos.'
                      : 'Revisa que el número esté bien escrito e inténtalo de nuevo.'}
                  </EmptyDescription>
                </EmptyHeader>
                {contact && (
                  <EmptyContent>
                    <Button
                      variant="outline"
                      nativeButton={false}
                      render={<a href={contact} target="_blank" rel="noopener noreferrer" />}
                    >
                      <WhatsAppIcon />
                      Escríbenos por WhatsApp
                    </Button>
                  </EmptyContent>
                )}
              </Empty>
            </CardContent>
          </Card>
        )}
      </main>

      <footer className="public-foot">{business.name} · Gestión de cartera</footer>
    </div>
  )
}

function ResultCard({
  result,
  contact,
  businessName,
}: {
  result: ConsultaResult
  contact: string
  businessName: string
}) {
  const loans = result.loans ?? []
  const totals = result.totals ?? { balance: 0, mora: 0, count: 0 }
  const hasMora = totals.mora > 0
  const next = loans
    .filter((loan) => loan.next_due_date)
    .sort((a, b) => a.next_due_date.localeCompare(b.next_due_date))[0]

  return (
    <Card className="public-result">
      <div className={`status-banner ${hasMora ? 'mora' : 'ok'}`}>
        {hasMora ? <TriangleAlert /> : <CheckCircle2 />}
        {hasMora ? 'Tienes cuotas en mora' : 'Estás al día'}
      </div>

      <CardContent className="public-result-body">
        <p className="public-greeting">
          Hola, <b>{result.client?.name}</b>
        </p>

        <div className="total-block">
          <span>Total adeudado</span>
          <strong>{money(totals.balance)}</strong>
          {next && (
            <small>
              Próximo pago: {formatDate(next.next_due_date)} · {money(next.next_due_amount)}
            </small>
          )}
        </div>

        {loans.length > 0 && (
          <div className="loans-list">
            {loans.map((loan) => {
              const pct =
                loan.installments_count > 0
                  ? Math.min(100, Math.round((loan.paid_count / loan.installments_count) * 100))
                  : 0
              return (
                <div className="loan-row" key={loan.code}>
                  <div className="loan-row-head">
                    <b>{loan.code}</b>
                    <Badge variant={loan.status === 'en_mora' ? 'destructive' : 'secondary'}>
                      {loan.status === 'en_mora' ? 'En mora' : 'Al día'}
                    </Badge>
                  </div>
                  <div className="loan-progress">
                    <i style={{ width: `${pct}%` }} />
                  </div>
                  <div className="loan-row-foot">
                    <span>
                      {loan.paid_count}/{loan.installments_count} cuotas
                    </span>
                    <b>Saldo {money(loan.balance)}</b>
                  </div>
                  {loan.mora_total > 0 && (
                    <small className="loan-mora">
                      {loan.mora_count} cuota(s) en mora · {money(loan.mora_total)}
                    </small>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {contact && (
          <Button
            variant="outline"
            className="public-contact"
            nativeButton={false}
            render={<a href={contact} target="_blank" rel="noopener noreferrer" />}
          >
            <WhatsAppIcon />
            Escribir a {businessName} por WhatsApp
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
