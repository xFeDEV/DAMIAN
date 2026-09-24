import type { Installment, InstallmentStatus, Loan, LoanStatus, Payment } from './types'
import { parseWallClock } from './format'

export type Tone = 'good' | 'warn' | 'bad' | 'muted'

export const LOAN_STATUS_LABEL: Record<string, string> = {
  pendiente: 'Pendiente',
  activo: 'Activo',
  en_mora: 'En mora',
  finalizado: 'Finalizado',
}

export const INSTALLMENT_STATUS_LABEL: Record<string, string> = {
  pendiente: 'Pendiente',
  parcial: 'Parcial',
  vencida: 'En mora',
  pagada: 'Pagada',
}

export const FREQUENCY_LABEL: Record<string, string> = {
  diaria: 'Diaria',
  semanal: 'Semanal',
  quincenal: 'Quincenal',
  mensual: 'Mensual',
}

export const FREQUENCY_DAYS: Record<string, number> = {
  diaria: 1,
  semanal: 7,
  quincenal: 15,
  mensual: 30,
}

export const METHOD_LABEL: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  nequi: 'Nequi',
  daviplata: 'Daviplata',
  otro: 'Otro',
}

export const PAYMENT_METHODS = ['efectivo', 'transferencia', 'nequi', 'daviplata', 'otro'] as const
export const FREQUENCIES = ['diaria', 'semanal', 'quincenal', 'mensual'] as const

export const ACTIVITY_LABEL: Record<string, string> = {
  'payment.created': 'Pago registrado',
  'payment.updated': 'Pago actualizado',
  'payment.deleted': 'Pago eliminado',
  'loan.deleted': 'Crédito eliminado',
  'client.deleted': 'Cliente eliminado',
}

export function badgeTone(status: string): Tone {
  if (['Al día', 'Pagada', 'Activo'].includes(status)) return 'good'
  if (['Pendiente', 'Parcial', 'Próxima', 'Pendiente'].includes(status)) return 'warn'
  if (['Finalizado', 'Finalizada'].includes(status)) return 'muted'
  return 'bad'
}

export function activityTone(action: string): string {
  if (action === 'payment.created') return 'green'
  if (action === 'payment.updated') return 'blue'
  if (action === 'payment.deleted' || action === 'loan.deleted' || action === 'client.deleted') return 'red'
  return 'purple'
}

export function loanLabel(loan: Loan) {
  return LOAN_STATUS_LABEL[loan.status] || 'Activo'
}

export function loanPending(loan: Loan) {
  return Number(loan.balance) || 0
}

export function loanProgress(loan: Loan) {
  const total = Number(loan.total) || 0
  if (total <= 0) return 0
  return Math.max(0, Math.min(1, (Number(loan.paid_total) || 0) / total))
}

export function clientStatus(loans: Loan[], installments: Installment[], reference = new Date()) {
  if (loans.length === 0) return 'Sin préstamos'
  return overdueInstallments(installments, reference).length > 0 ? 'En mora' : 'Al día'
}

export interface ClientStats {
  activeLoans: number
  balance: number
  paid: number
  overdue: number
  next: string
  status: string
  totalLoans: number
}

export function clientStats(loans: Loan[], installments: Installment[], reference = new Date()): ClientStats {
  const active = loans.filter((loan) => loan.status !== 'finalizado')
  const pendingInstallments = installments
    .filter((item) => installmentOutstanding(item) > 0)
    .sort((a, b) => new Date(a.due_date.replace(' ', 'T')).getTime() - new Date(b.due_date.replace(' ', 'T')).getTime())

  return {
    activeLoans: active.length,
    balance: active.reduce((sum, loan) => sum + (Number(loan.balance) || 0), 0),
    paid: loans.reduce((sum, loan) => sum + (Number(loan.paid_total) || 0), 0),
    overdue: overdueInstallments(installments, reference).length,
    next: pendingInstallments[0]?.due_date || '',
    status: clientStatus(loans, installments, reference),
    totalLoans: loans.length,
  }
}

export function loanSummary(loan: Loan) {
  return {
    label: loanLabel(loan),
    pending: loanPending(loan),
    progress: loanProgress(loan),
    installment: Number(loan.installment_amount) || 0,
    frequency: FREQUENCY_LABEL[loan.frequency] || '—',
  }
}

export function paymentLabel(payment: Payment) {
  return METHOD_LABEL[payment.method] || '—'
}

export function sumPayments(payments: Payment[]) {
  return payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0)
}

export function isSameMonth(iso: string, reference = new Date()) {
  const date = parseWallClock(iso)
  if (!date) return false
  return date.getFullYear() === reference.getFullYear() && date.getMonth() === reference.getMonth()
}

export function isSameDay(iso: string, reference = new Date()) {
  const date = parseWallClock(iso)
  if (!date) return false
  return (
    date.getFullYear() === reference.getFullYear() &&
    date.getMonth() === reference.getMonth() &&
    date.getDate() === reference.getDate()
  )
}

/* ------------------------- Mora (por fecha) ------------------------- */

// Una cuota está en mora cuando su fecha de vencimiento (día calendario) ya
// pasó y todavía tiene saldo. Regla única para toda la app.
function dayKeyFromDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function dayKey(iso?: string | null) {
  const date = parseWallClock(iso)
  return date ? dayKeyFromDate(date) : ''
}

export function todayKey(reference = new Date()) {
  return dayKeyFromDate(reference)
}

export function installmentOutstanding(item: Installment) {
  return Math.max(0, (Number(item.amount) || 0) - (Number(item.paid) || 0))
}

export function isOverdue(item: Installment, reference = new Date()) {
  if (installmentOutstanding(item) <= 0) return false
  const key = dayKey(item.due_date)
  return key !== '' && key < todayKey(reference)
}

export function daysLate(item: Installment, reference = new Date()) {
  const due = parseWallClock(item.due_date)
  if (!due) return 0
  const from = new Date(due.getFullYear(), due.getMonth(), due.getDate())
  const to = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate())
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 86_400_000))
}

export function overdueInstallments(installments: Installment[], reference = new Date()) {
  return installments.filter((item) => isOverdue(item, reference))
}

export function moraTotal(installments: Installment[], reference = new Date()) {
  return overdueInstallments(installments, reference).reduce((sum, item) => sum + installmentOutstanding(item), 0)
}

export function loanHasMora(loanId: string, installments: Installment[], reference = new Date()) {
  return installments.some((item) => item.loan === loanId && isOverdue(item, reference))
}

export function effectiveInstallmentStatus(item: Installment, reference = new Date()): InstallmentStatus {
  if (installmentOutstanding(item) <= 0) return 'pagada'
  if (isOverdue(item, reference)) return 'vencida'
  if ((Number(item.paid) || 0) > 0) return 'parcial'
  return 'pendiente'
}

export function effectiveLoanStatus(loan: Loan, installments: Installment[], reference = new Date()): LoanStatus {
  if ((Number(loan.balance) || 0) <= 0) return 'finalizado'
  return loanHasMora(loan.id, installments, reference) ? 'en_mora' : 'activo'
}
