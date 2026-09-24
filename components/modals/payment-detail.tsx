'use client'

import { Trash2 } from 'lucide-react'
import { Modal } from '@/components/ui/kit'
import { Button } from '@/components/ui/button'
import { useAuth, useData, useLookups, useToast } from '@/components/providers'
import { METHOD_LABEL } from '@/lib/derive'
import { formatDate, formatDateTime, money } from '@/lib/format'

export function PaymentDetailModal({
  paymentId,
  installmentNumber,
  coveredAmount,
  close,
}: {
  paymentId: string
  installmentNumber?: number
  coveredAmount?: number
  close: () => void
}) {
  const { payments, deletePayment } = useData()
  const { clientById, loanById } = useLookups()
  const { user } = useAuth()
  const notify = useToast()

  const payment = payments.find((item) => item.id === paymentId)
  const isAdmin = user?.role === 'admin'

  if (!payment) {
    return (
      <Modal title="Detalle del pago" close={close}>
        <div className="modal-body">
          <p className="center-note">No se encontró el pago.</p>
        </div>
        <div className="modal-foot">
          <Button variant="outline" onClick={close}>
            Cerrar
          </Button>
        </div>
      </Modal>
    )
  }

  const client = clientById.get(payment.client)
  const loan = loanById.get(payment.loan)

  async function onDelete() {
    if (!payment) return
    if (!window.confirm('¿Eliminar este pago? El saldo del préstamo se recalculará.')) return
    try {
      await deletePayment(payment.id)
      notify('Pago eliminado')
      close()
    } catch {
      notify('No se pudo eliminar el pago')
    }
  }

  const rows: [string, React.ReactNode][] = [
    ['Código', payment.code || '—'],
    ['Cliente', client?.name ?? '—'],
    ['Préstamo', loan?.code ?? '—'],
    ['Monto', money(payment.amount)],
    ['Fecha de pago', formatDate(payment.paid_at)],
    ['Método', METHOD_LABEL[payment.method] || '—'],
    ['Registrado', formatDateTime(payment.created)],
    ['Registrado por', payment.created_by ? 'Operador' : 'Sistema'],
    ['Referencia', payment.reference || '—'],
    ['Observación', payment.notes || '—'],
  ]

  return (
    <Modal title="Detalle del pago" close={close}>
      <div className="payment-context">
        <div>
          <b>{payment.code || 'Pago'}</b>
          <span>
            {client?.name ?? '—'} · {loan?.code ?? '—'}
          </span>
        </div>
      </div>

      <div className="modal-body">
        {installmentNumber ? (
          <div className="due-box" style={{ margin: '0 0 16px' }}>
            <div>
              <span>Cuota</span>
              <b>#{installmentNumber}</b>
            </div>
            <div>
              <span>Aplicado a esta cuota</span>
              <b>{money(coveredAmount ?? payment.amount)}</b>
            </div>
          </div>
        ) : null}

        <div className="summary-grid">
          {rows.map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <b>{value}</b>
            </div>
          ))}
        </div>
      </div>

      <div className="modal-foot">
        {isAdmin && (
          <Button variant="destructive" onClick={onDelete}>
            <Trash2 data-icon="inline-start" />
            Eliminar pago
          </Button>
        )}
        <Button variant="outline" onClick={close}>
          Cerrar
        </Button>
      </div>
    </Modal>
  )
}
