'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronDown, Search } from 'lucide-react'
import { Badge, Field, Modal, MoneyInput } from '@/components/ui/kit'
import { Button } from '@/components/ui/button'
import { useData, useToast, type InstallmentInput, type LoanInput } from '@/components/providers'
import { INSTALLMENT_STATUS_LABEL, FREQUENCIES, FREQUENCY_DAYS, FREQUENCY_LABEL, installmentOutstanding, isOverdue, METHOD_LABEL, PAYMENT_METHODS } from '@/lib/derive'
import { formatDate, isoFromInputDate, money, normalize, parseAmount, toInputDate } from '@/lib/format'
import type { Loan, LoanFrequency, LoanStatus, PaymentMethod } from '@/lib/types'

function addDays(base: Date, days: number) {
  const date = new Date(base)
  date.setDate(date.getDate() + days)
  return date
}

function parseRate(value: string) {
  const rate = Number(String(value).replace(',', '.'))
  return Number.isFinite(rate) ? rate : 0
}

export function LoanModal({
  close,
  clientId,
  loan,
  onCreated,
}: {
  close: () => void
  clientId?: string
  loan?: Loan | null
  onCreated?: (loanId: string) => void
}) {
  const { clients, installments, payments, createLoan, updateLoan } = useData()
  const notify = useToast()
  const router = useRouter()

  const editing = !!loan
  const loanInstallments = loan
    ? installments.filter((item) => item.loan === loan.id).sort((a, b) => a.number - b.number)
    : []
  const hasPayments = loan ? payments.some((item) => item.loan === loan.id) : false

  const [step, setStep] = useState(editing ? 2 : 1)
  const [client, setClient] = useState(loan?.client || clientId || clients[0]?.id || '')
  const [amount, setAmount] = useState(loan ? String(loan.amount) : '1000000')
  const [interest, setInterest] = useState(
    loan
      ? String(
          loan.interest_rate > 0
            ? loan.interest_rate
            : loan.amount > 0
              ? Math.round((loan.total / loan.amount - 1) * 10000) / 100
              : 0,
        )
      : '20',
  )
  const [total, setTotal] = useState(loan ? String(loan.total) : '1200000')
  const [count, setCount] = useState(loan ? String(loan.installments_count || loanInstallments.length || '') : '20')
  const [installment, setInstallment] = useState(loan ? String(loan.installment_amount) : '')
  const [frequency, setFrequency] = useState<LoanFrequency>((loan?.frequency as LoanFrequency) || 'diaria')
  const [disbursementMethod, setDisbursementMethod] = useState<PaymentMethod>(
    (loan?.disbursement_method as PaymentMethod) || 'efectivo',
  )
  const [disbursed, setDisbursed] = useState(loan ? toInputDate(loan.disbursed_at) : toInputDate())
  const [nextDue, setNextDue] = useState(() => {
    if (!loan) return toInputDate()
    const pending = loanInstallments.find((item) => installmentOutstanding(item) > 0)
    return pending ? toInputDate(pending.due_date) : toInputDate(loan.end_at)
  })
  const [paidCount, setPaidCount] = useState(String(loanInstallments.filter((item) => installmentOutstanding(item) <= 0).length))
  const [loanState, setLoanState] = useState<LoanStatus>(
    loan && loanInstallments.some((item) => isOverdue(item)) ? 'en_mora' : 'activo',
  )
  const [pickerQuery, setPickerQuery] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const countValue = Number(count) || 0
  const paidValue = Math.max(0, Math.min(Number(paidCount) || 0, countValue))
  const pendingCount = Math.max(0, countValue - paidValue)
  const anchorIndex = countValue > 0 ? Math.min(paidValue, countValue - 1) : 0

  useEffect(() => {
    const totalValue = parseAmount(total)
    const countValue = Number(count) || 0
    if (totalValue > 0 && countValue > 0) setInstallment(String(Math.round(totalValue / countValue)))
  }, [total, count])

  useEffect(() => {
    if (interest.trim() === '') return
    const amountValue = parseAmount(amount)
    if (amountValue > 0) setTotal(String(Math.round(amountValue * (1 + parseRate(interest) / 100))))
  }, [amount, interest])

  useEffect(() => {
    if (!nextDue) return
    const overdue = new Date(`${nextDue}T00:00:00`).getTime() < new Date(`${toInputDate()}T00:00:00`).getTime()
    setLoanState(overdue ? 'en_mora' : 'activo')
  }, [nextDue])

  const filteredClients = useMemo(() => {
    if (!pickerQuery.trim()) return clients.slice(0, 8)
    return clients.filter((item) => normalize(`${item.name} ${item.doc} ${item.code}`).includes(normalize(pickerQuery))).slice(0, 8)
  }, [clients, pickerQuery])

  const selectedClient = clients.find((item) => item.id === client)

  const dates = useMemo(() => {
    const countValue = Number(count) || 0
    if (!nextDue || countValue <= 0) return [] as Date[]
    const anchor = new Date(`${nextDue}T00:00:00`)
    const days = FREQUENCY_DAYS[frequency] ?? 1
    return Array.from({ length: countValue }, (_, index) => addDays(anchor, (index - anchorIndex) * days))
  }, [nextDue, count, frequency, anchorIndex])

  function next() {
    setError('')
    if (step === 1 && !editing && !client) {
      setError('Selecciona un cliente.')
      return
    }
    if (step === 2) {
      if (parseAmount(amount) <= 0) return setError('El monto prestado debe ser mayor a 0.')
      if (parseAmount(total) <= 0) return setError('El total a pagar debe ser mayor a 0.')
      if (countValue <= 0) return setError('El número de cuotas debe ser mayor a 0.')
      if (Number(paidCount) < 0 || Number(paidCount) > countValue) {
        return setError(`Las cuotas ya pagadas deben estar entre 0 y ${countValue}.`)
      }
      if (pendingCount > 0 && !nextDue) return setError('Indica la próxima fecha de pago.')
    }
    setStep((value) => Math.min(4, value + 1))
  }

  async function onSave() {
    const targetClientId = loan ? loan.client : selectedClient?.id || ''
    if (!targetClientId || dates.length === 0) return
    setSaving(true)
    setError('')
    try {
      const amountValue = parseAmount(amount)
      const totalValue = parseAmount(total)
      const installmentValue = parseAmount(installment)
      const payload: LoanInput = {
        client: targetClientId,
        amount: amountValue,
        total: totalValue,
        installments_count: dates.length,
        installment_amount: installmentValue,
        frequency,
        disbursed_at: isoFromInputDate(disbursed),
        disbursement_method: disbursementMethod,
        start_at: isoFromInputDate(toInputDate(dates[0].toISOString())),
        end_at: isoFromInputDate(toInputDate(dates[dates.length - 1].toISOString())),
        interest_rate: parseRate(interest),
        notes: loan?.notes ?? '',
        paid_installments: paidValue,
        status: loanState,
      }
      const installmentRows: InstallmentInput[] = dates.map((date, index) => ({
        number: index + 1,
        due_date: isoFromInputDate(toInputDate(date.toISOString())),
        amount: installmentValue,
      }))
      if (loan) {
        await updateLoan(loan.id, payload, installmentRows)
        notify('Préstamo actualizado correctamente')
        close()
      } else {
        const record = await createLoan(payload, installmentRows)
        notify('Préstamo creado correctamente')
        close()
        if (onCreated) onCreated(record.id)
        else router.push(`/prestamos/${record.id}`)
      }
    } catch {
      setError(editing ? 'No se pudo actualizar el préstamo. Inténtalo de nuevo.' : 'No se pudo crear el préstamo. Inténtalo de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  const installmentValue = parseAmount(installment)

  function statusFor(index: number) {
    if (index < paidValue) return 'pagada'
    const overdue = dates[index] && dates[index].getTime() < new Date(`${toInputDate()}T00:00:00`).getTime()
    return overdue ? 'vencida' : 'pendiente'
  }

  return (
    <Modal title={editing ? 'Editar préstamo' : 'Nuevo préstamo'} close={close} wide>
      <div className="stepper">
        {['Cliente', 'Información', 'Resumen', 'Calendario'].map((label, index) => (
          <div className={step >= index + 1 ? 'current' : ''} key={label}>
            <b>{index + 1}</b>
            <span>{label}</span>
          </div>
        ))}
      </div>

      <div className="modal-body loan-modal-body">
        {step === 1 &&
          (editing ? (
            <>
              <h3>Cliente</h3>
              <p>El cliente del préstamo no se puede cambiar.</p>
              <div className="client-picker">
                <button className="picked" type="button">
                  <div className="avatar small">{selectedClient ? selectedClient.name.slice(0, 2).toUpperCase() : '—'}</div>
                  <div>
                    <b>{selectedClient?.name ?? '—'}</b>
                    <span>
                      {selectedClient?.doc || selectedClient?.code || ''} · {selectedClient?.city || 'Sin ciudad'}
                    </span>
                  </div>
                  <Check />
                </button>
              </div>
            </>
          ) : (
            <>
              <h3>Selecciona un cliente</h3>
              <p>El préstamo quedará asociado al historial del cliente.</p>
              <div className="search-field">
                <Search />
                <input
                  placeholder="Buscar cliente..."
                  value={pickerQuery}
                  onChange={(event) => setPickerQuery(event.target.value)}
                />
              </div>
              <div className="client-picker">
                {filteredClients.length > 0 ? (
                  filteredClients.map((item) => (
                    <button className={client === item.id ? 'picked' : ''} key={item.id} onClick={() => setClient(item.id)}>
                      <div className="avatar small">
                        {item.name
                          .split(' ')
                          .map((part) => part[0])
                          .slice(0, 2)
                          .join('')}
                      </div>
                      <div>
                        <b>{item.name}</b>
                        <span>
                          {item.doc || item.code} · {item.city || 'Sin ciudad'}
                        </span>
                      </div>
                      {client === item.id && <Check />}
                    </button>
                  ))
                ) : (
                  <p className="center-note">No encontramos clientes con esa búsqueda.</p>
                )}
              </div>
            </>
          ))}

        {step === 2 && (editing || selectedClient) && (
          <>
            <h3>Información del préstamo</h3>
            <p>Define el acuerdo de pago con {selectedClient?.name ?? '—'}.</p>
            {hasPayments && (
              <div className="alert-warn">
                Este préstamo tiene pagos registrados: solo puedes editar montos, interés, notas, estado y fecha de desembolso.
              </div>
            )}
            <div className="form-grid">
              <Field label="Monto prestado *">
                <MoneyInput value={amount} onChange={setAmount} />
              </Field>
              <Field label="Interés (%)">
                <input value={interest} onChange={(event) => setInterest(event.target.value)} inputMode="decimal" />
              </Field>
              <Field label="Total a pagar *">
                <MoneyInput value={total} onChange={setTotal} />
              </Field>
              <Field label="Número de cuotas *">
                <input
                  value={count}
                  onChange={(event) => setCount(event.target.value)}
                  inputMode="numeric"
                  disabled={hasPayments}
                />
              </Field>
              <Field label="Valor de cuota *">
                <MoneyInput value={installment} onChange={setInstallment} />
              </Field>
              <Field label="Fecha de desembolso">
                <input type="date" value={disbursed} onChange={(event) => setDisbursed(event.target.value)} />
              </Field>
              <Field label="Método de desembolso">
                <select
                  value={disbursementMethod}
                  onChange={(event) => setDisbursementMethod(event.target.value as PaymentMethod)}
                >
                  {PAYMENT_METHODS.map((option) => (
                    <option value={option} key={option}>
                      {METHOD_LABEL[option]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Cuotas ya pagadas">
                <input
                  value={paidCount}
                  onChange={(event) => setPaidCount(event.target.value)}
                  inputMode="numeric"
                  disabled={hasPayments}
                />
              </Field>
              <Field label={pendingCount > 0 ? `Próxima fecha de pago (cuota #${anchorIndex + 1})` : 'Fecha de la última cuota'}>
                <input
                  type="date"
                  value={nextDue}
                  onChange={(event) => setNextDue(event.target.value)}
                  disabled={hasPayments}
                />
              </Field>
            </div>
            {pendingCount > 0 && (
              <Field label="Estado del préstamo">
                <div className="frequency">
                  {(['activo', 'en_mora'] as LoanStatus[]).map((option) => (
                    <button
                      className={loanState === option ? 'selected' : ''}
                      key={option}
                      onClick={() => setLoanState(option)}
                      type="button"
                    >
                      {option === 'activo' ? 'Al día' : 'En mora'}
                    </button>
                  ))}
                </div>
              </Field>
            )}
            <Field label="Frecuencia de pago">
              <div className="frequency">
                {FREQUENCIES.map((option) => (
                  <button
                    className={frequency === option ? 'selected' : ''}
                    key={option}
                    onClick={() => setFrequency(option)}
                    type="button"
                    disabled={hasPayments}
                  >
                    {FREQUENCY_LABEL[option]}
                    <small>
                      {option === 'diaria'
                        ? 'Una cuota cada día'
                        : option === 'semanal'
                          ? 'Una cuota cada 7 días'
                          : option === 'quincenal'
                            ? 'Una cuota cada 15 días'
                            : 'Una cuota cada mes'}
                    </small>
                  </button>
                ))}
              </div>
            </Field>
          </>
        )}

        {step === 3 && (editing || selectedClient) && (
          <>
            <h3>Resumen del préstamo</h3>
            <p>Revisa la información antes de generar el calendario.</p>
            <div className="summary-grid">
              {[
                ['Cliente', selectedClient?.name ?? '—'],
                ['Monto prestado', money(parseAmount(amount))],
                ['Interés', `${parseRate(interest)}%`],
                ['Total a pagar', money(parseAmount(total))],
                ['Número de cuotas', count],
                ['Valor de cuota', money(installmentValue)],
                ['Frecuencia', FREQUENCY_LABEL[frequency]],
                ['Cuotas pagadas', `${paidValue} de ${countValue}`],
                ['Saldo pendiente', money(Math.max(0, parseAmount(total) - paidValue * installmentValue))],
                ['Próxima cuota', paidValue < countValue && dates[paidValue] ? formatDate(dates[paidValue].toISOString()) : '—'],
                ['Estado', loanState === 'en_mora' ? 'En mora' : 'Al día'],
                ['Primera cuota', dates[0] ? formatDate(dates[0].toISOString()) : '—'],
                ['Última cuota', dates.length ? formatDate(dates[dates.length - 1].toISOString()) : '—'],
              ].map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <b>{value}</b>
                </div>
              ))}
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <h3>Calendario de pagos</h3>
            <p>
              Se generarán {dates.length} cuotas con frecuencia {FREQUENCY_LABEL[frequency].toLowerCase()}
              {paidValue > 0 ? ` (${paidValue} ya pagadas)` : ''}.
            </p>
            <div className="schedule">
              {dates.map((date, index) => (
                <div key={date.toISOString()}>
                  <span>#{index + 1}</span>
                  <b>{formatDate(date.toISOString())}</b>
                  <strong>{money(installmentValue)}</strong>
                  <Badge status={INSTALLMENT_STATUS_LABEL[statusFor(index)]} />
                </div>
              ))}
            </div>
          </>
        )}

        {error && <div className="form-error">{error}</div>}
      </div>

      <div className="modal-foot">
        <Button
          variant="outline"
          onClick={step <= (editing ? 2 : 1) ? close : () => setStep(step - 1)}
          disabled={saving}
        >
          {step <= (editing ? 2 : 1) ? 'Cancelar' : 'Atrás'}
        </Button>
        {step < 4 ? (
          <Button onClick={next}>
            {step === 1 ? 'Continuar' : 'Siguiente'}
            <ChevronDown data-icon="inline-end" />
          </Button>
        ) : (
          <Button onClick={onSave} disabled={saving}>
            <Check data-icon="inline-start" />
            {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear préstamo'}
          </Button>
        )}
      </div>
    </Modal>
  )
}
