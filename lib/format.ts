export function money(value: number | null | undefined, currency = 'COP') {
  const amount = Number(value) || 0
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function compactMoney(value: number) {
  const n = Math.abs(Number(value) || 0)
  const sign = (Number(value) || 0) < 0 ? '-' : ''
  if (n >= 1_000_000) return `${sign}$${(n / 1_000_000).toFixed(1).replace('.0', '')}M`
  if (n >= 1_000) return `${sign}$${Math.round(n / 1_000)}K`
  return `${sign}$${n}`
}

function parseDate(iso?: string | null) {
  if (!iso) return null
  const date = new Date(String(iso).replace(' ', 'T'))
  return Number.isNaN(date.getTime()) ? null : date
}

// Calendar dates are stored converted to UTC (e.g. "2026-09-15 05:00:00.000Z").
// Parse them as the wall-clock value they hold so the displayed day never shifts
// with the browser timezone.
export function parseWallClock(iso?: string | null) {
  if (!iso) return null
  let naive = String(iso)
    .trim()
    .replace(/([zZ]|[+-]\d{2}:?\d{2})$/, '')
    .replace(' ', 'T')
  // A date-only value ("2026-09-19") must be read as a local calendar day,
  // not as UTC midnight (which would shift the day in negative offsets).
  if (/^\d{4}-\d{2}-\d{2}$/.test(naive)) naive += 'T00:00:00'
  const date = new Date(naive)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatDate(iso?: string | null) {
  const date = parseWallClock(iso)
  if (!date) return '—'
  return date.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// For real timestamps (records' created/updated), shown in the local timezone.
export function formatTimestampDate(iso?: string | null) {
  const date = parseDate(iso)
  if (!date) return '—'
  return date.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatLongDate(iso?: string | null) {
  const date = parseDate(iso)
  if (!date) return '—'
  return date.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
}

export function formatDateTime(iso?: string | null) {
  const date = parseDate(iso)
  if (!date) return '—'
  return `${date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })} · ${date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`
}

export function relativeTime(iso?: string | null) {
  const date = parseDate(iso)
  if (!date) return '—'
  const diff = Date.now() - date.getTime()
  const minutes = Math.round(diff / 60000)
  if (minutes < 1) return 'Ahora'
  if (minutes < 60) return `Hace ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `Hace ${hours} h`
  const days = Math.round(hours / 24)
  if (days < 30) return `Hace ${days} d`
  return formatTimestampDate(iso)
}

export function toInputDate(iso?: string | null) {
  const date = parseWallClock(iso) ?? new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function isoFromInputDate(value: string) {
  if (!value) return ''
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().replace('T', ' ')
}

export function initials(name?: string) {
  if (!name) return '—'
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase())
    .slice(0, 2)
    .join('')
}

export function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function daysBetween(from?: string | null, to = new Date()) {
  const date = parseDate(from)
  if (!date) return 0
  return Math.max(0, Math.floor((to.getTime() - date.getTime()) / 86_400_000))
}

export function isPast(iso?: string | null) {
  const date = parseDate(iso)
  return !!date && date.getTime() < Date.now()
}

export const DEFAULT_COLLECTION_MESSAGE =
  'Hola {nombre}, le escribimos de {negocio}. Tiene {cuotas} cuota(s) en mora por {monto} del crédito {credito}. Por favor comuníquese para ponerse al día. ¡Gracias!'

// Normaliza teléfonos de Colombia a formato internacional (57 + 10 dígitos).
export function normalizePhoneCO(raw?: string | null) {
  const digits = String(raw ?? '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('57') && digits.length >= 12) return digits
  if (digits.length === 10) return `57${digits}`
  return digits
}

export function whatsappUrl(number?: string | null, message?: string) {
  const digits = normalizePhoneCO(number)
  if (!digits) return ''
  const base = `https://wa.me/${digits}`
  return message ? `${base}?text=${encodeURIComponent(message)}` : base
}

export function buildCollectionMessage(template: string | undefined | null, vars: Record<string, string | number>) {
  const source = (template && template.trim()) || DEFAULT_COLLECTION_MESSAGE
  return source.replace(/\{(\w+)\}/g, (match, key) => {
    const value = vars[key]
    return value === undefined || value === null ? match : String(value)
  })
}

export function downloadCSV(filename: string, rows: (string | number)[][]) {
  const content = rows
    .map((row) =>
      row
        .map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`)
        .join(','),
    )
    .join('\n')
  const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function parseAmount(value: string) {
  const digits = String(value).replace(/[^\d]/g, '')
  return digits ? Number(digits) : 0
}

export function formatAmountInput(value: number) {
  if (!value) return ''
  return new Intl.NumberFormat('es-CO').format(value)
}
