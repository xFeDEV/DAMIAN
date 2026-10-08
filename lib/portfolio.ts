import type { Installment, Loan, Payment } from './types'
import { dayKey, daysLate } from './derive'
import { addDaysKey } from './week'

export interface PortfolioDayLoan {
  loan: Loan
  balance: number
  mora: boolean
  late: number
}

export interface PortfolioDay {
  day: string
  opening: number
  disbursed: number
  disbursedCapital: number
  utility: number
  recovered: number
  refinanced: number
  adjusted: number
  initialDeposits: number
  totalPayments: number
  closing: number
  loansDisbursed: Loan[]
  paymentsInDay: Payment[]
  portfolioLoans: PortfolioDayLoan[]
}

function loanOpening(loan: Loan) {
  return Number(loan.opening_balance) || Number(loan.total) || 0
}

function loanInCartera(loan: Loan, day: string) {
  const disbursed = dayKey(loan.disbursed_at)
  if (!disbursed || disbursed > day) return false
  if (loan.status === 'cancelado') {
    const cancelled = dayKey(loan.cancelled_at)
    if (cancelled && cancelled <= day) return false
  }
  return true
}

function paidUpTo(payments: Payment[], loanId: string, day: string) {
  return payments
    .filter((payment) => payment.loan === loanId && dayKey(payment.paid_at) && dayKey(payment.paid_at) <= day)
    .reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0)
}

function carteraValue(loans: Loan[], payments: Payment[], day: string) {
  let total = 0
  for (const loan of loans) {
    if (!loanInCartera(loan, day)) continue
    total += Math.max(0, loanOpening(loan) - paidUpTo(payments, loan.id, day))
  }
  return total
}

// Estado de mora de un credito "a una fecha": reparte los pagos hasta esa fecha
// en cascada por numero de cuota y marca mora si alguna cuota ya vencida (a esa
// fecha) quedo sin cubrir.
function moraAt(loan: Loan, installments: Installment[], payments: Payment[], day: string) {
  const rows = installments.filter((item) => item.loan === loan.id).sort((a, b) => a.number - b.number)
  let remaining = paidUpTo(payments, loan.id, day)
  let mora = false
  let late = 0
  const reference = new Date(`${day}T12:00:00`)
  for (const item of rows) {
    const amount = Number(item.amount) || 0
    const applied = Math.max(0, Math.min(amount, remaining))
    remaining -= applied
    if (applied >= amount) continue
    const due = dayKey(item.due_date)
    if (due && due < day) {
      mora = true
      late = Math.max(late, daysLate(item, reference))
    }
  }
  return { mora, late }
}

export function portfolioAtDay(
  loans: Loan[],
  payments: Payment[],
  installments: Installment[],
  day: string,
): PortfolioDay {
  const dayBefore = addDaysKey(day, -1)
  const opening = carteraValue(loans, payments, dayBefore)
  const closing = carteraValue(loans, payments, day)

  const loansDisbursed = loans.filter((loan) => dayKey(loan.disbursed_at) === day)
  const paymentsInDay = payments.filter((payment) => dayKey(payment.paid_at) === day)

  const disbursed = loansDisbursed.reduce((sum, loan) => sum + loanOpening(loan), 0)
  const disbursedCapital = loansDisbursed.reduce((sum, loan) => sum + (Number(loan.amount) || 0), 0)
  const recovered = paymentsInDay
    .filter((payment) => (payment.kind || 'real') === 'real')
    .reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0)
  const refinanced = paymentsInDay
    .filter((payment) => payment.kind === 'refinanciacion')
    .reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0)
  const adjusted = paymentsInDay
    .filter((payment) => payment.kind === 'ajuste')
    .reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0)
  const initialDeposits = paymentsInDay
    .filter((payment) => payment.kind === 'saldo_inicial')
    .reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0)
  const totalPayments = paymentsInDay.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0)

  const portfolioLoans: PortfolioDayLoan[] = []
  for (const loan of loans) {
    if (!loanInCartera(loan, day)) continue
    const balance = Math.max(0, loanOpening(loan) - paidUpTo(payments, loan.id, day))
    if (balance <= 0) continue
    const { mora, late } = moraAt(loan, installments, payments, day)
    portfolioLoans.push({ loan, balance, mora, late })
  }
  portfolioLoans.sort((a, b) => b.balance - a.balance)

  return {
    day,
    opening,
    disbursed,
    disbursedCapital,
    utility: disbursed - disbursedCapital,
    recovered,
    refinanced,
    adjusted,
    initialDeposits,
    totalPayments,
    closing,
    loansDisbursed,
    paymentsInDay: paymentsInDay.sort((a, b) => String(b.paid_at).localeCompare(String(a.paid_at))),
    portfolioLoans,
  }
}
