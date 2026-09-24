'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Download, Filter, MoreHorizontal, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, Badge, DataTable, Empty, Head } from '@/components/ui/kit'
import { ClientModal } from '@/components/modals/client-modal'
import { useData, useToday } from '@/components/providers'
import { clientStats } from '@/lib/derive'
import { downloadCSV, formatDate, money, normalize } from '@/lib/format'

type FilterKey = 'all' | 'active' | 'overdue' | 'none'

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'active', label: 'Activos' },
  { key: 'overdue', label: 'Con mora' },
  { key: 'none', label: 'Sin préstamos' },
]

export default function ClientsView() {
  const { clients, loans, installments } = useData()
  const router = useRouter()
  const today = useToday()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<FilterKey>('all')
  const [showModal, setShowModal] = useState(false)

  const rows = useMemo(
    () =>
      clients.map((client) => {
        const clientLoans = loans.filter((loan) => loan.client === client.id)
        const clientInstallments = installments.filter((item) => item.client === client.id)
        return { client, stats: clientStats(clientLoans, clientInstallments, today) }
      }),
    [clients, loans, installments, today],
  )

  const filtered = useMemo(() => {
    const term = normalize(query.trim())
    return rows.filter(({ client, stats }) => {
      if (term && !normalize(`${client.name} ${client.doc} ${client.phone} ${client.code}`).includes(term)) return false
      if (filter === 'active') return stats.activeLoans > 0
      if (filter === 'overdue') return stats.status === 'En mora'
      if (filter === 'none') return stats.totalLoans === 0
      return true
    })
  }, [rows, query, filter])

  function exportCSV() {
    downloadCSV(
      `damian-clientes-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        ['Código', 'Nombre', 'Documento', 'Teléfono', 'Ciudad', 'Préstamos activos', 'Saldo pendiente', 'Próxima cuota', 'Estado'],
        ...filtered.map(({ client, stats }) => [
          client.code,
          client.name,
          client.doc,
          client.phone,
          client.city,
          stats.activeLoans,
          stats.balance,
          stats.next ? formatDate(stats.next) : '—',
          stats.status,
        ]),
      ],
    )
  }

  return (
    <>
      <Head
        title="Clientes"
        desc="Administra los clientes y consulta su historial de préstamos."
        action={
          <Button onClick={() => setShowModal(true)}>
            <Plus data-icon="inline-start" />
            Nuevo cliente
          </Button>
        }
      />

      <div className="card">
        <div className="toolbar">
          <div className="search-field">
            <Search />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre, teléfono o documento..." />
          </div>
          <div className="pills">
            {FILTERS.map((option) => (
              <button className={filter === option.key ? 'selected' : ''} key={option.key} onClick={() => setFilter(option.key)}>
                {option.label}
                {option.key === 'all' && <b>{rows.length}</b>}
              </button>
            ))}
          </div>
          <Button variant="outline" onClick={exportCSV}>
            <Download data-icon="inline-start" />
            Exportar
          </Button>
        </div>

        <DataTable>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Teléfono</th>
              <th>Préstamos activos</th>
              <th>Saldo pendiente</th>
              <th>Próxima cuota</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? (
              filtered.map(({ client, stats }) => (
                <tr key={client.id}>
                  <td>
                    <div className="person">
                      <Avatar name={client.name} size="small" />
                      <div>
                        <b>{client.name}</b>
                        <small>{client.doc || client.code}</small>
                      </div>
                    </div>
                  </td>
                  <td>{client.phone || '—'}</td>
                  <td>{stats.activeLoans}</td>
                  <td>
                    <b>{money(stats.balance)}</b>
                  </td>
                  <td>{stats.next ? formatDate(stats.next) : '—'}</td>
                  <td>
                    <Badge status={stats.status} />
                  </td>
                  <td>
                    <button className="icon-btn" onClick={() => router.push(`/clientes/${client.id}`)} title="Ver cliente">
                      <MoreHorizontal />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7}>
                  <Empty title="Sin clientes" desc="No hay clientes que coincidan con el filtro." />
                </td>
              </tr>
            )}
          </tbody>
        </DataTable>
      </div>

      {showModal && <ClientModal close={() => setShowModal(false)} />}
    </>
  )
}
