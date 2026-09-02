import type { BackupData, Product, Purchase, Store } from './types'
import { makeSearchKey, normalizePersianText, sameNormalizedText } from './text'

export interface MergePlan {
  productsToPut: Product[]
  storesToPut: Store[]
  purchasesToPut: Purchase[]
  dedupedProducts: number
  dedupedStores: number
}

function productIdentity(product: Product) {
  return makeSearchKey(product.name, product.brand ?? '', product.unit)
}


export function resolveMergeCurrency(localCurrency: string, incomingCurrency: string, localPurchaseCount: number, incomingPurchaseCount: number) {
  const mismatch = !sameNormalizedText(localCurrency, incomingCurrency)
  if (localPurchaseCount > 0 && incomingPurchaseCount > 0 && mismatch) {
    throw new Error(`واحد پول داده فعلی «${localCurrency}» و پشتیبان «${incomingCurrency}» متفاوت است. برای جلوگیری از ادغام مبالغ ناسازگار، ابتدا داده‌ها را به یک واحد مشترک تبدیل کنید.`)
  }
  return {
    adoptIncomingCurrency: localPurchaseCount === 0 && incomingPurchaseCount > 0 && mismatch,
  }
}

export function planBackupMerge(
  local: Pick<BackupData, 'products' | 'stores' | 'purchases'>,
  incoming: BackupData,
): MergePlan {
  const localStoreById = new Map(local.stores.map(store => [store.id, store]))
  const storeIdByName = new Map<string, string>()
  for (const store of local.stores) {
    const key = normalizePersianText(store.name)
    if (key && !storeIdByName.has(key)) storeIdByName.set(key, store.id)
  }

  const storeIdMap = new Map<string, string>()
  const storesToPut: Store[] = []
  let dedupedStores = 0

  for (const store of incoming.stores) {
    const sameId = localStoreById.get(store.id)
    const nameKey = normalizePersianText(store.name)
    const sameNameId = storeIdByName.get(nameKey)

    if (!sameId && sameNameId) {
      storeIdMap.set(store.id, sameNameId)
      dedupedStores += 1
      continue
    }

    if (sameId && sameNameId && sameNameId !== store.id) {
      storeIdMap.set(store.id, sameNameId)
      dedupedStores += 1
      continue
    }

    storesToPut.push(store)
    storeIdMap.set(store.id, store.id)
    if (nameKey) storeIdByName.set(nameKey, store.id)
  }

  const localProductById = new Map(local.products.map(product => [product.id, product]))
  const productIdByIdentity = new Map<string, string>()
  for (const product of local.products) {
    const key = productIdentity(product)
    if (key && !productIdByIdentity.has(key)) productIdByIdentity.set(key, product.id)
  }

  const productIdMap = new Map<string, string>()
  const productsToPut: Product[] = []
  let dedupedProducts = 0
  const localPurchaseProductIds = new Set(local.purchases.map(purchase => purchase.productId))
  const incomingPurchaseProductIds = new Set(incoming.purchases.map(purchase => purchase.productId))

  for (const product of incoming.products) {
    const sameId = localProductById.get(product.id)
    if (sameId && !sameNormalizedText(sameId.unit, product.unit) && (localPurchaseProductIds.has(product.id) || incomingPurchaseProductIds.has(product.id))) {
      throw new Error(`واحد مقایسه کالای «${product.name}» بین داده فعلی و پشتیبان متفاوت است؛ برای جلوگیری از مخلوط‌شدن قیمت‌های ناسازگار، ادغام متوقف شد.`)
    }
    const identity = productIdentity(product)
    const sameIdentityId = productIdByIdentity.get(identity)

    if (!sameId && sameIdentityId) {
      productIdMap.set(product.id, sameIdentityId)
      dedupedProducts += 1
      continue
    }

    productsToPut.push(product)
    productIdMap.set(product.id, product.id)
    if (identity) productIdByIdentity.set(identity, product.id)
  }

  const purchasesToPut = incoming.purchases.map(purchase => ({
    ...purchase,
    productId: productIdMap.get(purchase.productId) ?? purchase.productId,
    storeId: purchase.storeId ? (storeIdMap.get(purchase.storeId) ?? purchase.storeId) : undefined,
  }))

  return { productsToPut, storesToPut, purchasesToPut, dedupedProducts, dedupedStores }
}
