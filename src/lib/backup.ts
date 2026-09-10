import { z } from 'zod'
import type { BackupData } from './types'
import { normalizePersianText } from './text'
import { startOfPersianMonthISO } from './persian-date'

const idSchema = z.string().min(1).max(160)
const shortText = z.string().max(500)
const longText = z.string().max(10_000)
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const isoDateTime = z.string().min(1).max(80).refine(value => Number.isFinite(Date.parse(value)), 'invalid datetime')

const productSchema = z.object({
  id: idSchema,
  name: shortText.min(1),
  category: shortText,
  unit: shortText.min(1),
  brand: shortText.optional(),
  notes: longText.optional(),
  archived: z.boolean(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime
})

const storeSchema = z.object({
  id: idSchema,
  name: shortText.min(1),
  createdAt: isoDateTime
})

const purchaseSchema = z.object({
  id: idSchema,
  productId: idSchema,
  storeId: idSchema.optional(),
  date: isoDate,
  quantity: z.number().positive().finite(),
  totalPaid: z.number().nonnegative().finite(),
  unitPrice: z.number().nonnegative().finite(),
  listedUnitPrice: z.number().nonnegative().finite().optional(),
  discount: z.number().nonnegative().finite().optional(),
  note: longText.optional(),
  createdAt: isoDateTime
})

const transactionSchema = z.object({
  id: idSchema,
  kind: z.enum(['income', 'expense']),
  date: isoDate,
  amount: z.number().positive().finite(),
  category: shortText.min(1),
  note: longText.optional(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime
})

const financialSnapshotSchema = z.object({
  id: idSchema,
  month: isoDate,
  usdRate: z.number().positive().finite(),
  rateDate: isoDate,
  savingsBalance: z.number().nonnegative().finite().optional(),
  note: longText.optional(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime
})

const settingsSchema = z.object({
  id: z.literal('main'),
  currency: shortText.min(1),
  theme: z.enum(['system', 'light', 'dark']),
  compactNumbers: z.boolean().default(false),
  lastBackupAt: isoDateTime.optional()
})

const backupSchema = z.object({
  schema: z.literal('gheymat-negar'),
  version: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  exportedAt: isoDateTime,
  products: z.array(productSchema).max(100_000),
  stores: z.array(storeSchema).max(100_000),
  purchases: z.array(purchaseSchema).max(1_000_000),
  transactions: z.array(transactionSchema).max(1_000_000).default([]),
  financialSnapshots: z.array(financialSnapshotSchema).max(100_000).default([]),
  settings: settingsSchema
})

const encryptedBackupSchema = z.object({
  schema: z.literal('gheymat-negar-encrypted'),
  version: z.literal(1),
  kdf: z.literal('PBKDF2-SHA256'),
  iterations: z.number().int().min(100_000).max(2_000_000),
  salt: z.string().min(1).max(256),
  iv: z.string().min(1).max(256),
  data: z.string().min(1)
})

function bytesToBase64(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function base64ToBytes(value: string) {
  try {
    const binary = atob(value)
    return Uint8Array.from(binary, character => character.charCodeAt(0))
  } catch {
    throw new Error('ساختار فایل پشتیبان رمزدار معتبر نیست.')
  }
}

function assertUniqueIds<T extends { id: string }>(rows: T[], label: string) {
  const ids = new Set<string>()
  for (const row of rows) {
    if (ids.has(row.id)) throw new Error(`فایل پشتیبان شناسه تکراری در بخش ${label} دارد.`)
    ids.add(row.id)
  }
}

export function validateBackupIntegrity(data: BackupData) {
  const normalized = { ...data, transactions: data.transactions ?? [], financialSnapshots: data.financialSnapshots ?? [] }
  assertUniqueIds(normalized.products, 'کالاها')
  assertUniqueIds(normalized.stores, 'فروشگاه‌ها')
  assertUniqueIds(normalized.purchases, 'خریدها')
  assertUniqueIds(normalized.transactions, 'تراکنش‌ها')
  assertUniqueIds(normalized.financialSnapshots, 'معیارهای مالی')

  const snapshotMonths = new Set<string>()
  const today = new Date().toISOString().slice(0, 10)
  for (const snapshot of normalized.financialSnapshots) {
    if (snapshot.month !== startOfPersianMonthISO(snapshot.month)) throw new Error('ماه یک معیار مالی باید شروع ماه هجری شمسی باشد.')
    if (startOfPersianMonthISO(snapshot.rateDate) !== snapshot.month) throw new Error('تاریخ نرخ دلار باید داخل ماه معیار مالی باشد.')
    if (snapshot.rateDate > today) throw new Error('تاریخ نرخ دلار نمی‌تواند در آینده باشد.')
    if (snapshotMonths.has(snapshot.month)) throw new Error('فایل پشتیبان برای یک ماه بیش از یک معیار مالی دارد.')
    snapshotMonths.add(snapshot.month)
  }

  const productIds = new Set(normalized.products.map(product => product.id))
  const storeIds = new Set(normalized.stores.map(store => store.id))
  const storeNames = new Set<string>()

  for (const store of normalized.stores) {
    const key = normalizePersianText(store.name)
    if (!key) throw new Error('نام یک فروشگاه در پشتیبان خالی است.')
    if (storeNames.has(key)) throw new Error(`نام فروشگاه «${store.name}» در پشتیبان تکراری است.`)
    storeNames.add(key)
  }

  for (const purchase of normalized.purchases) {
    if (!productIds.has(purchase.productId)) throw new Error('پشتیبان شامل خریدی است که کالای وابسته به آن وجود ندارد.')
    if (purchase.storeId && !storeIds.has(purchase.storeId)) throw new Error('پشتیبان شامل خریدی است که فروشگاه وابسته به آن وجود ندارد.')

    const effectiveTotal = purchase.unitPrice * purchase.quantity
    const tolerance = Math.max(0.01, Math.abs(purchase.totalPaid) * 1e-6)
    if (Math.abs(effectiveTotal - purchase.totalPaid) > tolerance) {
      throw new Error('پشتیبان شامل رکورد خریدی با مبلغ کل و قیمت واحد ناسازگار است.')
    }

    if (purchase.listedUnitPrice != null) {
      const listedTotal = purchase.listedUnitPrice * purchase.quantity - (purchase.discount ?? 0)
      if (listedTotal < -tolerance || Math.abs(listedTotal - purchase.totalPaid) > tolerance) {
        throw new Error('پشتیبان شامل رکورد خریدی با تخفیف یا قیمت قبل از تخفیف ناسازگار است.')
      }
    }
  }

  return normalized
}


function schemaError(message: string, error: unknown): never {
  if (error instanceof z.ZodError) throw new Error(message)
  throw error
}

function parsePlainBackup(value: unknown): BackupData {
  try {
    return validateBackupIntegrity(backupSchema.parse(value))
  } catch (error) {
    return schemaError('ساختار یا نسخه فایل پشتیبان با این نسخه قیمت‌نگار سازگار نیست.', error)
  }
}

export async function encryptBackup(data: BackupData, password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const iterations = 600_000
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey'])
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  )
  const plaintext = new TextEncoder().encode(JSON.stringify(validateBackupIntegrity({ ...data, transactions: data.transactions ?? [], financialSnapshots: data.financialSnapshots ?? [] })))
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext))

  return JSON.stringify({
    schema: 'gheymat-negar-encrypted',
    version: 1,
    kdf: 'PBKDF2-SHA256',
    iterations,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    data: bytesToBase64(ciphertext)
  })
}

export async function parseBackup(text: string, password?: string): Promise<BackupData> {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('فایل انتخاب‌شده JSON معتبر نیست.')
  }

  if (typeof raw === 'object' && raw !== null && 'schema' in raw && raw.schema === 'gheymat-negar-encrypted') {
    if (!password) throw new Error('این فایل رمزگذاری شده است؛ رمز پشتیبان را وارد کنید.')
    let encrypted: z.infer<typeof encryptedBackupSchema>
    try {
      encrypted = encryptedBackupSchema.parse(raw)
    } catch (error) {
      return schemaError('ساختار فایل پشتیبان رمزدار معتبر یا پشتیبانی‌شده نیست.', error)
    }
    const salt = base64ToBytes(encrypted.salt)
    const iv = base64ToBytes(encrypted.iv)
    const cipher = base64ToBytes(encrypted.data)
    if (salt.length !== 16 || iv.length !== 12 || cipher.length < 17) throw new Error('ساختار فایل پشتیبان رمزدار معتبر نیست.')
    const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey'])
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: encrypted.iterations, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    )

    let plaintext: ArrayBuffer
    try {
      plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher)
    } catch {
      throw new Error('رمز اشتباه است یا فایل پشتیبان آسیب دیده است.')
    }

    let decrypted: unknown
    try {
      decrypted = JSON.parse(new TextDecoder().decode(plaintext))
    } catch {
      throw new Error('محتوای رمزگشایی‌شده پشتیبان معتبر نیست.')
    }
    return parsePlainBackup(decrypted)
  }

  return parsePlainBackup(raw)
}

