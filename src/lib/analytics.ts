import type { FinancialSnapshot, FinancialTransaction, Product, Purchase, Store } from './types'
import { persianDateParts, shiftPersianMonthISO, startOfPersianMonthISO } from './persian-date'

export interface ProductStat {
  product: Product
  count: number
  latest: number | null
  first: number | null
  min: number | null
  max: number | null
  avg: number | null
  changePct: number | null
  volatilityPct: number | null
  lastDate: string | null
}

export interface CompositePoint {
  month: string
  index: number
  matched: number
  coveragePct: number
}

export interface CashflowPoint {
  month: string
  purchaseExpense: number
  otherExpense: number
  expense: number
  income: number
  net: number
}

export interface FinancialBenchmarkPoint extends CashflowPoint {
  usdRate: number | null
  incomeUsd: number | null
  monthlySaving: number
  monthlySavingUsd: number | null
  savingsRatePct: number | null
  savingsBalance: number | null
  savingsBalanceUsd: number | null
  nominalIncomeChangePct: number | null
  dollarIncomeChangePct: number | null
  personalInflationPct: number | null
  realIncomeChangePct: number | null
}

const safePct = (from: number, to: number) => from > 0 ? ((to / from) - 1) * 100 : null
const isValidPrice = (value: number) => Number.isFinite(value) && value > 0
const isValidSpend = (value: number) => Number.isFinite(value) && value > 0

export function sortPurchases(rows: Purchase[]) {
  return [...rows].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
}

function median(values: number[]) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export function getProductStats(products: Product[], purchases: Purchase[]): ProductStat[] {
  const grouped = new Map<string, Purchase[]>()
  for (const row of purchases) {
    const list = grouped.get(row.productId) ?? []
    list.push(row)
    grouped.set(row.productId, list)
  }

  return products.map(product => {
    const rows = sortPurchases(grouped.get(product.id) ?? []).filter(row => isValidPrice(row.unitPrice))
    if (!rows.length) {
      return { product, count: 0, latest: null, first: null, min: null, max: null, avg: null, changePct: null, volatilityPct: null, lastDate: null }
    }

    const prices = rows.map(row => row.unitPrice)
    const logChanges = prices.slice(1).map((value, index) => Math.abs(Math.log(value / prices[index])) * 100).filter(Number.isFinite)

    return {
      product,
      count: rows.length,
      latest: prices.at(-1) ?? null,
      first: prices[0] ?? null,
      min: Math.min(...prices),
      max: Math.max(...prices),
      avg: prices.reduce((sum, value) => sum + value, 0) / prices.length,
      changePct: safePct(prices[0], prices.at(-1) ?? prices[0]),
      volatilityPct: logChanges.length ? logChanges.reduce((sum, value) => sum + value, 0) / logChanges.length : 0,
      lastDate: rows.at(-1)?.date ?? null
    }
  })
}

export function filterPurchases(purchases: Purchase[], from?: string, to?: string) {
  return purchases.filter(purchase => (!from || purchase.date >= from) && (!to || purchase.date <= to))
}

export function periodProductChange(rows: Purchase[]) {
  const sorted = sortPurchases(rows).filter(row => isValidPrice(row.unitPrice))
  if (sorted.length < 2) return null
  return safePct(sorted[0].unitPrice, sorted.at(-1)!.unitPrice)
}

function monthKey(date: string) {
  return startOfPersianMonthISO(date)
}

function monthNumber(month: string) {
  const parts = persianDateParts(month)
  return parts ? parts.year * 12 + (parts.month - 1) : 0
}

function previousMonth(month: string) {
  return shiftPersianMonthISO(month, -1)
}

function inclusiveMonthCount(from: string, to: string) {
  return Math.max(1, monthNumber(to) - monthNumber(from) + 1)
}

