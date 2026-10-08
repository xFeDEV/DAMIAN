import type { RecordModel } from 'pocketbase'

export type OperatorRole = 'admin' | 'cobrador'
export type LoanFrequency = 'diaria' | 'semanal' | 'quincenal' | 'mensual'
export type LoanStatus = 'pendiente' | 'activo' | 'en_mora' | 'finalizado' | 'cancelado'
export type LoanOrigin = 'nuevo' | 'volteo' | 'correccion'
export type InstallmentStatus = 'pendiente' | 'parcial' | 'vencida' | 'pagada'
export type PaymentMethod = 'efectivo' | 'transferencia' | 'nequi' | 'daviplata' | 'otro'
export type PaymentKind = 'real' | 'saldo_inicial' | 'refinanciacion' | 'ajuste'

export interface Operator extends RecordModel {
  email: string
  name: string
  role: OperatorRole
  phone: string
  active: boolean
}

export interface Client extends RecordModel {
  code: string
  name: string
  doc: string
  phone: string
  whatsapp: string
  address: string
  city: string
  notes: string
  active: boolean
}

export interface Loan extends RecordModel {
  code: string
  client: string
  amount: number
  opening_balance: number
  balance: number
  total: number
  interest_rate: number
  installments_count: number
  installment_amount: number
  frequency: LoanFrequency | ''
  disbursed_at: string
  disbursement_method: PaymentMethod | ''
  start_at: string
  end_at: string
  paid_total: number
  base_paid: number
  status: LoanStatus | ''
  created_by: string
  updated_by: string
  notes: string
  disbursement_amount: number
  origin: LoanOrigin | ''
  refinanced_from: string
  refinanced_amount: number
  cancel_reason: string
  cancelled_at: string
}

export interface Installment extends RecordModel {
  loan: string
  client: string
  number: number
  due_date: string
  amount: number
  paid: number
  status: InstallmentStatus | ''
}

export interface Payment extends RecordModel {
  code: string
  loan: string
  client: string
  installment: string
  amount: number
  paid_at: string
  method: PaymentMethod | ''
  reference: string
  notes: string
  created_by: string
  receipt: string
  kind: PaymentKind | ''
}

export interface Settings extends RecordModel {
  business_name: string
  phone: string
  address: string
  city: string
  currency: string
  allow_partial_payments: boolean
  due_reminders: boolean
  grace_days: number
  collection_message: string
  cash_start_date: string
  cash_initial_cash: number
  cash_initial_digital: number
  logo: string
}

export type CashMovementType = 'ingreso' | 'egreso'
export type CashCategory = 'gasto' | 'retiro' | 'aporte' | 'ajuste' | 'otro'

export interface CashMovement extends RecordModel {
  date: string
  type: CashMovementType | ''
  category: CashCategory | ''
  method: PaymentMethod | ''
  amount: number
  description: string
  created_by: string
}

export interface InstallmentNote extends RecordModel {
  loan: string
  installment: string
  client: string
  reason: string
  previous_due_date: string
  new_due_date: string
  created_by: string
}

export interface AuditChange {
  antes: unknown
  despues: unknown
}

export interface AuditEntry extends RecordModel {
  collection: string
  record: string
  loan: string
  client: string
  action: 'create' | 'update' | 'delete' | ''
  user: string
  user_name: string
  changes: Record<string, AuditChange>
}

export interface ActivityItem extends RecordModel {
  client: string
  loan: string
  user: string
  action: string
  detail: string
}

export interface DataSnapshot {
  clients: Client[]
  loans: Loan[]
  installments: Installment[]
  payments: Payment[]
  cashMovements: CashMovement[]
  installmentNotes: InstallmentNote[]
  auditLog: AuditEntry[]
  operators: Operator[]
  settings: Settings | null
  activity: ActivityItem[]
}
