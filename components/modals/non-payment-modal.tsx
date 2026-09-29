'use client'

import { useMemo, useState } from 'react'
import { Check, MessageSquareWarning, Pencil, Trash2, X } from 'lucide-react'
import { Field, Modal } from '@/components/ui/kit'
import { Button } from '@/components/ui/button'
import { useAuth, useData, useLookups, useToast, useToday } from '@/components/providers'
import { INSTALLMENT_STATUS_LABEL, effectiveInstallmentStatus, installmentOutstanding } from '@/lib/derive'
import { formatDate, formatDateTime, money, toInputDate } from '@/lib/format'

export function NonPaymentModal({ installmentId, close }: { installmentId: string; close: () => void }) {
  const { installments, installmentNotes, rescheduleInstallment, updateInstallmentNote, deleteInstallmentNote } = useData()
  const { loanById, clientById } = useLookups()
  const { user } = useAuth()
  const notify = useToast()
  const today = useToday()
  const isAdmin = user?.role === 'admin'

  const installment = installments.find((item) => item.id === installmentId)
  const loan = installment ? loanById.get(installment.loan) : undefined
  const client = installment ? clientById.get(installment.client) : undefined

  const notes = useMemo(
    () => installmentNotes.filter((note) => note.installment === installmentId),
    [installmentNotes, installmentId],
  )

  const [reason, setReason] = useState('')
  const [newDate, setNewDate] = useState('')
  const [shiftFollowing, setShiftFollowing] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState('')
  const [editingReason, setEditingReason] = useState('')

  if (!installment) {
    return (
      <Modal title="Nota de no pago" close={close}>
        <div className="modal-body">
          <p className="center-note">No se encontró la cuota.</p>
        </div>
        <div className="modal-foot">
          <Button variant="outline" onClick={close}>
            Cerrar
          </Button>
        </div>
      </Modal>
    )
  }

  const outstanding = installmentOutstanding(installment)

  async function saveNote() {
    if (!editingId || !editingReason.trim()) return
    try {
      await updateInstallmentNote(editingId, editingReason.trim())
      notify('Nota actualizada')
      setEditingId('')
      setEditingReason('')
    } catch {
      notify('No se pudo actualizar la nota')
    }
  }

  async function removeNote(id: string) {
    if (!window.confirm('¿Eliminar esta nota de no pago? Las fechas no se revierten.')) return
    try {
      await deleteInstallmentNote(id)
      notify('Nota eliminada')
    } catch {
      notify('No se pudo eliminar la nota')
    }
  }

  async function onSave() {
    if (!reason.trim()) {
      setError('Escribe la justificación (por qué no pagó).')
      return
    }
    setSaving(true)
    setError('')
    try {
      await rescheduleInstallment({
        installment: installment!.id,
        reason: reason.trim(),
        new_date: newDate || '',
        shift_following: shiftFollowing,
      })
      notify('Nota de no pago registrada')
      close()
    } catch {
      setError('No se pudo guardar la nota. Inténtalo de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Nota de no pago" close={close}>
      <div className="payment-context">
        <div>
          <b>{client?.name ?? '—'}</b>
          <span>
            {loan?.code ?? '—'} · Cuota #{installment.number} · {formatDate(installment.due_date)}
          </span>
        </div>
        <span className="badge bad">
          <i />
          {INSTALLMENT_STATUS_LABEL[effectiveInstallmentStatus(installment, today)] || 'Pendiente'}
        </span>
      </div>

      <div className="modal-body">
        <div className="due-box" style={{ margin: '0 0 16px' }}>
          <div>
            <span>Valor de la cuota</span>
            <b>{money(installment.amount)}</b>
          </div>
          <div>
            <span>Saldo de la cuota</span>
            <b>{money(outstanding)}</b>
          </div>
        </div>

        <Field label="¿Por qué no pagó? (justificación) *">
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Ej. El cliente está enfermo / sin trabajo / pidió plazo hasta la próxima semana."
            autoFocus
          />
        </Field>

        <Field label="Nueva fecha de pago (opcional)">
          <input type="date" value={newDate} min={toInputDate(installment.due_date)} onChange={(event) => setNewDate(event.target.value)} />
        </Field>

        {newDate && (
          <label className="check-row">
            <input type="checkbox" checked={shiftFollowing} onChange={(event) => setShiftFollowing(event.target.checked)} />
            <span>Mover también las siguientes cuotas por la misma diferencia</span>
          </label>
        )}

        {notes.length > 0 && (
          <div className="note-history">
            <span>Historial de notas</span>
            {notes.map((note) => (
              <div className="note-item" key={note.id}>
                <div className="note-head">
                  <MessageSquareWarning />
                  <b>{formatDateTime(note.created)}</b>
                  {isAdmin && editingId !== note.id && (
                    <span className="note-actions">
                      <button
                        className="icon-btn"
                        title="Editar nota"
                        onClick={() => {
                          setEditingId(note.id)
                          setEditingReason(note.reason)
                        }}
                      >
                        <Pencil />
                      </button>
                      <button className="icon-btn danger" title="Eliminar nota" onClick={() => removeNote(note.id)}>
                        <Trash2 />
                      </button>
                    </span>
                  )}
                </div>
                {editingId === note.id ? (
                  <div className="note-edit">
                    <textarea value={editingReason} onChange={(event) => setEditingReason(event.target.value)} rows={2} />
                    <div className="note-edit-actions">
                      <button
                        className="icon-btn"
                        title="Cancelar"
                        onClick={() => {
                          setEditingId('')
                          setEditingReason('')
                        }}
                      >
                        <X />
                      </button>
                      <button className="icon-btn" title="Guardar" onClick={saveNote}>
                        <Check />
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p>{note.reason}</p>
                    {note.new_due_date && (
                      <small>
                        {formatDate(note.previous_due_date)} → {formatDate(note.new_due_date)}
                      </small>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {error && <div className="form-error">{error}</div>}
      </div>

      <div className="modal-foot">
        <Button variant="outline" onClick={close} disabled={saving}>
          Cancelar
        </Button>
        <Button onClick={onSave} disabled={saving}>
          <Check data-icon="inline-start" />
          {saving ? 'Guardando…' : 'Guardar nota'}
        </Button>
      </div>
    </Modal>
  )
}
