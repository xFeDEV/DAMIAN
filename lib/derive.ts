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

/* ----------------------- Calendario (sin domingos) ----------------------- */

// Los domingos no hay cobro: ninguna cuota puede vencer en domingo.
export function isSunday(date: Date) {
  return date.getDay() === 0
}

export function addBusinessDays(base: Date, delta: number) {
  const date = new Date(base)
  const step = delta >= 0 ? 1 : -1
  let remaining = Math.abs(delta)
  while (remaining > 0) {
    date.setDate(date.getDate() + step)
    if (date.getDay() !== 0) remaining -= 1
  }
  return date
}

export function snapBusinessDay(base: Date) {
  const date = new Date(base)
  if (date.getDay() === 0) date.setDate(date.getDate() + 1)
  return date
}

// Genera el calendario de cuotas lunes-sabado. `anchor` es la fecha de la cuota
// #(anchorIndex + 1) (la proxima a pagar). En "diaria" se avanza dia habil por
// dia habil (saltando domingos, manteniendo el numero de cuotas y corriendo el
// fin); en el resto de frecuencias se corre cualquier domingo al lunes.
export function buildSchedule({
  anchor,
  anchorIndex,
  count,
  frequency,
}: {
  anchor: Date
  anchorIndex: number
  count: number
  frequency: string
}) {
  if (count <= 0) return [] as Date[]
  const days = FREQUENCY_DAYS[frequency] ?? 1

  if (frequency === 'diaria') {
    let first = new Date(anchor)
    for (let i = 0; i < anchorIndex; i += 1) first = addBusinessDays(first, -1)
    const dates: Date[] = []
    let cursor = first
    for (let i = 0; i < count; i += 1) {
      dates.push(new Date(cursor))
      cursor = addBusinessDays(cursor, 1)
    }
    return dates
  }

  const base = snapBusinessDay(anchor)
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(base)
    date.setDate(date.getDate() + (index - anchorIndex) * days)
    return snapBusinessDay(date)
  })
}

// Reparte el total entre las cuotas de modo que la ultima absorba el residuo
// del redondeo (evita que el credito nunca llegue a saldo 0).
export function installmentAmounts(total: number, count: number, base: number) {
  if (count <= 0) return { base, rows: [] as number[] }
  const nominal = base > 0 ? base : Math.round(total / count)
  const rows = Array.from({ length: count }, (_, index) => (index === count - 1 ? total - nominal * (count - 1) : nominal))
  return { base: nominal, rows }
}

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

export interface InstallmentCoverage {
  payment: Payment
  amount: number
}

// Reparte los pagos en cascada (por número de cuota, como lo hace el hook del
// backend) y devuelve qué pago(s) cubren cada cuota. Esto permite ver el pago
// real de una cuota incluso cuando un pago cubre varias cuotas.
export function paymentCoverageByInstallment(installments: Installment[], payments: Payment[]) {
  const ordered = [...installments].sort((a, b) => a.number - b.number)
  const orderedPayments = [...payments].sort((a, b) => {
    const byDate = String(a.paid_at || '').localeCompare(String(b.paid_at || ''))
    return byDate !== 0 ? byDate : String(a.created || '').localeCompare(String(b.created || ''))
  })

  const remaining = new Map(ordered.map((item) => [item.id, Number(item.amount) || 0]))
  const coverage = new Map<string, InstallmentCoverage[]>()

  for (const payment of orderedPayments) {
    let left = Number(payment.amount) || 0
    if (left <= 0) continue
    for (const item of ordered) {
      if (left <= 0) break
      const rest = remaining.get(item.id) || 0
      if (rest <= 0) continue
      const applied = Math.min(rest, left)
      remaining.set(item.id, rest - applied)
      left -= applied
      const list = coverage.get(item.id) ?? []
      list.push({ payment, amount: applied })
      coverage.set(item.id, list)
    }
  }

  return coverage
}
