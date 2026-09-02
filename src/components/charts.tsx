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
  labelFormatter
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

  return <div className="chart-tooltip">
    {shownLabel ? <div>{shownLabel}</div> : null}
    <strong>{shownValue}</strong>
  </div>
}
