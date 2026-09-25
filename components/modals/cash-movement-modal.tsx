'use client'

import { useState } from 'react'
import { Check, Trash2 } from 'lucide-react'
import { Field, Modal, MoneyInput } from '@/components/ui/kit'
import { Button } from '@/components/ui/button'
import { useAuth, useData, useToast, type CashMovementInput } from '@/components/providers'
import { METHOD_LABEL, PAYMENT_METHODS } from '@/lib/derive'
import { isoFromInputDate, money, parseAmount, toInputDate } from '@/lib/format'
import type { CashMovement } from '@/lib/types'

const CATEGORIES: Record<string, string[]> = {
  ingreso: ['aporte', 'ajuste', 'otro'],
  egreso: ['gasto', 'retiro', 'ajuste', 'otro'],
}

const CATEGORY_LABEL: Record<string, string> = {
  aporte: 'Aporte (entra dinero)',
  ajuste: 'Ajuste',
  otro: 'Otro',
  gasto: 'Gasto',
  retiro: 'Retiro',
}

export function CashMovementModal({ movement, close }: { movement?: CashMovement | null; close: () => void }) {
  const { createCashMovement, updateCashMovement, deleteCashMovement } = useData()
  const { user } = useAuth()
  const notify = useToast()
  const isAdmin = user?.role === 'admin'
  const editing = !!movement

  const [type, setType] = useState<'ingreso' | 'egreso'>(movement?.type === 'ingreso' ? 'ingreso' : 'egreso')
  const [category, setCategory] = useState<string>(movement?.category || 'gasto')
  const [method, setMethod] = useState<string>(movement?.method || 'efectivo')
  const [amount, setAmount] = useState(movement ? String(movement.amount) : '')
  const [date, setDate] = useState(movement ? toInputDate(movement.date) : toInputDate())
  const [description, setDescription] = useState(movement?.description || '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function changeType(next: 'ingreso' | 'egreso') {
    setType(next)
    if (!CATEGORIES[next].includes(category)) setCategory(CATEGORIES[next][0])
  }

  async function onSave() {
    const value = parseAmount(amount)
    if (value <= 0) return setError('El monto debe ser mayor a 0.')
    setSaving(true)
    setError('')
    const payload: CashMovementInput = {
      type,
      category,
      method,
      amount: value,
      date: isoFromInputDate(date),
      description: description.trim(),
    }
    try {
      if (movement) await updateCashMovement(movement.id, payload)
      else await createCashMovement(payload)
      notify(editing ? 'Movimiento actualizado' : 'Movimiento registrado')
      close()
    } catch {
      setError('No se pudo guardar el movimiento. Inténtalo de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  async function onDelete() {
    if (!movement) return
    if (!window.confirm('¿Eliminar este movimiento de caja?')) return
    try {
      await deleteCashMovement(movement.id)
      notify('Movimiento eliminado')
      close()
    } catch {
      notify('No se pudo eliminar el movimiento')
    }
  }

  return (
    <Modal title={editing ? 'Editar movimiento' : 'Registrar movimiento'} close={close}>
      <div className="modal-body">
        <Field label="Tipo">
          <div className="frequency">
            {(['ingreso', 'egreso'] as const).map((option) => (
              <button
                className={type === option ? 'selected' : ''}
                key={option}
                type="button"
                onClick={() => changeType(option)}
              >
                {option === 'ingreso' ? 'Entra dinero' : 'Sale dinero'}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Categoría">
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            {CATEGORIES[type].map((option) => (
              <option value={option} key={option}>
                {CATEGORY_LABEL[option]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Método">
          <select value={method} onChange={(event) => setMethod(event.target.value)}>
            {PAYMENT_METHODS.map((option) => (
              <option value={option} key={option}>
                {METHOD_LABEL[option]}
                {option === 'efectivo' ? ' (caja)' : ' (cuenta)'}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Monto *">
          <MoneyInput value={amount} onChange={setAmount} autoFocus />
        </Field>
        <Field label="Fecha">
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </Field>
        <Field label="Descripción">
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Ej. Pago de arriendo, retiro para gastos, aporte de socio"
          />
        </Field>
        {error && <div className="form-error">{error}</div>}
      </div>

      <div className="modal-foot">
        {editing && isAdmin && (
          <Button variant="destructive" onClick={onDelete} disabled={saving}>
            <Trash2 data-icon="inline-start" />
            Eliminar
          </Button>
        )}
        <Button variant="outline" onClick={close} disabled={saving}>
          Cancelar
        </Button>
        <Button onClick={onSave} disabled={saving}>
          <Check data-icon="inline-start" />
          {saving ? 'Guardando…' : editing ? 'Guardar' : 'Registrar'}
        </Button>
      </div>
    </Modal>
  )
}
