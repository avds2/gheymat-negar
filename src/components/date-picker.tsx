import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { todayISO, toFaDigits } from '../lib/format'
import {
  formatPersianDateLong,
  getPersianCalendarMonth,
  nextPersianMonthISO,
  previousPersianMonthISO,
} from '../lib/persian-date'

const WEEKDAYS = [
  ['ش', 'شنبه'],
  ['ی', 'یکشنبه'],
  ['د', 'دوشنبه'],
  ['س', 'سه‌شنبه'],
  ['چ', 'چهارشنبه'],
  ['پ', 'پنجشنبه'],
  ['ج', 'جمعه'],
] as const

type Props = {
  value: string
  onChange: (value: string) => void
  max?: string
  min?: string
  required?: boolean
  allowClear?: boolean
  placeholder?: string
  ariaLabel?: string
  onBlur?: () => void
}

export function PersianDatePicker({
  value,
  onChange,
  max,
  min,
  required = false,
  allowClear = false,
  placeholder = 'انتخاب تاریخ',
  ariaLabel = 'انتخاب تاریخ',
  onBlur,
}: Props) {
  const today = todayISO()
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const selectedRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [viewAnchor, setViewAnchor] = useState(value || today)
  const month = useMemo(() => getPersianCalendarMonth(viewAnchor), [viewAnchor])
  const nextMonth = useMemo(() => nextPersianMonthISO(month.startISO), [month.startISO])
  const previousMonth = useMemo(() => previousPersianMonthISO(month.startISO), [month.startISO])
  const nextDisabled = Boolean(max && nextMonth > max)
  const previousDisabled = Boolean(min && nextPersianMonthISO(previousMonth) <= min)

  useEffect(() => {
    if (value) setViewAnchor(value)
  }, [value])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => selectedRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [open, month.startISO])

  const closeAndRestoreFocus = () => {
    setOpen(false)
    requestAnimationFrame(() => triggerRef.current?.focus())
  }

  const choose = (iso: string) => {
    if ((max && iso > max) || (min && iso < min)) return
    onChange(iso)
    setViewAnchor(iso)
    closeAndRestoreFocus()
  }

  return <div className={`persian-date-picker ${open ? 'open' : ''}`} ref={rootRef} onKeyDown={event => {
    if (open && event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      closeAndRestoreFocus()
    }
  }}>
    <button
      ref={triggerRef}
      type="button"
      className={`date-picker-trigger ${value ? '' : 'is-placeholder'}`}
      aria-label={ariaLabel}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={() => setOpen(current => !current)}
      onBlur={onBlur}
    >
      <span>{value ? formatPersianDateLong(value) : placeholder}</span>
      <CalendarDays size={18}/>
    </button>

    {open ? <div className="persian-calendar" role="dialog" aria-label="تقویم شمسی">
      <div className="persian-calendar-head">
        <button type="button" className="calendar-nav" onClick={() => setViewAnchor(previousMonth)} disabled={previousDisabled} aria-label="ماه قبل" title="ماه قبل"><ChevronRight size={18}/></button>
        <strong>{month.label}</strong>
        <button type="button" className="calendar-nav" onClick={() => setViewAnchor(nextMonth)} disabled={nextDisabled} aria-label="ماه بعد" title="ماه بعد"><ChevronLeft size={18}/></button>
      </div>

      <div className="persian-calendar-weekdays" aria-hidden="true">
        {WEEKDAYS.map(([short, full]) => <span key={full} title={full}>{short}</span>)}
      </div>
      <div className="persian-calendar-grid">
        {Array.from({ length: month.leadingBlankDays }, (_, index) => <span className="calendar-blank" key={`blank-${index}`}/>) }
        {month.days.map(day => {
          const disabled = Boolean((max && day.iso > max) || (min && day.iso < min))
          const selected = day.iso === value
          const isToday = day.iso === today
          return <button
            key={day.iso}
            ref={selected ? selectedRef : undefined}
            type="button"
            className={`${selected ? 'selected ' : ''}${isToday ? 'today' : ''}`.trim()}
            disabled={disabled}
            aria-current={isToday ? 'date' : undefined}
            aria-pressed={selected}
            aria-label={formatPersianDateLong(day.iso)}
            onClick={() => choose(day.iso)}
          >{toFaDigits(day.day)}</button>
        })}
      </div>

      <div className="persian-calendar-footer">
        <button type="button" className="calendar-text-button" disabled={Boolean((max && today > max) || (min && today < min))} onClick={() => choose(today)}>امروز</button>
        {allowClear && !required && value ? <button type="button" className="calendar-text-button muted" onClick={() => { onChange(''); closeAndRestoreFocus() }}><X size={14}/>پاک کردن</button> : <span/>}
      </div>
    </div> : null}
  </div>
}
