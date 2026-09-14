'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle2, CircleDollarSign, Download, Eye, WalletCards } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge, DataTable, Empty, Head, Section, Stat } from '@/components/ui/kit'
import { useData, useLookups } from '@/components/providers'
import { LOAN_STATUS_LABEL, isSameMonth } from '@/lib/derive'
import { daysBetween, downloadCSV, formatDate, money } from '@/lib/format'

export default function PortfolioView() {
  const { loans, payments } = useData()
  const { clientById } = useLookups()
  const router = useRouter()

  const data = useMemo(() => {
    const active = loans.filter((loan) => loan.status !== 'finalizado')
    const overdue = loans.filter((loan) => loan.status === 'en_mora')
    const current = active.filter((loan) => loan.status !== 'en_mora')
    const activeBalance = active.reduce((sum, loan) => sum + (Number(loan.balance) || 0), 0)
    const overdueBalance = overdue.reduce((sum, loan) => sum + (Number(loan.balance) || 0), 0)
    const currentBalance = current.reduce((sum, loan) => sum + (Number(loan.balance) || 0), 0)
    const recovered = payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0)
    const total = activeBalance || 1

    const buckets = [
      { label: 'Al día', value: currentBalance, tone: 'blue' },
      { label: 'Vencida', value: overdueBalance, tone: 'red' },
    ].map((bucket) => ({ ...bucket, pct: Math.round((bucket.value / total) * 100) }))

    return {
      active,
      activeBalance,
      overdueBalance,
      currentBalance,
      recovered,
      buckets,
      thisMonth: payments.filter((payment) => isSameMonth(payment.paid_at)).reduce((sum, payment) => sum + payment.amount, 0),
    }
  }, [loans, payments])

  function exportCSV() {
    downloadCSV(
      `damian-cartera-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        ['Cliente', 'Préstamo', 'Saldo', 'Días de atraso', 'Próxima/última cuota', 'Estado'],
        ...data.active.map((loan) => [
          clientById.get(loan.client)?.name ?? '',
          loan.code,
          loan.balance,
          loan.status === 'en_mora' ? daysBetween(loan.end_at) : 0,
          formatDate(loan.end_at),
          LOAN_STATUS_LABEL[loan.status] || '',
        ]),
      ],
    )
  }

  return (
    <>
      <Head
        title="Cartera"
        desc="Consulta el estado general de las obligaciones pendientes."
        action={
          <Button variant="outline" onClick={exportCSV}>
            <Download data-icon="inline-start" />
            Exportar cartera
          </Button>
        }
      />

      <div className="stats-grid">
        <Stat label="Cartera activa" value={money(data.activeBalance)} icon={WalletCards} />
        <Stat label="Cartera vencida" value={money(data.overdueBalance)} icon={AlertTriangle} tone="red" />
        <Stat label="Cartera al día" value={money(data.currentBalance)} icon={CheckCircle2} tone="green" />
        <Stat label="Recuperado este mes" value={money(data.thisMonth)} icon={CircleDollarSign} />
      </div>

      <div className="card">
        <Section title="Obligaciones pendientes" desc="Saldo pendiente de préstamos activos, segmentado por estado." />
        <div className="portfolio-bars">
          {data.buckets.map((bucket) => (
            <div key={bucket.label}>
              <span>{bucket.label}</span>
              <div>
                <i className={bucket.tone} style={{ width: `${bucket.pct}%` }} />
              </div>
              <b>{bucket.pct}%</b>
            </div>
          ))}
        </div>

        <DataTable>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Préstamo</th>
              <th>Saldo</th>
              <th>Días de atraso</th>
              <th>Vencimiento</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.active.length > 0 ? (
              data.active.slice(0, 15).map((loan) => {
                const client = clientById.get(loan.client)
                const late = loan.status === 'en_mora' ? daysBetween(loan.end_at) : 0
                return (
                  <tr key={loan.id}>
                    <td>
                      <b>{client?.name ?? '—'}</b>
                    </td>
                    <td>
                      <button className="link" onClick={() => router.push(`/prestamos/${loan.id}`)}>
                        {loan.code}
                      </button>
                    </td>
                    <td>
                      <b>{money(loan.balance)}</b>
                    </td>
                    <td>{late > 0 ? late : '—'}</td>
                    <td>{formatDate(loan.end_at)}</td>
                    <td>
                      <Badge status={LOAN_STATUS_LABEL[loan.status] || 'Activo'} />
                    </td>
                    <td>
                      <button className="icon-btn" onClick={() => router.push(`/prestamos/${loan.id}`)}>
                        <Eye />
                      </button>
                    </td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan={7}>
                  <Empty title="Cartera sin obligaciones" desc="No hay saldos pendientes." />
                </td>
              </tr>
            )}
          </tbody>
        </DataTable>
      </div>
    </>
  )
}
