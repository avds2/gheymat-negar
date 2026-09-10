import { faDecimal, formatMoney } from '../lib/format'

type TooltipPayloadEntry = {
  dataKey?: string | number
  value?: string | number
  payload?: Record<string, unknown>
}

interface ChartTooltipProps {
  active?: boolean
  payload?: TooltipPayloadEntry[]
  label?: string | number
  currency?: string
  valueKey?: string
  isMoney?: boolean
  compactMoney?: boolean
  suffix?: string
  labelFormatter?: (value: string) => string
  series?: Array<{ key: string; label: string }>
}

export function ChartTooltip({
  active,
  payload,
  label,
  currency,
  valueKey = 'value',
  isMoney = false,
  compactMoney = false,
  suffix = '',
  labelFormatter,
  series
}: ChartTooltipProps) {
  if (!active || !payload?.length) return null

  const entry = payload.find(item => String(item.dataKey) === valueKey) ?? payload[0]
  const value = Number(entry?.value)
  const payloadName = typeof entry?.payload?.name === 'string' ? entry.payload.name : ''
  const rawLabel = String(label ?? payloadName ?? '')
  const shownLabel = labelFormatter && rawLabel ? labelFormatter(rawLabel) : rawLabel
  const shownValue = isMoney
    ? formatMoney(value, currency, compactMoney)
    : `${faDecimal.format(value)}${suffix}`
  const seriesValues = series?.map(item => {
    const rawValue = payload.find(entry => String(entry.dataKey) === item.key)?.value
    return { ...item, value: rawValue == null ? null : Number(rawValue) }
  })

  return <div className="chart-tooltip">
    {shownLabel ? <div>{shownLabel}</div> : null}
    {seriesValues?.length ? seriesValues.map(item => <strong key={item.key}>{item.label}: {item.value == null ? '—' : isMoney ? formatMoney(item.value, currency, compactMoney) : `${faDecimal.format(item.value)}${suffix}`}</strong>) : <strong>{shownValue}</strong>}
  </div>
}
