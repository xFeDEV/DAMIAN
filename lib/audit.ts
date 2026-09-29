export const AUDIT_ACTION_LABEL: Record<string, string> = {
  create: 'Creó',
  update: 'Actualizó',
  delete: 'Eliminó',
}

export const AUDIT_COLLECTION_LABEL: Record<string, string> = {
  loans: 'el crédito',
  installments: 'una cuota',
  payments: 'un pago',
  cash_movements: 'un movimiento de caja',
  installment_notes: 'una nota de no pago',
  clients: 'un cliente',
  settings: 'la configuración',
}

export const AUDIT_FIELD_LABEL: Record<string, string> = {
  code: 'Código',
  client: 'Cliente',
  amount: 'Monto',
  total: 'Total a pagar',
  interest_rate: 'Interés %',
  installments_count: 'Nº de cuotas',
  installment_amount: 'Valor de cuota',
  frequency: 'Frecuencia',
  disbursed_at: 'Fecha de desembolso',
  disbursement_method: 'Método de desembolso',
  start_at: 'Inicio',
  end_at: 'Fin',
  status: 'Estado',
  balance: 'Saldo',
  paid_total: 'Total pagado',
  notes: 'Notas',
  due_date: 'Fecha de vencimiento',
  paid: 'Pagado',
  method: 'Método',
  reference: 'Referencia',
  receipt: 'Comprobante',
  date: 'Fecha',
  type: 'Tipo',
  category: 'Categoría',
  description: 'Descripción',
  reason: 'Justificación',
  new_due_date: 'Nueva fecha',
  previous_due_date: 'Fecha anterior',
  name: 'Nombre',
  doc: 'Documento',
  phone: 'Teléfono',
  whatsapp: 'WhatsApp',
  address: 'Dirección',
  city: 'Ciudad',
  active: 'Activo',
  business_name: 'Nombre del negocio',
  collection_message: 'Mensaje de cobro',
  cash_start_date: 'Inicio de caja',
  cash_initial_cash: 'Saldo inicial efectivo',
  cash_initial_digital: 'Saldo inicial digital',
  motivo_no_pago: 'Motivo de no pago',
}

export const CASH_SETTING_FIELDS = ['cash_start_date', 'cash_initial_cash', 'cash_initial_digital']

const MONEY_FIELDS = new Set([
  'amount',
  'total',
  'balance',
  'paid_total',
  'installment_amount',
  'paid',
  'cash_initial_cash',
  'cash_initial_digital',
])

export function isMoneyField(field: string) {
  return MONEY_FIELDS.has(field)
}

export function auditFieldLabel(field: string) {
  return AUDIT_FIELD_LABEL[field] || field
}
