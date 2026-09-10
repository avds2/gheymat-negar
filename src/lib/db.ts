import Dexie, { type EntityTable } from 'dexie'
import type { AppSettings, FinancialTransaction, Product, Purchase, Store } from './types'

class GheymatDB extends Dexie {
  products!: EntityTable<Product, 'id'>
  stores!: EntityTable<Store, 'id'>
  purchases!: EntityTable<Purchase, 'id'>
  transactions!: EntityTable<FinancialTransaction, 'id'>
  settings!: EntityTable<AppSettings, 'id'>

  constructor() {
    super('gheymat-negar-db')
    this.version(1).stores({
      products: 'id, name, category, archived, createdAt, updatedAt',
      stores: 'id, &name, createdAt',
      purchases: 'id, productId, storeId, date, createdAt',
      settings: 'id'
    })
    this.version(2).stores({
      products: 'id, name, category, archived, createdAt, updatedAt',
      stores: 'id, &name, createdAt',
      purchases: 'id, productId, storeId, date, createdAt',
      settings: 'id'
    }).upgrade(transaction => transaction.table('products').toCollection().modify(product => {
      delete (product as { weight?: number }).weight
    }))
    this.version(3).stores({
      transactions: 'id, kind, date, category, createdAt, updatedAt'
    })
  }
}

export const db = new GheymatDB()

export const DEFAULT_SETTINGS: AppSettings = {
  id: 'main',
  currency: 'تومان',
  theme: 'system',
  compactNumbers: false
}

export async function ensureSettings() {
  const settings = await db.settings.get('main')
  await db.settings.put({ ...DEFAULT_SETTINGS, ...(settings ?? {}), id: 'main' })
}

export function uid(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`
}
