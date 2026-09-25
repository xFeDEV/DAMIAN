'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Activity, AlertTriangle, Banknote, CalendarDays, CircleDollarSign, Plus, WalletCards } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, Badge, DataTable, Empty, Head, Section, Stat } from '@/components/ui/kit'
import { LoanModal } from '@/components/modals/loan-modal'
import { PaymentModal } from '@/components/modals/payment-modal'
import { PaymentPicker } from '@/components/modals/payment-picker'
import { WhatsAppButton } from '@/components/ui/whatsapp-button'
import { useData, useLookups, useToday } from '@/components/providers'
import {
  ACTIVITY_LABEL,
  activityTone,
  dayKey,
  daysLate,
  effectiveInstallmentStatus,
  INSTALLMENT_STATUS_LABEL,
  installmentOutstanding,
  isOverdue,
  isSameDay,
  isSameMonth,
  moraTotal,
  todayKey,
} from '@/lib/derive'
import { buildCashEntries, cashSummary } from '@/lib/cash'
import { compactMoney, formatDate, formatLongDate, money, relativeTime } from '@/lib/format'

const DONUT_COLORS: Record<string, string> = {
  blue: 'var(--accent-bar)',
  amber: 'var(--warn)',
  red: 'var(--danger)',
  gray: 'var(--muted-bar)',
}

export default function DashboardView() {
  const router = useRouter()
  const { loans, installments, payments, cashMovements, settings, activity } = useData()
  const { clientById } = useLookups()
  const [modal, setModal] = useState<'loan' | 'payment' | 'picker' | null>(null)
  const [selectedLoan, setSelectedLoan] = useState('')

  const today = useToday()

  const cash = useMemo(
    () => cashSummary(buildCashEntries(payments, loans, cashMovements), settings, todayKey(today)),
    [payments, loans, cashMovements, settings, today],
  )

  const stats = useMemo(() => {
    const activeLoans = loans.filter((loan) => loan.status !== 'finalizado')
    const pending = installments.filter((item) => installmentOutstanding(item) > 0)
    const carteraActiva = activeLoans.reduce((sum, loan) => sum + (Number(loan.balance) || 0), 0)
    const cobrarHoy = pending
      .filter((item) => isSameDay(item.due_date, today))
      .reduce((sum, item) => sum + installmentOutstanding(item), 0)
    const vencido = moraTotal(installments, today)
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
    const activeBalance = loans.reduce((sum, loan) => sum + (Number(loan.balance) || 0), 0)
    const mora = moraTotal(installments, today)
    const alDia = Math.max(0, activeBalance - mora)
    const total = activeBalance || 1
    const pct = (value: number) => Math.round((value / total) * 100)
    return [
      { label: 'Al día', value: alDia, pct: pct(alDia), tone: 'blue' },
      { label: 'En mora', value: mora, pct: pct(mora), tone: 'red' },
    ]
  }, [loans, installments, today])

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
        .filter(
          (item) =>
            installmentOutstanding(item) > 0 && (isOverdue(item, today) || isSameDay(item.due_date, today)),
        )
        .sort((a, b) => dayKey(a.due_date).localeCompare(dayKey(b.due_date))),
    [installments, today],
  )

  return (
    <>
      <Head
        title="Resumen de cartera"
        desc="Consulta el estado de tus préstamos y cobranza."
        action={
          <div className="page-head-actions">
            <Button variant="outline" onClick={() => setModal('picker')}>
              <Banknote data-icon="inline-start" />
              Registrar pago
            </Button>
            <Button onClick={() => setModal('loan')}>
              <Plus data-icon="inline-start" />
              Nuevo préstamo
            </Button>
          </div>
        }
      />

      <div className="stats-grid">
        <Stat label="Cartera activa" value={money(stats.carteraActiva)} icon={WalletCards} href="/prestamos?filtro=activos" />
        <Stat
          label="Por cobrar hoy"
          value={money(stats.cobrarHoy)}
          icon={CalendarDays}
          tone="amber"
          href="/cuotas?filtro=hoy"
        />
        <Stat label="En mora" value={money(stats.vencido)} icon={AlertTriangle} tone="red" href="/cuotas?filtro=mora" />
        <Stat
          label="Recaudado este mes"
          value={money(stats.recaudadoMes)}
          icon={CircleDollarSign}
          tone="green"
          href="/pagos?filtro=mes"
        />
      </div>

      <div className="card cash-strip">
        <div className="cash-strip-item">
          <span>Efectivo en caja</span>
          <b>{money(cash.cash)}</b>
        </div>
        <div className="cash-strip-item">
          <span>En cuenta (digital)</span>
          <b>{money(cash.digital)}</b>
        </div>
        <div className="cash-strip-item">
          <span>Total en caja</span>
          <b>{money(cash.total)}</b>
        </div>
        <Button variant="outline" size="sm" onClick={() => router.push('/caja')}>
          Ver caja
        </Button>
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
        <div className="card dash-cuotas">
          <Section
            title="Cuotas en mora y de hoy"
            desc={formatLongDate(today.toISOString())}
            action={
              <Button variant="outline" size="sm" onClick={() => router.push('/cuotas')}>
                Ver agenda
              </Button>
            }
          />
          <div className="table-scroll">
            <DataTable>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Estado</th>
                  <th>Cuota</th>
                  <th>Vencimiento</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {upcoming.length > 0 ? (
                  upcoming.map((item) => {
                    const client = clientById.get(item.client)
                    const late = isOverdue(item, today)
                    return (
                      <tr key={item.id}>
                        <td>
                          <b>{client?.name ?? '—'}</b>
                          <small>{client?.phone}</small>
                        </td>
                        <td>
                          <Badge status={INSTALLMENT_STATUS_LABEL[effectiveInstallmentStatus(item, today)] || 'Pendiente'} />
                        </td>
                        <td>
                          <b>{money(item.amount)}</b>
                        </td>
                        <td>
                          {formatDate(item.due_date)}
                          {late && <small>{daysLate(item, today)} d</small>}
                        </td>
                        <td className="row-actions">
                          <WhatsAppButton clientId={item.client} loanId={item.loan} />
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
                    <td colSpan={5}>
                      <Empty title="Sin cuotas pendientes" desc="No hay obligaciones en mora ni para hoy." />
                    </td>
                  </tr>
                )}
              </tbody>
            </DataTable>
          </div>
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
      {modal === 'picker' && <PaymentPicker close={() => setModal(null)} />}
      {modal === 'payment' && selectedLoan && (
        <PaymentModal loanId={selectedLoan} close={() => setModal(null)} />
      )}
    </>
  )
}
