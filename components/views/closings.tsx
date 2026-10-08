'use client'

import { useMemo, useState } from 'react'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Download,
  Printer,
  Receipt,
  Users,
  WalletCards,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DataTable, Empty, Head, Section, Stat } from '@/components/ui/kit'
import { useData, useLookups, useToday } from '@/components/providers'
import { buildCashEntries, cashSummary, CASH_CATEGORY_LABEL, isRealPayment, loanDisbursed, rangeSummary, type CashEntry } from '@/lib/cash'
import { dayKey, LOAN_STATUS_LABEL, METHOD_LABEL, moraTotal, todayKey } from '@/lib/derive'
import { downloadCSV, formatDate, money, toInputDate } from '@/lib/format'
import { addDaysKey, formatWeekRange, shiftWeek, weekDayKeys, weekEndKey, WEEKDAY_LABEL, weekStartKey } from '@/lib/week'

const INCOME_CATEGORY = ['pago', 'aporte', 'ajuste', 'otro']
const EXPENSE_CATEGORY = ['desembolso', 'gasto', 'retiro', 'ajuste', 'otro']

function groupByCategory(list: CashEntry[], categories: string[]) {
  const map = new Map<string, { efectivo: number; digital: number }>()
  for (const entry of list) {
    const current = map.get(entry.category) ?? { efectivo: 0, digital: 0 }
    current[entry.pool] += entry.amount
    map.set(entry.category, current)
  }
  return categories
    .map((category) => {
      const value = map.get(category) ?? { efectivo: 0, digital: 0 }
      return { category, efectivo: value.efectivo, digital: value.digital, total: value.efectivo + value.digital }
    })
    .filter((row) => row.total > 0)
}

function weekTotal(list: CashEntry[], kind: 'ingreso' | 'egreso') {
  return list
    .filter((entry) => entry.kind === kind)
    .reduce(
      (acc, entry) => {
        acc[entry.pool] += entry.amount
        acc.total += entry.amount
        return acc
      },
      { efectivo: 0, digital: 0, total: 0 },
    )
}

