'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDownLeft, ArrowUpRight, Banknote, CircleDollarSign, Download, Landmark, Pencil, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DataTable, Empty, Head, Section, Stat } from '@/components/ui/kit'
import { CashMovementModal } from '@/components/modals/cash-movement-modal'
import { useAuth, useData, useToday } from '@/components/providers'
import { buildCashEntries, cashSummary, CASH_CATEGORY_LABEL } from '@/lib/cash'
import { dayKey, METHOD_LABEL, todayKey } from '@/lib/derive'
import { downloadCSV, formatDate, money } from '@/lib/format'
import type { CashMovement } from '@/lib/types'

type Range = 'hoy' | 'semana' | 'mes' | 'todo'

const RANGES: { key: Range; label: string }[] = [
  { key: 'hoy', label: 'Hoy' },
  { key: 'semana', label: '7 días' },
  { key: 'mes', label: 'Este mes' },
  { key: 'todo', label: 'Todo' },
]

export default function CashView() {
  const { payments, loans, cashMovements, settings } = useData()
  const { user } = useAuth()
  const router = useRouter()
  const today = useToday()
  const isAdmin = user?.role === 'admin'
  const [range, setRange] = useState<Range>('mes')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<CashMovement | null>(null)

  const entries = useMemo(
    () => buildCashEntries(payments, loans, cashMovements),
    [payments, loans, cashMovements],
  )
  const summary = useMemo(() => cashSummary(entries, settings, todayKey(today)), [entries, settings, today])

  const startDay = dayKey(settings?.cash_start_date) || todayKey(today)
  const todayDay = todayKey(today)

  const rows = useMemo(() => {
    const weekAgo = new Date(today)
    weekAgo.setDate(weekAgo.getDate() - 6)
    const weekKey = todayKey(weekAgo)
    const monthKey = todayDay.slice(0, 7)
    return entries.filter((entry) => {
      if (range === 'hoy') return entry.day === todayDay
      if (range === 'semana') return entry.day >= weekKey
      if (range === 'mes') return entry.day.slice(0, 7) === monthKey
      return true
    })
  }, [entries, range, today, todayDay])

  const todayTotals = useMemo(() => {
    const todays = entries.filter((entry) => entry.day === todayDay)
    return todays.reduce(
      (acc, entry) => {
        const pool = entry.pool === 'efectivo' ? 'cash' : 'digital'
        if (entry.kind === 'ingreso') acc.income[pool] += entry.amount
        else acc.expense[pool] += entry.amount
        return acc
      },
      { income: { cash: 0, digital: 0 }, expense: { cash: 0, digital: 0 } },
    )
  }, [entries, todayDay])

  function exportCSV() {
    downloadCSV(
      `damian-caja-${todayDay}.csv`,
      [
        ['Fecha', 'Tipo', 'Concepto', 'Método', 'Monto', 'Descripción'],
        ...rows.map((entry) => [
          formatDate(entry.date),
          entry.kind === 'ingreso' ? 'Ingreso' : 'Egreso',
          `${CASH_CATEGORY_LABEL[entry.category] || entry.category}${entry.ref ? ` ${entry.ref.code}` : ''}`,
          METHOD_LABEL[entry.method] || '',
          (entry.kind === 'ingreso' ? 1 : -1) * entry.amount,
          entry.description,
        ]),
      ],
    )
  }

  return (
    <>
      <Head
        title="Caja"
        desc="Efectivo y cuenta disponibles según los movimientos registrados."
        action={
          <div className="page-head-actions">
            <Button variant="outline" onClick={exportCSV}>
              <Download data-icon="inline-start" />
              Exportar
            </Button>
            {isAdmin && (
              <Button
                onClick={() => {
                  setEditing(null)
                  setShowModal(true)
                }}
              >
                <Plus data-icon="inline-start" />
                Registrar movimiento
              </Button>
            )}
          </div>
        }
      />

      <div className="stats-grid">
        <Stat label="Efectivo en caja" value={money(summary.cash)} icon={Banknote} tone="green" />
        <Stat label="En cuenta (digital)" value={money(summary.digital)} icon={Landmark} tone="blue" />
        <Stat label="Total" value={money(summary.total)} icon={CircleDollarSign} tone="amber" />
      </div>

      <div className="card cash-today">
        <Section title="Movimiento de hoy" desc={formatDate(todayDay)} />
        <div className="cash-today-grid">
          <div>
            <span>Entradas efectivo</span>
            <b className="positive">{money(todayTotals.income.cash)}</b>
          </div>
          <div>
            <span>Entradas cuenta</span>
            <b className="positive">{money(todayTotals.income.digital)}</b>
          </div>
          <div>
            <span>Salidas efectivo</span>
            <b>{money(todayTotals.expense.cash)}</b>
          </div>
          <div>
            <span>Salidas cuenta</span>
            <b>{money(todayTotals.expense.digital)}</b>
          </div>
        </div>
        <p className="cash-note">
          Desde {formatDate(startDay)} · Saldo inicial: efectivo {money(settings?.cash_initial_cash)} · cuenta{' '}
          {money(settings?.cash_initial_digital)}. Ajusta el arranque en Configuración → Caja.
        </p>
      </div>

      <div className="card">
        <div className="toolbar">
          <div className="pills">
            {RANGES.map((item) => (
              <button className={range === item.key ? 'selected' : ''} key={item.key} onClick={() => setRange(item.key)}>
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <DataTable>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Concepto</th>
              <th>Método</th>
              <th>Monto</th>
              <th>Descripción</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((entry) => (
                <tr key={entry.id}>
                  <td>{formatDate(entry.date)}</td>
                  <td>
                    <span className={`cash-kind ${entry.kind}`}>
                      {entry.kind === 'ingreso' ? <ArrowDownLeft /> : <ArrowUpRight />}
                      {CASH_CATEGORY_LABEL[entry.category] || entry.category}
                    </span>
                    {entry.ref && (
                      <button className="link" onClick={() => entry.link && router.push(entry.link)}>
                        {entry.ref.code}
                      </button>
                    )}
                  </td>
                  <td>{METHOD_LABEL[entry.method] || '—'}</td>
                  <td>
                    <b className={entry.kind === 'ingreso' ? 'positive' : 'negative'}>
                      {entry.kind === 'ingreso' ? '+' : '−'}
                      {money(entry.amount)}
                    </b>
                  </td>
                  <td>{entry.description || '—'}</td>
                  <td>
                    {isAdmin && entry.movementId && (
                      <button
                        className="icon-btn"
                        title="Editar movimiento"
                        onClick={() => {
                          const movement = cashMovements.find((item) => item.id === entry.movementId)
                          if (movement) {
                            setEditing(movement)
                            setShowModal(true)
                          }
                        }}
                      >
                        <Pencil />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6}>
                  <Empty title="Sin movimientos" desc="No hay entradas ni salidas en este rango." />
                </td>
              </tr>
            )}
          </tbody>
        </DataTable>
      </div>

      {showModal && <CashMovementModal movement={editing} close={() => setShowModal(false)} />}
    </>
  )
}
