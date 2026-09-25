'use client'

import { useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Banknote, CheckCircle2, ChevronLeft, CircleDollarSign, Pencil, Trash2, WalletCards } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge, DataTable, Empty, Stat } from '@/components/ui/kit'
import { LoanModal } from '@/components/modals/loan-modal'
import { PaymentModal } from '@/components/modals/payment-modal'
import { PaymentDetailModal } from '@/components/modals/payment-detail'
import { useAuth, useData, useLookups, useToast, useToday } from '@/components/providers'
import {
  effectiveInstallmentStatus,
  effectiveLoanStatus,
  FREQUENCY_LABEL,
  INSTALLMENT_STATUS_LABEL,
  installmentOutstanding,
  LOAN_STATUS_LABEL,
  loanProgress,
  METHOD_LABEL,
  paymentCoverageByInstallment,
} from '@/lib/derive'
import { formatDate, money } from '@/lib/format'

export default function LoanDetailView() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { installments, payments, deleteLoan } = useData()
  const { user } = useAuth()
  const notify = useToast()
  const { loanById, clientById } = useLookups()
  const today = useToday()
  const [showPayment, setShowPayment] = useState(false)
  const [paymentNumber, setPaymentNumber] = useState<number | undefined>()
  const [showEdit, setShowEdit] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [paymentDetail, setPaymentDetail] = useState<{ paymentId: string; installmentNumber: number; coveredAmount: number } | null>(null)

  const isAdmin = user?.role === 'admin'
  const loan = params?.id ? loanById.get(params.id) : undefined
  const client = loan ? clientById.get(loan.client) : undefined

  const rows = useMemo(
    () => installments.filter((item) => item.loan === loan?.id).sort((a, b) => a.number - b.number),
    [installments, loan?.id],
  )

  const coverage = useMemo(
    () => paymentCoverageByInstallment(rows, payments.filter((item) => item.loan === loan?.id)),
    [rows, payments, loan?.id],
  )

  async function onDeleteLoan() {
    if (!loan || deleting) return
    if (!window.confirm('¿Eliminar este crédito? Se borrarán también sus cuotas y todos sus pagos. Esta acción no se puede deshacer.')) return
    setDeleting(true)
    try {
      await deleteLoan(loan.id)
      notify('Crédito eliminado')
      router.push('/prestamos')
    } catch {
      notify('No se pudo eliminar el crédito')
    } finally {
      setDeleting(false)
    }
  }

  if (!loan) {
    return (
      <div className="card">
        <Empty title="Préstamo no encontrado" desc="El préstamo que buscas no existe." />
        <div style={{ padding: '0 15px 20px' }}>
          <Button variant="outline" onClick={() => router.push('/prestamos')}>
            Volver a préstamos
          </Button>
        </div>
      </div>
    )
  }

  const progress = Math.round(loanProgress(loan) * 100)

  return (
    <>
      <div className="detail-head">
        <div>
          <button className="back" onClick={() => router.push('/prestamos')}>
            <ChevronLeft />
            Préstamos / Detalle
          </button>
          <div className="title-line">
            <h1>Préstamo {loan.code}</h1>
            <Badge status={LOAN_STATUS_LABEL[effectiveLoanStatus(loan, rows, today)] || 'Activo'} />
          </div>
          <p>
            Cliente:{' '}
            <b>
              <button className="link" onClick={() => router.push(`/clientes/${loan.client}`)}>
                {client?.name ?? '—'}
              </button>
            </b>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 9 }}>
          {isAdmin && (
            <Button variant="destructive" onClick={onDeleteLoan} disabled={deleting}>
              <Trash2 data-icon="inline-start" />
              Eliminar
            </Button>
          )}
          {isAdmin && (
            <Button variant="outline" onClick={() => setShowEdit(true)}>
              <Pencil data-icon="inline-start" />
              Editar
            </Button>
          )}
          <Button
            onClick={() => {
              setPaymentNumber(undefined)
              setShowPayment(true)
            }}
          >
            <Banknote data-icon="inline-start" />
            Registrar pago
          </Button>
        </div>
      </div>

      <div className="stats-grid">
        <Stat label="Monto prestado" value={money(loan.amount)} icon={Banknote} />
        <Stat label="Total a pagar" value={money(loan.total)} icon={WalletCards} />
        <Stat label="Total pagado" value={money(loan.paid_total)} icon={CheckCircle2} tone="green" />
        <Stat label="Saldo pendiente" value={money(loan.balance)} icon={CircleDollarSign} tone="amber" />
      </div>

      <div className="card loan-overview">
        <div className="section-head">
          <div>
            <h2>Progreso del préstamo</h2>
            <p>{progress}% completado</p>
          </div>
          <strong className="percent">{progress}%</strong>
        </div>
        <div className="progress">
          <i style={{ width: `${progress}%` }} />
        </div>
        <div className="loan-meta">
          <div>
            <span>Desembolso</span>
            <b>{formatDate(loan.disbursed_at)}</b>
          </div>
          <div>
            <span>Método de desembolso</span>
            <b>{METHOD_LABEL[loan.disbursement_method] || 'Efectivo'}</b>
          </div>
          <div>
            <span>Inicio de pagos</span>
            <b>{formatDate(loan.start_at)}</b>
          </div>
          <div>
            <span>Finalización estimada</span>
            <b>{formatDate(loan.end_at)}</b>
          </div>
          <div>
            <span>Frecuencia</span>
            <b>{FREQUENCY_LABEL[loan.frequency] || '—'}</b>
          </div>
          <div>
            <span>Número de cuotas</span>
            <b>{loan.installments_count || rows.length}</b>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="section-head">
          <div>
            <h2>Calendario de cuotas</h2>
            <p>Consulta el estado y registra pagos de este préstamo.</p>
          </div>
        </div>
        <DataTable>
          <thead>
            <tr>
              <th>Cuota</th>
              <th>Fecha</th>
              <th>Valor</th>
              <th>Pagado</th>
              <th>Saldo</th>
              <th>Estado</th>
              <th>Pago</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((item) => {
                const links = coverage.get(item.id) ?? []
                return (
                  <tr key={item.id}>
                    <td>#{item.number}</td>
                    <td>{formatDate(item.due_date)}</td>
                    <td>{money(item.amount)}</td>
                    <td>{money(item.paid)}</td>
                    <td>{money(Number(item.amount) - Number(item.paid))}</td>
                    <td>
                      <Badge status={INSTALLMENT_STATUS_LABEL[effectiveInstallmentStatus(item, today)] || 'Pendiente'} />
                    </td>
                    <td>
                      {links.length === 0
                        ? '—'
                        : links.map((link, index) => (
                            <button
                              className="link"
                              key={`${link.payment.id}-${index}`}
                              onClick={() =>
                                setPaymentDetail({
                                  paymentId: link.payment.id,
                                  installmentNumber: item.number,
                                  coveredAmount: link.amount,
                                })
                              }
                            >
                              {link.payment.code || 'Pago'}
                              {index < links.length - 1 ? ', ' : ''}
                            </button>
                          ))}
                    </td>
                    <td>
                      {installmentOutstanding(item) > 0 && (
                        <button
                          className="table-action"
                          onClick={() => {
                            setPaymentNumber(item.number)
                            setShowPayment(true)
                          }}
                        >
                          Registrar pago
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan={8}>
                  <Empty title="Sin cuotas" desc="Este préstamo no tiene cuotas registradas." />
                </td>
              </tr>
            )}
          </tbody>
        </DataTable>
      </div>

      {showPayment && (
        <PaymentModal loanId={loan.id} uptoInstallmentNumber={paymentNumber} close={() => setShowPayment(false)} />
      )}
      {showEdit && <LoanModal loan={loan} close={() => setShowEdit(false)} />}
      {paymentDetail && (
        <PaymentDetailModal
          paymentId={paymentDetail.paymentId}
          installmentNumber={paymentDetail.installmentNumber}
          coveredAmount={paymentDetail.coveredAmount}
          close={() => setPaymentDetail(null)}
        />
      )}
    </>
  )
}
