'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Banknote, CheckCircle2, CircleDollarSign, Download, Eye, WalletCards } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge, DataTable, Empty, Head, Section, Stat } from '@/components/ui/kit'
import { PaymentModal } from '@/components/modals/payment-modal'
import { useData, useLookups, useToday } from '@/components/providers'
import {
  daysLate,
  effectiveLoanStatus,
  isSameMonth,
  LOAN_STATUS_LABEL,
  loanHasMora,
  moraTotal,
  overdueInstallments,
} from '@/lib/derive'
import { downloadCSV, formatDate, money } from '@/lib/format'

export default function PortfolioView() {
  const { loans, installments, payments } = useData()
  const { clientById } = useLookups()
  const router = useRouter()
  const today = useToday()
  const [payLoan, setPayLoan] = useState('')

  const data = useMemo(() => {
    const active = loans.filter((loan) => (Number(loan.balance) || 0) > 0)
    const overdue = active.filter((loan) => loanHasMora(loan.id, installments, today))
    const sumBalance = (items: typeof active) => items.reduce((sum, loan) => sum + (Number(loan.balance) || 0), 0)
    const activeBalance = sumBalance(active)
    // Cartera en mora = total de cuotas en mora (no el saldo completo del crédito).
    const overdueBalance = moraTotal(installments, today)
    const currentBalance = Math.max(0, activeBalance - overdueBalance)
    const recovered = payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0)
    const total = activeBalance || 1

    const maxLate = (loan: (typeof active)[number]) =>
      overdueInstallments(
        installments.filter((item) => item.loan === loan.id),
        today,
      ).reduce((max, item) => Math.max(max, daysLate(item, today)), 0)

    const buckets = [
      { label: 'Al día', value: currentBalance, tone: 'blue' },
      { label: 'En mora', value: overdueBalance, tone: 'red' },
    ].map((bucket) => ({ ...bucket, pct: Math.round((bucket.value / total) * 100) }))

    const rows = [...active].sort((a, b) => {
      const diff = (loanHasMora(b.id, installments, today) ? 1 : 0) - (loanHasMora(a.id, installments, today) ? 1 : 0)
      return diff !== 0 ? diff : maxLate(b) - maxLate(a)
    })

    return {
      active,
      rows,
      maxLate,
      overdueCount: overdue.length,
      activeBalance,
      overdueBalance,
      currentBalance,
      recovered,
      buckets,
      thisMonth: payments.filter((payment) => isSameMonth(payment.paid_at, today)).reduce((sum, payment) => sum + payment.amount, 0),
    }
  }, [loans, installments, payments, today])

  function exportCSV() {
    downloadCSV(
      `damian-cartera-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        ['Cliente', 'Préstamo', 'Saldo', 'Días de atraso', 'Próxima/última cuota', 'Estado'],
        ...data.rows.map((loan) => [
          clientById.get(loan.client)?.name ?? '',
          loan.code,
          loan.balance,
          data.maxLate(loan),
          formatDate(loan.end_at),
          LOAN_STATUS_LABEL[effectiveLoanStatus(loan, installments, today)] || '',
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
        <Stat
          label="Cartera activa"
          value={money(data.activeBalance)}
          icon={WalletCards}
          href="/prestamos?filtro=activos"
        />
        <Stat
          label="Cartera en mora"
          value={money(data.overdueBalance)}
          icon={AlertTriangle}
          tone="red"
          href="/cuotas?filtro=mora"
        />
        <Stat
          label="Cartera al día"
          value={money(data.currentBalance)}
          icon={CheckCircle2}
          tone="green"
          href="/prestamos?filtro=aldia"
        />
        <Stat
          label="Recuperado este mes"
          value={money(data.thisMonth)}
          icon={CircleDollarSign}
          href="/pagos?filtro=mes"
        />
      </div>

      <div className="card">
        <Section
          title="Obligaciones pendientes"
          desc="Saldo pendiente de préstamos activos, segmentado por estado."
        />
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
            {data.rows.length > 0 ? (
              data.rows.slice(0, 15).map((loan) => {
                const client = clientById.get(loan.client)
                const late = data.maxLate(loan)
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
                      <Badge status={LOAN_STATUS_LABEL[effectiveLoanStatus(loan, installments, today)] || 'Activo'} />
                    </td>
                    <td>
                      <button
                        className="icon-btn"
                        onClick={() => setPayLoan(loan.id)}
                        aria-label="Registrar pago"
                        title="Registrar pago"
                      >
                        <Banknote />
                      </button>
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

      {payLoan && <PaymentModal loanId={payLoan} close={() => setPayLoan('')} />}
    </>
  )
}
