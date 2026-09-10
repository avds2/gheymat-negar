export type ThemeMode = 'system' | 'light' | 'dark'

export interface Product {
  id: string
  name: string
  category: string
  unit: string
  brand?: string
  notes?: string
  archived: boolean
  createdAt: string
  updatedAt: string
}

export interface Store {
  id: string
  name: string
  createdAt: string
}

export interface Purchase {
  id: string
  productId: string
  storeId?: string
  date: string
  quantity: number
  totalPaid: number
  unitPrice: number
  listedUnitPrice?: number
  discount?: number
  note?: string
  createdAt: string
}

export type TransactionKind = 'income' | 'expense'

export interface FinancialTransaction {
  id: string
  kind: TransactionKind
  date: string
  amount: number
  category: string
  note?: string
  createdAt: string
  updatedAt: string
}

export interface AppSettings {
  id: 'main'
  currency: string
  theme: ThemeMode
  compactNumbers: boolean
  lastBackupAt?: string
}

export interface BackupData {
  schema: 'gheymat-negar'
  version: 1 | 2
  exportedAt: string
  products: Product[]
  stores: Store[]
  purchases: Purchase[]
  transactions: FinancialTransaction[]
  settings: AppSettings
}
