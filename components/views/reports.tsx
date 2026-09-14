'use client'

import { useMemo } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Head, Section } from '@/components/ui/kit'
import { useData, useToast } from '@/components/providers'
import { isSameDay } from '@/lib/derive'
import { compactMoney, downloadCSV, formatDate, money } from '@/lib/format'

export default function ReportsView() {
  const { loans, payments } = useData()
  const notify = useToast()

  const report = useMemo(() => {
    const days = Array.from({ length: 15 }, (_, index) => {
      const date = new Date()
      date.setDate(date.getDate() - (14 - index))
      return date
    })
    const daily = days.map((date) =>
      payments.filter((payment) => isSameDay(payment.paid_at, date)).reduce((sum, payment) => sum + payment.amount, 0),
    )
    const max = Math.max(1, ...daily)

    const active = loans.filter((loan) => loan.status !== 'finalizado')
    const overdue = loans.filter((loan) => loan.status === 'en_mora')
    const byStatus = [
      {
        label: 'Al día',
        value: active.filter((loan) => loan.status !== 'en_mora').reduce((sum, loan) => sum + (Number(loan.balance) || 0), 0),
        tone: 'blue',
      },
      { label: 'Vencida', value: overdue.reduce((sum, loan) => sum + (Number(loan.balance) || 0), 0), tone: 'red' },
      {
        label: 'Finalizada',
        value: loans.filter((loan) => loan.status === 'finalizado').reduce((sum, loan) => sum + (Number(loan.paid_total) || 0), 0),
        tone: 'gray',
      },
    ]
    const total = byStatus.reduce((sum, item) => sum + item.value, 0) || 1

    return {
      days,
      daily,
      heights: daily.map((value) => Math.max(4, Math.round((value / max) * 100))),
      max,
      byStatus: byStatus.map((item) => ({ ...item, pct: Math.round((item.value / total) * 100) })),
      activeCount: active.length,
      overdueClients: new Set(overdue.map((loan) => loan.client)).size,
      overdueBalance: overdue.reduce((sum, loan) => sum + (Number(loan.balance) || 0), 0),
    }
  }, [loans, payments])

  function exportReport() {
    downloadCSV(
      `damian-reporte-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        ['Fecha', 'Recaudo'],
        ...report.days.map((date, index) => [formatDate(date.toISOString()), report.daily[index]]),
        [],
        ['Estado', 'Saldo', 'Participación'],
        ...report.byStatus.map((item) => [item.label, item.value, `${item.pct}%`]),
      ],
    )
    notify('Reporte exportado correctamente')
  }

  return (
    <>
      <Head
        title="Reportes"
        desc="Indicadores para entender el desempeño de tu cartera."
        action={
          <Button onClick={exportReport}>
            <Download data-icon="inline-start" />
            Exportar reporte
          </Button>
        }
      />

      <div className="report-grid">
        <div className="card report-large">
          <Section title="Recaudo por día" desc="Últimos 15 días" />
          <div className="report-chart">
            {report.heights.map((height, index) => (
              <i key={index} style={{ height: `${height}%` }} title={money(report.daily[index])} />
            ))}
          </div>
          <p className="center-note">Máximo diario: {compactMoney(report.max)}</p>
        </div>

        <div className="card">
          <Section title="Cartera por estado" />
          <div className="report-list">
            {report.byStatus.map((item) => (
              <div key={item.label}>
                <i className={`lg ${item.tone}`} />
                <span>{item.label}</span>
                <b>{money(item.value)}</b>
                <small>{item.pct}%</small>
              </div>
            ))}
          </div>
        </div>

        <div className="card report-number-card">
          <Section title="Préstamos activos" />
          <strong>
            {report.activeCount} <small>préstamos</small>
          </strong>
          <p>{money(report.byStatus[0].value)} en cartera vigente</p>
        </div>

        <div className="card report-number-card">
          <Section title="Clientes con mora" />
          <strong className="danger">
            {report.overdueClients} <small>clientes</small>
          </strong>
          <p>{money(report.overdueBalance)} en saldo vencido</p>
        </div>
      </div>
    </>
  )
}
