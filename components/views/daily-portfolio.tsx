'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDownLeft, ArrowUpRight, Banknote, ChevronLeft, ChevronRight, CircleDollarSign, Download, Landmark, Printer, TrendingUp, WalletCards } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge, DataTable, Empty, Head, Section, Stat } from '@/components/ui/kit'
import { useData, useLookups, useToday } from '@/components/providers'
import { buildCashEntries, cashSummary, CASH_CATEGORY_LABEL } from '@/lib/cash'
import { INSTALLMENT_STATUS_LABEL, METHOD_LABEL } from '@/lib/derive'
import { portfolioAtDay } from '@/lib/portfolio'
import { downloadCSV, formatDate, money } from '@/lib/format'
import { addDaysKey } from '@/lib/week'

export default function DailyPortfolioView() {
  const { loans, installments, payments, cashMovements, settings } = useData()
  const { clientById } = useLookups()
  const router = useRouter()
  const today = useToday()
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const [day, setDay] = useState(todayKey)

  const report = useMemo(() => {
    const portfolio = portfolioAtDay(loans, payments, installments, day)
    const entries = buildCashEntries(payments, loans, cashMovements)
    const dayBefore = addDaysKey(day, -1)
    const cashOpen = cashSummary(entries, settings, dayBefore)
    const cashClose = cashSummary(entries, settings, day)
    const dayEntries = entries.filter((entry) => entry.day === day)
    return { portfolio, cashOpen, cashClose, dayEntries }
  }, [loans, payments, installments, cashMovements, settings, day])

  const { portfolio, cashOpen, cashClose, dayEntries } = report
  const isFuture = day > todayKey

  function exportCSV() {
    downloadCSV(`damian-cartera-diaria-${day}.csv`, [
      ['Cartera diaria', formatDate(day)],
      [],
      ['Concepto', 'Valor'],
      ['Cartera inicial', portfolio.opening],
      ['Prestado del dia (total a cobrar)', portfolio.disbursed],
      ['Utilidad de lo prestado', portfolio.utility],
      ['Recaudo real', portfolio.recovered],
      ['Refinanciaciones', portfolio.refinanced],
      ['Ajustes', portfolio.adjusted],
      ['Saldos iniciales (apertura)', portfolio.initialDeposits],
      ['Cartera de cierre', portfolio.closing],
      [],
      ['Caja', 'Efectivo', 'Cuenta', 'Total'],
      ['Saldo inicial', cashOpen.cash, cashOpen.digital, cashOpen.total],
      ['Saldo final', cashClose.cash, cashClose.digital, cashClose.total],
      [],
      ['Creditos otorgados', 'Cliente', 'Capital', 'Total', 'Utilidad', 'Metodo'],
      ...portfolio.loansDisbursed.map((loan) => [
        loan.code,
        clientById.get(loan.client)?.name ?? '',
        loan.amount,
        loan.opening_balance || loan.total,
        (Number(loan.opening_balance) || Number(loan.total) || 0) - (Number(loan.amount) || 0),
        METHOD_LABEL[loan.disbursement_method] || '',
      ]),
      [],
      ['Cartera al cierre', 'Cliente', 'Credito', 'Saldo'],
      ...portfolio.portfolioLoans.map((item) => [
        formatDate(day),
        clientById.get(item.loan.client)?.name ?? '',
        item.loan.code,
        item.balance,
      ]),
    ])
  }

  return (
    <>
      <Head
        title="Cartera diaria"
        desc="Estado de la cartera, movimientos y caja de un día específico."
        action={
          <div className="page-head-actions">
            <Button variant="outline" onClick={exportCSV}>
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

      <div className="card week-nav">
        <button className="icon-btn" title="Día anterior" onClick={() => setDay(addDaysKey(day, -1))}>
          <ChevronLeft />
        </button>
        <div>
          <b>{formatDate(day)}</b>
          <span>{day === todayKey ? 'Hoy' : 'Estado al cierre de este día'}</span>
        </div>
        <button className="icon-btn" title="Día siguiente" onClick={() => setDay(addDaysKey(day, 1))} disabled={day >= todayKey}>
          <ChevronRight />
        </button>
        <input type="date" value={day} max={todayKey} onChange={(event) => event.target.value && setDay(event.target.value)} />
        {day !== todayKey && (
          <button className="link" onClick={() => setDay(todayKey)}>
            Ir a hoy
          </button>
        )}
      </div>

      {isFuture && <div className="form-error">No se puede ver un día futuro.</div>}

      <div className="stats-grid">
        <Stat label="Cartera inicial" value={money(portfolio.opening)} icon={Banknote} tone="blue" />
        <Stat label="Prestado del día" value={money(portfolio.disbursed)} icon={ArrowUpRight} tone="red" />
        <Stat label="Recaudo del día" value={money(portfolio.recovered)} icon={ArrowDownLeft} tone="green" />
        <Stat label="Cartera de cierre" value={money(portfolio.closing)} icon={CircleDollarSign} tone="amber" />
      </div>

      <div className="dash-grid">
        <div className="card">
          <Section title="Movimiento de cartera del día" desc="Cómo abrió, qué se movió y cómo cerró" />
          <DataTable>
            <thead>
              <tr>
                <th>Concepto</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Cartera inicial (apertura)</td>
                <td><b>{money(portfolio.opening)}</b></td>
              </tr>
              <tr>
                <td>Prestado del día (total a cobrar)</td>
                <td className="negative">+{money(portfolio.disbursed)}</td>
              </tr>
              <tr>
                <td>Recaudo real del día</td>
                <td className="positive">−{money(portfolio.recovered)}</td>
              </tr>
              <tr>
                <td>Refinanciaciones (movimiento interno)</td>
                <td>−{money(portfolio.refinanced)}</td>
              </tr>
              <tr>
                <td>Ajustes</td>
                <td>−{money(portfolio.adjusted)}</td>
              </tr>
              {portfolio.initialDeposits > 0 && (
                <tr>
                  <td>Saldos iniciales de apertura</td>
                  <td>−{money(portfolio.initialDeposits)}</td>
                </tr>
              )}
              <tr>
                <td><b>Cartera de cierre</b></td>
                <td><b>{money(portfolio.closing)}</b></td>
              </tr>
            </tbody>
          </DataTable>
        </div>

        <div className="card">
          <Section title="Utilidad de lo prestado" desc="Interés de los créditos otorgados este día" />
          <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 0 }}>
            <Stat label="Capital prestado" value={money(portfolio.disbursedCapital)} icon={WalletCards} />
            <Stat label="Utilidad (interés)" value={money(portfolio.utility)} icon={TrendingUp} tone="green" />
          </div>
          <p className="center-note" style={{ textAlign: 'left', padding: '0 22px 16px' }}>
            Total a cobrar {money(portfolio.disbursed)} − capital {money(portfolio.disbursedCapital)} ={' '}
            <b>{money(portfolio.utility)}</b> de utilidad sobre lo desembolsado este día.
          </p>
        </div>
      </div>

      <div className="card">
        <Section title="Caja del día" desc="Cómo terminó la caja (efectivo y cuenta)" />
        <div className="stats-grid">
          <Stat label="Efectivo al cierre" value={money(cashClose.cash)} icon={Banknote} tone="green" />
          <Stat label="Cuenta al cierre" value={money(cashClose.digital)} icon={Landmark} tone="blue" />
          <Stat label="Total al cierre" value={money(cashClose.total)} icon={CircleDollarSign} tone="amber" />
          <Stat
            label="Movimiento del día"
            value={money(cashClose.total - cashOpen.total)}
            icon={TrendingUp}
            tone={cashClose.total - cashOpen.total >= 0 ? 'green' : 'red'}
          />
        </div>
        <DataTable>
          <thead>
            <tr>
              <th>Caja</th>
              <th>Efectivo</th>
              <th>Cuenta</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Saldo inicial</td>
              <td>{money(cashOpen.cash)}</td>
              <td>{money(cashOpen.digital)}</td>
              <td><b>{money(cashOpen.total)}</b></td>
            </tr>
            <tr>
              <td>Saldo final</td>
              <td><b>{money(cashClose.cash)}</b></td>
              <td><b>{money(cashClose.digital)}</b></td>
              <td><b>{money(cashClose.total)}</b></td>
            </tr>
          </tbody>
        </DataTable>
      </div>

      <div className="card">
        <Section title="Créditos otorgados este día" desc={`${portfolio.loansDisbursed.length} crédito(s)`} />
        {portfolio.loansDisbursed.length > 0 ? (
          <DataTable>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Crédito</th>
                <th>Capital</th>
                <th>Total a cobrar</th>
                <th>Utilidad</th>
                <th>Cuotas</th>
                <th>Método</th>
              </tr>
            </thead>
            <tbody>
              {portfolio.loansDisbursed.map((loan) => {
                const total = Number(loan.opening_balance) || Number(loan.total) || 0
                const capital = Number(loan.amount) || 0
                return (
                  <tr key={loan.id} className="row-click">
                    <td><b>{clientById.get(loan.client)?.name ?? '—'}</b></td>
                    <td>
                      <button className="link" onClick={() => router.push(`/prestamos/${loan.id}`)}>
                        {loan.code}
                      </button>
                    </td>
                    <td>{money(capital)}</td>
                    <td><b>{money(total)}</b></td>
                    <td className="positive">{money(total - capital)}</td>
                    <td>{loan.installments_count}</td>
                    <td>{METHOD_LABEL[loan.disbursement_method] || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </DataTable>
        ) : (
          <Empty title="Sin créditos otorgados" desc="No se desembolsaron créditos este día." />
        )}
      </div>

      <div className="card">
        <Section title="Pagos recibidos este día" desc={`${portfolio.paymentsInDay.length} pago(s) · recaudo real ${money(portfolio.recovered)}`} />
        {portfolio.paymentsInDay.length > 0 ? (
          <DataTable>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Crédito</th>
                <th>Monto</th>
                <th>Método</th>
                <th>Tipo</th>
              </tr>
            </thead>
            <tbody>
              {portfolio.paymentsInDay.map((payment) => (
                <tr key={payment.id} className="row-click" onClick={() => router.push(`/prestamos/${payment.loan}`)}>
                  <td><b>{clientById.get(payment.client)?.name ?? '—'}</b></td>
                  <td>{loans.find((item) => item.id === payment.loan)?.code ?? '—'}</td>
                  <td><b className={payment.kind === 'real' || !payment.kind ? 'positive' : ''}>{money(payment.amount)}</b></td>
                  <td>{METHOD_LABEL[payment.method] || '—'}</td>
                  <td>{payment.kind === 'saldo_inicial' ? 'Apertura' : payment.kind === 'refinanciacion' ? 'Refinanciación' : payment.kind === 'ajuste' ? 'Ajuste' : 'Real'}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        ) : (
          <Empty title="Sin pagos" desc="No se recibieron pagos este día." />
        )}
      </div>

      <div className="card">
        <Section title="Cartera al cierre del día" desc={`${portfolio.portfolioLoans.length} crédito(s) con saldo`} />
        {portfolio.portfolioLoans.length > 0 ? (
          <DataTable>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Crédito</th>
                <th>Saldo a la fecha</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {portfolio.portfolioLoans.map((item) => (
                <tr key={item.loan.id}>
                  <td><b>{clientById.get(item.loan.client)?.name ?? '—'}</b></td>
                  <td>
                    <button className="link" onClick={() => router.push(`/prestamos/${item.loan.id}`)}>
                      {item.loan.code}
                    </button>
                  </td>
                  <td><b>{money(item.balance)}</b></td>
                  <td>
                    <Badge status={item.mora ? INSTALLMENT_STATUS_LABEL.vencida : 'Al día'} />
                    {item.mora && item.late > 0 ? <small>{item.late} d</small> : null}
                  </td>
                  <td>
                    <button className="link" onClick={() => router.push(`/prestamos/${item.loan.id}`)}>
                      Ver
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        ) : (
          <Empty title="Sin cartera" desc="No había créditos con saldo ese día." />
        )}
      </div>

      <div className="card">
        <Section title="Movimientos de caja del día" desc="Gastos, retiros, aportes y ajustes" />
        {dayEntries.length > 0 ? (
          <DataTable>
            <thead>
              <tr>
                <th>Concepto</th>
                <th>Método</th>
                <th>Monto</th>
                <th>Descripción</th>
              </tr>
            </thead>
            <tbody>
              {dayEntries.map((entry) => (
                <tr key={entry.id}>
                  <td>{CASH_CATEGORY_LABEL[entry.category] || entry.category}</td>
                  <td>{METHOD_LABEL[entry.method] || '—'}</td>
                  <td className={entry.kind === 'ingreso' ? 'positive' : 'negative'}>
                    {entry.kind === 'ingreso' ? '+' : '−'}
                    {money(entry.amount)}
                  </td>
                  <td>{entry.description || (entry.ref ? entry.ref.code : '—')}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        ) : (
          <Empty title="Sin movimientos" desc="No hubo movimientos de caja este día." />
        )}
      </div>
    </>
  )
}
