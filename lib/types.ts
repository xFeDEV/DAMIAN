import type { RecordModel } from 'pocketbase'

export type OperatorRole = 'admin' | 'cobrador'
export type LoanFrequency = 'diaria' | 'semanal' | 'quincenal' | 'mensual'
export type LoanStatus = 'pendiente' | 'activo' | 'en_mora' | 'finalizado'
export type InstallmentStatus = 'pendiente' | 'parcial' | 'vencida' | 'pagada'
export type PaymentMethod = 'efectivo' | 'transferencia' | 'nequi' | 'daviplata' | 'otro'

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
  start_at: string
  end_at: string
  paid_total: number
  status: LoanStatus | ''
  notes: string
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
  logo: string
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
  settings: Settings | null
  activity: ActivityItem[]
}
