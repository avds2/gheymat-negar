import { comparePersianText } from '../lib/text'
import { useState, type FormEvent } from 'react'
import { Check } from 'lucide-react'
import { db, uid } from '../lib/db'
import { PersianDatePicker } from './date-picker'
import { formatMoney, formatMonth, todayISO } from '../lib/format'
import { normalizeStoreName, sameNormalizedText } from '../lib/text'
import type { FinancialSnapshot, FinancialTransaction, Product, Purchase, Store, TransactionKind } from '../lib/types'
import { addDaysISO, shiftPersianMonthISO, startOfPersianMonthISO } from '../lib/persian-date'

type ToastKind = 'ok' | 'error' | 'info'
type PushToast = (text: string, kind?: ToastKind) => void

interface ProductFormProps {
  product?: Product | null
  products: Product[]
  purchaseCount: number
  onDone: () => void
  onCancel: () => void
  pushToast: PushToast
}

export function ProductForm({ product, products, purchaseCount, onDone, onCancel, pushToast }: ProductFormProps) {
  const [name, setName] = useState(product?.name ?? '')
  const [category, setCategory] = useState(product?.category ?? '')
  const [unit, setUnit] = useState(product?.unit ?? 'عدد')
  const [brand, setBrand] = useState(product?.brand ?? '')
  const [notes, setNotes] = useState(product?.notes ?? '')

  const unitLocked = Boolean(product && purchaseCount > 0)
  const knownCategories = [...new Set(products.map(item => item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fa'))
  const knownUnits = [...new Set(products.map(item => item.unit).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fa'))

  async function submit(event: FormEvent) {
    event.preventDefault()
    const cleanName = name.trim()
    const cleanBrand = brand.trim()
    const cleanUnit = unit.trim() || 'عدد'
    if (!cleanName) return pushToast('نام کالا را وارد کنید.', 'error')
    const duplicate = products.some(item => item.id !== product?.id && sameNormalizedText(item.name, cleanName) && sameNormalizedText(item.brand ?? '', cleanBrand) && sameNormalizedText(item.unit, cleanUnit))
    if (duplicate) return pushToast('کالایی با همین نام، برند و واحد مقایسه از قبل وجود دارد.', 'error')

    const now = new Date().toISOString()
    const common = {
      name: cleanName,
      category: category.trim() || 'بدون دسته‌بندی',
      unit: cleanUnit,
      brand: cleanBrand || undefined,
      notes: notes.trim() || undefined,
      updatedAt: now
    }

    const row: Product = product
      ? { ...product, ...common }
      : { id: uid('prd'), ...common, archived: false, createdAt: now }

    try {
      await db.products.put(row)
      pushToast(product ? 'کالا ویرایش شد.' : 'کالا اضافه شد.')
      onDone()
    } catch {
      pushToast('ذخیره کالا ناموفق بود. دوباره تلاش کنید.', 'error')
    }
  }

  return <form onSubmit={submit} className="form-grid product-form">
    <label className="field field-span-2">
      <span>نام کالا *</span>
      <input value={name} onChange={event => setName(event.target.value)} placeholder="مثلاً برنج طارم" autoFocus required maxLength={500}/>
    </label>
    <label className="field">
      <span>دسته‌بندی</span>
      <input list="product-categories" value={category} onChange={event => setCategory(event.target.value)} placeholder="مثلاً خوراکی" maxLength={500}/>
      <datalist id="product-categories">{knownCategories.map(item => <option value={item} key={item}/>)}</datalist>
    </label>
    <label className="field">
      <span>برند / مدل</span>
      <input value={brand} onChange={event => setBrand(event.target.value)} placeholder="اختیاری" maxLength={500}/>
    </label>
    <label className="field field-with-help field-span-2">
      <span>واحد مقایسه</span>
      <input list="product-units" value={unit} onChange={event => setUnit(event.target.value)} placeholder="کیلوگرم، عدد، بسته…" maxLength={500} disabled={unitLocked}/>
      <datalist id="product-units">{knownUnits.map(item => <option value={item} key={item}/>)}</datalist>
      <small className="field-help">{unitLocked ? 'برای حفظ یکپارچگی تاریخچه، این واحد بعد از اولین خرید قفل می‌شود.' : 'قیمت‌های این کالا بر اساس همین واحد با هم مقایسه می‌شوند.'}</small>
    </label>
    <label className="field field-span-2">
      <span>یادداشت</span>
      <textarea value={notes} onChange={event => setNotes(event.target.value)} placeholder="جزئیات ثابت درباره این کالا" rows={3} maxLength={10_000}/>
    </label>
    <div className="form-actions field-span-2">
      <button className="button primary" type="submit"><Check size={18}/>{product ? 'ذخیره تغییرات' : 'افزودن کالا'}</button>
      <button type="button" className="button ghost" onClick={onCancel}>انصراف</button>
    </div>
  </form>
}

interface PurchaseFormProps {
  products: Product[]
  stores: Store[]
  purchase?: Purchase | null
  initialProductId?: string
  currency: string
  onDone: () => void
  onCancel: () => void
  pushToast: PushToast
}

export function PurchaseForm({ products, stores, purchase, initialProductId, currency, onDone, onCancel, pushToast }: PurchaseFormProps) {
  const initialStore = purchase?.storeId ? stores.find(store => store.id === purchase.storeId)?.name ?? '' : ''
  const selectableProducts = products
    .filter(product => !product.archived || product.id === purchase?.productId)
    .sort((left, right) => comparePersianText(left.name, right.name)
      || comparePersianText(left.brand ?? '', right.brand ?? '')
      || left.createdAt.localeCompare(right.createdAt)
      || left.id.localeCompare(right.id))
  const [productId, setProductId] = useState(purchase?.productId ?? initialProductId ?? selectableProducts[0]?.id ?? '')
  const [date, setDate] = useState(purchase?.date ?? todayISO())
  const [storeName, setStoreName] = useState(initialStore)
  const [quantity, setQuantity] = useState(String(purchase?.quantity ?? 1))
  const [totalPaid, setTotalPaid] = useState(purchase ? String(purchase.totalPaid) : '')
  const [listedTotal, setListedTotal] = useState(purchase?.discount ? String(purchase.totalPaid + purchase.discount) : '')
  const [note, setNote] = useState(purchase?.note ?? '')
  const [touched, setTouched] = useState({ date: false, quantity: false, totalPaid: false, listedTotal: false })

  const product = products.find(item => item.id === productId)
  const qty = Number(quantity)
  const paid = Number(totalPaid)
  const listed = listedTotal === '' ? 0 : Number(listedTotal)
  const quantityInvalid = !Number.isFinite(qty) || qty <= 0
  const totalPaidInvalid = !Number.isFinite(paid) || paid <= 0
  const listedTotalInvalid = listedTotal !== '' && (!Number.isFinite(listed) || listed <= 0 || listed < paid)
  const effectiveUnitPrice = !quantityInvalid && !totalPaidInvalid ? paid / qty : 0
  const discount = listedTotal !== '' && !listedTotalInvalid ? listed - paid : 0
  const dateInvalid = !date || date > todayISO()
  const formInvalid = !productId || quantityInvalid || totalPaidInvalid || listedTotalInvalid || dateInvalid
  const showDateError = touched.date && dateInvalid
  const showQuantityError = touched.quantity && quantityInvalid
  const showTotalPaidError = touched.totalPaid && totalPaidInvalid
  const showListedTotalError = touched.listedTotal && listedTotalInvalid
  const markTouched = (field: keyof typeof touched) => setTouched(current => ({ ...current, [field]: true }))

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (formInvalid) {
      if (dateInvalid) return pushToast('تاریخ خرید نمی‌تواند بعد از امروز باشد.', 'error')
      if (quantityInvalid) return pushToast('مقدار خرید باید بیشتر از صفر باشد.', 'error')
      if (totalPaidInvalid) return pushToast('مبلغ پرداخت‌شده باید بیشتر از صفر باشد.', 'error')
      if (listedTotalInvalid) return pushToast('مبلغ قبل از تخفیف نمی‌تواند از مبلغ پرداخت‌شده کمتر باشد.', 'error')
      return pushToast('اطلاعات فرم را کامل کنید.', 'error')
    }

    try {
      await db.transaction('rw', [db.stores, db.purchases], async () => {
        let storeId: string | undefined
        const normalized = normalizeStoreName(storeName)

        if (normalized) {
          const currentStores = await db.stores.toArray()
          const existing = currentStores.find(store => sameNormalizedText(store.name, normalized))
          if (existing) {
            storeId = existing.id
          } else {
            const newStore: Store = { id: uid('str'), name: normalized, createdAt: new Date().toISOString() }
            await db.stores.add(newStore)
            storeId = newStore.id
          }
        }

        const row: Purchase = {
          id: purchase?.id ?? uid('buy'),
          productId,
          storeId,
          date,
          quantity: qty,
          listedUnitPrice: listedTotal !== '' ? listed / qty : undefined,
          unitPrice: paid / qty,
          totalPaid: paid,
          discount: discount || undefined,
          note: note.trim() || undefined,
          createdAt: purchase?.createdAt ?? new Date().toISOString()
        }

        await db.purchases.put(row)
      })
      pushToast(purchase ? 'خرید ویرایش شد.' : 'خرید ثبت شد.')
      onDone()
    } catch {
      pushToast('ذخیره خرید ناموفق بود. داده‌ها تغییر نکردند.', 'error')
    }
  }

  return <form onSubmit={submit} className="form-grid">
    <label className="field field-span-2">
      <span>کالا *</span>
      <select value={productId} onChange={event => setProductId(event.target.value)} required>
        {selectableProducts.map(item => <option key={item.id} value={item.id}>{item.name}{item.brand ? ` — ${item.brand}` : ''}</option>)}
      </select>
    </label>
    <div className={`field ${showDateError ? 'field-invalid' : ''}`}>
      <span>تاریخ خرید *</span>
      <PersianDatePicker value={date} onChange={setDate} max={todayISO()} required ariaLabel="تاریخ خرید" onBlur={() => markTouched('date')}/>
      {showDateError ? <small className="field-error">تاریخ باید امروز یا قبل‌تر باشد.</small> : null}
    </div>
    <label className="field">
      <span>فروشگاه</span>
      <input list="stores-list" value={storeName} onChange={event => setStoreName(event.target.value)} placeholder="نام فروشگاه" maxLength={500}/>
      <datalist id="stores-list">{stores.map(store => <option value={store.name} key={store.id}/>)}</datalist>
    </label>
    <label className={`field ${showQuantityError ? 'field-invalid' : ''}`}>
      <span>تعداد / مقدار ({product?.unit ?? 'واحد'}) *</span>
      <input inputMode="decimal" type="number" min="0.0001" step="any" value={quantity} onChange={event => setQuantity(event.target.value)} onBlur={() => markTouched('quantity')} required/>
      {showQuantityError ? <small className="field-error">مقدار باید بیشتر از صفر باشد.</small> : null}
    </label>
    <label className={`field ${showTotalPaidError ? 'field-invalid' : ''}`}>
      <span>مبلغ واقعی پرداخت‌شده ({currency}) *</span>
      <input inputMode="numeric" type="number" min="0.0001" step="any" value={totalPaid} onChange={event => setTotalPaid(event.target.value)} onBlur={() => markTouched('totalPaid')} placeholder="مثلاً ۷۰۰۰۰" required/>
      {showTotalPaidError ? <small className="field-error">مبلغ پرداخت‌شده باید بیشتر از صفر باشد.</small> : null}
    </label>
    <label className={`field ${showListedTotalError ? 'field-invalid' : ''}`}>
      <span>مبلغ کل قبل از تخفیف</span>
      <input inputMode="numeric" type="number" min="0.0001" step="any" value={listedTotal} onChange={event => setListedTotal(event.target.value)} onBlur={() => markTouched('listedTotal')} placeholder="اختیاری"/>
      {showListedTotalError ? <small className="field-error">این مبلغ باید برابر یا بیشتر از مبلغ پرداخت‌شده باشد.</small> : null}
    </label>
    <div className="field summary-field">
      <span>قیمت واقعی هر {product?.unit ?? 'واحد'}</span>
      <strong>{formatMoney(effectiveUnitPrice, currency)}</strong>
      {discount > 0 ? <small>تخفیف کل: {formatMoney(discount, currency, true)}</small> : <small>از تقسیم مبلغ پرداختی بر مقدار خرید</small>}
    </div>
    <label className="field field-span-2">
      <span>یادداشت</span>
      <textarea value={note} onChange={event => setNote(event.target.value)} rows={2} placeholder="مثلاً کیفیت، بسته‌بندی یا علت اختلاف قیمت" maxLength={10_000}/>
    </label>
    <div className="form-actions field-span-2">
      <button className="button primary" type="submit" disabled={formInvalid}><Check size={18}/>{purchase ? 'ذخیره تغییرات' : 'ثبت خرید'}</button>
      <button type="button" className="button ghost" onClick={onCancel}>انصراف</button>
    </div>
  </form>
}

interface TransactionFormProps {
  transactions: FinancialTransaction[]
  transaction?: FinancialTransaction | null
  initialKind?: TransactionKind
  currency: string
  onDone: () => void
  onCancel: () => void
  pushToast: PushToast
}

const DEFAULT_CATEGORIES: Record<TransactionKind, string[]> = {
  expense: ['مسکن', 'قبوض', 'حمل‌ونقل', 'درمان', 'آموزش', 'تفریح', 'خدمات', 'سایر'],
  income: ['حقوق', 'فروش', 'هدیه', 'سرمایه‌گذاری', 'سایر'],
}

export function TransactionForm({ transactions, transaction, initialKind = 'expense', currency, onDone, onCancel, pushToast }: TransactionFormProps) {
  const [kind, setKind] = useState<TransactionKind>(transaction?.kind ?? initialKind)
  const [date, setDate] = useState(transaction?.date ?? todayISO())
  const [amount, setAmount] = useState(transaction ? String(transaction.amount) : '')
  const [category, setCategory] = useState(transaction?.category ?? '')
  const [note, setNote] = useState(transaction?.note ?? '')
  const numericAmount = Number(amount)
  const invalid = !date || date > todayISO() || !Number.isFinite(numericAmount) || numericAmount <= 0 || !category.trim()
  const knownCategories = [...new Set([
    ...DEFAULT_CATEGORIES[kind],
    ...transactions.filter(row => row.kind === kind).map(row => row.category),
  ])].sort((a, b) => a.localeCompare(b, 'fa'))

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (date > todayISO()) return pushToast('تاریخ تراکنش نمی‌تواند بعد از امروز باشد.', 'error')
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return pushToast('مبلغ باید بیشتر از صفر باشد.', 'error')
    if (!category.trim()) return pushToast('دسته‌بندی را وارد کنید.', 'error')
    const now = new Date().toISOString()
    const row: FinancialTransaction = {
      id: transaction?.id ?? uid('txn'),
      kind,
      date,
      amount: numericAmount,
      category: category.trim(),
      note: note.trim() || undefined,
      createdAt: transaction?.createdAt ?? now,
      updatedAt: now,
    }
    try {
      await db.transactions.put(row)
      pushToast(transaction ? 'تراکنش ویرایش شد.' : kind === 'expense' ? 'هزینه ثبت شد.' : 'درآمد ثبت شد.')
      onDone()
    } catch {
      pushToast('ذخیره تراکنش ناموفق بود. دوباره تلاش کنید.', 'error')
    }
  }

  return <form onSubmit={submit} className="form-grid">
    <label className="field field-span-2">
      <span>نوع تراکنش *</span>
      <select value={kind} onChange={event => { setKind(event.target.value as TransactionKind); setCategory('') }}>
        <option value="expense">هزینه</option>
        <option value="income">درآمد</option>
      </select>
    </label>
    <div className="field">
      <span>تاریخ *</span>
      <PersianDatePicker value={date} onChange={setDate} max={todayISO()} required ariaLabel="تاریخ تراکنش"/>
    </div>
    <label className="field">
      <span>مبلغ ({currency}) *</span>
      <input inputMode="numeric" type="number" min="0.0001" step="any" value={amount} onChange={event => setAmount(event.target.value)} placeholder="مثلاً ۵۰۰۰۰۰" required/>
    </label>
    <label className="field field-span-2">
      <span>دسته‌بندی *</span>
      <input list={`transaction-categories-${kind}`} value={category} onChange={event => setCategory(event.target.value)} placeholder={kind === 'expense' ? 'مثلاً اجاره یا حمل‌ونقل' : 'مثلاً حقوق'} maxLength={500} required/>
      <datalist id={`transaction-categories-${kind}`}>{knownCategories.map(item => <option value={item} key={item}/>)}</datalist>
    </label>
    <label className="field field-span-2">
      <span>یادداشت</span>
      <textarea value={note} onChange={event => setNote(event.target.value)} rows={2} placeholder="جزئیات اختیاری" maxLength={10_000}/>
    </label>
    <div className="form-actions field-span-2">
      <button className="button primary" type="submit" disabled={invalid}><Check size={18}/>{transaction ? 'ذخیره تغییرات' : 'ثبت تراکنش'}</button>
      <button type="button" className="button ghost" onClick={onCancel}>انصراف</button>
    </div>
  </form>
}

interface FinancialSnapshotFormProps {
  month: string
  snapshot?: FinancialSnapshot | null
  currency: string
  onDone: () => void
  onCancel: () => void
  pushToast: PushToast
}

export function FinancialSnapshotForm({ month, snapshot, currency, onDone, onCancel, pushToast }: FinancialSnapshotFormProps) {
  const [usdRate, setUsdRate] = useState(snapshot ? String(snapshot.usdRate) : '')
  const [rateDate, setRateDate] = useState(snapshot?.rateDate ?? month)
  const [savingsBalance, setSavingsBalance] = useState(snapshot?.savingsBalance != null ? String(snapshot.savingsBalance) : '')
  const [note, setNote] = useState(snapshot?.note ?? '')
  const rate = Number(usdRate)
  const balance = savingsBalance === '' ? undefined : Number(savingsBalance)
  const maxRateDate = month === startOfPersianMonthISO(todayISO()) ? todayISO() : addDaysISO(shiftPersianMonthISO(month, 1), -1)
  const rateInvalid = !Number.isFinite(rate) || rate <= 0
  const balanceInvalid = balance != null && (!Number.isFinite(balance) || balance < 0)
  const dateInvalid = !rateDate || rateDate > todayISO() || startOfPersianMonthISO(rateDate) !== month
  const invalid = rateInvalid || balanceInvalid || dateInvalid

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (rateInvalid) return pushToast('قیمت هر دلار باید بیشتر از صفر باشد.', 'error')
    if (balanceInvalid) return pushToast('مانده پس‌انداز نمی‌تواند منفی باشد.', 'error')
    if (dateInvalid) return pushToast('تاریخ نرخ دلار باید داخل ماه انتخابی و حداکثر امروز باشد.', 'error')
    const now = new Date().toISOString()
    const row: FinancialSnapshot = {
      id: snapshot?.id ?? `fin_${month}`,
      month,
      usdRate: rate,
      rateDate,
      savingsBalance: balance,
      note: note.trim() || undefined,
      createdAt: snapshot?.createdAt ?? now,
      updatedAt: now,
    }
    try {
      await db.financialSnapshots.put(row)
      pushToast(snapshot ? 'معیار مالی ماه ویرایش شد.' : 'معیار مالی ماه ثبت شد.')
      onDone()
    } catch {
      pushToast('ذخیره معیار مالی ناموفق بود. دوباره تلاش کنید.', 'error')
    }
  }

  return <form onSubmit={submit} className="form-grid">
    <div className="snapshot-month field-span-2"><span>ماه گزارش</span><strong>{formatMonth(month)}</strong></div>
    <label className="field">
      <span>قیمت یک دلار ({currency}) *</span>
      <input autoFocus inputMode="numeric" type="number" min="0.0001" step="any" value={usdRate} onChange={event => setUsdRate(event.target.value)} placeholder="نرخ معیار ابتدای ماه" required/>
      <small className="field-help">نرخ معیار خودتان، ترجیحاً دلار آزاد ابتدای ماه</small>
    </label>
    <div className="field">
      <span>تاریخ نرخ *</span>
      <PersianDatePicker value={rateDate} onChange={setRateDate} min={month} max={maxRateDate} required ariaLabel="تاریخ نرخ دلار"/>
    </div>
    <label className="field field-span-2">
      <span>مانده کل پس‌انداز ({currency})</span>
      <input inputMode="numeric" type="number" min="0" step="any" value={savingsBalance} onChange={event => setSavingsBalance(event.target.value)} placeholder="اختیاری"/>
      <small className="field-help">موجودی کل پس‌انداز را وارد کنید؛ پس‌انداز همان ماه جداگانه از درآمد منهای هزینه محاسبه می‌شود.</small>
    </label>
    <label className="field field-span-2">
      <span>منبع نرخ یا یادداشت</span>
      <textarea value={note} onChange={event => setNote(event.target.value)} rows={2} placeholder="مثلاً نرخ دلار آزاد در شروع ماه" maxLength={10_000}/>
    </label>
    <div className="form-actions field-span-2">
      <button className="button primary" type="submit" disabled={invalid}><Check size={18}/>ذخیره معیار ماه</button>
      <button type="button" className="button ghost" onClick={onCancel}>انصراف</button>
    </div>
  </form>
}
