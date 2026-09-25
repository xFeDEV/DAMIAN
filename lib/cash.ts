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
  return /^saldo inicial/i.test(String(payment.notes || '').trim())
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
    if (isInitialPayment(payment)) continue
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
      amount: Number(loan.amount) || 0,
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
  const startDay = dayKey(settings?.cash_start_date) || asOfDay
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