function buildMonthlyData(purchases: Purchase[]) {
  const priceBuckets = new Map<string, Map<string, number[]>>()
  const monthlySpend = new Map<string, Map<string, number>>()

  for (const purchase of sortPurchases(purchases)) {
    const month = monthKey(purchase.date)

    if (isValidPrice(purchase.unitPrice)) {
      const monthMap = priceBuckets.get(month) ?? new Map<string, number[]>()
      const prices = monthMap.get(purchase.productId) ?? []
      prices.push(purchase.unitPrice)
      monthMap.set(purchase.productId, prices)
      priceBuckets.set(month, monthMap)
    }

    if (isValidSpend(purchase.totalPaid)) {
      const spendMap = monthlySpend.get(month) ?? new Map<string, number>()
      spendMap.set(purchase.productId, (spendMap.get(purchase.productId) ?? 0) + purchase.totalPaid)
      monthlySpend.set(month, spendMap)
    }
  }

  const monthlyPrices = new Map<string, Map<string, number>>()
  for (const [month, products] of priceBuckets) {
    const representatives = new Map<string, number>()
    for (const [productId, prices] of products) {
      const value = median(prices)
      if (value != null) representatives.set(productId, value)
    }
    monthlyPrices.set(month, representatives)
  }

  return { monthlyPrices, monthlySpend }
}

/**
 * Automatic basket weight based on prior observed spending.
 *
 * We use average monthly spend from the product's first observed purchase up to
 * the month before the current comparison. Spreading spend over elapsed calendar
 * months prevents a single bulk purchase from permanently dominating the index,
 * while frequently purchased/high-spend items naturally receive more influence.
 */
function historicalMonthlySpendWeight(
  productId: string,
  currentMonth: string,
  spendTotals: Map<string, number>,
  firstSpendMonth: Map<string, string>
) {
  const total = spendTotals.get(productId) ?? 0
  const firstMonth = firstSpendMonth.get(productId)
  if (!firstMonth || !isValidSpend(total)) return 1
  return total / inclusiveMonthCount(firstMonth, previousMonth(currentMonth))
}

export function buildCompositeIndex(purchases: Purchase[]): CompositePoint[] {
  const { monthlyPrices, monthlySpend } = buildMonthlyData(purchases)
  const months = [...monthlyPrices.keys()].sort()
  if (!months.length) return []

  const lastKnown = new Map<string, number>()
  const historicalSpendTotals = new Map<string, number>()
  const firstSpendMonth = new Map<string, string>()
  let index = 100
  const result: CompositePoint[] = []

  for (const [monthIndex, month] of months.entries()) {
    const current = monthlyPrices.get(month)!
    const eligibleProductIds = [...lastKnown.keys()]
    const comparable: Array<{ ratio: number; weight: number }> = []

    for (const [productId, currentPrice] of current) {
      const previousPrice = lastKnown.get(productId)
      if (previousPrice && isValidPrice(previousPrice) && isValidPrice(currentPrice)) {
        comparable.push({
          ratio: currentPrice / previousPrice,
          weight: historicalMonthlySpendWeight(productId, month, historicalSpendTotals, firstSpendMonth)
        })
      }
    }

    if (monthIndex > 0 && comparable.length) {
      const totalWeight = comparable.reduce((sum, item) => sum + item.weight, 0)
      const weightedLogRatio = comparable.reduce((sum, item) => sum + Math.log(item.ratio) * item.weight, 0) / totalWeight
      index *= Math.exp(weightedLogRatio)
    }

    const eligibleWeight = eligibleProductIds.reduce(
      (sum, productId) => sum + historicalMonthlySpendWeight(productId, month, historicalSpendTotals, firstSpendMonth),
      0
    )
    const freshWeight = comparable.reduce((sum, item) => sum + item.weight, 0)

    result.push({
      month,
      index,
      matched: monthIndex === 0 ? current.size : comparable.length,
      coveragePct: monthIndex === 0 ? 100 : eligibleWeight ? Math.min(100, (freshWeight / eligibleWeight) * 100) : 0
    })

    for (const [productId, currentPrice] of current) lastKnown.set(productId, currentPrice)

    for (const [productId, spend] of monthlySpend.get(month) ?? []) {
      if (!firstSpendMonth.has(productId)) firstSpendMonth.set(productId, month)
      historicalSpendTotals.set(productId, (historicalSpendTotals.get(productId) ?? 0) + spend)
    }
  }

  return result
}

