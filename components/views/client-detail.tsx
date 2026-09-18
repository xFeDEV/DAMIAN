'use client'

import { useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AlertTriangle, ChevronLeft, CircleDollarSign, CheckCircle2, Eye, Pencil, Plus, Trash2, WalletCards } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, Badge, DataTable, Empty, Stat } from '@/components/ui/kit'
import { ClientModal } from '@/components/modals/client-modal'
import { LoanModal } from '@/components/modals/loan-modal'
import { useAuth, useData, useLookups, useToast } from '@/components/providers'
import {
  ACTIVITY_LABEL,
  activityTone,
  clientStats,
  INSTALLMENT_STATUS_LABEL,
  LOAN_STATUS_LABEL,
  METHOD_LABEL,
  loanProgress,
} from '@/lib/derive'
import { formatDate, formatTimestampDate, money, relativeTime } from '@/lib/format'

type Tab = 'resumen' | 'prestamos' | 'pagos' | 'actividad'

export default function ClientDetailView() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { loans, installments, payments, activity, deleteClient } = useData()
  const { clientById } = useLookups()
  const { user } = useAuth()
  const notify = useToast()
  const [tab, setTab] = useState<Tab>('resumen')
  const [modal, setModal] = useState<'edit' | 'loan' | null>(null)
  const [deleting, setDeleting] = useState(false)

  const client = params?.id ? clientById.get(params.id) : undefined
  const isAdmin = user?.role === 'admin'

  const data = useMemo(() => {
    if (!client) return null
    const clientLoans = loans.filter((loan) => loan.client === client.id)
    const clientInstallments = installments.filter((item) => item.client === client.id)
    const clientPayments = payments.filter((payment) => payment.client === client.id)
    const clientActivity = activity.filter((item) => item.client === client.id)
    return { clientLoans, clientInstallments, clientPayments, clientActivity, stats: clientStats(clientLoans, clientInstallments) }
  }, [client, loans, installments, payments, activity])

  if (!client || !data) {
    return (
      <div className="card">
        <Empty title="Cliente no encontrado" desc="El cliente que buscas no existe o fue eliminado." />
        <div style={{ padding: '0 15px 20px' }}>
          <Button variant="outline" onClick={() => router.push('/clientes')}>
            Volver a clientes
          </Button>
        </div>
      </div>
    )
  }

  const { clientLoans, clientPayments, clientActivity, stats } = data

  async function onDeleteClient() {
    if (!client || deleting) return
    if (!window.confirm('¿Eliminar este cliente? Esta acción no se puede deshacer. Solo se permite si el cliente nunca ha tenido créditos.')) return
    setDeleting(true)
    try {
      await deleteClient(client.id)
      notify('Cliente eliminado')
      router.push('/clientes')
    } catch (error) {
      const message = (error as { response?: { message?: string } })?.response?.message
      notify(message || 'No se pudo eliminar el cliente')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="detail-head">
        <div>
          <button className="back" onClick={() => router.push('/clientes')}>
            <ChevronLeft />
            Clientes
          </button>
          <div className="detail-title">
            <Avatar name={client.name} size="large" />
            <div>
              <div className="title-line">
                <h1>{client.name}</h1>
                <Badge status={stats.status} />
              </div>
              <p>
                {client.doc || client.code} · {client.phone || 'Sin teléfono'}
              </p>
            </div>
          </div>
        </div>
        <div className="detail-actions">
          {isAdmin && (
            <Button variant="destructive" onClick={onDeleteClient} disabled={deleting}>
              <Trash2 data-icon="inline-start" />
              Eliminar
            </Button>
          )}
          <Button variant="outline" onClick={() => setModal('edit')}>
            <Pencil data-icon="inline-start" />
            Editar
          </Button>
          <Button onClick={() => setModal('loan')}>
            <Plus data-icon="inline-start" />
            Nuevo préstamo
          </Button>
        </div>
      </div>

      <div className="info-strip">
        <div>
          <span>Documento</span>
          <b>{client.doc || '—'}</b>
        </div>
        <div>
          <span>Teléfono</span>
          <b>{client.phone || '—'}</b>
        </div>
        <div>
          <span>Dirección</span>
          <b>{client.address || client.city || '—'}</b>
        </div>
        <div>
          <span>Cliente desde</span>
          <b>{formatTimestampDate(client.created)}</b>
        </div>
      </div>

      <div className="stats-grid compact">
        <Stat label="Préstamos activos" value={String(stats.activeLoans)} icon={WalletCards} />
        <Stat label="Saldo pendiente" value={money(stats.balance)} icon={CircleDollarSign} tone="amber" />
        <Stat label="Total pagado" value={money(stats.paid)} icon={CheckCircle2} tone="green" />
        <Stat label="Cuotas vencidas" value={String(stats.overdue)} icon={AlertTriangle} tone="red" />
      </div>

      <div className="card">
        <div className="tabs">
          <button className={tab === 'resumen' ? 'active' : ''} onClick={() => setTab('resumen')}>
            Resumen
          </button>
          <button className={tab === 'prestamos' ? 'active' : ''} onClick={() => setTab('prestamos')}>
            Préstamos <b>{clientLoans.length}</b>
          </button>
          <button className={tab === 'pagos' ? 'active' : ''} onClick={() => setTab('pagos')}>
            Pagos <b>{clientPayments.length}</b>
          </button>
          <button className={tab === 'actividad' ? 'active' : ''} onClick={() => setTab('actividad')}>
            Actividad
          </button>
        </div>

        {tab === 'pagos' ? (
          <DataTable>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Préstamo</th>
                <th>Valor</th>
                <th>Método</th>
              </tr>
            </thead>
            <tbody>
              {clientPayments.length > 0 ? (
                clientPayments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{formatDate(payment.paid_at)}</td>
                    <td>{payment.loan.slice(0, 8)}</td>
                    <td>
                      <b className="positive">{money(payment.amount)}</b>
                    </td>
                    <td>{METHOD_LABEL[payment.method] || '—'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4}>
                    <Empty title="Sin pagos" desc="Este cliente aún no tiene pagos registrados." />
                  </td>
                </tr>
              )}
            </tbody>
          </DataTable>
        ) : tab === 'actividad' ? (
          <div className="activity-list padded">
            {clientActivity.length > 0 ? (
              clientActivity.slice(0, 12).map((item) => (
                <div className="activity-item" key={item.id}>
                  <div className={`activity-icon ${activityTone(item.action)}`}>
                    <WalletCards />
                  </div>
                  <div>
                    <b>{ACTIVITY_LABEL[item.action] || item.action}</b>
                    <span>{relativeTime(item.created)}</span>
                  </div>
                </div>
              ))
            ) : (
              <Empty title="Sin actividad" desc="Los movimientos aparecerán aquí." />
            )}
          </div>
        ) : (
          <DataTable>
            <thead>
              <tr>
                <th>Préstamo</th>
                <th>Desembolso</th>
                <th>Monto</th>
                <th>Saldo</th>
                <th>Progreso</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {clientLoans.length > 0 ? (
                clientLoans.map((loan) => (
                  <tr key={loan.id}>
                    <td>
                      <button className="link" onClick={() => router.push(`/prestamos/${loan.id}`)}>
                        {loan.code}
                      </button>
                    </td>
                    <td>{formatDate(loan.disbursed_at)}</td>
                    <td>{money(loan.amount)}</td>
                    <td>{money(loan.balance)}</td>
                    <td>
                      <div className="mini-progress">
                        <i style={{ width: `${Math.round(loanProgress(loan) * 100)}%` }} />
                      </div>
                      <small>{Math.round(loanProgress(loan) * 100)}%</small>
                    </td>
                    <td>
                      <Badge status={LOAN_STATUS_LABEL[loan.status] || 'Activo'} />
                    </td>
                    <td>
                      <button className="icon-btn" onClick={() => router.push(`/prestamos/${loan.id}`)}>
                        <Eye />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7}>
                    <Empty title="Sin préstamos" desc="Crea el primer préstamo de este cliente." />
                  </td>
                </tr>
              )}
            </tbody>
          </DataTable>
        )}
      </div>

      {modal === 'edit' && <ClientModal client={client} close={() => setModal(null)} />}
      {modal === 'loan' && <LoanModal clientId={client.id} close={() => setModal(null)} />}
    </>
  )
}
