'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, RotateCcw, Wrench } from 'lucide-react'
import { Field, Modal, MoneyInput } from '@/components/ui/kit'
import { Button } from '@/components/ui/button'
import { useData, useToast } from '@/components/providers'
import { isRealPayment } from '@/lib/cash'
import { formatDate, money, parseAmount } from '@/lib/format'
import type { Loan } from '@/lib/types'

export function CorrectionModal({ loan, close, onDone }: { loan: Loan; close: () => void; onDone?: () => void }) {
  const { loans, payments, markRollover, markCorrection, unmarkLoan } = useData()
  const notify = useToast()

  const clientLoans = useMemo(
    () => loans.filter((item) => item.client === loan.client && item.id !== loan.id).sort((a, b) => String(b.created).localeCompare(String(a.created))),
    [loans, loan.client, loan.id],
  )
  const loanPayments = useMemo(
    () => payments.filter((item) => item.loan === loan.id && isRealPayment(item)).sort((a, b) => String(b.created).localeCompare(String(a.created))),
    [payments, loan.id],
  )

  const [oldId, setOldId] = useState('')
  const [paymentId, setPaymentId] = useState('')
  const [refinanced, setRefinanced] = useState('')
  const [correctionPayment, setCorrectionPayment] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const oldLoan = oldId ? loans.find((item) => item.id === oldId) : undefined
  const oldPayments = useMemo(
    () => (oldId ? payments.filter((item) => item.loan === oldId && isRealPayment(item)).sort((a, b) => String(b.created).localeCompare(String(a.created))) : []),
    [payments, oldId],
  )

  // Saldo refinanciado = opening del viejo − pagos reales que NO son el pago de cierre.
  useEffect(() => {
    if (!oldLoan) return
    const opening = Number(oldLoan.opening_balance) || Number(oldLoan.total) || 0
    const others = oldPayments.filter((item) => item.id !== paymentId).reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
    setRefinanced(String(Math.max(0, opening - others)))
  }, [oldLoan, oldPayments, paymentId])

  const capital = Number(loan.amount) || 0
  const refinancedValue = parseAmount(refinanced)
  const cashOut = Math.max(0, capital - refinancedValue)

  async function applyRollover() {
    if (!oldId) return setError('Selecciona el crédito anterior.')
    setSaving(true)
    setError('')
    try {
      await markRollover({ newLoan: loan.id, oldLoan: oldId, payment: paymentId, refinanced_amount: refinancedValue })
      notify('Marcado como volteo')
      onDone?.()
      close()
    } catch {
      setError('No se pudo aplicar la corrección.')
    } finally {
      setSaving(false)
    }
  }

  async function applyCorrection() {
    if (!correctionPayment) return setError('Selecciona el pago a marcar como ficticio.')
    setSaving(true)
    setError('')
    try {
      await markCorrection(loan.id, correctionPayment)
      notify('Pago marcado como ajuste')
      onDone?.()
      close()
    } catch {
      setError('No se pudo marcar el pago.')
    } finally {
      setSaving(false)
    }
  }

  async function revert() {
    setSaving(true)
    setError('')
    try {
      await unmarkLoan(loan.id, paymentId || undefined)
      notify('Marca revertida')
      onDone?.()
      close()
    } catch {
      setError('No se pudo revertir.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={`Corregir ${loan.code}`} close={close} wide>
      <div className="modal-body">
        {loan.origin === 'volteo' && (
          <div className="alert-warn">
            Este crédito está marcado como <b>volteo</b>: refinancia a otro crédito por {money(loan.refinanced_amount)} y su
            desembolso real es {money(loan.disbursement_amount)}.
          </div>
        )}

        <h3>Marcar como volteo (refinanciación)</h3>
        <p>Vincula este crédito con el crédito anterior y reclasifica el pago de cierre (deja de contar como recaudo).</p>
        <div className="form-grid">
          <Field label="Crédito anterior (mismo cliente)">
            <select value={oldId} onChange={(event) => { setOldId(event.target.value); setPaymentId('') }}>
              <option value="">— Selecciona —</option>
              {clientLoans.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.code} · {money(item.amount)} · {formatDate(item.disbursed_at)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Pago de cierre del crédito anterior">
            <select value={paymentId} onChange={(event) => setPaymentId(event.target.value)} disabled={!oldId}>
              <option value="">— Selecciona —</option>
              {oldPayments.map((item) => (
                <option value={item.id} key={item.id}>
                  {formatDate(item.paid_at)} · {money(item.amount)} · {item.method}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Saldo refinanciado">
            <MoneyInput value={refinanced} onChange={setRefinanced} />
          </Field>
          <Field label="Efectivo real a entregar (calculado)">
            <input value={money(cashOut)} readOnly />
          </Field>
        </div>
        <div className="modal-foot" style={{ border: 0, padding: '0 0 18px' }}>
          <Button onClick={applyRollover} disabled={saving}>
            <Check data-icon="inline-start" />
            Marcar como volteo
          </Button>
        </div>

        <h3>Marcar un pago como ficticio (ajuste)</h3>
        <p>Para pagos que se registraron solo para cerrar/recrear un crédito y que nunca ocurrieron.</p>
        <div className="form-grid">
          <Field label="Pago de este crédito">
            <select value={correctionPayment} onChange={(event) => setCorrectionPayment(event.target.value)}>
              <option value="">— Selecciona —</option>
              {loanPayments.map((item) => (
                <option value={item.id} key={item.id}>
                  {formatDate(item.paid_at)} · {money(item.amount)} · {item.method}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="modal-foot" style={{ border: 0, padding: '0 0 8px' }}>
          <Button variant="outline" onClick={applyCorrection} disabled={saving}>
            <Wrench data-icon="inline-start" />
            Marcar pago como ajuste
          </Button>
        </div>

        {loan.origin === 'volteo' && (
          <div className="modal-foot" style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <Button variant="destructive" onClick={revert} disabled={saving}>
              <RotateCcw data-icon="inline-start" />
              Revertir marca de volteo
            </Button>
          </div>
        )}

        {error && <div className="form-error">{error}</div>}
      </div>
      <div className="modal-foot">
        <Button variant="outline" onClick={close} disabled={saving}>
          Cerrar
        </Button>
      </div>
    </Modal>
  )
}
