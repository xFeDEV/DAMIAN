'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Banknote, CalendarDays, CircleDollarSign, CreditCard, Download, Search, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DataTable, Empty, Head, Stat } from '@/components/ui/kit'
import { useAuth, useData, useLookups, useToast } from '@/components/providers'
import { METHOD_LABEL, isSameDay, isSameMonth } from '@/lib/derive'
import { downloadCSV, formatDate, money, normalize } from '@/lib/format'

export default function PaymentsView() {
  const { payments, deletePayment } = useData()
  const { clientById, loanById } = useLookups()
  const { user } = useAuth()
  const notify = useToast()
  const router = useRouter()
  const [query, setQuery] = useState('')

  const stats = useMemo(() => {
    const now = new Date()
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    return {
      today: payments.filter((payment) => isSameDay(payment.paid_at, now)).reduce((sum, payment) => sum + payment.amount, 0),
      week: payments
        .filter((payment) => new Date(payment.paid_at.replace(' ', 'T')).getTime() >= weekAgo.getTime())
        .reduce((sum, payment) => sum + payment.amount, 0),
      month: payments.filter((payment) => isSameMonth(payment.paid_at, now)).reduce((sum, payment) => sum + payment.amount, 0),
    }
  }, [payments])

  const rows = useMemo(() => {
    const term = normalize(query.trim())
    if (!term) return payments
    return payments.filter((payment) => {
      const client = clientById.get(payment.client)
      const loan = loanById.get(payment.loan)
      return normalize(`${client?.name ?? ''} ${loan?.code ?? ''} ${payment.reference}`).includes(term)
    })
  }, [payments, query, clientById, loanById])

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
        <Stat label="Recaudado hoy" value={money(stats.today)} icon={CircleDollarSign} tone="green" />
        <Stat label="Últimos 7 días" value={money(stats.week)} icon={CalendarDays} />
        <Stat label="Este mes" value={money(stats.month)} icon={Banknote} />
      </div>

      <div className="card">
        <div className="toolbar">
          <div className="search-field">
            <Search />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar pago, cliente o préstamo..." />
          </div>
        </div>

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
