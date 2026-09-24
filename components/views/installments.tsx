'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge, DataTable, Empty, Head } from '@/components/ui/kit'
import { PaymentModal } from '@/components/modals/payment-modal'
import { useData, useLookups, useToday } from '@/components/providers'
import {
  dayKey,
  effectiveInstallmentStatus,
  INSTALLMENT_STATUS_LABEL,
  installmentOutstanding,
  isOverdue,
  isSameDay,
  todayKey,
} from '@/lib/derive'
import { downloadCSV, formatDate, money, normalize } from '@/lib/format'
import type { Installment } from '@/lib/types'

type Tab = 'hoy' | 'manana' | 'mora' | 'proximas'
const TABS: Tab[] = ['hoy', 'manana', 'mora', 'proximas']

export default function InstallmentsView() {
  const { installments } = useData()
  const { clientById, loanById } = useLookups()
  const router = useRouter()
  const today = useToday()
  const [tab, setTab] = useState<Tab>('hoy')
  const [query, setQuery] = useState('')
  const [selectedLoan, setSelectedLoan] = useState('')

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get('filtro') as Tab | null
    if (value && TABS.includes(value)) setTab(value)
  }, [])

  const tomorrow = useMemo(() => {
    const date = new Date(today)
    date.setDate(date.getDate() + 1)
    return date
  }, [today])

  const buckets = useMemo(() => {
    const pending = installments.filter((item) => installmentOutstanding(item) > 0)
    return {
      hoy: pending.filter((item) => isSameDay(item.due_date, today)),
      manana: pending.filter((item) => isSameDay(item.due_date, tomorrow)),
      mora: installments.filter((item) => isOverdue(item, today)),
      proximas: pending.filter((item) => dayKey(item.due_date) > todayKey(today)),
    }
  }, [installments, today, tomorrow])

  const rows = useMemo(() => {
    const base = buckets[tab]
    const term = normalize(query.trim())
    const filtered = term
      ? base.filter((item) => {
          const client = clientById.get(item.client)
          const loan = loanById.get(item.loan)
          return normalize(`${client?.name ?? ''} ${loan?.code ?? ''}`).includes(term)
        })
      : base
    return filtered.sort((a, b) => dayKey(a.due_date).localeCompare(dayKey(b.due_date)))
  }, [buckets, tab, query, clientById, loanById])

  const rowsTotal = useMemo(
    () => rows.reduce((sum, item) => sum + installmentOutstanding(item), 0),
    [rows],
  )

  function exportCSV() {
    downloadCSV(
      `damian-cuotas-${tab}-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        ['Cliente', 'Préstamo', 'Cuota', 'Fecha', 'Valor', 'Pagado', 'Estado'],
        ...rows.map((item) => {
          const client = clientById.get(item.client)
          const loan = loanById.get(item.loan)
          return [
            client?.name ?? '',
            loan?.code ?? '',
            item.number,
            formatDate(item.due_date),
            item.amount,
            item.paid,
            INSTALLMENT_STATUS_LABEL[effectiveInstallmentStatus(item, today)] || '',
          ]
        }),
      ],
    )
  }

  const tabs: { key: Tab; label: string; count: number; danger?: boolean }[] = [
    { key: 'hoy', label: 'Hoy', count: buckets.hoy.length },
    { key: 'manana', label: 'Mañana', count: buckets.manana.length },
    { key: 'mora', label: 'En mora', count: buckets.mora.length, danger: true },
    { key: 'proximas', label: 'Próximas', count: buckets.proximas.length },
  ]

  return (
    <>
      <Head
        title="Cuotas"
        desc="Agenda de cobranza y seguimiento de obligaciones."
        action={
          <Button variant="outline" onClick={exportCSV}>
            <CalendarDays data-icon="inline-start" />
            Exportar
          </Button>
        }
      />

      <div className="card">
        <div className="tabs">
          {tabs.map((item) => (
            <button className={tab === item.key ? 'active' : ''} key={item.key} onClick={() => setTab(item.key)}>
              {item.label} <b className={item.danger ? 'red-count' : undefined}>{item.count}</b>
            </button>
          ))}
        </div>

        <div className="toolbar">
          <div className="search-field">
            <Search />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar cliente o préstamo..." />
          </div>
        </div>

        {rows.length > 0 && (
          <span className="pill-filter">
            {rows.length} cuota{rows.length === 1 ? '' : 's'} · {money(rowsTotal)}
          </span>
        )}

        <DataTable>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Préstamo</th>
              <th>Cuota</th>
              <th>Fecha</th>
              <th>Valor</th>
              <th>Estado</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((item: Installment) => {
                const client = clientById.get(item.client)
                const loan = loanById.get(item.loan)
                return (
                  <tr key={item.id}>
                    <td>
                      <b>{client?.name ?? '—'}</b>
                    </td>
                    <td>
                      <button className="link" onClick={() => router.push(`/prestamos/${item.loan}`)}>
                        {loan?.code ?? '—'}
                      </button>
                    </td>
                    <td>#{item.number}</td>
                    <td>{formatDate(item.due_date)}</td>
                    <td>
                      <b>{money(installmentOutstanding(item))}</b>
                    </td>
                    <td>
                      <Badge status={INSTALLMENT_STATUS_LABEL[effectiveInstallmentStatus(item, today)] || 'Pendiente'} />
                    </td>
                    <td>
                      {installmentOutstanding(item) > 0 && (
                        <button className="table-action" onClick={() => setSelectedLoan(item.loan)}>
                          Registrar pago
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan={7}>
                  <Empty title="Sin cuotas" desc="No hay cuotas para este filtro." />
                </td>
              </tr>
            )}
          </tbody>
        </DataTable>
      </div>

      {selectedLoan && <PaymentModal loanId={selectedLoan} close={() => setSelectedLoan('')} />}
    </>
  )
}
