'use client'

import { useState } from 'react'
import { Ban } from 'lucide-react'
import { Field, Modal } from '@/components/ui/kit'
import { Button } from '@/components/ui/button'
import { useData, useToast } from '@/components/providers'
import { money } from '@/lib/format'
import type { Loan } from '@/lib/types'

export function CancelLoanModal({ loan, close, onDone }: { loan: Loan; close: () => void; onDone?: () => void }) {
  const { cancelLoan } = useData()
  const notify = useToast()
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function onSave() {
    if (!reason.trim()) return setError('El motivo es obligatorio.')
    setSaving(true)
    setError('')
    try {
      await cancelLoan(loan.id, reason.trim())
      notify('Crédito cancelado')
      onDone?.()
      close()
    } catch {
      setError('No se pudo cancelar el crédito.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Cancelar crédito" close={close}>
      <div className="modal-body">
        <p className="center-note" style={{ textAlign: 'left' }}>
          {loan.code} — Saldo actual <b>{money(loan.balance)}</b>. El crédito queda marcado como <b>cancelado</b> (no se
          borra ni se genera ningún pago).
        </p>
        <Field label="Motivo de la cancelación *">
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            placeholder="Ej. Crédito creado por error / error de digitación"
          />
        </Field>
        {error && <div className="form-error">{error}</div>}
      </div>
      <div className="modal-foot">
        <Button variant="outline" onClick={close} disabled={saving}>
          Volver
        </Button>
        <Button variant="destructive" onClick={onSave} disabled={saving}>
          <Ban data-icon="inline-start" />
          {saving ? 'Cancelando…' : 'Cancelar crédito'}
        </Button>
      </div>
    </Modal>
  )
}
