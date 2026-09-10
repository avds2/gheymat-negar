export const faNumber = new Intl.NumberFormat('fa-IR')
export const faCompact = new Intl.NumberFormat('fa-IR', { notation: 'compact', maximumFractionDigits: 1 })
export const faDecimal = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 })
export const faDate = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric', month: 'short', day: 'numeric' })
export const faMonth = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric', month: 'short' })

export function formatMoney(value: number, currency = 'تومان', compact = false) {
  if (!Number.isFinite(value)) return '—'
  return `${compact ? faCompact.format(value) : faNumber.format(Math.round(value))} ${currency}`
}

export function formatPct(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${faDecimal.format(value)}٪`
}

export function formatDate(value: string) {
  const d = new Date(`${value}T12:00:00`)
  return Number.isNaN(d.getTime()) ? value : faDate.format(d)
}

export function formatMonth(value: string) {
  const isoDate = /^\d{4}-\d{2}$/.test(value) ? `${value}-15` : value
  const d = new Date(`${isoDate}T12:00:00`)
  return Number.isNaN(d.getTime()) ? value : faMonth.format(d)
}

export function todayISO() {
  const d = new Date()
  const offset = d.getTimezoneOffset() * 60_000
  return new Date(d.getTime() - offset).toISOString().slice(0, 10)
}

export function toFaDigits(input: string | number) {
  return String(input).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[Number(d)])
}
