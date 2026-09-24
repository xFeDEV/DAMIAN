'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, FileText, Upload, X } from 'lucide-react'
import { Avatar, Badge, Field, Modal, MoneyInput } from '@/components/ui/kit'
import { Button } from '@/components/ui/button'
import { useData, useToast, useLookups, useToday } from '@/components/providers'
import {
  effectiveInstallmentStatus,
  effectiveLoanStatus,
  INSTALLMENT_STATUS_LABEL,
  installmentOutstanding,
  isOverdue,
  LOAN_STATUS_LABEL,
  METHOD_LABEL,
  PAYMENT_METHODS,
} from '@/lib/derive'
import { formatDate, isoFromInputDate, money, parseAmount, toInputDate } from '@/lib/format'
import { compressImage, formatFileSize, isAcceptedReceipt, MAX_RECEIPT_BYTES } from '@/lib/upload'
import type { Installment, PaymentMethod } from '@/lib/types'

function coverageOf(rows: Installment[], value: number) {
  let remaining = value
  let full = 0
  let first = 0
  let last = 0
  let partial = false
  for (const item of rows) {
    if (remaining <= 0) break
    const amountValue = Number(item.amount) || 0
    if (!first) first = item.number
    if (amountValue > 0 && remaining >= amountValue) {
      full += 1
      last = item.number
      remaining -= amountValue
    } else {
      last = item.number
      partial = amountValue > 0
      break
    }
  }
  return { full, first, last, partial }
}

