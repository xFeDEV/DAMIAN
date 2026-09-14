'use client'

import { useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import { Avatar, Badge, Field, Modal } from '@/components/ui/kit'
import { Button } from '@/components/ui/button'
import { useData, useToast, useLookups } from '@/components/providers'
import { INSTALLMENT_STATUS_LABEL, LOAN_STATUS_LABEL, METHOD_LABEL, PAYMENT_METHODS } from '@/lib/derive'
import { formatDate, money, parseAmount, toInputDate } from '@/lib/format'
import type { PaymentMethod } from '@/lib/types'

export function PaymentModal({ loanId, close, onDone }: { loanId: string; close: () => void; onDone?: () => void }) {
  const { installments, registerPayment } = useData()
  const { loanById, clientById } = useLookups()
  const notify = useToast()

  const loan = loanById.get(loanId)
  const client = loan ? clientById.get(loan.client) : undefined

  const pendingInstallments = useMemo(
    () =>
      installments
        .filter((item) => item.loan === loanId && item.status !== 'pagada')
        .sort((a, b) => a.number - b.number),
    [installments, loanId],
  )

  const target = pendingInstallments[0]
  const pending = Number(loan?.balance ?? 0) || 0
  const [amount, setAmount] = useState(String(target?.amount ?? pending ?? 0))
  const [paidAt, setPaidAt] = useState(toInputDate())
  const [method, setMethod] = useState<PaymentMethod>('efectivo')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  if (!loan || !client) {
    return (
      <Modal title="Registrar pago" close={close}>
        <div className="modal-body">
          <p className="center-note">No se encontró el préstamo.</p>
        </div>
        <div className="modal-foot">
          <Button variant="outline" onClick={close}>
            Cerrar
          </Button>
        </div>
      </Modal>
    )
  }

  async function onSave() {
    const value = parseAmount(amount)
    if (value <= 0) {
      setError('El valor recibido debe ser mayor a 0.')
      return
    }
    if (value > pending && pending > 0) {
      setError(`El valor no puede superar el saldo pendiente (${money(pending)}).`)
      return
    }
    setSaving(true)
    setError('')
    try {
      await registerPayment({
        loan: loan!.id,
        client: loan!.client,
        installment: target?.id,
        amount: value,
        paid_at: `${paidAt} 00:00:00.000Z`.replace('T', ' '),
        method,
        reference,
        notes,
      })
      notify('Pago registrado correctamente')
      if (onDone) onDone()
      close()
    } catch {
      setError('No se pudo registrar el pago. Inténtalo de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Registrar pago" close={close}>
      <div className="payment-context">
        <Avatar name={client.name} />
        <div>
          <b>{client.name}</b>
          <span>
            {loan.code} {target ? `· Cuota #${target.number}` : ''}
          </span>
        </div>
        <Badge status={target ? INSTALLMENT_STATUS_LABEL[target.status] : LOAN_STATUS_LABEL[loan.status]} />
      </div>

      <div className="due-box">
        <div>
          <span>Saldo pendiente</span>
          <b>{money(pending)}</b>
        </div>
        <div>
          <span>Vencimiento</span>
          <b>{target ? formatDate(target.due_date) : formatDate(loan.end_at)}</b>
        </div>
      </div>

      <div className="modal-body">
        <Field label="Valor recibido *">
          <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="numeric" />
        </Field>
        <Field label="Fecha de pago">
          <input type="date" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} />
        </Field>
        <Field label="Método de pago">
          <select value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)}>
            {PAYMENT_METHODS.map((option) => (
              <option value={option} key={option}>
                {METHOD_LABEL[option]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Referencia">
          <input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Ej. Comprobante 1234" />
        </Field>
        <Field label="Observación">
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ej. Pago recibido en visita." />
        </Field>
        {error && <div className="form-error">{error}</div>}
      </div>

      <div className="modal-foot">
        <Button variant="outline" onClick={close} disabled={saving}>
          Cancelar
        </Button>
        <Button onClick={onSave} disabled={saving}>
          <Check data-icon="inline-start" />
          {saving ? 'Registrando…' : 'Registrar pago'}
        </Button>
      </div>
    </Modal>
  )
}
