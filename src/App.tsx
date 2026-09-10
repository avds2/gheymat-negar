import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Activity, Archive, ArrowDownCircle, ArrowUpCircle, Box, Check, ChevronLeft, CloudOff, Database,
  DollarSign, Download, FileJson, FileSpreadsheet, Gauge, HardDrive, Info, LineChart as LineIcon, LockKeyhole,
  Minus, Moon, PackagePlus, Pencil, Plus, ReceiptText, Search, Settings, ShieldCheck, ShoppingBasket,
  Sun, Trash2, TrendingDown, TrendingUp, Upload, WifiOff, X
} from 'lucide-react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts'
import { db, DEFAULT_SETTINGS } from './lib/db'
import type { BackupData, FinancialSnapshot, FinancialTransaction, Product, Purchase, Store, ThemeMode, TransactionKind } from './lib/types'
import { buildCompositeIndex, buildFinancialBenchmarks, buildMonthlyCashflow, categoryInflation, filterPurchases, getProductStats, lastNDaysISO, percentageChange, periodProductChange, sortPurchases, storeComparison, totalSpend, transactionTotal } from './lib/analytics'
import { downloadText, encryptBackup, financialSnapshotsToCsv, parseBackup, purchasesToCsv, transactionsToCsv } from './lib/backup'
import { formatDate, formatMoney, formatMonth, formatPct, faDecimal, faNumber, todayISO } from './lib/format'
import { makeDemoData } from './lib/demo'
import { makeSearchKey, normalizePersianText, normalizeStoreName, sameNormalizedText } from './lib/text'
import { planBackupMerge, resolveMergeCurrency } from './lib/merge'
import { APP_VERSION, BACKUP_REMINDER_DAYS, MAX_BACKUP_FILE_BYTES } from './lib/constants'
import { ChartTooltip } from './components/charts'
import { FinancialSnapshotForm, ProductForm, PurchaseForm, TransactionForm } from './components/forms'
import { PersianDatePicker } from './components/date-picker'
import { Badge, ConfirmDialog, EmptyState, Modal, StatCard } from './components/ui'
import { MobileNavigation, Sidebar, Topbar, type PageId } from './components/navigation'
import { shiftPersianMonthISO, startOfPersianMonthISO } from './lib/persian-date'

type Toast = { id: number; text: string; kind: 'ok'|'error'|'info' }

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
}
const CHART_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)', 'var(--chart-7)', 'var(--chart-8)']

