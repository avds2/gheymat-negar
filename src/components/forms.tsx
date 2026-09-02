import { useState, type FormEvent } from 'react'
import { Check } from 'lucide-react'
import { db, uid } from '../lib/db'
import { PersianDatePicker } from './date-picker'
import { formatMoney, todayISO } from '../lib/format'
import { normalizeStoreName, sameNormalizedText } from '../lib/text'
import type { Product, Purchase, Store } from '../lib/types'

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
  const [productId, setProductId] = useState(purchase?.productId ?? initialProductId ?? products.find(product => !product.archived)?.id ?? '')
  const [date, setDate] = useState(purchase?.date ?? todayISO())
  const [storeName, setStoreName] = useState(initialStore)
  const [quantity, setQuantity] = useState(String(purchase?.quantity ?? 1))
  const [unitPrice, setUnitPrice] = useState(purchase ? String(purchase.listedUnitPrice ?? (purchase.unitPrice + ((purchase.discount ?? 0) / purchase.quantity))) : '')
  const [discount, setDiscount] = useState(purchase?.discount ? String(purchase.discount) : '')
  const [note, setNote] = useState(purchase?.note ?? '')
  const [touched, setTouched] = useState({ date: false, quantity: false, unitPrice: false, discount: false })

  const product = products.find(item => item.id === productId)
  const qty = Number(quantity)
  const price = Number(unitPrice)
  const disc = discount === '' ? 0 : Number(discount)
  const quantityInvalid = !Number.isFinite(qty) || qty <= 0
  const priceInvalid = !Number.isFinite(price) || price <= 0
  const discountInvalid = !Number.isFinite(disc) || disc < 0
  const subtotal = !quantityInvalid && !priceInvalid ? qty * price : 0
  const discountTooLarge = !discountInvalid && disc >= subtotal && subtotal > 0
  const total = Math.max(0, subtotal - (Number.isFinite(disc) ? disc : 0))
  const dateInvalid = !date || date > todayISO()
  const formInvalid = !productId || quantityInvalid || priceInvalid || discountInvalid || discountTooLarge || dateInvalid
  const showDateError = touched.date && dateInvalid
  const showQuantityError = touched.quantity && quantityInvalid
  const showPriceError = touched.unitPrice && priceInvalid
  const showDiscountError = touched.discount && (discountInvalid || discountTooLarge)
  const markTouched = (field: keyof typeof touched) => setTouched(current => ({ ...current, [field]: true }))

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (formInvalid) {
      if (dateInvalid) return pushToast('تاریخ خرید نمی‌تواند بعد از امروز باشد.', 'error')
      if (quantityInvalid) return pushToast('مقدار خرید باید بیشتر از صفر باشد.', 'error')
      if (priceInvalid) return pushToast('قیمت واحد باید بیشتر از صفر باشد.', 'error')
      if (discountInvalid || discountTooLarge) return pushToast('مقدار تخفیف معتبر نیست.', 'error')
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
          listedUnitPrice: price,
          unitPrice: total / qty,
          totalPaid: total,
          discount: disc || undefined,
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
        {products.filter(item => !item.archived || item.id === productId).map(item => <option key={item.id} value={item.id}>{item.name}{item.brand ? ` — ${item.brand}` : ''}</option>)}
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
    <label className={`field ${showPriceError ? 'field-invalid' : ''}`}>
      <span>قیمت هر {product?.unit ?? 'واحد'} قبل از تخفیف *</span>
      <input inputMode="numeric" type="number" min="0.0001" step="any" value={unitPrice} onChange={event => setUnitPrice(event.target.value)} onBlur={() => markTouched('unitPrice')} placeholder="مثلاً ۲۵۰۰۰۰" required/>
      {showPriceError ? <small className="field-error">قیمت باید بیشتر از صفر باشد.</small> : null}
    </label>
    <label className={`field ${showDiscountError ? 'field-invalid' : ''}`}>
      <span>تخفیف کل</span>
      <input inputMode="numeric" type="number" min="0" step="any" value={discount} onChange={event => setDiscount(event.target.value)} onBlur={() => markTouched('discount')} placeholder="۰"/>
      {showDiscountError ? (discountInvalid ? <small className="field-error">تخفیف نمی‌تواند منفی باشد.</small> : <small className="field-error">تخفیف باید کمتر از مبلغ قبل از تخفیف باشد.</small>) : null}
    </label>
    <div className="field summary-field">
      <span>مبلغ پرداختی</span>
      <strong>{formatMoney(total, currency)}</strong>
      {disc > 0 && Number.isFinite(disc) ? <small>قبل از تخفیف: {formatMoney(subtotal, currency, true)}</small> : null}
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
