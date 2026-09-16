'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Banknote, CheckCircle2, CircleDollarSign, Download, Eye, Pencil, Plus, Search, WalletCards } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge, DataTable, Empty, Head, Stat } from '@/components/ui/kit'
import { LoanModal } from '@/components/modals/loan-modal'
import { useAuth, useData, useLookups } from '@/components/providers'
import { LOAN_STATUS_LABEL, FREQUENCY_LABEL, loanProgress } from '@/lib/derive'
import { downloadCSV, formatDate, money, normalize } from '@/lib/format'
import type { Loan } from '@/lib/types'

export default function LoansView() {
  const { loans } = useData()
  const { user } = useAuth()
  const { clientById } = useLookups()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editLoan, setEditLoan] = useState<Loan | null>(null)

  const isAdmin = user?.role === 'admin'

  const stats = useMemo(() => {
    const active = loans.filter((loan) => loan.status !== 'finalizado')
    return {
      total: loans.reduce((sum, loan) => sum + (Number(loan.amount) || 0), 0),
      activeCount: active.length,
      pending: active.reduce((sum, loan) => sum + (Number(loan.balance) || 0), 0),
      finished: loans.length - active.length,
    }
  }, [loans])

  const filtered = useMemo(() => {
    const term = normalize(query.trim())
    if (!term) return loans
    return loans.filter((loan) => {
      const client = clientById.get(loan.client)
      return normalize(`${loan.code} ${client?.name ?? ''}`).includes(term)
    })
  }, [loans, query, clientById])

  function exportCSV() {
    downloadCSV(
      `damian-prestamos-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        ['Código', 'Cliente', 'Monto', 'Total a pagar', 'Cuota', 'Frecuencia', 'Saldo', 'Estado'],
        ...filtered.map((loan) => [
          loan.code,
          clientById.get(loan.client)?.name ?? '',
          loan.amount,
          loan.total,
          loan.installment_amount,
          FREQUENCY_LABEL[loan.frequency] || '',
          loan.balance,
          LOAN_STATUS_LABEL[loan.status] || '',
        ]),
      ],
    )
  }

  return (
    <>
      <Head
        title="Préstamos"
        desc="Consulta y administra todos los préstamos."
        action={
          <Button onClick={() => setShowModal(true)}>
            <Plus data-icon="inline-start" />
            Nuevo préstamo
          </Button>
        }
      />

      <div className="stats-grid">
        <Stat label="Total prestado" value={money(stats.total)} icon={Banknote} />
        <Stat label="Préstamos activos" value={String(stats.activeCount)} icon={WalletCards} />
        <Stat label="Por cobrar" value={money(stats.pending)} icon={CircleDollarSign} tone="amber" />
        <Stat label="Finalizados" value={String(stats.finished)} icon={CheckCircle2} tone="green" />
      </div>

      <div className="card">
        <div className="toolbar">
          <div className="search-field">
            <Search />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar préstamo o cliente..." />
          </div>
          <Button variant="outline" onClick={exportCSV}>
            <Download data-icon="inline-start" />
            Exportar
          </Button>
        </div>

        <DataTable>
          <thead>
            <tr>
              <th>ID</th>
              <th>Cliente</th>
              <th>Monto</th>
              <th>Total a pagar</th>
              <th>Cuota</th>
              <th>Progreso</th>
              <th>Saldo pendiente</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? (
              filtered.map((loan) => {
                const client = clientById.get(loan.client)
                const progress = Math.round(loanProgress(loan) * 100)
                return (
                  <tr key={loan.id}>
                    <td>
                      <button className="link" onClick={() => router.push(`/prestamos/${loan.id}`)}>
                        {loan.code}
                      </button>
                    </td>
                    <td>
                      <b>{client?.name ?? '—'}</b>
                    </td>
                    <td>{money(loan.amount)}</td>
                    <td>{money(loan.total)}</td>
                    <td>
                      {money(loan.installment_amount)} <small>{FREQUENCY_LABEL[loan.frequency]?.toLowerCase() ?? ''}</small>
                    </td>
                    <td>
                      <div className="mini-progress">
                        <i style={{ width: `${progress}%` }} />
                      </div>
                      <small>{progress}%</small>
                    </td>
                    <td>
                      <b>{money(loan.balance)}</b>
                    </td>
                    <td>
                      <Badge status={LOAN_STATUS_LABEL[loan.status] || 'Activo'} />
                    </td>
                    <td>
                      <button className="icon-btn" onClick={() => router.push(`/prestamos/${loan.id}`)}>
                        <Eye />
                      </button>
                      {isAdmin && (
                        <button className="icon-btn" onClick={() => setEditLoan(loan)} aria-label="Editar préstamo">
                          <Pencil />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan={9}>
                  <Empty title="Sin préstamos" desc="No hay préstamos que coincidan con la búsqueda." />
                </td>
              </tr>
            )}
          </tbody>
        </DataTable>
      </div>

      {showModal && <LoanModal close={() => setShowModal(false)} />}
      {editLoan && <LoanModal loan={editLoan} close={() => setEditLoan(null)} />}
    </>
  )
}
