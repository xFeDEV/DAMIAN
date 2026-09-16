'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Activity, AlertTriangle, CalendarDays, CircleDollarSign, Plus, WalletCards } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, Badge, DataTable, Empty, Head, Section, Stat } from '@/components/ui/kit'
import { LoanModal } from '@/components/modals/loan-modal'
import { PaymentModal } from '@/components/modals/payment-modal'
import { useData, useLookups } from '@/components/providers'
import { ACTIVITY_LABEL, activityTone, INSTALLMENT_STATUS_LABEL, isSameDay, isSameMonth } from '@/lib/derive'
import { compactMoney, formatDate, formatLongDate, money, relativeTime } from '@/lib/format'

const DONUT_COLORS: Record<string, string> = {
  blue: 'var(--accent-bar)',
  amber: 'var(--warn)',
  red: 'var(--danger)',
  gray: 'var(--muted-bar)',
}

export default function DashboardView() {
  const router = useRouter()
  const { loans, installments, payments, activity } = useData()
  const { clientById } = useLookups()
  const [modal, setModal] = useState<'loan' | 'payment' | null>(null)
  const [selectedLoan, setSelectedLoan] = useState('')

  const today = new Date()

  const stats = useMemo(() => {
    const activeLoans = loans.filter((loan) => loan.status !== 'finalizado')
    const pending = installments.filter((item) => item.status !== 'pagada')
    const carteraActiva = activeLoans.reduce((sum, loan) => sum + (Number(loan.balance) || 0), 0)
    const cobrarHoy = pending
      .filter((item) => isSameDay(item.due_date, today))
      .reduce((sum, item) => sum + (Number(item.amount) - Number(item.paid) || 0), 0)
    const vencido = installments
      .filter((item) => item.status === 'vencida')
      .reduce((sum, item) => sum + (Number(item.amount) - Number(item.paid) || 0), 0)
    const recaudadoMes = payments
      .filter((payment) => isSameMonth(payment.paid_at, today))
      .reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0)
    return { carteraActiva, cobrarHoy, vencido, recaudadoMes }
  }, [loans, installments, payments, today])

  const bars = useMemo(() => {
    const days = Array.from({ length: 14 }, (_, index) => {
      const date = new Date()
      date.setDate(date.getDate() - (13 - index))
      return date
    })
    const values = days.map((date) =>
      payments.filter((payment) => isSameDay(payment.paid_at, date)).reduce((sum, payment) => sum + payment.amount, 0),
    )
    const max = Math.max(1, ...values)
    return { values, heights: values.map((value) => Math.max(4, Math.round((value / max) * 100))), max }
  }, [payments])

  const portfolio = useMemo(() => {
    let alDia = 0
    let proxima = 0
    let mora = 0
    let finalizada = 0
    for (const loan of loans) {
      if (loan.status === 'finalizado') {
        finalizada += Number(loan.paid_total) || 0
        continue
      }
      const balance = Number(loan.balance) || 0
      if (loan.status === 'en_mora') {
        mora += balance
        continue
      }
      const end = loan.end_at ? new Date(loan.end_at.replace(' ', 'T')).getTime() : 0
      const soon = end > 0 && end - today.getTime() < 7 * 86_400_000
      if (soon) proxima += balance
      else alDia += balance
    }
    const total = alDia + proxima + mora + finalizada || 1
    const pct = (value: number) => Math.round((value / total) * 100)
    return [
      { label: 'Al día', value: alDia, pct: pct(alDia), tone: 'blue' },
      { label: 'Próxima a vencer', value: proxima, pct: pct(proxima), tone: 'amber' },
      { label: 'En mora', value: mora, pct: pct(mora), tone: 'red' },
      { label: 'Finalizada', value: finalizada, pct: pct(finalizada), tone: 'gray' },
    ]
  }, [loans, today])

  const donut = useMemo(() => {
    const total = portfolio.reduce((sum, item) => sum + item.value, 0)
    if (total <= 0) return 'conic-gradient(var(--divider-strong) 0 100%)'
    let acc = 0
    const stops = portfolio.map((item) => {
      const start = (acc / total) * 100
      acc += item.value
      const end = (acc / total) * 100
      return `${DONUT_COLORS[item.tone]} ${start.toFixed(2)}% ${end.toFixed(2)}%`
    })
    return `conic-gradient(${stops.join(', ')})`
  }, [portfolio])

  const upcoming = useMemo(
    () =>
      installments
        .filter((item) => item.status !== 'pagada')
        .sort((a, b) => new Date(a.due_date.replace(' ', 'T')).getTime() - new Date(b.due_date.replace(' ', 'T')).getTime())
        .slice(0, 5),
    [installments],
  )

  return (
    <>
      <Head
        title="Resumen de cartera"
        desc="Consulta el estado de tus préstamos y cobranza."
        action={
          <Button onClick={() => setModal('loan')}>
            <Plus data-icon="inline-start" />
            Nuevo préstamo
          </Button>
        }
      />

      <div className="stats-grid">
        <Stat label="Cartera activa" value={money(stats.carteraActiva)} icon={WalletCards} />
        <Stat label="Por cobrar hoy" value={money(stats.cobrarHoy)} icon={CalendarDays} tone="amber" />
        <Stat label="Vencido" value={money(stats.vencido)} icon={AlertTriangle} tone="red" />
        <Stat label="Recaudado este mes" value={money(stats.recaudadoMes)} icon={CircleDollarSign} tone="green" />
      </div>

      <div className="dash-grid">
        <div className="card chart-card">
          <Section title="Recaudo" desc="Últimos 14 días" />
          <div className="chart">
            <div className="yaxis">
              <span>{compactMoney(bars.max)}</span>
              <span>{compactMoney(bars.max / 2)}</span>
              <span>$0</span>
            </div>
            <div className="bars">
              {bars.heights.map((height, index) => (
                <i style={{ height: `${height}%` }} key={index} title={money(bars.values[index])} />
              ))}
            </div>
          </div>
        </div>

        <div className="card portfolio-chart">
          <Section title="Estado de cartera" desc="Distribución actual" />
          <div className="donut" style={{ background: donut }}>
            <div>
              <b>{portfolio[0].pct}%</b>
              <span>al día</span>
            </div>
          </div>
          <div className="legend">
            {portfolio.map((item) => (
              <span key={item.label}>
                <i className={item.tone} />
                {item.label} <b>{item.pct}%</b>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="lower-grid">
        <div className="card">
          <Section
            title="Próximas cuotas"
            desc={formatLongDate(today.toISOString())}
            action={
              <Button variant="outline" size="sm" onClick={() => router.push('/cuotas')}>
                Ver agenda
              </Button>
            }
          />
          <DataTable>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Préstamo</th>
                <th>Cuota</th>
                <th>Vencimiento</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {upcoming.length > 0 ? (
                upcoming.map((item) => {
                  const client = clientById.get(item.client)
                  return (
                    <tr key={item.id}>
                      <td>
                        <b>{client?.name ?? '—'}</b>
                        <small>{client?.phone}</small>
                      </td>
                      <td>{item.number}</td>
                      <td>
                        <b>{money(item.amount)}</b>
                      </td>
                      <td>{formatDate(item.due_date)}</td>
                      <td>
                        <Badge status={INSTALLMENT_STATUS_LABEL[item.status] || 'Pendiente'} />
                      </td>
                      <td>
                        <button
                          className="table-action"
                          onClick={() => {
                            setSelectedLoan(item.loan)
                            setModal('payment')
                          }}
                        >
                          Registrar pago
                        </button>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={6}>
                    <Empty title="Sin cuotas pendientes" desc="No hay obligaciones por cobrar." />
                  </td>
                </tr>
              )}
            </tbody>
          </DataTable>
        </div>

        <div className="card activity">
          <Section title="Actividad reciente" />
          <div className="activity-list">
            {activity.length > 0 ? (
              activity.slice(0, 5).map((item) => {
                const client = item.client ? clientById.get(item.client) : undefined
                return (
                  <div className="activity-item" key={item.id}>
                    <div className={`activity-icon ${activityTone(item.action)}`}>
                      <Activity />
                    </div>
                    <div>
                      <b>{ACTIVITY_LABEL[item.action] || item.action}</b>
                      <span>
                        {client?.name ? `${client.name} · ` : ''}
                        {relativeTime(item.created)}
                      </span>
                    </div>
                  </div>
                )
              })
            ) : (
              <Empty title="Sin actividad" desc="Los movimientos aparecerán aquí." />
            )}
          </div>
        </div>
      </div>

      {modal === 'loan' && <LoanModal close={() => setModal(null)} />}
      {modal === 'payment' && selectedLoan && (
        <PaymentModal loanId={selectedLoan} close={() => setModal(null)} />
      )}
    </>
  )
}