function pctTone(value: number | null) { return value == null || value === 0 ? 'neutral' : value > 0 ? 'up' : 'down' }
function growthTone(value: number | null) { return value == null || value === 0 ? 'neutral' : value > 0 ? 'down' : 'up' }
export default function App() {
  const productsLive = useLiveQuery(() => db.products.toArray())
  const storesLive = useLiveQuery(() => db.stores.toArray())
  const purchasesLive = useLiveQuery(() => db.purchases.toArray())
  const transactionsLive = useLiveQuery(() => db.transactions.toArray())
  const financialSnapshotsLive = useLiveQuery(() => db.financialSnapshots.toArray())
  const settings = useLiveQuery(() => db.settings.get('main'), [], DEFAULT_SETTINGS) ?? DEFAULT_SETTINGS
  const loading = productsLive === undefined || storesLive === undefined || purchasesLive === undefined || transactionsLive === undefined || financialSnapshotsLive === undefined
  const products = productsLive ?? []
  const stores = storesLive ?? []
  const purchases = purchasesLive ?? []
  const transactions = transactionsLive ?? []
  const financialSnapshots = financialSnapshotsLive ?? []

  const [page, setPage] = useState<PageId>('dashboard')
  const [financeMonth, setFinanceMonth] = useState(() => startOfPersianMonthISO(todayISO()))
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [productModal, setProductModal] = useState<{open:boolean; product?:Product|null}>({open:false})
  const [purchaseModal, setPurchaseModal] = useState<{open:boolean; purchase?:Purchase|null; productId?:string}>({open:false})
  const [transactionModal, setTransactionModal] = useState<{open:boolean; transaction?:FinancialTransaction|null; kind?:TransactionKind}>({open:false})
  const [financialSnapshotModal, setFinancialSnapshotModal] = useState(false)
  const [selectedProductId, setSelectedProductId] = useState('')
  const [toasts, setToasts] = useState<Toast[]>([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('همه')
  const [sortBy, setSortBy] = useState<'recent'|'change'|'name'>('recent')
  const [rangeFrom, setRangeFrom] = useState('')
  const [rangeTo, setRangeTo] = useState(todayISO())
  const [backupPassword, setBackupPassword] = useState('')
  const [importMode, setImportMode] = useState<'replace'|'merge'>('replace')
  const [storageText, setStorageText] = useState('در حال بررسی…')
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [online, setOnline] = useState(navigator.onLine)
  const [systemDark, setSystemDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches)
  const [confirmState, setConfirmState] = useState<{title:string; body:string; confirmText?:string; danger?:boolean} | null>(null)
  const confirmResolver = useRef<((value:boolean)=>void) | null>(null)
  const [renameTarget, setRenameTarget] = useState<Store | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const productDetailRef = useRef<HTMLElement>(null)
  const productListRef = useRef<HTMLElement>(null)

  const pushToast = (text: string, kind: Toast['kind']='ok') => {
    const id = Date.now() + Math.random()
    setToasts(t => [...t, {id, text, kind}])
    setTimeout(() => setToasts(t => t.filter(x=>x.id!==id)), 3200)
  }

  function askConfirm(title: string, body: string, confirmText = 'تأیید', danger = false) {
    return new Promise<boolean>(resolve => {
      confirmResolver.current = resolve
      setConfirmState({ title, body, confirmText, danger })
    })
  }

  function closeConfirm(result: boolean) {
    confirmResolver.current?.(result)
    confirmResolver.current = null
    setConfirmState(null)
  }

  function selectProduct(id: string, revealOnMobile = false) {
    setSelectedProductId(id)
    if (revealOnMobile && window.matchMedia('(max-width: 900px)').matches) {
      requestAnimationFrame(() => productDetailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    }
  }

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault()
      setInstallEvent(event as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine)
    window.addEventListener('online', sync); window.addEventListener('offline', sync)
    return () => { window.removeEventListener('online', sync); window.removeEventListener('offline', sync) }
  }, [])

  useEffect(() => {
    const root = document.documentElement
    const apply = (mode: ThemeMode) => {
      const dark = mode === 'dark' || (mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
      root.dataset.theme = dark ? 'dark' : 'light'
    }
    apply(settings.theme)
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const listener = () => { setSystemDark(mq.matches); apply(settings.theme) }
    mq.addEventListener('change', listener)
    return () => mq.removeEventListener('change', listener)
  }, [settings.theme])

  useEffect(() => {
    navigator.storage?.estimate?.().then(({usage, quota}) => {
      if (!usage || !quota) return setStorageText('ذخیره‌سازی محلی مرورگر')
      setStorageText(`${faDecimal.format(usage/1024/1024)} از ${faDecimal.format(quota/1024/1024)} مگابایت`)
    }).catch(()=>setStorageText('ذخیره‌سازی محلی مرورگر'))
  }, [purchases.length, products.length, transactions.length, financialSnapshots.length])

  useEffect(() => {
    if (loading) return
    const selected = products.find(p => p.id === selectedProductId)
    if (!selected || selected.archived) {
      setSelectedProductId(products.find(p => !p.archived)?.id ?? '')
    }
  }, [loading, products, selectedProductId])

  useEffect(() => {
    if (!sidebarOpen) return
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setSidebarOpen(false) }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [sidebarOpen])

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [page])

  const activeProducts = useMemo(() => products.filter(product => !product.archived), [products])
  const stats = useMemo(() => getProductStats(products, purchases), [products, purchases])
  const composite = useMemo(() => buildCompositeIndex(purchases), [purchases])
  const latestComposite = composite.at(-1)
  const totalIndexChange = composite.length >= 2 ? ((composite.at(-1)!.index / composite[0].index) - 1) * 100 : null
  const last30Spend = useMemo(() => totalSpend(filterPurchases(purchases, lastNDaysISO(30), todayISO())), [purchases])
  const last30OtherExpense = useMemo(() => transactionTotal(transactions.filter(row => row.kind === 'expense' && row.date >= lastNDaysISO(30) && row.date <= todayISO())), [transactions])
  const cashflow = useMemo(() => buildMonthlyCashflow(purchases, transactions), [purchases, transactions])
  const currentFinanceMonth = startOfPersianMonthISO(todayISO())
  const currentCashflow = cashflow.find(point => point.month === currentFinanceMonth)
  const currentExpense = currentCashflow?.expense ?? 0
  const financePoint = cashflow.find(point => point.month === financeMonth)
  const previousCashflow = cashflow.find(point => point.month === shiftPersianMonthISO(financeMonth, -1))
  const lastYearCashflow = cashflow.find(point => point.month === shiftPersianMonthISO(financeMonth, -12))
  const financeExpense = financePoint?.expense ?? 0
  const financeIncome = financePoint?.income ?? 0
  const monthExpenseChange = previousCashflow ? percentageChange(previousCashflow.expense, financeExpense) : null
  const yearExpenseChange = lastYearCashflow ? percentageChange(lastYearCashflow.expense, financeExpense) : null
  const currentTransactions = useMemo(() => transactions.filter(row => startOfPersianMonthISO(row.date) === financeMonth), [transactions, financeMonth])
  const currentPurchases = useMemo(() => purchases.filter(row => startOfPersianMonthISO(row.date) === financeMonth), [purchases, financeMonth])
  const financeChart = useMemo(() => cashflow.slice(-12).map(point => ({ ...point, label: formatMonth(point.month) })), [cashflow])
  const financeMonths = useMemo(() => [...new Set([currentFinanceMonth, ...cashflow.map(point => point.month), ...financialSnapshots.map(snapshot => snapshot.month)])].sort().reverse(), [cashflow, financialSnapshots, currentFinanceMonth])
  const benchmarks = useMemo(() => buildFinancialBenchmarks(cashflow, financialSnapshots, composite), [cashflow, financialSnapshots, composite])
  const financeBenchmark = benchmarks.find(point => point.month === financeMonth)
  const selectedFinancialSnapshot = financialSnapshots.find(snapshot => snapshot.month === financeMonth)
  const lastYearFinanceBenchmark = benchmarks.find(point => point.month === shiftPersianMonthISO(financeMonth, -12))
  const yearlyDollarIncomeChange = financeBenchmark?.incomeUsd != null && lastYearFinanceBenchmark?.incomeUsd != null ? percentageChange(lastYearFinanceBenchmark.incomeUsd, financeBenchmark.incomeUsd) : null
  const yearlySavingsBalanceChange = financeBenchmark?.savingsBalanceUsd != null && lastYearFinanceBenchmark?.savingsBalanceUsd != null ? percentageChange(lastYearFinanceBenchmark.savingsBalanceUsd, financeBenchmark.savingsBalanceUsd) : null
  const benchmarkChart = useMemo(() => benchmarks.slice(-12).map(point => ({ ...point, label: formatMonth(point.month) })), [benchmarks])
  const currentExpenseCategories = useMemo(() => {
    const productCategories = new Map(products.map(product => [product.id, product.category || 'بدون دسته‌بندی']))
    const sums = new Map<string, number>()
    for (const row of currentPurchases) {
      const key = productCategories.get(row.productId) ?? 'کالای حذف‌شده'
      sums.set(key, (sums.get(key) ?? 0) + row.totalPaid)
    }
    for (const row of currentTransactions.filter(item => item.kind === 'expense')) sums.set(row.category, (sums.get(row.category) ?? 0) + row.amount)
    return [...sums.entries()].map(([name, spend]) => ({ name, spend })).sort((a, b) => b.spend - a.spend)
  }, [currentPurchases, currentTransactions, products])
  const currentLedger = useMemo(() => {
    const productNames = new Map(products.map(product => [product.id, product.name]))
    const purchaseRows = currentPurchases.map(row => ({
      id: row.id, date: row.date, kind: 'expense' as const, category: 'خرید کالا',
      title: productNames.get(row.productId) ?? 'کالای حذف‌شده', amount: row.totalPaid,
      purchase: row, transaction: undefined,
    }))
    const transactionRows = currentTransactions.map(row => ({
      id: row.id, date: row.date, kind: row.kind, category: row.category,
      title: row.note || row.category, amount: row.amount,
      purchase: undefined, transaction: row,
    }))
    return [...purchaseRows, ...transactionRows].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
  }, [currentPurchases, currentTransactions, products])
  const categories = useMemo(() => ['همه', ...Array.from(new Set(activeProducts.map(product => product.category).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'fa'))], [activeProducts])
  const normalizedSearch = useMemo(() => normalizePersianText(search), [search])
  const filteredStats = useMemo(() => {
    const rows = stats.filter(stat => {
      if (stat.product.archived) return false
      if (category !== 'همه' && stat.product.category !== category) return false
      if (!normalizedSearch) return true
      return makeSearchKey(stat.product.name, stat.product.brand, stat.product.category, stat.product.unit, stat.product.notes).includes(normalizedSearch)
    })

    return rows.sort((a, b) => {
      if (sortBy === 'name') return a.product.name.localeCompare(b.product.name, 'fa')
      if (sortBy === 'change') {
        const aChange = a.changePct == null ? -Infinity : Math.abs(a.changePct)
        const bChange = b.changePct == null ? -Infinity : Math.abs(b.changePct)
        return bChange - aChange
      }
      return (b.lastDate ?? b.product.updatedAt).localeCompare(a.lastDate ?? a.product.updatedAt)
    })
  }, [stats, normalizedSearch, category, sortBy])
  const filtersActive = Boolean(normalizedSearch) || category !== 'همه' || sortBy !== 'recent'
  const topChanges = useMemo(() => stats
    .filter(stat => stat.changePct != null && stat.changePct > 0 && stat.count >= 2 && !stat.product.archived)
    .sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0))
    .slice(0, 7)
    .map(stat => ({ name: stat.product.name, change: stat.changePct })), [stats])
  const selectedProduct = products.find(product => product.id === selectedProductId)
  const selectedPurchasesAll = useMemo(() => purchases.filter(purchase => purchase.productId === selectedProductId), [purchases, selectedProductId])
  const selectedHistory = useMemo(() => sortPurchases(selectedPurchasesAll).map(purchase => ({ date: purchase.date, price: purchase.unitPrice, total: purchase.totalPaid })), [selectedPurchasesAll])
  const selectedStoreDataAll = useMemo(() => storeComparison(selectedProductId, selectedPurchasesAll, stores), [selectedProductId, selectedPurchasesAll, stores])
  const selectedNamedStores = useMemo(() => selectedStoreDataAll.filter(row => row.store !== 'بدون فروشگاه' && row.store !== 'فروشگاه حذف‌شده'), [selectedStoreDataAll])
  const selectedBestStore = selectedNamedStores.length >= 2 ? selectedNamedStores[0] : null
  const rangeInvalid = Boolean(rangeFrom && rangeTo && rangeFrom > rangeTo)
  const filteredPurchases = useMemo(() => rangeInvalid ? [] : filterPurchases(purchases, rangeFrom || undefined, rangeTo || undefined), [purchases, rangeFrom, rangeTo, rangeInvalid])
  const filteredProductHistory = useMemo(() => filteredPurchases.filter(purchase => purchase.productId === selectedProductId), [filteredPurchases, selectedProductId])
  const periodChange = periodProductChange(filteredProductHistory)
  const catInflation = useMemo(() => categoryInflation(products, filteredPurchases), [products, filteredPurchases])
  const storeData = useMemo(() => storeComparison(selectedProductId, filteredPurchases, stores), [selectedProductId, filteredPurchases, stores])
  const namedStoreData = useMemo(() => storeData.filter(row => row.store !== 'بدون فروشگاه' && row.store !== 'فروشگاه حذف‌شده'), [storeData])
  const bestStore = namedStoreData.length >= 2 ? namedStoreData[0] : null
  const categorySpend = useMemo(() => {
    const categoriesByProduct = new Map(products.map(product => [product.id, product.category || 'بدون دسته‌بندی']))
    const sums = new Map<string, number>()
    for (const purchase of filteredPurchases) {
      const key = categoriesByProduct.get(purchase.productId) ?? 'کالای حذف‌شده'
      sums.set(key, (sums.get(key) ?? 0) + purchase.totalPaid)
    }
    return [...sums.entries()].map(([name, spend]) => ({ name, spend })).sort((a, b) => b.spend - a.spend).slice(0, 8)
  }, [products, filteredPurchases])
  const volatility = useMemo(() => getProductStats(activeProducts, filteredPurchases)
    .filter(stat => stat.count >= 2 && stat.volatilityPct != null)
    .sort((a, b) => (b.volatilityPct ?? 0) - (a.volatilityPct ?? 0))
    .slice(0, 8)
    .map(stat => ({ name: stat.product.name, volatility: stat.volatilityPct })), [activeProducts, filteredPurchases])
  const recentStats = useMemo(() => stats
    .filter(stat => stat.count > 0 && !stat.product.archived)
    .sort((a, b) => (b.lastDate ?? '').localeCompare(a.lastDate ?? ''))
    .slice(0, 8), [stats])
  const money = (value: number, compact = settings.compactNumbers) => formatMoney(value, settings.currency, compact)
  const dollarMoney = (value: number | null | undefined) => value == null ? '—' : formatMoney(value, 'دلار', false)
  const isDark = settings.theme === 'dark' || (settings.theme === 'system' && systemDark)
  const lastBackupAt = settings.lastBackupAt ? new Date(settings.lastBackupAt) : null
  const backupAgeDays = lastBackupAt && !Number.isNaN(lastBackupAt.getTime()) ? Math.floor((Date.now() - lastBackupAt.getTime()) / 86_400_000) : null
  const backupDue = purchases.length + transactions.length + financialSnapshots.length >= 10 && (backupAgeDays == null || backupAgeDays >= BACKUP_REMINDER_DAYS)

  if (loading) return <div className="app-loading" role="status" aria-live="polite"><div className="loading-mark"><LineIcon size={28}/></div><strong>قیمت‌نگار</strong><span>در حال آماده‌سازی داده‌های محلی…</span><div className="loading-bar"><i/></div></div>

  function backupObject(exportedAt = new Date().toISOString()): BackupData { return { schema:'gheymat-negar', version:3, exportedAt, products, stores, purchases, transactions, financialSnapshots, settings: { ...settings, lastBackupAt: exportedAt } } }

  async function markBackup(exportedAt: string) {
    await db.settings.put({ ...settings, lastBackupAt: exportedAt })
  }

  async function plainExport() {
    const exportedAt = new Date().toISOString()
    downloadText(`gheymat-negar-backup-${todayISO()}.json`, JSON.stringify(backupObject(exportedAt), null, 2))
    await markBackup(exportedAt)
    pushToast('پشتیبان JSON ساخته شد.')
  }
  async function encryptedExport() {
    if (backupPassword.length < 8) return pushToast('برای پشتیبان رمزدار، رمزی با حداقل ۸ کاراکتر وارد کنید.', 'error')
    const exportedAt = new Date().toISOString()
    const encrypted = await encryptBackup(backupObject(exportedAt), backupPassword)
    downloadText(`gheymat-negar-backup-${todayISO()}.gheymat`, encrypted, 'application/octet-stream')
    await markBackup(exportedAt)
    setBackupPassword('')
    pushToast('پشتیبان رمزگذاری‌شده ساخته شد.')
  }
  function csvExport() {
    const data = backupObject()
    downloadText(`gheymat-negar-purchases-${todayISO()}.csv`, purchasesToCsv(data), 'text/csv;charset=utf-8')
    downloadText(`gheymat-negar-transactions-${todayISO()}.csv`, transactionsToCsv(data), 'text/csv;charset=utf-8')
    downloadText(`gheymat-negar-financial-benchmarks-${todayISO()}.csv`, financialSnapshotsToCsv(data), 'text/csv;charset=utf-8')
    pushToast('CSV خریدها، دخل‌وخرج و معیارهای مالی ساخته شد.')
  }

  async function importFile(file: File) {
    try {
      if (file.size > MAX_BACKUP_FILE_BYTES) throw new Error('حجم فایل پشتیبان بیشتر از ۵۰ مگابایت است و برای ورود مستقیم مناسب نیست.')
      const data = await parseBackup(await file.text(), backupPassword || undefined)
      const fileSummary = `${faNumber.format(data.products.length)} کالا، ${faNumber.format(data.purchases.length)} خرید، ${faNumber.format(data.transactions.length)} تراکنش، ${faNumber.format(data.financialSnapshots.length)} معیار مالی و ${faNumber.format(data.stores.length)} فروشگاه`
      if (importMode === 'replace') {
        if (!await askConfirm('جایگزینی داده‌های فعلی', `${fileSummary} وارد می‌شود و تمام داده‌های فعلی جایگزین خواهند شد. بهتر است قبل از ادامه از داده فعلی خروجی بگیرید.`, 'جایگزین کن', true)) return
        await db.transaction('rw', [db.products, db.stores, db.purchases, db.transactions, db.financialSnapshots, db.settings], async () => {
          await Promise.all([db.products.clear(), db.stores.clear(), db.purchases.clear(), db.transactions.clear(), db.financialSnapshots.clear(), db.settings.clear()])
          await db.products.bulkAdd(data.products); await db.stores.bulkAdd(data.stores); await db.purchases.bulkAdd(data.purchases); await db.transactions.bulkAdd(data.transactions); await db.financialSnapshots.bulkAdd(data.financialSnapshots); await db.settings.put(data.settings)
        })
      } else {
        const { adoptIncomingCurrency } = resolveMergeCurrency(settings.currency, data.settings.currency, purchases.length + transactions.length + financialSnapshots.length, data.purchases.length + data.transactions.length + data.financialSnapshots.length)
        const plan = planBackupMerge({ products, stores, purchases, transactions, financialSnapshots }, data)
        const dedupeNote = plan.dedupedProducts || plan.dedupedStores
          ? ` ${faNumber.format(plan.dedupedProducts)} کالای همسان و ${faNumber.format(plan.dedupedStores)} فروشگاه هم‌نام با رکوردهای فعلی یکپارچه می‌شوند.`
          : ''
        const currencyNote = adoptIncomingCurrency ? ` چون هنوز رکورد مالی در داده فعلی نیست، واحد پول «${data.settings.currency}» از پشتیبان پذیرفته می‌شود.` : ''
        const mergeSummary = `${fileSummary} بررسی می‌شود. رکوردهای هم‌شناسه به‌روزرسانی می‌شوند، موارد همسان ادغام و تنظیمات نمایشی فعلی حفظ می‌شود.${dedupeNote}${currencyNote}`
        if (!await askConfirm('ادغام پشتیبان', mergeSummary, 'ادغام کن')) return
        await db.transaction('rw', [db.products, db.stores, db.purchases, db.transactions, db.financialSnapshots, db.settings], async () => {
          await db.products.bulkPut(plan.productsToPut)
          await db.stores.bulkPut(plan.storesToPut)
          await db.purchases.bulkPut(plan.purchasesToPut)
          await db.transactions.bulkPut(plan.transactionsToPut)
          await db.financialSnapshots.bulkPut(plan.financialSnapshotsToPut)
          await db.settings.put({ ...settings, currency: adoptIncomingCurrency ? data.settings.currency : settings.currency, lastBackupAt: undefined })
        })
      }
      setBackupPassword('')
      pushToast(importMode === 'replace' ? 'پشتیبان جایگزین شد.' : 'داده‌های پشتیبان ادغام شدند؛ تنظیمات نمایشی فعلی حفظ شد و زمان پشتیبان برای یادآوری بعدی بازنشانی شد.')
    } catch (e) { pushToast(e instanceof Error ? e.message : 'ورود فایل ناموفق بود.', 'error') }
    finally { if (fileInputRef.current) fileInputRef.current.value = '' }
  }

  async function clearAll() {
    if (!await askConfirm('پاک کردن همه داده‌ها', 'تمام کالاها، فروشگاه‌ها، خریدها، تراکنش‌ها و معیارهای مالی برای همیشه از این مرورگر حذف می‌شوند و این عمل برگشت‌پذیر نیست.', 'همه را پاک کن', true)) return
    await db.transaction('rw', [db.products, db.stores, db.purchases, db.transactions, db.financialSnapshots, db.settings], async()=>{ await db.financialSnapshots.clear(); await db.transactions.clear(); await db.purchases.clear(); await db.stores.clear(); await db.products.clear(); await db.settings.put({ ...settings, lastBackupAt: undefined }) })
    pushToast('همه داده‌ها پاک شدند.', 'info')
  }

  async function loadDemo() {
    if (products.length || purchases.length || stores.length || transactions.length || financialSnapshots.length) return pushToast('داده نمونه فقط روی دیتابیس خالی اضافه می‌شود. ابتدا پشتیبان بگیرید و داده‌ها را پاک کنید.', 'info')
    const demo = makeDemoData(); await db.products.bulkAdd(demo.products); await db.stores.bulkAdd(demo.stores); await db.purchases.bulkAdd(demo.purchases); await db.transactions.bulkAdd(demo.transactions); await db.financialSnapshots.bulkAdd(demo.financialSnapshots); pushToast('داده نمونه اضافه شد.')
  }

  async function persistStorage() {
    if (!navigator.storage?.persist) return pushToast('مرورگر شما این قابلیت را پشتیبانی نمی‌کند.', 'error')
    const ok = await navigator.storage.persist(); pushToast(ok ? 'مرورگر اجازه نگهداری پایدار داده‌ها را داد.' : 'مرورگر اجازه ذخیره‌سازی پایدار را نداد.', ok?'ok':'info')
  }

  async function setTheme(theme: ThemeMode) { await db.settings.put({...settings, theme}) }
  function applyQuickRange(days?: number) { setRangeTo(todayISO()); setRangeFrom(days ? lastNDaysISO(days) : '') }

  async function deletePurchase(row: Purchase) {
    if (!await askConfirm('حذف رکورد خرید', 'این رکورد از تاریخچه قیمت حذف می‌شود.', 'حذف کن', true)) return
    await db.purchases.delete(row.id); pushToast('رکورد حذف شد.', 'info')
  }
  async function deleteTransaction(row: FinancialTransaction) {
    const label = row.kind === 'expense' ? 'هزینه' : 'درآمد'
    if (await askConfirm(`حذف ${label}`, `این ${label} از دسته «${row.category}» حذف شود؟`, 'حذف', true)) {
      await db.transactions.delete(row.id)
      pushToast(`${label} حذف شد.`, 'info')
    }
  }
  async function deleteFinancialSnapshot(row: FinancialSnapshot) {
    if (!await askConfirm('حذف معیار مالی ماه', `نرخ دلار و مانده پس‌انداز ${formatMonth(row.month)} حذف شود؟ دخل‌وخرج این ماه دست‌نخورده می‌ماند.`, 'حذف معیار', true)) return
    await db.financialSnapshots.delete(row.id)
    pushToast('معیار مالی ماه حذف شد.', 'info')
  }
  async function toggleArchive(product: Product) { await db.products.put({...product, archived:!product.archived, updatedAt:new Date().toISOString()}); pushToast(product.archived?'کالا از آرشیو خارج شد.':'کالا آرشیو شد.', 'info') }
  async function deleteProduct(product: Product) {
    const count = purchases.filter(p=>p.productId===product.id).length
    if (!await askConfirm('حذف کالا', count ? `این کالا و ${faNumber.format(count)} رکورد خرید وابسته به آن حذف می‌شوند.` : 'این کالا برای همیشه حذف می‌شود.', 'حذف کالا', true)) return
    await db.transaction('rw', [db.products, db.purchases], async()=>{ await db.purchases.where('productId').equals(product.id).delete(); await db.products.delete(product.id) }); pushToast('کالا حذف شد.', 'info')
  }

  function renameStore(store: Store) {
    setRenameTarget(store)
    setRenameValue(store.name)
  }

  async function saveStoreRename(e: FormEvent) {
    e.preventDefault()
    if (!renameTarget) return
    const name = normalizeStoreName(renameValue)
    if (!name) return pushToast('نام فروشگاه نمی‌تواند خالی باشد.', 'error')
    if (sameNormalizedText(name, renameTarget.name)) { setRenameTarget(null); return }
    if (stores.some(store => store.id !== renameTarget.id && sameNormalizedText(store.name, name))) return pushToast('فروشگاهی با این نام از قبل وجود دارد.', 'error')
    await db.stores.put({ ...renameTarget, name })
    setRenameTarget(null)
    pushToast('نام فروشگاه ویرایش شد.')
  }
  async function deleteStore(store: Store) {
    const count = purchases.filter(p => p.storeId === store.id).length
    if (!await askConfirm('حذف فروشگاه', count ? `نام «${store.name}» از ${faNumber.format(count)} خرید پاک می‌شود، اما خود خریدها باقی می‌مانند.` : `فروشگاه «${store.name}» حذف می‌شود.`, 'حذف فروشگاه', true)) return
    await db.transaction('rw', [db.stores, db.purchases], async () => { await db.purchases.where('storeId').equals(store.id).modify({ storeId: undefined }); await db.stores.delete(store.id) })
    pushToast('فروشگاه حذف شد.', 'info')
  }

  const renderDashboard = () => <>
    <div className="page-heading">
      <div>
        <span className="eyebrow">نمای کلی</span>
        <h1>داشبورد قیمت و هزینه</h1>
        <p>روند قیمت‌ها و مخارج واقعی شما؛ بدون ارسال داده‌های ثبت‌شده به سرور.</p>
      </div>
      <div className="button-row page-heading-actions"><button className="button primary" onClick={() => setPurchaseModal({ open: true })} disabled={!activeProducts.length}><Plus size={19}/>ثبت خرید</button><button className="button secondary" onClick={() => setTransactionModal({ open: true, kind: 'expense' })}><ArrowDownCircle size={18}/>ثبت هزینه</button></div>
    </div>

    {!products.length && !transactions.length ? <EmptyState
      icon={<ShoppingBasket size={28}/>}
      title="از اولین کالا یا تراکنش شروع کنید"
      body="برای رصد قیمت یک کالا بسازید، یا برای مدیریت مخارج اولین هزینه یا درآمد را ثبت کنید."
      action={<div className="button-row"><button className="button primary" onClick={() => setProductModal({ open: true })}><PackagePlus size={18}/>افزودن کالا</button><button className="button secondary" onClick={() => setTransactionModal({ open: true, kind: 'expense' })}><ArrowDownCircle size={18}/>ثبت هزینه</button><button className="button secondary" onClick={loadDemo}>داده نمونه</button></div>}
    /> : <>
      {products.length > 0 && !activeProducts.length ? <section className="onboarding-callout">
        <div className="onboarding-icon"><Archive size={22}/></div>
        <div><strong>همه کالاها آرشیو شده‌اند</strong><span>برای ثبت خرید جدید، یک کالای آرشیوی را برگردانید یا کالای جدید بسازید.</span></div>
        <button className="button primary small" onClick={() => setProductModal({ open: true })}>کالای جدید</button>
      </section> : null}

      {!purchases.length && activeProducts.length ? <section className="onboarding-callout">
        <div className="onboarding-icon"><Plus size={22}/></div>
        <div><strong>همه‌چیز برای شروع آماده است</strong><span>اولین خرید را ثبت کنید. از ثبت دوم هر کالا، روند و درصد تغییر قیمت معنی‌دار می‌شود.</span></div>
        <button className="button primary small" onClick={() => setPurchaseModal({ open: true })}>ثبت اولین خرید</button>
      </section> : null}

      {backupDue ? <section className="onboarding-callout backup-callout">
        <div className="onboarding-icon"><Download size={22}/></div>
        <div><strong>وقت یک پشتیبان تازه است</strong><span>{backupAgeDays == null ? 'هنوز پشتیبان کامل ثبت نشده است.' : `آخرین پشتیبان کامل حدود ${faNumber.format(backupAgeDays)} روز پیش ثبت شده است.`} داده محلی را دوره‌ای خروجی بگیرید.</span></div>
        <button className="button secondary small" onClick={() => setPage('data')}>رفتن به پشتیبان</button>
      </section> : null}

      <div className="stats-grid">
        <StatCard label="شاخص سبد قیمت" value={composite.length ? faDecimal.format(composite.at(-1)!.index) : '—'} hint={totalIndexChange == null ? 'حداقل دو ماه داده لازم است' : `${formatPct(totalIndexChange)} از اولین ماه`} tone={pctTone(totalIndexChange)}/>
        <StatCard label="هزینه واقعی این ماه" value={money(currentExpense)} hint="خریدها و سایر مخارج ثبت‌شده"/>
        <StatCard label="هزینه ۳۰ روز اخیر" value={money(last30Spend + last30OtherExpense)} hint="خریدها و سایر مخارج ثبت‌شده"/>
        <StatCard label="کالاهای فعال" value={faNumber.format(activeProducts.length)} hint={`${faNumber.format(purchases.length)} رکورد قیمت`}/>
      </div>

      <div className="dashboard-grid">
        <section className="panel panel-wide">
          <div className="panel-head">
            <div>
              <h2>شاخص تورم شخصی</h2>
              <p>شاخص زنجیره‌ای ماهانه با پایه ۱۰۰؛ میانه قیمت‌های هر ماه با آخرین قیمت قابل‌مقایسه همان کالا سنجیده و تغییرها بر اساس الگوی هزینه قبلی شما ترکیب می‌شوند.</p>
            </div>
            {latestComposite ? <Badge tone={latestComposite.coveragePct >= 60 ? 'info' : 'default'}>{faDecimal.format(latestComposite.coveragePct)}٪ پوشش</Badge> : <Badge tone="info">تقریبی</Badge>}
          </div>
          {latestComposite && latestComposite.matched === 0 ? <div className="inline-warning"><Info size={16}/><span>در ماه آخر هیچ کالای دارای سابقه قبلی دوباره قیمت‌گذاری نشده؛ شاخص در این نقطه تغییر نکرده و باید با احتیاط تفسیر شود.</span></div> : null}
          {composite.length > 1 ? <div className="chart-lg"><ResponsiveContainer width="100%" height="100%"><AreaChart data={composite} margin={{ top: 6, right: 12, bottom: 10, left: 8 }}>
            <defs><linearGradient id="indexFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.3}/><stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02}/></linearGradient></defs>
            <CartesianGrid strokeDasharray="4 4" vertical={false}/><XAxis dataKey="month" tickFormatter={formatMonth} tickMargin={10} minTickGap={28} interval="preserveStartEnd"/><YAxis domain={['auto', 'auto']} orientation="right" tickMargin={8}/><Tooltip content={<ChartTooltip valueKey="index" labelFormatter={formatMonth}/>}/><Area type="monotone" dataKey="index" stroke="var(--chart-1)" fill="url(#indexFill)" strokeWidth={3}/>
          </AreaChart></ResponsiveContainer></div> : <EmptyState icon={<LineIcon size={24}/>} title="برای نمودار داده بیشتری لازم است" body="قیمت یک یا چند کالا را در حداقل دو ماه ثبت کنید."/>}
        </section>

        <section className="panel">
          <div className="panel-head"><div><h2>بیشترین افزایش</h2><p>از اولین تا آخرین ثبت هر کالا</p></div></div>
          {topChanges.length ? <div className="chart-md"><ResponsiveContainer width="100%" height="100%"><BarChart data={topChanges} layout="vertical" margin={{ left: 8, right: 8 }}><CartesianGrid strokeDasharray="4 4" horizontal={false}/><XAxis type="number" tickFormatter={value => `${faDecimal.format(Number(value))}٪`}/><YAxis dataKey="name" type="category" width={104}/><Tooltip content={<ChartTooltip valueKey="change" suffix="٪"/>}/><Bar dataKey="change" fill="var(--chart-2)" radius={[5, 5, 5, 5]}/></BarChart></ResponsiveContainer></div> : <EmptyState title="هنوز مقایسه‌ای نداریم" body="هر کالا به حداقل دو ثبت قیمت نیاز دارد."/>}
        </section>
      </div>

      <section className="panel">
        <div className="panel-head"><div><h2>آخرین تغییرات کالاها</h2><p>قیمت فعلی، کمینه و تغییر نسبت به اولین ثبت</p></div><button className="text-button" onClick={() => setPage('products')}>همه کالاها <ChevronLeft size={16}/></button></div>
        {recentStats.length ? <div className="table-wrap"><table><thead><tr><th>کالا</th><th>آخرین قیمت</th><th>کمینه</th><th>تغییر کل</th><th>آخرین ثبت</th></tr></thead><tbody>{recentStats.map(stat => <tr key={stat.product.id} className="clickable" tabIndex={0} role="button" onClick={() => { selectProduct(stat.product.id); setPage('products') }} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectProduct(stat.product.id); setPage('products') } }}><td data-label="کالا"><strong>{stat.product.name}</strong><small>{stat.product.category}</small></td><td data-label="آخرین قیمت">{money(stat.latest!)}</td><td data-label="کمینه">{money(stat.min!)}</td><td data-label="تغییر کل"><span className={`delta ${pctTone(stat.changePct)}`}>{stat.changePct == null || stat.changePct === 0 ? <Minus size={15}/> : stat.changePct > 0 ? <TrendingUp size={15}/> : <TrendingDown size={15}/>} {formatPct(stat.changePct)}</span></td><td data-label="آخرین ثبت">{stat.lastDate ? formatDate(stat.lastDate) : '—'}</td></tr>)}</tbody></table></div> : <EmptyState icon={<Activity size={24}/>} title="هنوز خریدی ثبت نشده" body="اولین خرید را ثبت کنید تا آخرین قیمت‌ها و تغییرات اینجا نمایش داده شوند." action={activeProducts.length ? <button className="button primary small" onClick={() => setPurchaseModal({ open: true })}><Plus size={17}/>ثبت اولین خرید</button> : undefined}/>} 
      </section>
    </>}
  </>

  const selectedStat = stats.find(stat => stat.product.id === selectedProductId)
  const resetProductFilters = () => { setSearch(''); setCategory('همه'); setSortBy('recent') }

  const renderProducts = () => <>
    <div className="page-heading">
      <div><span className="eyebrow">مدیریت کالا</span><h1>کالاها و تاریخچه قیمت</h1><p>واحد مقایسه هر کالا را ثابت نگه دارید تا روند و درصد تغییر قابل اتکا بماند.</p></div>
      <div className="button-row page-heading-actions"><button className="button primary" onClick={() => setPurchaseModal({ open: true, productId: selectedProduct && !selectedProduct.archived ? selectedProductId : undefined })} disabled={!activeProducts.length}><Plus size={18}/>ثبت خرید</button><button className="button secondary" onClick={() => setProductModal({ open: true })}><PackagePlus size={18}/>کالای جدید</button></div>
    </div>

    <div className="product-layout">
      <section ref={productListRef} className="panel product-list-panel">
        <div className="filters">
          <div className="search-box"><Search size={17}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="نام، برند، دسته یا واحد…" aria-label="جست‌وجوی کالا"/>{search ? <button className="search-clear" onClick={() => setSearch('')} aria-label="پاک کردن جست‌وجو"><X size={15}/></button> : null}</div>
          <select value={category} onChange={event => setCategory(event.target.value)} aria-label="فیلتر دسته‌بندی">{categories.map(item => <option key={item}>{item}</option>)}</select>
          <select value={sortBy} onChange={event => setSortBy(event.target.value as 'recent' | 'change' | 'name')} aria-label="مرتب‌سازی کالاها"><option value="recent">آخرین ثبت</option><option value="change">بیشترین تغییر</option><option value="name">نام کالا</option></select>
        </div>
        <div className="filter-meta"><span>{faNumber.format(filteredStats.length)} از {faNumber.format(activeProducts.length)} کالا</span>{filtersActive ? <button className="text-button" onClick={resetProductFilters}>پاک کردن فیلترها</button> : null}</div>

        <div className="product-list">
          {filteredStats.length ? filteredStats.map(stat => <button className={`product-row ${selectedProductId === stat.product.id ? 'active' : ''}`} key={stat.product.id} onClick={() => selectProduct(stat.product.id, true)}><div className="product-row-main"><span className="product-avatar">{stat.product.name.trim().charAt(0)}</span><div><strong>{stat.product.name}</strong><small>{stat.product.category} · {stat.product.unit}</small></div></div><div className="product-row-price"><strong>{stat.latest == null ? 'بدون قیمت' : money(stat.latest)}</strong><span className={`mini-delta ${pctTone(stat.changePct)}`}>{formatPct(stat.changePct)}</span></div></button>) : <EmptyState title="کالایی پیدا نشد" body="جست‌وجو یا فیلترها را تغییر دهید." action={filtersActive ? <button className="button secondary small" onClick={resetProductFilters}>حذف فیلترها</button> : <button className="button secondary small" onClick={() => setProductModal({ open: true })}>کالای جدید</button>}/>} 

          {products.some(product => product.archived) ? <details className="archive-block"><summary><Archive size={14}/>آرشیو ({faNumber.format(products.filter(product => product.archived).length)})</summary>{products.filter(product => product.archived).sort((a, b) => a.name.localeCompare(b.name, 'fa')).map(product => <div className="archived-row" key={product.id}><span>{product.name}</span><button className="text-button" onClick={() => toggleArchive(product)}>بازگردانی</button></div>)}</details> : null}
        </div>
      </section>

      <section ref={productDetailRef} className="panel product-detail">
        {selectedProduct && selectedStat ? <>
          <button className="text-button mobile-list-back" onClick={() => productListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>بازگشت به فهرست کالاها</button>
          <div className="detail-head">
            <div><span className="eyebrow">{selectedProduct.category}</span><h2>{selectedProduct.name}</h2><p>{selectedProduct.brand ? `${selectedProduct.brand} · ` : ''}هر قیمت برای یک {selectedProduct.unit}</p></div>
            <div className="detail-actions"><button className="button primary small detail-buy" onClick={() => setPurchaseModal({ open: true, productId: selectedProduct.id })}><Plus size={16}/>ثبت خرید</button><div className="kebab-row"><button className="icon-button" title="ویرایش" aria-label="ویرایش کالا" onClick={() => setProductModal({ open: true, product: selectedProduct })}><Pencil size={18}/></button><button className="icon-button" title="آرشیو" aria-label="آرشیو کالا" onClick={() => toggleArchive(selectedProduct)}><Archive size={18}/></button><button className="icon-button danger-icon" title="حذف" aria-label="حذف کالا" onClick={() => deleteProduct(selectedProduct)}><Trash2 size={18}/></button></div></div>
          </div>

          <div className="mini-stats"><div><span>آخرین</span><strong>{selectedStat.latest == null ? '—' : money(selectedStat.latest)}</strong></div><div><span>کمینه</span><strong>{selectedStat.min == null ? '—' : money(selectedStat.min)}</strong></div><div><span>بیشینه</span><strong>{selectedStat.max == null ? '—' : money(selectedStat.max)}</strong></div><div><span>تغییر</span><strong className={`tone-${pctTone(selectedStat.changePct)}`}>{formatPct(selectedStat.changePct)}</strong></div></div>

          {selectedBestStore ? <div className="insight-strip"><ShoppingBasket size={17}/><div><strong>کمترین میانگین وزنی: {selectedBestStore.store}</strong><span>{money(selectedBestStore.avg)} · بر اساس {faNumber.format(selectedBestStore.count)} خرید</span></div></div> : null}
          {selectedProduct.notes ? <div className="product-note"><Info size={16}/><span>{selectedProduct.notes}</span></div> : null}

          {selectedHistory.length > 1 ? <div className="chart-lg"><ResponsiveContainer width="100%" height="100%"><LineChart data={selectedHistory} margin={{ top: 6, right: 12, bottom: 10, left: 8 }}><CartesianGrid strokeDasharray="4 4" vertical={false}/><XAxis dataKey="date" tickFormatter={formatDate} tickMargin={10} minTickGap={34} interval="preserveStartEnd"/><YAxis orientation="right" tickFormatter={value => faNumber.format(Number(value))} width={76} tickMargin={8}/><Tooltip content={<ChartTooltip valueKey="price" isMoney currency={settings.currency} compactMoney={settings.compactNumbers} labelFormatter={formatDate}/>}/><Line type="monotone" dataKey="price" stroke="var(--chart-1)" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }}/></LineChart></ResponsiveContainer></div> : <EmptyState icon={<Activity size={24}/>} title="تاریخچه هنوز کوتاه است" body="بعد از ثبت دومین خرید، روند قیمت این کالا اینجا نمایش داده می‌شود." action={<button className="button primary small" onClick={() => setPurchaseModal({ open: true, productId: selectedProduct.id })}><Plus size={17}/>ثبت خرید</button>}/>} 

          <div className="section-head"><h3>سوابق خرید</h3><span>{faNumber.format(selectedPurchasesAll.length)} رکورد</span></div>
          <div className="history-list">{sortPurchases(selectedPurchasesAll).reverse().map(row => { const store = stores.find(item => item.id === row.storeId); return <div className="history-row" key={row.id}><div className="history-date"><strong>{formatDate(row.date)}</strong><small>{store?.name ?? 'بدون فروشگاه'}</small></div><div><strong>{money(row.unitPrice, false)}</strong><small>{faNumber.format(row.quantity)} {selectedProduct.unit} · جمع {money(row.totalPaid)}</small></div><div className="row-actions"><button className="icon-button tiny" aria-label="ویرایش خرید" title="ویرایش خرید" onClick={() => setPurchaseModal({ open: true, purchase: row })}><Pencil size={15}/></button><button className="icon-button tiny danger-icon" aria-label="حذف خرید" title="حذف خرید" onClick={() => deletePurchase(row)}><Trash2 size={15}/></button></div></div> })}</div>
        </> : <EmptyState icon={<Box size={24}/>} title="یک کالا انتخاب کنید" body="جزئیات و نمودار قیمت اینجا نشان داده می‌شود."/>}
      </section>
    </div>
  </>

  const renderFinance = () => <>
    <div className="page-heading">
      <div><span className="eyebrow">حسابداری شخصی ساده</span><h1>دخل‌وخرج واقعی من</h1><p>خریدهای کالا خودکار جزو هزینه‌ها هستند؛ درآمدها و هزینه‌های دیگری مثل اجاره، قبض و رفت‌وآمد را اینجا ثبت کنید.</p></div>
      <div className="button-row page-heading-actions"><button className="button primary" onClick={() => setTransactionModal({ open: true, kind: 'expense' })}><ArrowDownCircle size={18}/>ثبت هزینه</button><button className="button secondary" onClick={() => setTransactionModal({ open: true, kind: 'income' })}><ArrowUpCircle size={18}/>ثبت درآمد</button><button className="button secondary" onClick={() => setFinancialSnapshotModal(true)}><DollarSign size={18}/>{selectedFinancialSnapshot ? 'ویرایش معیار دلار' : 'ثبت معیار دلار'}</button></div>
    </div>

    <section className="panel finance-month-picker"><label className="field"><span>ماه گزارش</span><select value={financeMonth} onChange={event => setFinanceMonth(event.target.value)}>{financeMonths.map(month => <option value={month} key={month}>{formatMonth(month)}{month === currentFinanceMonth ? ' (تا امروز)' : ''}</option>)}</select></label></section>

    <div className="stats-grid">
      <StatCard label="هزینه ماه انتخابی" value={money(financeExpense)} hint={`${money(financePoint?.purchaseExpense ?? 0)} خرید کالا + ${money(financePoint?.otherExpense ?? 0)} سایر هزینه‌ها`}/>
      <StatCard label="درآمد ماه انتخابی" value={money(financeIncome)} hint={`${faNumber.format(currentTransactions.filter(row => row.kind === 'income').length)} ثبت درآمد`}/>
      <StatCard label="مانده ماه انتخابی" value={money(financeIncome - financeExpense)} hint={financeIncome - financeExpense >= 0 ? 'درآمد منهای همه هزینه‌ها' : 'کسری ماه انتخابی'} tone={financeIncome - financeExpense === 0 ? 'neutral' : financeIncome - financeExpense > 0 ? 'down' : 'up'}/>
      <StatCard label="تغییر نسبت به ماه قبل" value={formatPct(monthExpenseChange)} hint={yearExpenseChange == null ? 'برای مقایسه سالانه داده کافی نیست' : `${formatPct(yearExpenseChange)} نسبت به ماه مشابه پارسال`} tone={pctTone(monthExpenseChange)}/>
    </div>

    {!selectedFinancialSnapshot ? <div className="onboarding-callout benchmark-callout"><div className="onboarding-icon"><DollarSign size={20}/></div><div><strong>برای {formatMonth(financeMonth)} نرخ دلار ثبت نشده است</strong><span>نرخ معیار ابتدای ماه را وارد کنید تا درآمد، پس‌انداز ماه و مانده کل پس‌انداز به دلار سنجیده شوند.</span></div><button className="button primary small" onClick={() => setFinancialSnapshotModal(true)}>ثبت نرخ و پس‌انداز</button></div> : <>
      <div className="stats-grid benchmark-stats">
        <StatCard label="درآمد دلاری" value={dollarMoney(financeBenchmark?.incomeUsd)} hint={`${money(financeIncome)} ÷ نرخ ${money(selectedFinancialSnapshot.usdRate, false)}`}/>
        <StatCard label="پس‌انداز دلاری این ماه" value={dollarMoney(financeBenchmark?.monthlySavingUsd)} hint={financeBenchmark?.savingsRatePct == null ? 'درآمدی برای محاسبه نرخ پس‌انداز نیست' : `نرخ پس‌انداز ${formatPct(financeBenchmark.savingsRatePct)}`} tone={growthTone(financeBenchmark?.monthlySavingUsd ?? null)}/>
        <StatCard label="ارزش دلاری کل پس‌انداز" value={dollarMoney(financeBenchmark?.savingsBalanceUsd)} hint={financeBenchmark?.savingsBalance == null ? 'مانده کل پس‌انداز وارد نشده' : yearlySavingsBalanceChange == null ? money(financeBenchmark.savingsBalance) : `${formatPct(yearlySavingsBalanceChange)} نسبت به پارسال`} tone={growthTone(yearlySavingsBalanceChange)}/>
        <StatCard label="رشد درآمد دلاری" value={formatPct(financeBenchmark?.dollarIncomeChangePct)} hint={yearlyDollarIncomeChange == null ? 'نسبت به ماه قبل' : `${formatPct(yearlyDollarIncomeChange)} نسبت به پارسال`} tone={growthTone(financeBenchmark?.dollarIncomeChangePct ?? null)}/>
      </div>

      <section className="panel benchmark-panel">
        <div className="panel-head"><div><h2>درآمد در برابر دلار و تورم شخصی</h2><p>تورم شخصی از تغییر سبد قیمت‌های ثبت‌شده شما محاسبه می‌شود؛ نرخ دلار و مانده کل پس‌انداز دستی هستند.</p></div><div className="row-actions"><button className="icon-button tiny" title="ویرایش معیار" aria-label="ویرایش معیار مالی" onClick={() => setFinancialSnapshotModal(true)}><Pencil size={15}/></button><button className="icon-button tiny danger-icon" title="حذف معیار" aria-label="حذف معیار مالی" onClick={() => deleteFinancialSnapshot(selectedFinancialSnapshot)}><Trash2 size={15}/></button></div></div>
        <div className="benchmark-summary">
          <div><span>رشد اسمی درآمد</span><strong className={`tone-${growthTone(financeBenchmark?.nominalIncomeChangePct ?? null)}`}>{formatPct(financeBenchmark?.nominalIncomeChangePct)}</strong><small>نسبت به ماه قبل</small></div>
          <div><span>تورم شخصی</span><strong className={`tone-${pctTone(financeBenchmark?.personalInflationPct ?? null)}`}>{formatPct(financeBenchmark?.personalInflationPct)}</strong><small>بر پایه سبد واقعی کالاها</small></div>
          <div><span>رشد واقعی درآمد</span><strong className={`tone-${growthTone(financeBenchmark?.realIncomeChangePct ?? null)}`}>{formatPct(financeBenchmark?.realIncomeChangePct)}</strong><small>پس از کسر اثر تورم شخصی</small></div>
        </div>
        {benchmarkChart.some(point => point.incomeUsd != null || point.savingsBalanceUsd != null) ? <div className="chart-lg benchmark-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={benchmarkChart} margin={{ top: 6, right: 12, bottom: 10, left: 8 }}><CartesianGrid strokeDasharray="4 4" vertical={false}/><XAxis dataKey="label" tickMargin={10} minTickGap={24}/><YAxis orientation="right" tickFormatter={value => faNumber.format(Number(value))} width={76}/><Tooltip content={<ChartTooltip isMoney currency="دلار" series={[{ key: 'incomeUsd', label: 'درآمد دلاری' }, { key: 'savingsBalanceUsd', label: 'کل پس‌انداز دلاری' }]}/>} /><Line type="monotone" dataKey="incomeUsd" connectNulls stroke="var(--chart-1)" strokeWidth={3} dot={{ r: 3 }}/><Line type="monotone" dataKey="savingsBalanceUsd" connectNulls stroke="var(--chart-4)" strokeWidth={3} dot={{ r: 3 }}/></LineChart></ResponsiveContainer></div> : null}
        <div className="benchmark-footnote"><Info size={16}/><span>نرخ ثبت‌شده برای {formatDate(selectedFinancialSnapshot.rateDate)} است{selectedFinancialSnapshot.note ? `؛ ${selectedFinancialSnapshot.note}` : ''}. نتیجه‌ها فقط برای خودسنجی هستند و توصیه سرمایه‌گذاری محسوب نمی‌شوند.</span></div>
      </section>
    </>}

    <div className="finance-grid">
      <section className="panel panel-wide">
        <div className="panel-head"><div><h2>روند ماهانه دخل‌وخرج</h2><p>جمع خریدهای ثبت‌شده و سایر هزینه‌ها در ماه‌های هجری شمسی</p></div><Badge tone="info">{formatMonth(financeMonth)}{financeMonth === currentFinanceMonth ? ' تا امروز' : ''}</Badge></div>
        {financeChart.length ? <div className="chart-lg"><ResponsiveContainer width="100%" height="100%"><BarChart data={financeChart} margin={{ top: 6, right: 12, bottom: 10, left: 8 }}><CartesianGrid strokeDasharray="4 4" vertical={false}/><XAxis dataKey="label" tickMargin={10} minTickGap={24}/><YAxis orientation="right" tickFormatter={value => faNumber.format(Number(value))} width={80}/><Tooltip content={<ChartTooltip isMoney currency={settings.currency} compactMoney={settings.compactNumbers} series={[{ key: 'expense', label: 'هزینه' }, { key: 'income', label: 'درآمد' }]}/>} /><Bar dataKey="expense" name="هزینه" fill="var(--chart-2)" radius={[6, 6, 0, 0]}/><Bar dataKey="income" name="درآمد" fill="var(--chart-4)" radius={[6, 6, 0, 0]}/></BarChart></ResponsiveContainer></div> : <EmptyState icon={<ReceiptText size={24}/>} title="هنوز تراکنشی ثبت نشده" body="با ثبت خرید، هزینه یا درآمد، نمودار ماهانه ساخته می‌شود."/>}
      </section>

      <section className="panel">
        <div className="panel-head"><div><h2>سبد هزینه ماه انتخابی</h2><p>سهم دسته‌ها از مخارج واقعی شما</p></div></div>
        {currentExpenseCategories.length ? <div className="pie-wrap"><div className="chart-md"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={currentExpenseCategories} dataKey="spend" nameKey="name" innerRadius="48%" outerRadius="78%" paddingAngle={2}>{currentExpenseCategories.map((_, index) => <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]}/>)}</Pie><Tooltip content={<ChartTooltip valueKey="spend" isMoney currency={settings.currency} compactMoney={settings.compactNumbers}/>} /></PieChart></ResponsiveContainer></div><div className="pie-legend">{currentExpenseCategories.slice(0, 8).map((item, index) => <div key={item.name}><span style={{ background: CHART_COLORS[index % CHART_COLORS.length] }}/><strong>{item.name}</strong><small>{money(item.spend)}</small></div>)}</div></div> : <EmptyState title="هزینه‌ای در این ماه نیست" body="خریدها و هزینه‌های مستقل اینجا یکجا دیده می‌شوند."/>}
      </section>
    </div>

    <section className="panel">
      <div className="panel-head"><div><h2>دفتر ماه انتخابی</h2><p>خریدهای کالا و تراکنش‌های مستقل، بدون ثبت تکراری</p></div><span>{faNumber.format(currentLedger.length)} رکورد</span></div>
      {currentLedger.length ? <div className="transaction-list">{currentLedger.map(row => <div className="transaction-row" key={`${row.purchase ? 'purchase' : 'transaction'}-${row.id}`}><span className={`transaction-kind ${row.kind}`} aria-hidden="true">{row.kind === 'income' ? <ArrowUpCircle size={18}/> : <ArrowDownCircle size={18}/>}</span><div className="transaction-main"><strong>{row.title}</strong><small>{row.category} · {formatDate(row.date)}</small></div><strong className={`transaction-amount ${row.kind}`}>{row.kind === 'income' ? '+' : '−'} {money(row.amount)}</strong><div className="row-actions"><button className="icon-button tiny" aria-label="ویرایش رکورد" onClick={() => row.purchase ? setPurchaseModal({ open: true, purchase: row.purchase }) : setTransactionModal({ open: true, transaction: row.transaction })}><Pencil size={15}/></button><button className="icon-button tiny danger-icon" aria-label="حذف رکورد" onClick={() => row.purchase ? deletePurchase(row.purchase) : row.transaction && deleteTransaction(row.transaction)}><Trash2 size={15}/></button></div></div>)}</div> : <EmptyState title="دفتر این ماه خالی است" body="اولین هزینه، درآمد یا خرید را ثبت کنید."/>}
    </section>
  </>

  const renderAnalytics = () => <>
    <div className="page-heading"><div><span className="eyebrow">تحلیل عمیق</span><h1>تحلیل تورم و نوسان</h1><p>بازه زمانی را محدود کنید و رفتار هر کالا، دسته و فروشگاه را مقایسه کنید.</p></div></div>

    <section className="panel filter-panel">
      <div className="filter-grid">
        <div className="field"><span>از تاریخ</span><PersianDatePicker value={rangeFrom} onChange={setRangeFrom} max={todayISO()} allowClear ariaLabel="از تاریخ" placeholder="انتخاب تاریخ شروع"/></div>
        <div className="field"><span>تا تاریخ</span><PersianDatePicker value={rangeTo} onChange={setRangeTo} max={todayISO()} allowClear ariaLabel="تا تاریخ" placeholder="انتخاب تاریخ پایان"/></div>
        <label className="field field-span-2"><span>کالا برای تحلیل جزئی</span><select value={selectedProductId} onChange={event => setSelectedProductId(event.target.value)}>{activeProducts.map(product => <option value={product.id} key={product.id}>{product.name}</option>)}</select></label>
      </div>
      <div className="quick-ranges" aria-label="بازه‌های سریع"><button className={rangeFrom === lastNDaysISO(30) && rangeTo === todayISO() ? 'active' : ''} onClick={() => applyQuickRange(30)}>۳۰ روز</button><button className={rangeFrom === lastNDaysISO(90) && rangeTo === todayISO() ? 'active' : ''} onClick={() => applyQuickRange(90)}>۹۰ روز</button><button className={rangeFrom === lastNDaysISO(365) && rangeTo === todayISO() ? 'active' : ''} onClick={() => applyQuickRange(365)}>یک سال</button><button className={!rangeFrom && rangeTo === todayISO() ? 'active' : ''} onClick={() => applyQuickRange()}>همه تاریخ</button></div>
      {rangeInvalid ? <div className="filter-error"><Info size={15}/>تاریخ شروع باید قبل از تاریخ پایان باشد.</div> : null}
    </section>

    <div className="stats-grid three"><StatCard label={`تغییر ${selectedProduct?.name ?? 'کالا'}`} value={formatPct(periodChange)} hint={`${faNumber.format(filteredProductHistory.length)} ثبت در این بازه`} tone={pctTone(periodChange)}/><StatCard label="خریدهای بازه" value={faNumber.format(filteredPurchases.length)} hint={money(totalSpend(filteredPurchases))}/><StatCard label="کالاهای دارای داده" value={faNumber.format(new Set(filteredPurchases.map(purchase => purchase.productId)).size)} hint="در بازه انتخاب‌شده"/></div>

    <div className="analytics-grid">
      <section className="panel panel-wide"><div className="panel-head"><div><h2>روند قیمت {selectedProduct?.name ?? ''}</h2><p>قیمت واحد مؤثر پس از تخفیف در بازه انتخاب‌شده</p></div></div>{filteredProductHistory.length > 1 ? <div className="chart-lg"><ResponsiveContainer width="100%" height="100%"><LineChart data={sortPurchases(filteredProductHistory)} margin={{ top: 6, right: 12, bottom: 10, left: 8 }}><CartesianGrid strokeDasharray="4 4" vertical={false}/><XAxis dataKey="date" tickFormatter={formatDate} tickMargin={10} minTickGap={34} interval="preserveStartEnd"/><YAxis orientation="right" tickFormatter={value => faNumber.format(Number(value))} width={80} tickMargin={8}/><Tooltip content={<ChartTooltip valueKey="unitPrice" isMoney currency={settings.currency} compactMoney={settings.compactNumbers} labelFormatter={formatDate}/>}/><Line type="monotone" dataKey="unitPrice" stroke="var(--chart-1)" strokeWidth={3}/></LineChart></ResponsiveContainer></div> : <EmptyState title="داده کافی نیست" body="برای این کالا در بازه انتخابی حداقل دو قیمت لازم است."/>}</section>

      <section className="panel"><div className="panel-head"><div><h2>تورم دسته‌ها</h2><p>تغییر مرکب کالاهای هر دسته بر اساس سهم هزینه در بازه انتخابی</p></div></div>{catInflation.length ? <div className="chart-md"><ResponsiveContainer width="100%" height="100%"><BarChart data={catInflation}><CartesianGrid strokeDasharray="4 4" vertical={false}/><XAxis dataKey="category" tickMargin={10} minTickGap={18}/><YAxis orientation="right" tickMargin={8} tickFormatter={value => `${faDecimal.format(Number(value))}٪`}/><Tooltip content={<ChartTooltip valueKey="change" suffix="٪"/>}/><Bar dataKey="change" fill="var(--chart-2)" radius={[7, 7, 0, 0]}/></BarChart></ResponsiveContainer></div> : <EmptyState title="داده کافی نیست" body="حداقل دو قیمت برای چند کالا ثبت کنید."/>}</section>

      <section className="panel"><div className="panel-head"><div><h2>نوسان قیمت کالاها</h2><p>شدت متوسط تغییر بین ثبت‌های متوالی؛ عدد بیشتر یعنی قیمت ناپایدارتر</p></div></div>{volatility.length ? <div className="chart-md"><ResponsiveContainer width="100%" height="100%"><BarChart data={volatility} layout="vertical"><CartesianGrid strokeDasharray="4 4" horizontal={false}/><XAxis type="number" tickFormatter={value => `${faDecimal.format(Number(value))}٪`}/><YAxis type="category" dataKey="name" width={104}/><Tooltip content={<ChartTooltip valueKey="volatility" suffix="٪"/>}/><Bar dataKey="volatility" fill="var(--chart-3)" radius={[5, 5, 5, 5]}/></BarChart></ResponsiveContainer></div> : <EmptyState title="داده کافی نیست" body="برای سنجش نوسان به چند ثبت متوالی نیاز است."/>}</section>

      <section className="panel"><div className="panel-head"><div><h2>مقایسه فروشگاه‌ها</h2><p>میانگین وزنی قیمت {selectedProduct?.name ?? 'کالای انتخابی'} در هر فروشگاه</p></div>{bestStore ? <Badge tone="success">کمترین: {bestStore.store}</Badge> : null}</div>{storeData.length ? <div className="chart-md"><ResponsiveContainer width="100%" height="100%"><BarChart data={storeData}><CartesianGrid strokeDasharray="4 4" vertical={false}/><XAxis dataKey="store" tickMargin={10} minTickGap={18}/><YAxis orientation="right" tickMargin={8} tickFormatter={value => faNumber.format(Number(value))} width={76}/><Tooltip content={<ChartTooltip valueKey="avg" isMoney currency={settings.currency} compactMoney={settings.compactNumbers}/>}/><Bar dataKey="avg" fill="var(--chart-4)" radius={[7, 7, 0, 0]}/></BarChart></ResponsiveContainer></div> : <EmptyState title="فروشگاهی ثبت نشده" body="هنگام ثبت خرید نام فروشگاه را وارد کنید تا این مقایسه ساخته شود."/>}</section>

      <section className="panel"><div className="panel-head"><div><h2>سهم هزینه دسته‌ها</h2><p>تقسیم مبلغ خریدهای ثبت‌شده در بازه انتخابی</p></div></div>{categorySpend.length ? <div className="pie-wrap"><div className="chart-md"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={categorySpend} dataKey="spend" nameKey="name" innerRadius="48%" outerRadius="78%" paddingAngle={2}>{categorySpend.map((_, index) => <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]}/>)}</Pie><Tooltip content={<ChartTooltip valueKey="spend" isMoney currency={settings.currency} compactMoney={settings.compactNumbers}/>}/></PieChart></ResponsiveContainer></div><div className="pie-legend">{categorySpend.map((item, index) => <div key={item.name}><span style={{ background: CHART_COLORS[index % CHART_COLORS.length] }}/><strong>{item.name}</strong><small>{money(item.spend)}</small></div>)}</div></div> : <EmptyState title="هزینه‌ای در بازه نیست" body="با ثبت خرید، سهم هزینه دسته‌ها اینجا دیده می‌شود."/>}</section>
    </div>
  </>

  const renderData = () => <>
    <div className="page-heading"><div><span className="eyebrow">کنترل داده</span><h1>داده، حریم خصوصی و تنظیمات</h1><p>داده‌های عملیاتی داخل مرورگر نگه‌داری می‌شوند؛ اپ بک‌اند، حساب کاربری یا ابزار رهگیری ندارد.</p></div></div>
    <div className="settings-grid">
      <section className="panel">
        <div className="settings-title"><div className="settings-icon"><ShieldCheck size={22}/></div><div><h2>حریم خصوصی و آفلاین</h2><p>بعد از اولین بارگذاری نسخه نهایی، فایل‌های اپ برای استفاده آفلاین در مرورگر نگه‌داری می‌شوند.</p></div></div>
        <div className="settings-list"><div><span><CloudOff size={17}/>ارسال داده کاربر</span><strong>ندارد</strong></div><div><span><HardDrive size={17}/>محل داده</span><strong>IndexedDB مرورگر</strong></div><div><span><WifiOff size={17}/>حالت آفلاین</span><strong>{import.meta.env.DEV ? 'در حالت توسعه غیرفعال است' : navigator.serviceWorker?.controller ? 'فعال' : ('serviceWorker' in navigator ? 'در حال آماده‌سازی' : 'پشتیبانی مرورگر محدود است')}</strong></div><div><span><Database size={17}/>فضای فعلی</span><strong>{storageText}</strong></div><div><span><Info size={17}/>نسخه اپ</span><strong>{APP_VERSION}</strong></div><div><span><Download size={17}/>آخرین پشتیبان کامل</span><strong>{lastBackupAt && !Number.isNaN(lastBackupAt.getTime()) ? lastBackupAt.toLocaleDateString('fa-IR-u-ca-persian') : 'ثبت نشده'}</strong></div></div>
        <div className="button-row settings-actions"><button className="button secondary" onClick={persistStorage}><HardDrive size={18}/>درخواست ذخیره‌سازی پایدار</button>{installEvent ? <button className="button primary" onClick={async () => { await installEvent.prompt(); setInstallEvent(null) }}><Download size={18}/>نصب اپ</button> : null}</div>
        <div className="notice"><Info size={17}/><span>IndexedDB رمزگذاری سطح اپ محسوب نمی‌شود. اگر دستگاه یا پروفایل مرورگر در اختیار فرد دیگری باشد، داده محلی ممکن است قابل دسترسی باشد. برای جابه‌جایی فایل، پشتیبان رمزدار مناسب‌تر است.</span></div>
      </section>

      <section className="panel">
        <div className="settings-title"><div className="settings-icon"><LockKeyhole size={22}/></div><div><h2>پشتیبان و انتقال داده</h2><p>JSON برای بازیابی کامل، CSV برای تحلیل بیرونی و فایل رمزدار برای جابه‌جایی امن‌تر.</p></div></div>
        <label className="field"><span>رمز پشتیبان رمزدار</span><input type="password" value={backupPassword} onChange={event => setBackupPassword(event.target.value)} placeholder="حداقل ۸ کاراکتر" autoComplete="new-password"/></label>
        <div className="backup-buttons"><button className="button primary" onClick={encryptedExport}><LockKeyhole size={18}/>پشتیبان رمزدار</button><button className="button secondary" onClick={plainExport}><FileJson size={18}/>خروجی JSON</button><button className="button secondary" onClick={csvExport}><FileSpreadsheet size={18}/>خروجی CSV</button></div>
        <hr/>
        <div className="import-row"><label className="field"><span>روش ورود</span><select value={importMode} onChange={event => setImportMode(event.target.value as 'replace' | 'merge')}><option value="replace">جایگزینی کامل داده فعلی</option><option value="merge">ادغام داده‌ها و حفظ تنظیمات فعلی</option></select></label><button className="button secondary" onClick={() => fileInputRef.current?.click()}><Upload size={18}/>ورود پشتیبان</button><input ref={fileInputRef} type="file" accept=".json,.gheymat,application/json" hidden onChange={event => event.target.files?.[0] && importFile(event.target.files[0])}/></div>
      </section>

      <section className="panel">
        <div className="settings-title"><div className="settings-icon"><Sun size={22}/></div><div><h2>نمایش</h2><p>تنظیمات ظاهری روی همین دستگاه ذخیره می‌شوند.</p></div></div>
        <div className="theme-picker"><button className={settings.theme === 'system' ? 'active' : ''} onClick={() => setTheme('system')}><Settings size={18}/>سیستم</button><button className={settings.theme === 'light' ? 'active' : ''} onClick={() => setTheme('light')}><Sun size={18}/>روشن</button><button className={settings.theme === 'dark' ? 'active' : ''} onClick={() => setTheme('dark')}><Moon size={18}/>تیره</button></div>
        <label className="field"><span>واحد پول</span><input key={settings.currency} defaultValue={settings.currency} disabled={purchases.length + transactions.length + financialSnapshots.length > 0} onBlur={event => db.settings.put({ ...settings, currency: event.target.value.trim() || 'تومان' })} placeholder="تومان"/><small className="field-help">{purchases.length + transactions.length + financialSnapshots.length ? 'برای جلوگیری از برچسب‌گذاری اشتباه مبالغ قبلی، واحد پول بعد از اولین رکورد مالی قفل می‌شود.' : 'این گزینه واحد نمایش همه مبالغ است؛ قبل از شروع ثبت داده آن را مشخص کنید.'}</small></label>
        <label className="switch-row"><div><strong>نمایش اعداد فشرده</strong><small>برای کارت‌ها و نمودارها از نمایش‌هایی مثل «۱٫۲ میلیون» استفاده شود.</small></div><input type="checkbox" checked={settings.compactNumbers} onChange={event => db.settings.put({ ...settings, compactNumbers: event.target.checked })}/></label>
      </section>

      <section className="panel">
        <div className="settings-title"><div className="settings-icon"><ShoppingBasket size={22}/></div><div><h2>مدیریت فروشگاه‌ها</h2><p>نام‌های اشتباه را اصلاح کنید؛ حذف فروشگاه فقط ارتباط نام فروشگاه را از خریدها پاک می‌کند.</p></div></div>
        {stores.length ? <div className="store-list">{[...stores].sort((a, b) => a.name.localeCompare(b.name, 'fa')).map(store => <div className="store-manage-row" key={store.id}><div><strong>{store.name}</strong><small>{faNumber.format(purchases.filter(purchase => purchase.storeId === store.id).length)} خرید</small></div><div className="row-actions"><button className="icon-button tiny" onClick={() => renameStore(store)} title="ویرایش فروشگاه" aria-label="ویرایش فروشگاه"><Pencil size={15}/></button><button className="icon-button tiny danger-icon" onClick={() => deleteStore(store)} title="حذف فروشگاه" aria-label="حذف فروشگاه"><Trash2 size={15}/></button></div></div>)}</div> : <EmptyState title="فروشگاهی ثبت نشده" body="هنگام ثبت خرید می‌توانید نام فروشگاه را بنویسید."/>}
      </section>

      <section className="panel danger-panel">
        <div className="settings-title"><div className="settings-icon"><Database size={22}/></div><div><h2>ابزار داده</h2><p>برای تست می‌توانید روی دیتابیس خالی داده نمونه بسازید یا داده‌های عملیاتی را پاک کنید.</p></div></div>
        <div className="button-row"><button className="button secondary" onClick={loadDemo}><Gauge size={18}/>افزودن داده نمونه</button><button className="button danger" onClick={clearAll}><Trash2 size={18}/>پاک کردن همه داده‌ها</button></div>
      </section>
    </div>
  </>

  const navigate = (nextPage: PageId) => {
    setSidebarOpen(false)
    if (nextPage === page) {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
      return
    }
    setPage(nextPage)
  }

  return <div className="app-shell">
    <Sidebar page={page} open={sidebarOpen} onNavigate={navigate} onClose={() => setSidebarOpen(false)}/>
    <main className="main">
      <Topbar page={page} online={online} isDark={isDark} onMenu={() => setSidebarOpen(true)} onToggleTheme={() => setTheme(isDark ? 'light' : 'dark')}/>
      <div className="page-content">{page==='dashboard'?renderDashboard():page==='products'?renderProducts():page==='finance'?renderFinance():page==='analytics'?renderAnalytics():renderData()}</div>
    </main>
    <MobileNavigation page={page} onNavigate={navigate}/>

    <Modal open={productModal.open} title={productModal.product?'ویرایش کالا':'افزودن کالای جدید'} onClose={()=>setProductModal({open:false})} wide><ProductForm product={productModal.product} products={products} purchaseCount={productModal.product ? purchases.filter(row => row.productId === productModal.product!.id).length : 0} onDone={()=>setProductModal({open:false})} onCancel={()=>setProductModal({open:false})} pushToast={pushToast}/></Modal>
    <Modal open={purchaseModal.open} title={purchaseModal.purchase?'ویرایش خرید':'ثبت خرید جدید'} onClose={()=>setPurchaseModal({open:false})}><PurchaseForm key={`${purchaseModal.purchase?.id??'new'}-${purchaseModal.productId??''}`} products={products} stores={stores} purchase={purchaseModal.purchase} initialProductId={purchaseModal.productId} currency={settings.currency} onDone={()=>setPurchaseModal({open:false})} onCancel={()=>setPurchaseModal({open:false})} pushToast={pushToast}/></Modal>
    <Modal open={transactionModal.open} title={transactionModal.transaction?'ویرایش تراکنش':transactionModal.kind==='income'?'ثبت درآمد':'ثبت هزینه'} onClose={()=>setTransactionModal({open:false})}><TransactionForm key={`${transactionModal.transaction?.id??'new'}-${transactionModal.kind??''}`} transactions={transactions} transaction={transactionModal.transaction} initialKind={transactionModal.kind} currency={settings.currency} onDone={()=>setTransactionModal({open:false})} onCancel={()=>setTransactionModal({open:false})} pushToast={pushToast}/></Modal>
    <Modal open={financialSnapshotModal} title={selectedFinancialSnapshot ? `ویرایش معیار ${formatMonth(financeMonth)}` : `ثبت معیار ${formatMonth(financeMonth)}`} onClose={()=>setFinancialSnapshotModal(false)}><FinancialSnapshotForm key={`${financeMonth}-${selectedFinancialSnapshot?.updatedAt ?? 'new'}`} month={financeMonth} snapshot={selectedFinancialSnapshot} currency={settings.currency} onDone={()=>setFinancialSnapshotModal(false)} onCancel={()=>setFinancialSnapshotModal(false)} pushToast={pushToast}/></Modal>
    <Modal open={!!renameTarget} title="ویرایش نام فروشگاه" onClose={()=>setRenameTarget(null)}><form className="form-grid" onSubmit={saveStoreRename}><label className="field field-span-2"><span>نام فروشگاه</span><input autoFocus value={renameValue} onChange={e=>setRenameValue(e.target.value)} required/></label><div className="form-actions field-span-2"><button type="submit" className="button primary"><Check size={18}/>ذخیره</button><button type="button" className="button ghost" onClick={()=>setRenameTarget(null)}>انصراف</button></div></form></Modal>
    <ConfirmDialog open={!!confirmState} title={confirmState?.title??''} body={confirmState?.body??''} confirmText={confirmState?.confirmText} danger={confirmState?.danger} onClose={()=>closeConfirm(false)} onConfirm={()=>closeConfirm(true)}/>
    <div className="toast-stack" role="status" aria-live="polite" aria-atomic="true">{toasts.map(t=><div className={`toast ${t.kind}`} key={t.id}>{t.kind==='ok'?<Check size={17}/>:t.kind==='error'?<X size={17}/>:<Info size={17}/>}<span>{t.text}</span></div>)}</div>
  </div>
}
