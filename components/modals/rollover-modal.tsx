'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, Repeat } from 'lucide-react'
import { Field, Modal, MoneyInput } from '@/components/ui/kit'
import { Button } from '@/components/ui/button'
import { useData, useLookups, useToast } from '@/components/providers'
import {
  buildSchedule,
  FREQUENCIES,
  FREQUENCY_LABEL,
  installmentAmounts,
  METHOD_LABEL,
  PAYMENT_METHODS,
} from '@/lib/derive'
import { isoFromInputDate, money, parseAmount, toInputDate } from '@/lib/format'
import type { Loan, LoanFrequency, PaymentMethod } from '@/lib/types'

function parseRate(value: string) {
  const rate = Number(String(value).replace(',', '.'))
  return Number.isFinite(rate) ? rate : 0
}

export function RolloverModal({ loan, close, onDone }: { loan: Loan; close: () => void; onDone?: () => void }) {
  const { rolloverLoan, nextCode } = useData()
  const { clientById } = useLookups()
  const notify = useToast()
  const client = clientById.get(loan.client)
  const remaining = Math.max(0, Number(loan.balance) || 0)

  const [amount, setAmount] = useState(String(Number(loan.amount) || ''))
  const [interest, setInterest] = useState('20')
  const [total, setTotal] = useState(String(Number(loan.total) || ''))
  const [count, setCount] = useState(String(Number(loan.installments_count) || ''))
  const [installment, setInstallment] = useState(String(Number(loan.installment_amount) || ''))
  const [frequency, setFrequency] = useState<LoanFrequency>((loan.frequency as LoanFrequency) || 'diaria')
  const [disbursed, setDisbursed] = useState(toInputDate())
  const [method, setMethod] = useState<PaymentMethod>((loan.disbursement_method as PaymentMethod) || 'efectivo')
  const [nextDue, setNextDue] = useState(toInputDate())
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const countValue = Number(count) || 0

  useEffect(() => {
    const totalValue = parseAmount(total)
    const c = Number(count) || 0
    if (totalValue > 0 && c > 0) setInstallment(String(Math.round(totalValue / c)))
  }, [total, count])

  useEffect(() => {
    if (interest.trim() === '') return
    const amountValue = parseAmount(amount)
    if (amountValue > 0) setTotal(String(Math.round(amountValue * (1 + parseRate(interest) / 100))))
  }, [amount, interest])

  const schedule = useMemo(
    () => installmentAmounts(parseAmount(total), countValue, Number(installment) || 0),
    [total, countValue, installment],
  )

  const dates = useMemo(() => {
    if (!nextDue || countValue <= 0) return [] as Date[]
    return buildSchedule({ anchor: new Date(`${nextDue}T00:00:00`), anchorIndex: 0, count: countValue, frequency })
  }, [nextDue, countValue, frequency])

  const newCapital = parseAmount(amount)
  const cashOut = Math.max(0, newCapital - remaining)

  async function onSave() {
    const totalValue = parseAmount(total)
    if (newCapital <= 0) return setError('El capital nuevo debe ser mayor a 0.')
    if (totalValue <= 0) return setError('El total a pagar debe ser mayor a 0.')
    if (countValue <= 0 || dates.length === 0) return setError('Indica número de cuotas y fecha.')
    setSaving(true)
    setError('')
    try {
      await rolloverLoan({
        oldLoan: loan.id,
        code: nextCode('PR'),
        amount: newCapital,
        total: totalValue,
        installment_amount: parseAmount(installment),
        frequency,
        disbursed_at: isoFromInputDate(disbursed),
        disbursement_method: method,
        start_at: isoFromInputDate(toInputDate(dates[0].toISOString())),
        end_at: isoFromInputDate(toInputDate(dates[dates.length - 1].toISOString())),
        interest_rate: parseRate(interest),
        notes,
        installments: dates.map((date, index) => ({
          number: index + 1,
          due_date: isoFromInputDate(toInputDate(date.toISOString())),
          amount: schedule.rows[index] ?? parseAmount(installment),
        })),
      })
      notify('Volteo registrado')
      onDone?.()
      close()
    } catch {
      setError('No se pudo registrar el volteo. Revisa el saldo de caja o inténtalo de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Voltear crédito" close={close}>
      <div className="modal-body">
        <p className="center-note" style={{ textAlign: 'left' }}>
          {loan.code} · {client?.name ?? '—'} — Saldo a refinanciar: <b>{money(remaining)}</b>. El crédito viejo queda
          cerrado por volteo (no se registra un pago ficticio).
        </p>
        <div className="form-grid">
          <Field label="Capital nuevo *">
            <MoneyInput value={amount} onChange={setAmount} autoFocus />
          </Field>
          <Field label="Interés (%)">
            <input value={interest} onChange={(event) => setInterest(event.target.value)} inputMode="decimal" />
          </Field>
          <Field label="Total a pagar *">
            <MoneyInput value={total} onChange={setTotal} />
          </Field>
          <Field label="Número de cuotas *">
            <input value={count} onChange={(event) => setCount(event.target.value)} inputMode="numeric" />
          </Field>
          <Field label="Valor de cuota *">
            <MoneyInput value={installment} onChange={setInstallment} />
          </Field>
          <Field label="Método de desembolso">
            <select value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)}>
              {PAYMENT_METHODS.map((option) => (
                <option value={option} key={option}>
                  {METHOD_LABEL[option]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Fecha de desembolso">
            <input type="date" value={disbursed} onChange={(event) => setDisbursed(event.target.value)} />
          </Field>
          <Field label="Próxima fecha de pago (cuota #1)">
            <input type="date" value={nextDue} onChange={(event) => setNextDue(event.target.value)} />
          </Field>
        </div>
        <Field label="Frecuencia de pago">
          <div className="frequency">
            {FREQUENCIES.map((option) => (
              <button
                className={frequency === option ? 'selected' : ''}
                key={option}
                type="button"
                onClick={() => setFrequency(option)}
              >
                {FREQUENCY_LABEL[option]}
              </button>
            ))}
          </div>
        </Field>

        <div className="summary-grid">
          <div>
            <span>Saldo refinanciado</span>
            <b>{money(remaining)}</b>
          </div>
          <div>
            <span>Efectivo real a entregar</span>
            <b className="positive">{money(cashOut)}</b>
          </div>
          <div>
            <span>Total nuevo crédito</span>
            <b>{money(parseAmount(total))}</b>
          </div>
          <div>
            <span>Cuotas</span>
            <b>{countValue}</b>
          </div>
        </div>
        <p className="center-note" style={{ textAlign: 'left' }}>
          Efectivo a entregar = capital nuevo ({money(newCapital)}) − saldo refinanciado ({money(remaining)}).
        </p>

        <Field label="Motivo / notas (opcional)">
          <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ej. El cliente renueva el crédito" />
        </Field>

        {error && <div className="form-error">{error}</div>}
      </div>
      <div className="modal-foot">
        <Button variant="outline" onClick={close} disabled={saving}>
          Cancelar
        </Button>
        <Button onClick={onSave} disabled={saving}>
          {saving ? 'Guardando…' : (
            <>
              <Repeat data-icon="inline-start" />
              Voltear
            </>
          )}
          {!saving && <Check data-icon="inline-end" />}
        </Button>
      </div>
    </Modal>
  )
}