export function PaymentModal({
  loanId,
  uptoInstallmentNumber,
  close,
  onDone,
}: {
  loanId: string
  uptoInstallmentNumber?: number
  close: () => void
  onDone?: () => void
}) {
  const { installments, registerPayment } = useData()
  const { loanById, clientById } = useLookups()
  const notify = useToast()
  const today = useToday()

  const loan = loanById.get(loanId)
  const client = loan ? clientById.get(loan.client) : undefined

  const pendingInstallments = useMemo(
    () =>
      installments
        .filter((item) => item.loan === loanId && installmentOutstanding(item) > 0)
        .sort((a, b) => a.number - b.number),
    [installments, loanId],
  )

  const target = pendingInstallments[0]
  const pending = Number(loan?.balance ?? 0) || 0

  const initialAmount = (() => {
    if (uptoInstallmentNumber) {
      const upto = pendingInstallments.filter((item) => item.number <= uptoInstallmentNumber)
      if (upto.length > 0) return upto.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
    }
    return Number(target?.amount ?? pending ?? 0)
  })()

  const [amount, setAmount] = useState(String(initialAmount))
  const [cuotasInput, setCuotasInput] = useState(String(pendingInstallments.filter((item) => item.number <= (uptoInstallmentNumber || 0)).length || 1))
  const [paidAt, setPaidAt] = useState(toInputDate())
  const [method, setMethod] = useState<PaymentMethod>('efectivo')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [receipt, setReceipt] = useState<File | null>(null)
  const [receiptPreview, setReceiptPreview] = useState('')
  const [receiptError, setReceiptError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return () => {
      if (receiptPreview) URL.revokeObjectURL(receiptPreview)
    }
  }, [receiptPreview])

  const coverage = coverageOf(pendingInstallments, parseAmount(amount))

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

  function applyCuotas(value: string) {
    const count = Math.max(0, Math.min(Number(value) || 0, pendingInstallments.length))
    setCuotasInput(value)
    const sum = pendingInstallments.slice(0, count).reduce((total, item) => total + (Number(item.amount) || 0), 0)
    setAmount(String(pending > 0 ? Math.min(sum, pending) : sum))
  }

  function applyOverdue() {
    const overdue = pendingInstallments.filter((item) => isOverdue(item, today))
    if (overdue.length === 0) return
    setCuotasInput(String(overdue.length))
    const sum = overdue.reduce((total, item) => total + installmentOutstanding(item), 0)
    setAmount(String(pending > 0 ? Math.min(sum, pending) : sum))
  }

  async function handleFile(file: File | undefined | null) {
    if (!file) return
    setReceiptError('')
    if (!isAcceptedReceipt(file)) {
      setReceiptError('Formato no permitido. Usa una imagen (JPG, PNG, WebP) o un PDF.')
      return
    }
    const next = file.type.startsWith('image/') ? await compressImage(file) : file
    if (next.size > MAX_RECEIPT_BYTES) {
      setReceiptError(`El archivo supera 5 MB (${formatFileSize(next.size)}).`)
      return
    }
    if (receiptPreview) URL.revokeObjectURL(receiptPreview)
    setReceipt(next)
    setReceiptPreview(next.type.startsWith('image/') ? URL.createObjectURL(next) : '')
  }

  function clearReceipt() {
    if (receiptPreview) URL.revokeObjectURL(receiptPreview)
    setReceipt(null)
    setReceiptPreview('')
    setReceiptError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
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
        paid_at: isoFromInputDate(paidAt),
        method,
        reference,
        notes,
        receipt: receipt ?? undefined,
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
        <Badge
          status={
            target
              ? INSTALLMENT_STATUS_LABEL[effectiveInstallmentStatus(target, today)]
              : LOAN_STATUS_LABEL[effectiveLoanStatus(loan, installments, today)]
          }
        />
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
          <MoneyInput value={amount} onChange={setAmount} />
        </Field>

        <Field label="Cuotas a pagar">
          <input value={cuotasInput} onChange={(event) => applyCuotas(event.target.value)} inputMode="numeric" />
        </Field>
        <div className="pills" style={{ marginBottom: 16 }}>
          <button type="button" onClick={() => applyCuotas('1')}>
           1 cuota
          </button>
          <button type="button" onClick={applyOverdue}>
            Vencidas
          </button>
          <button type="button" onClick={() => applyCuotas(String(pendingInstallments.length))}>
            Todas ({pendingInstallments.length})
          </button>
        </div>

        <div className="due-box" style={{ margin: '0 0 16px' }}>
          <div>
            <span>Cubre</span>
            <b>
              {coverage.full > 0
                ? `${coverage.full} cuota(s)${coverage.first !== coverage.last ? ` (#${coverage.first}–#${coverage.last})` : ` (#${coverage.first})`}`
                : 'Ninguna cuota completa'}
            </b>
          </div>
          <div>
            <span>Saldo después</span>
            <b>{money(Math.max(0, pending - parseAmount(amount)))}</b>
          </div>
        </div>
        {coverage.partial && (
          <p className="center-note">El valor cubre las cuotas completas hasta la #{coverage.last} y deja un abono parcial en esa cuota.</p>
        )}

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

        <div className="field">
          <span>Comprobante (opcional)</span>
          <div
            className={`receipt-drop${receipt ? ' has-file' : ''}`}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault()
              handleFile(event.dataTransfer.files?.[0])
            }}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') fileInputRef.current?.click()
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              hidden
              onChange={(event) => handleFile(event.target.files?.[0])}
            />
            {receipt ? (
              <div className="receipt-preview">
                {receiptPreview ? (
                  <img src={receiptPreview} alt="Comprobante" />
                ) : (
                  <span className="receipt-file-icon">
                    <FileText />
                  </span>
                )}
                <div>
                  <b>{receipt.name}</b>
                  <small>{formatFileSize(receipt.size)}</small>
                </div>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Quitar comprobante"
                  onClick={(event) => {
                    event.stopPropagation()
                    clearReceipt()
                  }}
                >
                  <X />
                </button>
              </div>
            ) : (
              <div className="receipt-empty">
                <Upload />
                <div>
                  <b>Adjuntar comprobante</b>
                  <small>Imagen (JPG, PNG, WebP) o PDF · hasta 5 MB</small>
                </div>
              </div>
            )}
          </div>
          {method !== 'efectivo' && !receipt && !receiptError && (
            <small className="receipt-hint">Adjunta el comprobante de la {METHOD_LABEL[method].toLowerCase()}.</small>
          )}
          {receiptError && <div className="form-error">{receiptError}</div>}
        </div>

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
