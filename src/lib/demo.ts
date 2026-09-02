import type { Product, Purchase, Store } from './types'
import { uid } from './db'

export function makeDemoData() {
  const now = new Date().toISOString()
  const products: Product[] = [
    ['برنج ایرانی', 'خوراکی', 'کیلوگرم'],
    ['روغن مایع', 'خوراکی', 'بطری'],
    ['مایع ظرفشویی', 'شوینده', 'بطری'],
    ['قهوه', 'نوشیدنی', 'بسته'],
    ['کاغذ A4', 'اداری', 'بسته']
  ].map(([name, category, unit]) => ({ id: uid('prd'), name, category, unit, archived: false, createdAt: now, updatedAt: now }))

  const stores: Store[] = ['فروشگاه محلی', 'هایپرمارکت', 'فروشگاه آنلاین']
    .map(name => ({ id: uid('str'), name, createdAt: now }))

  const purchases: Purchase[] = []
  const starts = [145000, 89000, 76000, 240000, 190000]
  const today = new Date()

  for (let monthOffset = 13; monthOffset >= 0; monthOffset--) {
    const sequence = 13 - monthOffset
    for (let productIndex = 0; productIndex < products.length; productIndex++) {
      if ((sequence + productIndex) % 3 === 0) continue

      const day = 4 + ((sequence * 3 + productIndex) % 20)
      let date = new Date(today.getFullYear(), today.getMonth() - monthOffset, day, 12)
      if (date > today) date = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12)

      const growth = 1 + sequence * (0.018 + productIndex * 0.004) + Math.sin((sequence + productIndex) * 1.4) * 0.025
      const unitPrice = Math.round(starts[productIndex] * growth / 1000) * 1000
      const quantity = productIndex === 0 ? 2 : 1

      purchases.push({
        id: uid('buy'),
        productId: products[productIndex].id,
        storeId: stores[(sequence + productIndex) % stores.length].id,
        date: date.toISOString().slice(0, 10),
        quantity,
        unitPrice,
        listedUnitPrice: unitPrice,
        totalPaid: unitPrice * quantity,
        createdAt: now
      })
    }
  }

  return { products, stores, purchases }
}
