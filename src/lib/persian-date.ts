const partsFormatter = new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', {
  calendar: 'persian',
  numberingSystem: 'latn',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
})

const PERSIAN_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'] as const
const faInteger = new Intl.NumberFormat('fa-IR', { useGrouping: false })

const fullDateFormatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  calendar: 'persian',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})

export type PersianDateParts = { year: number; month: number; day: number }

function fromISO(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day, 12)
  if (Number.isNaN(date.getTime()) || date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null
  return date
}

function toISO(date: Date) {
  const year = String(date.getFullYear()).padStart(4, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function persianDateParts(value: string): PersianDateParts | null {
  const date = fromISO(value)
  if (!date) return null
  const parts = partsFormatter.formatToParts(date)
  const year = Number(parts.find(part => part.type === 'year')?.value)
  const month = Number(parts.find(part => part.type === 'month')?.value)
  const day = Number(parts.find(part => part.type === 'day')?.value)
  if (![year, month, day].every(Number.isFinite)) return null
  return { year, month, day }
}

export function formatPersianDateLong(value: string) {
  const date = fromISO(value)
  return date ? fullDateFormatter.format(date) : value
}

export function formatPersianMonth(value: string) {
  const parts = persianDateParts(value)
  if (!parts) return value
  return `${PERSIAN_MONTHS[parts.month - 1]} ${faInteger.format(parts.year)}`
}

export function addDaysISO(value: string, days: number) {
  const date = fromISO(value)
  if (!date) return value
  date.setDate(date.getDate() + days)
  return toISO(date)
}

function samePersianMonth(a: PersianDateParts | null, b: PersianDateParts | null) {
  return Boolean(a && b && a.year === b.year && a.month === b.month)
}

export function startOfPersianMonthISO(anchor: string) {
  const target = persianDateParts(anchor)
  if (!target) return anchor
  let cursor = anchor
  for (let i = 0; i < 31; i += 1) {
    const previous = addDaysISO(cursor, -1)
    if (!samePersianMonth(persianDateParts(previous), target)) break
    cursor = previous
  }
  return cursor
}

export function nextPersianMonthISO(anchor: string) {
  const start = startOfPersianMonthISO(anchor)
  return startOfPersianMonthISO(addDaysISO(start, 32))
}

export function previousPersianMonthISO(anchor: string) {
  const start = startOfPersianMonthISO(anchor)
  return startOfPersianMonthISO(addDaysISO(start, -1))
}

export type PersianCalendarMonth = {
  startISO: string
  label: string
  leadingBlankDays: number
  days: Array<{ iso: string; day: number }>
}

export function getPersianCalendarMonth(anchor: string): PersianCalendarMonth {
  const startISO = startOfPersianMonthISO(anchor)
  const startDate = fromISO(startISO)
  const startParts = persianDateParts(startISO)
  if (!startDate || !startParts) {
    return { startISO, label: '', leadingBlankDays: 0, days: [] }
  }

  // JavaScript: Sunday=0 ... Saturday=6. Persian calendars start on Saturday.
  const leadingBlankDays = (startDate.getDay() + 1) % 7
  const days: Array<{ iso: string; day: number }> = []
  let cursor = startISO
  for (let i = 0; i < 31; i += 1) {
    const parts = persianDateParts(cursor)
    if (!samePersianMonth(parts, startParts)) break
    days.push({ iso: cursor, day: parts!.day })
    cursor = addDaysISO(cursor, 1)
  }

  return {
    startISO,
    label: formatPersianMonth(startISO),
    leadingBlankDays,
    days,
  }
}
