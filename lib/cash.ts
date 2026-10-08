import type { CashMovement, Loan, Payment, Settings } from './types'
import { dayKey, todayKey } from './derive'

export type CashPool = 'efectivo' | 'digital'

export const CASH_CATEGORY_LABEL: Record<string, string> = {
  pago: 'Pago',
  desembolso: 'Desembolso',
  gasto: 'Gasto',
  retiro: 'Retiro',
  aporte: 'Aporte',
  ajuste: 'Ajuste',
  otro: 'Otro',
}

// Efectivo va a la caja; transferencia/nequi/daviplata/otro a la cuenta (digital).
export function methodPool(method?: string | null): CashPool {
  return method === 'efectivo' ? 'efectivo' : 'digital'
}

// Los pagos "Saldo inicial" son cuotas ya pagadas al cargar créditos: no son
// dinero recibido, por eso no entran en la caja.
export function isInitialPayment(payment: Payment) {
  if (payment.kind) return payment.kind === 'saldo_inicial'
  return /^saldo inicial/i.test(String(payment.notes || '').trim())
}

// Solo los pagos 'real' representan dinero realmente recibido. Los de apertura,
// volteo (refinanciacion) o ajuste son movimientos de cartera, no de caja.
export function isRealPayment(payment: Payment) {
  if (payment.kind) return payment.kind === 'real'
  return !isInitialPayment(payment)
}

// Efectivo realmente entregado por un crédito (en un volteo es capital - saldo
// refinanciado). Cae a `amount` si el campo no está.
export function loanDisbursed(loan: Loan) {
  const value = Number(loan.disbursement_amount)
  if (Number.isFinite(value) && value > 0) return value
  if (loan.disbursement_amount === 0) return 0
  return Number(loan.amount) || 0
}

export interface CashEntry {
  id: string
  date: string
  day: string
  kind: 'ingreso' | 'egreso'
  category: string
  method: string
  pool: CashPool
  amount: number
  description: string
  ref?: { type: 'payment' | 'loan'; id: string; code: string }
  link?: string
  movementId?: string
}

export function buildCashEntries(payments: Payment[], loans: Loan[], movements: CashMovement[]): CashEntry[] {
  const entries: CashEntry[] = []

  for (const payment of payments) {
    if (!isRealPayment(payment)) continue
    const day = dayKey(payment.paid_at)
    if (!day) continue
    entries.push({
      id: `pay-${payment.id}`,
      date: payment.paid_at,
      day,
      kind: 'ingreso',
      category: 'pago',
      method: payment.method || 'efectivo',
      pool: methodPool(payment.method),
      amount: Number(payment.amount) || 0,
      description: payment.reference || '',
      ref: { type: 'payment', id: payment.id, code: payment.code },
      link: `/prestamos/${payment.loan}`,
    })
  }

  for (const loan of loans) {
    const day = dayKey(loan.disbursed_at)
    if (!day) continue
    entries.push({
      id: `loan-${loan.id}`,
      date: loan.disbursed_at,
      day,
      kind: 'egreso',
      category: 'desembolso',
      method: loan.disbursement_method || 'efectivo',
      pool: methodPool(loan.disbursement_method),
      amount: loanDisbursed(loan),
      description: '',
      ref: { type: 'loan', id: loan.id, code: loan.code },
      link: `/prestamos/${loan.id}`,
    })
  }

  for (const movement of movements) {
    const day = dayKey(movement.date)
    if (!day) continue
    entries.push({
      id: `mov-${movement.id}`,
      date: movement.date,
      day,
      kind: movement.type === 'ingreso' ? 'ingreso' : 'egreso',
      category: movement.category || 'otro',
      method: movement.method || 'efectivo',
      pool: methodPool(movement.method),
      amount: Number(movement.amount) || 0,
      description: movement.description || '',
      movementId: movement.id,
    })
  }

  return entries
}

export interface CashSummary {
  cash: number
  digital: number
  total: number
  income: { cash: number; digital: number }
  expense: { cash: number; digital: number }
}

