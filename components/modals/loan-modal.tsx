'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronDown, Search } from 'lucide-react'
import { Badge, Field, Modal } from '@/components/ui/kit'
import { Button } from '@/components/ui/button'
import { useData, useToast, type InstallmentInput, type LoanInput } from '@/components/providers'
import { FREQUENCIES, FREQUENCY_DAYS, FREQUENCY_LABEL } from '@/lib/derive'
import { formatDate, isoFromInputDate, money, normalize, parseAmount, toInputDate } from '@/lib/format'
import type { LoanFrequency } from '@/lib/types'

function addDays(base: Date, days: number) {
  const date = new Date(base)
  date.setDate(date.getDate() + days)
  return date
}

export function LoanModal({
  close,
  clientId,
  onCreated,
}: {
  close: () => void
  clientId?: string
  onCreated?: (loanId: string) => void
}) {
  const { clients, createLoan } = useData()
  const notify = useToast()
  const router = useRouter()

  const [step, setStep] = useState(1)
  const [client, setClient] = useState(clientId || clients[0]?.id || '')
  const [amount, setAmount] = useState('1000000')
  const [total, setTotal] = useState('1200000')
  const [count, setCount] = useState('20')
  const [installment, setInstallment] = useState('')
  const [frequency, setFrequency] = useState<LoanFrequency>('diaria')
  const [disbursed, setDisbursed] = useState(toInputDate())
  const [start, setStart] = useState(toInputDate())
  const [pickerQuery, setPickerQuery] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const totalValue = parseAmount(total)
    const countValue = Number(count) || 0
    if (totalValue > 0 && countValue > 0) setInstallment(String(Math.round(totalValue / countValue)))
  }, [total, count])

  const filteredClients = useMemo(() => {
    if (!pickerQuery.trim()) return clients.slice(0, 8)
    return clients.filter((item) => normalize(`${item.name} ${item.doc} ${item.code}`).includes(normalize(pickerQuery))).slice(0, 8)
  }, [clients, pickerQuery])

  const selectedClient = clients.find((item) => item.id === client)

  const dates = useMemo(() => {
    const countValue = Number(count) || 0
    if (!start || countValue <= 0) return [] as Date[]
    const base = new Date(`${start}T00:00:00`)
    const days = FREQUENCY_DAYS[frequency] ?? 1
    return Array.from({ length: countValue }, (_, index) => addDays(base, index * days))
  }, [start, count, frequency])

  function next() {
    setError('')
    if (step === 1 && !client) {
      setError('Selecciona un cliente.')
      return
    }
    if (step === 2) {
      if (parseAmount(amount) <= 0) return setError('El monto prestado debe ser mayor a 0.')
      if (parseAmount(total) <= 0) return setError('El total a pagar debe ser mayor a 0.')
      if (Number(count) <= 0) return setError('El número de cuotas debe ser mayor a 0.')
    }
    setStep((value) => Math.min(4, value + 1))
  }

  async function onSave() {
    if (!selectedClient || dates.length === 0) return
    setSaving(true)
    setError('')
    try {
      const amountValue = parseAmount(amount)
      const totalValue = parseAmount(total)
      const installmentValue = parseAmount(installment)
      const payload: LoanInput = {
        client: selectedClient.id,
        amount: amountValue,
        total: totalValue,
        installments_count: dates.length,
        installment_amount: installmentValue,
        frequency,
        disbursed_at: isoFromInputDate(disbursed),
        start_at: isoFromInputDate(start),
        end_at: isoFromInputDate(toInputDate(dates[dates.length - 1].toISOString())),
        interest_rate: 0,
        notes: '',
      }
      const installmentRows: InstallmentInput[] = dates.map((date, index) => ({
        number: index + 1,
        due_date: isoFromInputDate(toInputDate(date.toISOString())),
        amount: installmentValue,
      }))
      const record = await createLoan(payload, installmentRows)
      notify('Préstamo creado correctamente')
      close()
      if (onCreated) onCreated(record.id)
      else router.push(`/prestamos/${record.id}`)
    } catch {
      setError('No se pudo crear el préstamo. Inténtalo de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  const installmentValue = parseAmount(installment)

  return (
    <Modal title="Nuevo préstamo" close={close} wide>
      <div className="stepper">
        {['Cliente', 'Información', 'Resumen', 'Calendario'].map((label, index) => (
          <div className={step >= index + 1 ? 'current' : ''} key={label}>
            <b>{index + 1}</b>
            <span>{label}</span>
          </div>
        ))}
      </div>

      <div className="modal-body loan-modal-body">
        {step === 1 && (
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
        )}

        {step === 2 && selectedClient && (
          <>
            <h3>Información del préstamo</h3>
            <p>Define el acuerdo de pago con {selectedClient.name}.</p>
            <div className="form-grid">
              <Field label="Monto prestado *">
                <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="numeric" />
              </Field>
              <Field label="Total a pagar *">
                <input value={total} onChange={(event) => setTotal(event.target.value)} inputMode="numeric" />
              </Field>
              <Field label="Número de cuotas *">
                <input value={count} onChange={(event) => setCount(event.target.value)} inputMode="numeric" />
              </Field>
              <Field label="Valor de cuota *">
                <input value={installment} onChange={(event) => setInstallment(event.target.value)} inputMode="numeric" />
              </Field>
              <Field label="Fecha de desembolso">
                <input type="date" value={disbursed} onChange={(event) => setDisbursed(event.target.value)} />
              </Field>
              <Field label="Inicio de pagos">
                <input type="date" value={start} onChange={(event) => setStart(event.target.value)} />
              </Field>
            </div>
            <Field label="Frecuencia de pago">
              <div className="frequency">
                {FREQUENCIES.map((option) => (
                  <button
                    className={frequency === option ? 'selected' : ''}
                    key={option}
                    onClick={() => setFrequency(option)}
                    type="button"
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

        {step === 3 && selectedClient && (
          <>
            <h3>Resumen del préstamo</h3>
            <p>Revisa la información antes de generar el calendario.</p>
            <div className="summary-grid">
              {[
                ['Cliente', selectedClient.name],
                ['Monto prestado', money(parseAmount(amount))],
                ['Total a pagar', money(parseAmount(total))],
                ['Número de cuotas', count],
                ['Valor de cuota', money(installmentValue)],
                ['Frecuencia', FREQUENCY_LABEL[frequency]],
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
              Se generarán {dates.length} cuotas con frecuencia {FREQUENCY_LABEL[frequency].toLowerCase()}.
            </p>
            <div className="schedule">
              {dates.slice(0, 8).map((date, index) => (
                <div key={date.toISOString()}>
                  <span>#{index + 1}</span>
                  <b>{formatDate(date.toISOString())}</b>
                  <strong>{money(installmentValue)}</strong>
                  <Badge status="Pendiente" />
                </div>
              ))}
            </div>
            {dates.length > 8 && <p className="center-note">Mostrando las primeras 8 cuotas de {dates.length}.</p>}
          </>
        )}

        {error && <div className="form-error">{error}</div>}
      </div>

      <div className="modal-foot">
        <Button variant="outline" onClick={step === 1 ? close : () => setStep(step - 1)} disabled={saving}>
          {step === 1 ? 'Cancelar' : 'Atrás'}
        </Button>
        {step < 4 ? (
          <Button onClick={next}>
            {step === 1 ? 'Continuar' : 'Siguiente'}
            <ChevronDown data-icon="inline-end" />
          </Button>
        ) : (
          <Button onClick={onSave} disabled={saving}>
            <Check data-icon="inline-start" />
            {saving ? 'Creando…' : 'Crear préstamo'}
          </Button>
        )}
      </div>
    </Modal>
  )
}