export function validateBackup(data: unknown) {
  return parsePlainBackup(data)
}

export function downloadText(filename: string, text: string, type = 'application/json;charset=utf-8') {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function protectCsvFormula(value: string) {
  return /^[\s]*[=+\-@]/.test(value) ? `'${value}` : value
}

function csvCell(value: unknown) {
  const raw = String(value ?? '')
  const safe = protectCsvFormula(raw)
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export function purchasesToCsv(data: BackupData) {
  const productNames = new Map(data.products.map(product => [product.id, product.name]))
  const storeNames = new Map(data.stores.map(store => [store.id, store.name]))
  const headers = ['تاریخ', 'کالا', 'فروشگاه', 'تعداد', 'قیمت واحد مؤثر', 'قیمت واحد قبل تخفیف', 'مبلغ پرداختی', 'تخفیف', 'یادداشت']
  const rows = data.purchases.map(purchase => [
    purchase.date,
    productNames.get(purchase.productId) ?? purchase.productId,
    purchase.storeId ? (storeNames.get(purchase.storeId) ?? '') : '',
    purchase.quantity,
    purchase.unitPrice,
    purchase.listedUnitPrice ?? purchase.unitPrice,
    purchase.totalPaid,
    purchase.discount ?? '',
    purchase.note ?? ''
  ])
  return '\uFEFF' + [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\n')
}

export function transactionsToCsv(data: BackupData) {
  const headers = ['تاریخ', 'نوع', 'دسته‌بندی', 'مبلغ', 'یادداشت']
  const rows = data.transactions.map(transaction => [
    transaction.date,
    transaction.kind === 'expense' ? 'هزینه' : 'درآمد',
    transaction.category,
    transaction.amount,
    transaction.note ?? ''
  ])
  return '\uFEFF' + [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\n')
}

export function financialSnapshotsToCsv(data: BackupData) {
  const headers = ['ماه', 'تاریخ نرخ', 'قیمت یک دلار', 'مانده کل پس‌انداز', 'یادداشت']
  const rows = data.financialSnapshots.map(snapshot => [
    snapshot.month,
    snapshot.rateDate,
    snapshot.usdRate,
    snapshot.savingsBalance ?? '',
    snapshot.note ?? ''
  ])
  return '\uFEFF' + [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\n')
}