export function categoryInflation(products: Product[], purchases: Purchase[]) {
  const stats = getProductStats(products, purchases)
  const spendByProduct = new Map<string, number>()
  for (const purchase of purchases) {
    if (!isValidSpend(purchase.totalPaid)) continue
    spendByProduct.set(purchase.productId, (spendByProduct.get(purchase.productId) ?? 0) + purchase.totalPaid)
  }

  const groups = new Map<string, Array<{ ratio: number; spend: number }>>()

  for (const stat of stats) {
    if (stat.first == null || stat.latest == null || stat.count < 2 || stat.first <= 0 || stat.latest <= 0) continue
    const category = stat.product.category || 'بدون دسته‌بندی'
    const values = groups.get(category) ?? []
    values.push({ ratio: stat.latest / stat.first, spend: spendByProduct.get(stat.product.id) ?? 0 })
    groups.set(category, values)
  }

  return [...groups.entries()].map(([category, values]) => {
    const positiveSpend = values.reduce((sum, value) => sum + Math.max(0, value.spend), 0)
    const weightedLogRatio = positiveSpend > 0
      ? values.reduce((sum, value) => sum + Math.log(value.ratio) * Math.max(0, value.spend), 0) / positiveSpend
      : values.reduce((sum, value) => sum + Math.log(value.ratio), 0) / values.length
    return {
      category,
      change: (Math.exp(weightedLogRatio) - 1) * 100,
      products: values.length
    }
  }).sort((a, b) => b.change - a.change)
}

export function storeComparison(productId: string, purchases: Purchase[], stores: Store[]) {
  const names = new Map(stores.map(store => [store.id, store.name]))
  const grouped = new Map<string, Purchase[]>()

  for (const purchase of sortPurchases(purchases).filter(row => row.productId === productId && isValidPrice(row.unitPrice))) {
    const store = purchase.storeId ? (names.get(purchase.storeId) ?? 'فروشگاه حذف‌شده') : 'بدون فروشگاه'
    const rows = grouped.get(store) ?? []
    rows.push(purchase)
    grouped.set(store, rows)
  }

  return [...grouped.entries()].map(([store, rows]) => {
    const prices = rows.map(row => row.unitPrice)
    const totalQuantity = rows.reduce((sum, row) => sum + row.quantity, 0)
    const weightedAverage = totalQuantity > 0
      ? rows.reduce((sum, row) => sum + (row.unitPrice * row.quantity), 0) / totalQuantity
      : prices.reduce((sum, value) => sum + value, 0) / prices.length
    return {
      store,
      avg: weightedAverage,
      latest: prices.at(-1) ?? 0,
      min: Math.min(...prices),
      max: Math.max(...prices),
      count: prices.length
    }
  }).sort((a, b) => a.avg - b.avg)
}

export function totalSpend(purchases: Purchase[]) {
  return purchases.reduce((sum, purchase) => sum + purchase.totalPaid, 0)
}

