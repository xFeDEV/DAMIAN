// Semana de cierre: lunes a sabado (los domingos no hay cobro).
import { formatDate } from './format'

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`
}

function keyOf(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function weekStartKey(reference = new Date()) {
  const date = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate())
  const dow = date.getDay() // 0 = domingo
  const diff = dow === 0 ? -6 : 1 - dow
  date.setDate(date.getDate() + diff)
  return keyOf(date)
}

export function addDaysKey(key: string, days: number) {
  const [year, month, day] = key.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + days)
  return keyOf(date)
}

export function shiftWeek(startKey: string, weeks: number) {
  return addDaysKey(startKey, weeks * 7)
}

export function weekDayKeys(startKey: string) {
  return Array.from({ length: 6 }, (_, index) => addDaysKey(startKey, index))
}

export function weekEndKey(startKey: string) {
  return addDaysKey(startKey, 5)
}

export function formatWeekRange(startKey: string) {
  const end = weekEndKey(startKey)
  return `${formatDate(startKey)} — ${formatDate(end)}`
}

export const WEEKDAY_LABEL = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
