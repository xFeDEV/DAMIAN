'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Banknote, CalendarDays, CircleDollarSign, CreditCard, Download, Search, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DataTable, Empty, Head, Stat } from '@/components/ui/kit'
import { useAuth, useData, useLookups, useToast, useToday } from '@/components/providers'
import { METHOD_LABEL, isSameDay, isSameMonth } from '@/lib/derive'
import { downloadCSV, formatDate, money, normalize } from '@/lib/format'

const PAYMENT_FILTERS: Record<string, string> = {
  hoy: 'Recaudado hoy',
  semana: 'Últimos 7 días',
  mes: 'Este mes',
}

export default function PaymentsView() {
  const { payments, deletePayment } = useData()
  const { clientById, loanById } = useLookups()
  const { user } = useAuth()
  const notify = useToast()
  const router = useRouter()
  const today = useToday()
  const [query, setQuery] = useState('')
  const [filtro, setFiltro] = useState('')

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get('filtro')
    if (value) setFiltro(value)
  }, [])

  const stats = useMemo(() => {
    const weekAgo = new Date(today)
    weekAgo.setDate(weekAgo.getDate() - 7)
    return {
      today: payments.filter((payment) => isSameDay(payment.paid_at, today)).reduce((sum, payment) => sum + payment.amount, 0),
      week: payments
        .filter((payment) => new Date(payment.paid_at.replace(' ', 'T')).getTime() >= weekAgo.getTime())
        .reduce((sum, payment) => sum + payment.amount, 0),
      month: payments.filter((payment) => isSameMonth(payment.paid_at, today)).reduce((sum, payment) => sum + payment.amount, 0),
    }
  }, [payments, today])

  const rows = useMemo(() => {
    let base = payments
    if (filtro === 'mes') base = payments.filter((payment) => isSameMonth(payment.paid_at, today))
    else if (filtro === 'hoy') base = payments.filter((payment) => isSameDay(payment.paid_at, today))
    else if (filtro === 'semana') {
      const weekAgo = new Date(today)
      weekAgo.setDate(weekAgo.getDate() - 7)
      base = payments.filter((payment) => new Date(payment.paid_at.replace(' ', 'T')).getTime() >= weekAgo.getTime())
    }

    const term = normalize(query.trim())
    if (!term) return base
    return base.filter((payment) => {
      const client = clientById.get(payment.client)
      const loan = loanById.get(payment.loan)
      return normalize(`${client?.name ?? ''} ${loan?.code ?? ''} ${payment.reference}`).includes(term)
    })
  }, [payments, filtro, today, query, clientById, loanById])

  function exportCSV() {
    downloadCSV(
      `damian-pagos-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        ['Fecha', 'Cliente', 'Préstamo', 'Valor', 'Método', 'Referencia'],
        ...rows.map((payment) => [
          formatDate(payment.paid_at),
          clientById.get(payment.client)?.name ?? '',
          loanById.get(payment.loan)?.code ?? '',
          payment.amount,
          METHOD_LABEL[payment.method] || '',
          payment.reference,
        ]),
      ],
    )
  }

  async function onDelete(id: string) {
    if (!window.confirm('¿Eliminar este pago? El saldo del préstamo se recalculará.')) return
    try {
      await deletePayment(id)
      notify('Pago eliminado')
    } catch {
      notify('No se pudo eliminar el pago')
    }
  }

  const isAdmin = user?.role === 'admin'

  return (
    <>
      <Head
        title="Pagos"
        desc="Historial completo de recaudos registrados."
        action={
          <Button variant="outline" onClick={exportCSV}>
            <Download data-icon="inline-start" />
            Exportar
          </Button>
        }
      />

      <div className="stats-grid">
        <Stat label="Recaudado hoy" value={money(stats.today)} icon={CircleDollarSign} tone="green" href="/pagos?filtro=hoy" />
        <Stat label="Últimos 7 días" value={money(stats.week)} icon={CalendarDays} href="/pagos?filtro=semana" />
        <Stat label="Este mes" value={money(stats.month)} icon={Banknote} href="/pagos?filtro=mes" />
      </div>

      <div className="card">
        <div className="toolbar">
          <div className="search-field">
            <Search />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar pago, cliente o préstamo..." />
          </div>
        </div>

        {PAYMENT_FILTERS[filtro] && (
          <span className="pill-filter">
            {PAYMENT_FILTERS[filtro]} · {rows.length}
            <button className="link" onClick={() => setFiltro('')}>
              Quitar filtro
            </button>
          </span>
        )}

        <DataTable>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Cliente</th>
              <th>Préstamo</th>
              <th>Valor</th>
              <th>Método</th>
              <th>Registrado por</th>
              {isAdmin && <th></th>}
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((payment) => {
                const client = clientById.get(payment.client)
                const loan = loanById.get(payment.loan)
                return (
                  <tr key={payment.id}>
                    <td>{formatDate(payment.paid_at)}</td>
                    <td>
                      <b>{client?.name ?? '—'}</b>
                    </td>
                    <td>
                      <button className="link" onClick={() => router.push(`/prestamos/${payment.loan}`)}>
                        {loan?.code ?? '—'}
                      </button>
                    </td>
                    <td>
                      <b className="positive">{money(payment.amount)}</b>
                    </td>
                    <td>
                      <span className="method">
                        <CreditCard />
                        {METHOD_LABEL[payment.method] || '—'}
                      </span>
                    </td>
                    <td>{payment.created_by ? 'Operador' : 'Sistema'}</td>
                    {isAdmin && (
                      <td>
                        <button className="icon-btn danger" onClick={() => onDelete(payment.id)} title="Eliminar pago">
                          <Trash2 />
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan={isAdmin ? 7 : 6}>
                  <Empty title="Sin pagos" desc="Aún no hay recaudos registrados." />
                </td>
              </tr>
            )}
          </tbody>
        </DataTable>
      </div>
    </>
  )
}