export default function ClosingsView() {
  const { payments, loans, installments, cashMovements, settings } = useData()
  const { clientById, loanById, operatorById } = useLookups()
  const today = useToday()

  const [mode, setMode] = useState<'semana' | 'rango'>('semana')

  /* ------------------------------ Semana ------------------------------ */
  const [startKey, setStartKey] = useState(() => weekStartKey())

  const endKey = weekEndKey(startKey)
  const currentWeekStart = weekStartKey(today)

  const report = useMemo(() => {
    const entries = buildCashEntries(payments, loans, cashMovements)
    const opening = cashSummary(entries, settings, addDaysKey(startKey, -1))
    const closing = cashSummary(entries, settings, endKey)

    const inWeek = entries.filter((entry) => entry.day >= startKey && entry.day <= endKey)
    const income = weekTotal(inWeek, 'ingreso')
    const expense = weekTotal(inWeek, 'egreso')
    const net: { efectivo: number; digital: number; total: number } = {
      efectivo: income.efectivo - expense.efectivo,
      digital: income.digital - expense.digital,
      total: income.total - expense.total,
    }

    const prevStart = shiftWeek(startKey, -1)
    const prevEnd = weekEndKey(prevStart)
    const prevWeek = entries.filter((entry) => entry.day >= prevStart && entry.day <= prevEnd)
    const prevIncome = weekTotal(prevWeek, 'ingreso')
    const prevExpense = weekTotal(prevWeek, 'egreso')
    const prevNet = prevIncome.total - prevExpense.total

    const weekPayments = payments.filter(
      (payment) => isRealPayment(payment) && dayKey(payment.paid_at) >= startKey && dayKey(payment.paid_at) <= endKey,
    )
    const weekLoans = loans.filter((loan) => dayKey(loan.disbursed_at) >= startKey && dayKey(loan.disbursed_at) <= endKey)
    const clientsServed = new Set(weekPayments.map((payment) => payment.client)).size
    const activeBalance = loans.reduce((sum, loan) => sum + (Number(loan.balance) || 0), 0)
    const mora = moraTotal(installments, new Date(`${endKey}T12:00:00`))

    const daily = weekDayKeys(startKey).map((key) => ({
      key,
      recaudo: weekPayments.filter((payment) => dayKey(payment.paid_at) === key).reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0),
    }))
    const maxDaily = Math.max(1, ...daily.map((item) => item.recaudo))

    return {
      opening,
      closing,
      income,
      expense,
      net,
      prevIncome,
      prevExpense,
      prevNet,
      incomeRows: groupByCategory(inWeek.filter((entry) => entry.kind === 'ingreso'), INCOME_CATEGORY),
      expenseRows: groupByCategory(inWeek.filter((entry) => entry.kind === 'egreso'), EXPENSE_CATEGORY),
      weekPayments,
      weekLoans,
      clientsServed,
      activeBalance,
      mora,
      daily,
      maxDaily,
      movements: inWeek.filter((entry) => entry.movementId),
    }
  }, [payments, loans, installments, cashMovements, settings, startKey, endKey])

  /* ------------------------------- Rango ------------------------------- */
  const [fromKey, setFromKey] = useState(() => todayKey(new Date(today.getFullYear(), today.getMonth(), 1)))
  const [toKey, setToKey] = useState(() => toInputDate())
  const rangeValid = fromKey <= toKey

  const range = useMemo(() => {
    const lo = fromKey <= toKey ? fromKey : toKey
    const hi = fromKey <= toKey ? toKey : fromKey
    return rangeSummary(payments, loans, lo, hi)
  }, [payments, loans, fromKey, toKey])

  const earliestKey = useMemo(() => {
    const days = [
      ...payments.filter((payment) => isRealPayment(payment)).map((payment) => dayKey(payment.paid_at)),
      ...loans.map((loan) => dayKey(loan.disbursed_at)),
    ].filter(Boolean)
    return days.length > 0 ? days.reduce((min, day) => (day < min ? day : min)) : todayKey(new Date(2000, 0, 1))
  }, [payments, loans])

  const rangeMaxDaily = Math.max(1, ...range.daily.map((item) => item.cobrado))

  const delta = (current: number, previous: number) => {
    if (previous === 0) return current === 0 ? '' : 'nuevo'
    const pct = Math.round(((current - previous) / Math.abs(previous)) * 100)
    return `${pct >= 0 ? '+' : ''}${pct}%`
  }

  const netPool = {
    efectivo: range.cobradoPool.efectivo - range.prestadoPool.efectivo,
    digital: range.cobradoPool.digital - range.prestadoPool.digital,
  }

  function exportCSV() {
    downloadCSV(`damian-cierre-${startKey}.csv`, [
      ['Cierre semanal', formatWeekRange(startKey)],
      [],
      ['Concepto', 'Efectivo', 'Cuenta', 'Total'],
      ['Saldo inicial', report.opening.cash, report.opening.digital, report.opening.total],
      ['Entradas', report.income.efectivo, report.income.digital, report.income.total],
      ['Salidas', report.expense.efectivo, report.expense.digital, report.expense.total],
      ['Neto', report.net.efectivo, report.net.digital, report.net.total],
      ['Saldo final', report.closing.cash, report.closing.digital, report.closing.total],
      [],
      ['Entradas por concepto', 'Efectivo', 'Cuenta', 'Total'],
      ...report.incomeRows.map((row) => [CASH_CATEGORY_LABEL[row.category] || row.category, row.efectivo, row.digital, row.total]),
      [],
      ['Salidas por concepto', 'Efectivo', 'Cuenta', 'Total'],
      ...report.expenseRows.map((row) => [CASH_CATEGORY_LABEL[row.category] || row.category, row.efectivo, row.digital, row.total]),
      [],
      ['Recaudo por día', 'Valor'],
      ...report.daily.map((item, index) => [WEEKDAY_LABEL[index] + ' ' + formatDate(item.key), item.recaudo]),
      [],
      ['Pagos registrados', report.weekPayments.length],
      ['Créditos desembolsados', report.weekLoans.length],
      ['Monto desembolsado', report.weekLoans.reduce((sum, loan) => sum + loanDisbursed(loan), 0)],
      ['Clientes atendidos', report.clientsServed],
      ['Mora al cierre', report.mora],
    ])
  }

  function exportRangeCSV() {
    downloadCSV(`damian-rango-${fromKey}_${toKey}.csv`, [
      ['Rango de fechas', `${formatDate(fromKey)} — ${formatDate(toKey)}`],
      [],
      ['Concepto', 'Efectivo', 'Cuenta', 'Total'],
      ['Cobrado', range.cobradoPool.efectivo, range.cobradoPool.digital, range.cobrado],
      ['Prestado', range.prestadoPool.efectivo, range.prestadoPool.digital, range.prestado],
      ['Neto', netPool.efectivo, netPool.digital, range.neto],
      [],
      ['Detalle por día', 'Cobrado', 'Prestado'],
      ...range.daily.map((item) => [formatDate(item.day), item.cobrado, item.prestado]),
      [],
      ['Detalle de pagos'],
      ['Fecha', 'Cliente', 'Préstamo', 'Monto', 'Método', 'Registrado por'],
      ...range.payments.map((payment) => [
        formatDate(payment.paid_at),
        clientById.get(payment.client)?.name ?? '',
        loanById.get(payment.loan)?.code ?? '',
        payment.amount,
        METHOD_LABEL[payment.method] || '',
        payment.created_by ? operatorById.get(payment.created_by)?.name ?? 'Operador' : 'Sistema',
      ]),
      [],
      ['Detalle de créditos otorgados'],
      ['Fecha', 'Cliente', 'Código', 'Capital', 'Total', 'Cuotas', 'Método', 'Estado'],
      ...range.loans.map((loan) => [
        formatDate(loan.disbursed_at),
        clientById.get(loan.client)?.name ?? '',
        loan.code,
        loan.amount,
        loan.total,
        loan.installments_count,
        METHOD_LABEL[loan.disbursement_method] || '',
        LOAN_STATUS_LABEL[loan.status] || '',
      ]),
    ])
  }

  return (
    <>
      <Head
        title={mode === 'semana' ? 'Cierres semanales' : 'Rango de fechas'}
        desc={
          mode === 'semana'
            ? 'Cierre de caja de lunes a sábado. Los domingos no hay cobro.'
            : 'Calcula cuánto se cobró y cuánto se prestó entre dos fechas, con el detalle.'
        }
        action={
          <div className="page-head-actions">
            <Button variant="outline" onClick={mode === 'semana' ? exportCSV : exportRangeCSV}>
              <Download data-icon="inline-start" />
              Exportar
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer data-icon="inline-start" />
              Imprimir
            </Button>
          </div>
        }
      />

      <div className="pills" style={{ marginBottom: 16 }}>
        <button className={mode === 'semana' ? 'selected' : ''} onClick={() => setMode('semana')}>
          Semana
        </button>
        <button className={mode === 'rango' ? 'selected' : ''} onClick={() => setMode('rango')}>
          Rango de fechas
        </button>
      </div>

      {mode === 'semana' ? (
        <>
          <div className="card week-nav">
            <button className="icon-btn" title="Semana anterior" onClick={() => setStartKey(shiftWeek(startKey, -1))}>
              <ChevronLeft />
            </button>
            <div>
              <b>{formatWeekRange(startKey)}</b>
              <span>
                {startKey === currentWeekStart ? 'Semana actual (lunes a sábado)' : `Cierre de la semana del ${formatDate(startKey)}`}
              </span>
            </div>
            <button
              className="icon-btn"
              title="Semana siguiente"
              onClick={() => setStartKey(shiftWeek(startKey, 1))}
              disabled={startKey >= currentWeekStart}
            >
              <ChevronRight />
            </button>
            {startKey !== currentWeekStart && (
              <button className="link" onClick={() => setStartKey(currentWeekStart)}>
                Ir a la actual
              </button>
            )}
          </div>

          <div className="stats-grid">
            <Stat label="Saldo inicial" value={money(report.opening.total)} icon={Banknote} tone="blue" />
            <Stat label="Entradas" value={money(report.income.total)} icon={ArrowDownLeft} tone="green" />
            <Stat label="Salidas" value={money(report.expense.total)} icon={ArrowUpRight} tone="red" />
            <Stat label="Saldo final" value={money(report.closing.total)} icon={CircleDollarSign} tone="amber" />
          </div>

          <div className="dash-grid">
            <div className="card">
              <Section title="Resumen de caja" desc="Efectivo y cuenta, con neto de la semana" />
              <DataTable>
                <thead>
                  <tr>
                    <th>Concepto</th>
                    <th>Efectivo</th>
                    <th>Cuenta</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Saldo inicial</td>
                    <td>{money(report.opening.cash)}</td>
                    <td>{money(report.opening.digital)}</td>
                    <td>
                      <b>{money(report.opening.total)}</b>
                    </td>
                  </tr>
                  <tr>
                    <td>Entradas</td>
                    <td className="positive">{money(report.income.efectivo)}</td>
                    <td className="positive">{money(report.income.digital)}</td>
                    <td className="positive">
                      <b>{money(report.income.total)}</b>
                    </td>
                  </tr>
                  <tr>
                    <td>Salidas</td>
                    <td className="negative">{money(report.expense.efectivo)}</td>
                    <td className="negative">{money(report.expense.digital)}</td>
                    <td className="negative">
                      <b>{money(report.expense.total)}</b>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <b>Neto</b>
                    </td>
                    <td>
                      <b className={report.net.efectivo >= 0 ? 'positive' : 'negative'}>{money(report.net.efectivo)}</b>
                    </td>
                    <td>
                      <b className={report.net.digital >= 0 ? 'positive' : 'negative'}>{money(report.net.digital)}</b>
                    </td>
                    <td>
                      <b className={report.net.total >= 0 ? 'positive' : 'negative'}>{money(report.net.total)}</b>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <b>Saldo final</b>
                    </td>
                    <td>
                      <b>{money(report.closing.cash)}</b>
                    </td>
                    <td>
                      <b>{money(report.closing.digital)}</b>
                    </td>
                    <td>
                      <b>{money(report.closing.total)}</b>
                    </td>
                  </tr>
                </tbody>
              </DataTable>
            </div>

            <div className="card">
              <Section title="Semana anterior" desc="Comparación de movimientos" />
              <div className="report-list">
                <div>
                  <i className="lg blue" />
                  <span>Entradas</span>
                  <b>{money(report.prevIncome.total)}</b>
                  <small>{delta(report.income.total, report.prevIncome.total)}</small>
                </div>
                <div>
                  <i className="lg red" />
                  <span>Salidas</span>
                  <b>{money(report.prevExpense.total)}</b>
                  <small>{delta(report.expense.total, report.prevExpense.total)}</small>
                </div>
                <div>
                  <i className="lg amber" />
                  <span>Neto</span>
                  <b>{money(report.prevNet)}</b>
                  <small>{delta(report.net.total, report.prevNet)}</small>
                </div>
              </div>
            </div>
          </div>

          <div className="dash-grid">
            <div className="card">
              <Section title="Entradas por concepto" />
              {report.incomeRows.length > 0 ? (
                <DataTable>
                  <thead>
                    <tr>
                      <th>Concepto</th>
                      <th>Efectivo</th>
                      <th>Cuenta</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.incomeRows.map((row) => (
                      <tr key={row.category}>
                        <td>{CASH_CATEGORY_LABEL[row.category] || row.category}</td>
                        <td>{money(row.efectivo)}</td>
                        <td>{money(row.digital)}</td>
                        <td>
                          <b>{money(row.total)}</b>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
              ) : (
                <Empty title="Sin entradas" desc="No hubo ingresos en esta semana." />
              )}
            </div>

            <div className="card">
              <Section title="Salidas por concepto" />
              {report.expenseRows.length > 0 ? (
                <DataTable>
                  <thead>
                    <tr>
                      <th>Concepto</th>
                      <th>Efectivo</th>
                      <th>Cuenta</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.expenseRows.map((row) => (
                      <tr key={row.category}>
                        <td>{CASH_CATEGORY_LABEL[row.category] || row.category}</td>
                        <td>{money(row.efectivo)}</td>
                        <td>{money(row.digital)}</td>
                        <td>
                          <b>{money(row.total)}</b>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
              ) : (
                <Empty title="Sin salidas" desc="No hubo egresos en esta semana." />
              )}
            </div>
          </div>

          <div className="card">
            <Section title="Recaudo por día" desc="Lunes a sábado" />
            <div className="report-chart">
              {report.daily.map((item) => (
                <i key={item.key} style={{ height: `${Math.max(4, Math.round((item.recaudo / report.maxDaily) * 100))}%` }} title={money(item.recaudo)} />
              ))}
            </div>
            <div className="report-list" style={{ marginTop: 12 }}>
              {report.daily.map((item, index) => (
                <div key={item.key}>
                  <span>
                    {WEEKDAY_LABEL[index]} {formatDate(item.key)}
                  </span>
                  <b>{money(item.recaudo)}</b>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <Section title="Cartera de la semana" />
            <div className="stats-grid">
              <Stat
                label="Recaudado"
                value={money(report.weekPayments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0))}
                icon={CircleDollarSign}
                tone="green"
              />
              <Stat label="Pagos registrados" value={String(report.weekPayments.length)} icon={Receipt} />
              <Stat label="Clientes atendidos" value={String(report.clientsServed)} icon={Users} />
              <Stat label="Créditos desembolsados" value={String(report.weekLoans.length)} icon={WalletCards} />
            </div>
            <div className="report-list">
              <div>
                <i className="lg blue" />
                <span>Monto desembolsado</span>
                <b>{money(report.weekLoans.reduce((sum, loan) => sum + loanDisbursed(loan), 0))}</b>
              </div>
              <div>
                <i className="lg amber" />
                <span>Cartera activa al cierre</span>
                <b>{money(report.activeBalance)}</b>
              </div>
              <div>
                <i className="lg red" />
                <span>Mora al cierre de la semana</span>
                <b>{money(report.mora)}</b>
              </div>
            </div>
          </div>

          <div className="card">
            <Section title="Movimientos manuales de la semana" desc="Gastos, retiros y aportes registrados" />
            {report.movements.length > 0 ? (
              <DataTable>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Concepto</th>
                    <th>Método</th>
                    <th>Monto</th>
                    <th>Descripción</th>
                  </tr>
                </thead>
                <tbody>
                  {report.movements.map((entry) => (
                    <tr key={entry.id}>
                      <td>{formatDate(entry.date)}</td>
                      <td>{CASH_CATEGORY_LABEL[entry.category] || entry.category}</td>
                      <td>{METHOD_LABEL[entry.method] || '—'}</td>
                      <td className={entry.kind === 'ingreso' ? 'positive' : 'negative'}>
                        {entry.kind === 'ingreso' ? '+' : '−'}
                        {money(entry.amount)}
                      </td>
                      <td>{entry.description || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            ) : (
              <Empty title="Sin movimientos" desc="No se registraron movimientos manuales en esta semana." />
            )}
          </div>
        </>
      ) : (
        <>
          <div className="card cash-asof">
            <span className="cash-note" style={{ padding: 0 }}>
              Desde
            </span>
            <input type="date" value={fromKey} max={toInputDate()} onChange={(event) => setFromKey(event.target.value)} />
            <span className="cash-note" style={{ padding: 0 }}>
              Hasta
            </span>
            <input type="date" value={toKey} min={fromKey} max={toInputDate()} onChange={(event) => setToKey(event.target.value)} />
            <div className="pills" style={{ marginLeft: 'auto' }}>
              <button
                onClick={() => {
                  setFromKey(toInputDate())
                  setToKey(toInputDate())
                }}
              >
                Hoy
              </button>
              <button
                onClick={() => {
                  setFromKey(addDaysKey(toInputDate(), -6))
                  setToKey(toInputDate())
                }}
              >
                7 días
              </button>
              <button
                onClick={() => {
                  setFromKey(todayKey(new Date(today.getFullYear(), today.getMonth(), 1)))
                  setToKey(toInputDate())
                }}
              >
                Este mes
              </button>
              <button
                onClick={() => {
                  setFromKey(todayKey(new Date(today.getFullYear(), today.getMonth() - 1, 1)))
                  setToKey(todayKey(new Date(today.getFullYear(), today.getMonth(), 0)))
                }}
              >
                Mes pasado
              </button>
              <button
                onClick={() => {
                  setFromKey(earliestKey)
                  setToKey(toInputDate())
                }}
              >
                Todo
              </button>
            </div>
          </div>

          {!rangeValid && <div className="form-error">La fecha inicial es mayor que la final.</div>}

          <div className="stats-grid">
            <Stat label="Cobrado" value={money(range.cobrado)} icon={ArrowDownLeft} tone="green" />
            <Stat label="Prestado" value={money(range.prestado)} icon={ArrowUpRight} tone="red" />
            <Stat label="Neto" value={money(range.neto)} icon={CircleDollarSign} tone={range.neto >= 0 ? 'amber' : 'red'} />
            <Stat label="Clientes atendidos" value={String(range.clientsServed)} icon={Users} />
          </div>

          <div className="dash-grid">
            <div className="card">
              <Section title="Cobrado y prestado por método" desc={`Del ${formatDate(fromKey)} al ${formatDate(toKey)}`} />
              <DataTable>
                <thead>
                  <tr>
                    <th>Concepto</th>
                    <th>Efectivo</th>
                    <th>Cuenta</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Cobrado</td>
                    <td className="positive">{money(range.cobradoPool.efectivo)}</td>
                    <td className="positive">{money(range.cobradoPool.digital)}</td>
                    <td className="positive">
                      <b>{money(range.cobrado)}</b>
                    </td>
                  </tr>
                  <tr>
                    <td>Prestado</td>
                    <td className="negative">{money(range.prestadoPool.efectivo)}</td>
                    <td className="negative">{money(range.prestadoPool.digital)}</td>
                    <td className="negative">
                      <b>{money(range.prestado)}</b>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <b>Neto</b>
                    </td>
                    <td>
                      <b className={netPool.efectivo >= 0 ? 'positive' : 'negative'}>{money(netPool.efectivo)}</b>
                    </td>
                    <td>
                      <b className={netPool.digital >= 0 ? 'positive' : 'negative'}>{money(netPool.digital)}</b>
                    </td>
                    <td>
                      <b className={range.neto >= 0 ? 'positive' : 'negative'}>{money(range.neto)}</b>
                    </td>
                  </tr>
                </tbody>
              </DataTable>
            </div>

            <div className="card">
              <Section title="Resumen del rango" />
              <div className="stats-grid">
                <Stat label="Pagos registrados" value={String(range.paymentCount)} icon={Receipt} />
                <Stat label="Créditos otorgados" value={String(range.loanCount)} icon={WalletCards} />
              </div>
              <div className="report-list">
                <div>
                  <i className="lg blue" />
                  <span>Cobrado</span>
                  <b>{money(range.cobrado)}</b>
                </div>
                <div>
                  <i className="lg red" />
                  <span>Prestado</span>
                  <b>{money(range.prestado)}</b>
                </div>
                <div>
                  <i className="lg amber" />
                  <span>Neto (cobrado − prestado)</span>
                  <b>{money(range.neto)}</b>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <Section title="Recaudo por día" desc="Días con movimiento en el rango" />
            {range.daily.length > 0 ? (
              <>
                <div className="report-chart">
                  {range.daily.map((item) => (
                    <i key={item.day} style={{ height: `${Math.max(4, Math.round((item.cobrado / rangeMaxDaily) * 100))}%` }} title={money(item.cobrado)} />
                  ))}
                </div>
                <DataTable>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Cobrado</th>
                      <th>Prestado</th>
                      <th>Neto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {range.daily.map((item) => (
                      <tr key={item.day}>
                        <td>{formatDate(item.day)}</td>
                        <td className="positive">{money(item.cobrado)}</td>
                        <td className="negative">{money(item.prestado)}</td>
                        <td>{money(item.cobrado - item.prestado)}</td>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
              </>
            ) : (
              <Empty title="Sin movimientos" desc="No hubo cobros ni préstamos en este rango." />
            )}
          </div>

          <div className="card">
            <Section
              title="Detalle de pagos"
              desc={`${range.paymentCount} pago(s) · ${money(range.cobrado)}`}
            />
            {range.payments.length > 0 ? (
              <DataTable>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Cliente</th>
                    <th>Préstamo</th>
                    <th>Monto</th>
                    <th>Método</th>
                    <th>Registrado por</th>
                  </tr>
                </thead>
                <tbody>
                  {range.payments.map((payment) => (
                    <tr key={payment.id}>
                      <td>{formatDate(payment.paid_at)}</td>
                      <td>
                        <b>{clientById.get(payment.client)?.name ?? '—'}</b>
                      </td>
                      <td>{loanById.get(payment.loan)?.code ?? '—'}</td>
                      <td>
                        <b className="positive">{money(payment.amount)}</b>
                      </td>
                      <td>{METHOD_LABEL[payment.method] || '—'}</td>
                      <td>{payment.created_by ? operatorById.get(payment.created_by)?.name ?? 'Operador' : 'Sistema'}</td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            ) : (
              <Empty title="Sin pagos" desc="No hubo pagos en este rango." />
            )}
          </div>

          <div className="card">
            <Section
              title="Detalle de créditos otorgados"
              desc={`${range.loanCount} crédito(s) · ${money(range.prestado)} desembolsado`}
            />
            {range.loans.length > 0 ? (
              <DataTable>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Cliente</th>
                    <th>Código</th>
                    <th>Capital</th>
                    <th>Total</th>
                    <th>Cuotas</th>
                    <th>Método</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {range.loans.map((loan) => (
                    <tr key={loan.id}>
                      <td>{formatDate(loan.disbursed_at)}</td>
                      <td>
                        <b>{clientById.get(loan.client)?.name ?? '—'}</b>
                      </td>
                      <td>{loan.code}</td>
                      <td>
                        <b className="negative">{money(loan.amount)}</b>
                      </td>
                      <td>{money(loan.total)}</td>
                      <td>{loan.installments_count}</td>
                      <td>{METHOD_LABEL[loan.disbursement_method] || '—'}</td>
                      <td>{LOAN_STATUS_LABEL[loan.status] || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            ) : (
              <Empty title="Sin créditos" desc="No se otorgaron créditos en este rango." />
            )}
          </div>
        </>
      )}
    </>
  )
}