export function buildMonthlyCashflow(purchases: Purchase[], transactions: FinancialTransaction[]): CashflowPoint[] {
  const months = new Map<string, Omit<CashflowPoint, 'month' | 'expense' | 'net'>>()
  const ensure = (date: string) => {
    const month = startOfPersianMonthISO(date)
    const point = months.get(month) ?? { purchaseExpense: 0, otherExpense: 0, income: 0 }
    months.set(month, point)
    return point
  }

  for (const purchase of purchases) {
    if (!isValidSpend(purchase.totalPaid)) continue
    ensure(purchase.date).purchaseExpense += purchase.totalPaid
  }
  for (const transaction of transactions) {
    if (!isValidSpend(transaction.amount)) continue
    const point = ensure(transaction.date)
    if (transaction.kind === 'income') point.income += transaction.amount
    else point.otherExpense += transaction.amount
  }

  return [...months.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, point]) => {
    const expense = point.purchaseExpense + point.otherExpense
    return { month, ...point, expense, net: point.income - expense }
  })
}

export function percentageChange(from: number, to: number) {
  return from > 0 && Number.isFinite(from) && Number.isFinite(to) ? ((to / from) - 1) * 100 : null
}

export function transactionTotal(rows: FinancialTransaction[], kind?: FinancialTransaction['kind']) {
  return rows.reduce((sum, row) => sum + (kind && row.kind !== kind ? 0 : row.amount), 0)
}

export function buildFinancialBenchmarks(
  cashflow: CashflowPoint[],
  snapshots: FinancialSnapshot[],
  priceIndex: CompositePoint[],
): FinancialBenchmarkPoint[] {
  const cashflowByMonth = new Map(cashflow.map(point => [point.month, point]))
  const snapshotByMonth = new Map(snapshots.map(snapshot => [snapshot.month, snapshot]))
  const indexByMonth = new Map(priceIndex.map(point => [point.month, point.index]))
  const months = [...new Set([...cashflowByMonth.keys(), ...snapshotByMonth.keys()])].sort()

  const base = new Map<string, FinancialBenchmarkPoint>()
  for (const month of months) {
    const flow = cashflowByMonth.get(month) ?? { month, purchaseExpense: 0, otherExpense: 0, expense: 0, income: 0, net: 0 }
    const snapshot = snapshotByMonth.get(month)
    const usdRate = snapshot?.usdRate && snapshot.usdRate > 0 ? snapshot.usdRate : null
    const monthlySaving = flow.income - flow.expense
    base.set(month, {
      ...flow,
      usdRate,
      incomeUsd: usdRate ? flow.income / usdRate : null,
      monthlySaving,
      monthlySavingUsd: usdRate ? monthlySaving / usdRate : null,
      savingsRatePct: flow.income > 0 ? (monthlySaving / flow.income) * 100 : null,
      savingsBalance: snapshot?.savingsBalance ?? null,
      savingsBalanceUsd: usdRate && snapshot?.savingsBalance != null ? snapshot.savingsBalance / usdRate : null,
      nominalIncomeChangePct: null,
      dollarIncomeChangePct: null,
      personalInflationPct: null,
      realIncomeChangePct: null,
    })
  }

  return months.map(month => {
    const current = base.get(month)!
    const previous = base.get(shiftPersianMonthISO(month, -1))
    const currentIndex = indexByMonth.get(month)
    const previousIndex = indexByMonth.get(shiftPersianMonthISO(month, -1))
    const nominalIncomeChangePct = previous ? percentageChange(previous.income, current.income) : null
    const dollarIncomeChangePct = previous?.incomeUsd != null && current.incomeUsd != null
      ? percentageChange(previous.incomeUsd, current.incomeUsd)
      : null
    const personalInflationPct = previousIndex != null && currentIndex != null
      ? percentageChange(previousIndex, currentIndex)
      : null
    const realIncomeChangePct = nominalIncomeChangePct != null && personalInflationPct != null
      ? (((1 + nominalIncomeChangePct / 100) / (1 + personalInflationPct / 100)) - 1) * 100
      : null
    return { ...current, nominalIncomeChangePct, dollarIncomeChangePct, personalInflationPct, realIncomeChangePct }
  })
}

export function lastNDaysISO(days: number) {
  const date = new Date()
  date.setDate(date.getDate() - Math.max(0, days - 1))
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}