export function cashSummary(entries: CashEntry[], settings: Settings | null, asOfDay = todayKey()): CashSummary {
  // Sin fecha de inicio explicita, arranca desde el primer movimiento (no desde
  // hoy) para no ignorar el historial.
  const explicitStart = dayKey(settings?.cash_start_date)
  const earliest = entries.length > 0 ? entries.reduce((min, entry) => (entry.day < min ? entry.day : min), entries[0].day) : ''
  const startDay = explicitStart || earliest || asOfDay
  let cash = Number(settings?.cash_initial_cash) || 0
  let digital = Number(settings?.cash_initial_digital) || 0
  const income = { cash: 0, digital: 0 }
  const expense = { cash: 0, digital: 0 }

  for (const entry of entries) {
    if (entry.day < startDay || entry.day > asOfDay) continue
    const bucket = entry.pool === 'efectivo' ? 'cash' : 'digital'
    if (entry.kind === 'ingreso') {
      if (bucket === 'cash') {
        cash += entry.amount
        income.cash += entry.amount
      } else {
        digital += entry.amount
        income.digital += entry.amount
      }
    } else {
      if (bucket === 'cash') {
        cash -= entry.amount
        expense.cash += entry.amount
      } else {
        digital -= entry.amount
        expense.digital += entry.amount
      }
    }
  }

  return { cash, digital, total: cash + digital, income, expense }
}

export interface RangeDaily {
  day: string
  cobrado: number
  prestado: number
}

export interface RangeSummary {
  cobrado: number
  prestado: number
  neto: number
  paymentCount: number
  loanCount: number
  clientsServed: number
  cobradoPool: { efectivo: number; digital: number }
  prestadoPool: { efectivo: number; digital: number }
  daily: RangeDaily[]
  payments: Payment[]
  loans: Loan[]
}

// Resumen de un rango de fechas (solo dia calendario): cuanto se cobro (pagos de
// clientes, sin "Saldo inicial") y cuanto se presto (capital desembolsado).
export function rangeSummary(payments: Payment[], loans: Loan[], fromKey: string, toKey: string): RangeSummary {
  const inRange = (day: string) => day !== '' && day >= fromKey && day <= toKey
  const filteredPayments = payments
    .filter((payment) => isRealPayment(payment) && inRange(dayKey(payment.paid_at)))
    .sort((a, b) => dayKey(b.paid_at).localeCompare(dayKey(a.paid_at)))
  const filteredLoans = loans
    .filter((loan) => inRange(dayKey(loan.disbursed_at)))
    .sort((a, b) => dayKey(b.disbursed_at).localeCompare(dayKey(a.disbursed_at)))

  const cobradoPool = { efectivo: 0, digital: 0 }
  const prestadoPool = { efectivo: 0, digital: 0 }
  const days = new Map<string, RangeDaily>()
  const dayOf = (day: string) => {
    let item = days.get(day)
    if (!item) {
      item = { day, cobrado: 0, prestado: 0 }
      days.set(day, item)
    }
    return item
  }

  let cobrado = 0
  for (const payment of filteredPayments) {
    const amount = Number(payment.amount) || 0
    cobrado += amount
    cobradoPool[methodPool(payment.method)] += amount
    dayOf(dayKey(payment.paid_at)).cobrado += amount
  }

  let prestado = 0
  for (const loan of filteredLoans) {
    const amount = loanDisbursed(loan)
    prestado += amount
    prestadoPool[methodPool(loan.disbursement_method)] += amount
    dayOf(dayKey(loan.disbursed_at)).prestado += amount
  }

  return {
    cobrado,
    prestado,
    neto: cobrado - prestado,
    paymentCount: filteredPayments.length,
    loanCount: filteredLoans.length,
    clientsServed: new Set(filteredPayments.map((payment) => payment.client)).size,
    cobradoPool,
    prestadoPool,
    daily: [...days.values()].sort((a, b) => a.day.localeCompare(b.day)),
    payments: filteredPayments,
    loans: filteredLoans,
  }
}
