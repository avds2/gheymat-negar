import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = fileURLToPath(new URL('..', import.meta.url))
const out = join(root, '.test-build')
await rm(out, { recursive: true, force: true })
await mkdir(join(out, 'lib'), { recursive: true })
await writeFile(join(out, 'package.json'), '{"type":"commonjs"}\n')

const files = ['types.ts', 'text.ts', 'analytics.ts', 'merge.ts', 'backup.ts', 'persian-date.ts', 'format.ts']
for (const file of files) {
  const sourcePath = join(root, 'src', 'lib', file)
  const source = await readFile(sourcePath, 'utf8')
  const result = ts.transpileModule(source, {
    fileName: sourcePath,
    reportDiagnostics: true,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
    },
  })
  const errors = (result.diagnostics ?? []).filter(item => item.category === ts.DiagnosticCategory.Error)
  if (errors.length) {
    throw new Error(errors.map(item => ts.flattenDiagnosticMessageText(item.messageText, '\n')).join('\n'))
  }
  await writeFile(join(out, 'lib', file.replace(/\.ts$/, '.js')), result.outputText)
}

const require = createRequire(import.meta.url)
const analytics = require(join(out, 'lib', 'analytics.js'))
const merge = require(join(out, 'lib', 'merge.js'))
const text = require(join(out, 'lib', 'text.js'))
const backup = require(join(out, 'lib', 'backup.js'))
const persianDate = require(join(out, 'lib', 'persian-date.js'))
const format = require(join(out, 'lib', 'format.js'))


assert.deepEqual(persianDate.persianDateParts('2026-09-02'), { year: 1405, month: 6, day: 11 })
assert.equal(persianDate.startOfPersianMonthISO('2026-09-02'), '2026-08-23')
assert.equal(persianDate.getPersianCalendarMonth('2026-09-02').days.length, 31)
assert.equal(persianDate.previousPersianMonthISO('2026-09-02'), '2026-07-23')
assert.equal(persianDate.nextPersianMonthISO('2026-09-02'), '2026-09-23')
assert.equal(persianDate.shiftPersianMonthISO('2026-09-02', -1), '2026-07-23')
assert.match(format.formatMonth('2026-08-23'), /۱۴۰۵/)

const now = '2026-08-27T00:00:00.000Z'
const product = (id, name, brand = '') => ({
  id, name, brand: brand || undefined, category: 'خوراکی', unit: 'کیلوگرم',
  archived: false, createdAt: now, updatedAt: now,
})
const purchase = (id, productId, date, unitPrice, storeId, quantity = 1) => ({
  id, productId, storeId, date, quantity, totalPaid: unitPrice * quantity, unitPrice, createdAt: now,
})

assert.equal(text.normalizePersianText('  كالا‌ي  ايراني  '), 'کالای ایرانی')
assert.equal(text.sameNormalizedText('فروشگاه كالا', 'فروشگاه کالا'), true)
assert.equal(text.sameNormalizedText('مدل ۱۲۳', 'مدل 123'), true)
assert.deepEqual(['کالای ۱۰', 'کالای ۲', 'آب', 'ابزار'].sort(text.comparePersianText), ['آب', 'ابزار', 'کالای ۲', 'کالای ۱۰'])

const products = [product('p1', 'برنج')]
const purchases = [purchase('a', 'p1', '2026-01-02', 100), purchase('b', 'p1', '2026-03-02', 120)]
const index = analytics.buildCompositeIndex(purchases)
assert.equal(index.length, 2)
assert.equal(Math.round(index[1].index), 120)
assert.equal(Math.round(analytics.getProductStats(products, purchases)[0].changePct), 20)


// Automatic basket weighting: a higher historical monthly spend should have
// more influence than a low-spend item, without any manual product weight.
const weightedPurchases = [
  purchase('w1', 'wp1', '2026-01-05', 100),
  purchase('w2', 'wp2', '2026-01-05', 100, undefined, 10),
  purchase('w3', 'wp1', '2026-02-05', 200),
  purchase('w4', 'wp2', '2026-02-05', 100, undefined, 10),
]
const weightedIndex = analytics.buildCompositeIndex(weightedPurchases)
assert.equal(weightedIndex.length, 2)
assert.ok(weightedIndex[1].index > 106 && weightedIndex[1].index < 107)
assert.equal(Math.round(weightedIndex[1].coveragePct), 100)

const financialTransactions = [
  { id: 't1', kind: 'income', date: '2026-08-25', amount: 1_000, category: 'حقوق', createdAt: now, updatedAt: now },
  { id: 't2', kind: 'expense', date: '2026-08-26', amount: 250, category: 'مسکن', createdAt: now, updatedAt: now },
]
const cashflow = analytics.buildMonthlyCashflow(
  [purchase('cash-buy', 'p1', '2026-08-24', 100, undefined, 2)],
  financialTransactions,
)
assert.deepEqual(cashflow, [{ month: '2026-08-23', purchaseExpense: 200, otherExpense: 250, expense: 450, income: 1_000, net: 550 }])
assert.equal(analytics.percentageChange(400, 500), 25)
assert.equal(analytics.percentageChange(0, 500), null)

// Gregorian month boundaries must not split one Persian reporting month.
const samePersianMonthIndex = analytics.buildCompositeIndex([
  purchase('pm1', 'p1', '2026-08-24', 100),
  purchase('pm2', 'p1', '2026-09-02', 110),
])
assert.equal(samePersianMonthIndex.length, 1)

const financialSnapshots = [
  { id: 'fin-prev', month: '2026-07-23', usdRate: 40, rateDate: '2026-07-23', savingsBalance: 1_600, createdAt: now, updatedAt: now },
  { id: 'fin-current', month: '2026-08-23', usdRate: 50, rateDate: '2026-08-24', savingsBalance: 2_000, createdAt: now, updatedAt: now },
]
const financialBenchmarks = analytics.buildFinancialBenchmarks(
  [
    { month: '2026-07-23', purchaseExpense: 200, otherExpense: 200, expense: 400, income: 800, net: 400 },
    { month: '2026-08-23', purchaseExpense: 200, otherExpense: 250, expense: 450, income: 1_000, net: 550 },
  ],
  financialSnapshots,
  [
    { month: '2026-07-23', index: 100, matched: 1, coveragePct: 100 },
    { month: '2026-08-23', index: 110, matched: 1, coveragePct: 100 },
  ],
)
assert.equal(financialBenchmarks[1].incomeUsd, 20)
assert.equal(financialBenchmarks[1].monthlySavingUsd, 11)
assert.equal(financialBenchmarks[1].savingsBalanceUsd, 40)
assert.equal(financialBenchmarks[1].dollarIncomeChangePct, 0)
assert.equal(Math.round(financialBenchmarks[1].nominalIncomeChangePct), 25)
assert.equal(Math.round(financialBenchmarks[1].personalInflationPct), 10)
assert.ok(Math.abs(financialBenchmarks[1].realIncomeChangePct - 13.6363636364) < 0.0001)

const incoming = {
  schema: 'gheymat-negar', version: 3, exportedAt: now,
  products: [product('p2', 'برنج')], stores: [{ id: 's2', name: 'فروشگاه كالا', createdAt: now }],
  purchases: [purchase('c', 'p2', '2026-04-02', 125, 's2')],
  transactions: financialTransactions,
  financialSnapshots,
  settings: { id: 'main', currency: 'تومان', theme: 'system', compactNumbers: false },
}
const plan = merge.planBackupMerge({ products, stores: [{ id: 's1', name: 'فروشگاه کالا', createdAt: now }], purchases, transactions: [], financialSnapshots: [] }, incoming)
assert.equal(plan.productsToPut.length, 0)
assert.equal(plan.storesToPut.length, 0)
assert.equal(plan.purchasesToPut[0].productId, 'p1')
assert.equal(plan.purchasesToPut[0].storeId, 's1')
assert.equal(plan.transactionsToPut.length, 2)
assert.equal(plan.financialSnapshotsToPut.length, 2)
const snapshotMerge = merge.planBackupMerge(
  { products: [], stores: [], purchases: [], transactions: [], financialSnapshots: [{ ...financialSnapshots[0], id: 'local-month' }] },
  { ...incoming, products: [], stores: [], purchases: [], transactions: [], financialSnapshots: [{ ...financialSnapshots[0], id: 'incoming-month', usdRate: 42 }] },
)
assert.equal(snapshotMerge.financialSnapshotsToPut[0].id, 'local-month')
assert.equal(snapshotMerge.financialSnapshotsToPut[0].usdRate, 42)
assert.deepEqual(merge.resolveMergeCurrency('تومان', 'تومان', 2, 3), { adoptIncomingCurrency: false })
assert.deepEqual(merge.resolveMergeCurrency('تومان', 'ریال', 0, 3), { adoptIncomingCurrency: true })
assert.throws(() => merge.resolveMergeCurrency('تومان', 'ریال', 2, 3))
assert.throws(() => merge.planBackupMerge(
  { products: [product('same', 'روغن')], stores: [], purchases: [purchase('local', 'same', '2026-01-01', 10)], transactions: [], financialSnapshots: [] },
  { ...incoming, products: [{ ...product('same', 'روغن'), unit: 'لیتر' }], stores: [], purchases: [purchase('remote', 'same', '2026-02-01', 12)] },
))

const valid = backup.validateBackup(incoming)
assert.equal(valid.purchases.length, 1)
assert.equal(valid.transactions.length, 2)
assert.equal(valid.financialSnapshots.length, 2)

const legacyBackup = {
  ...incoming,
  version: 1,
  products: [{ ...product('legacy', 'کالای قدیمی'), weight: 7 }],
  purchases: [purchase('legacy-buy', 'legacy', '2026-04-02', 125)],
  stores: [],
}
delete legacyBackup.transactions
delete legacyBackup.financialSnapshots
const sanitizedLegacy = backup.validateBackup(legacyBackup)
assert.equal('weight' in sanitizedLegacy.products[0], false)
assert.deepEqual(sanitizedLegacy.transactions, [])
assert.deepEqual(sanitizedLegacy.financialSnapshots, [])
assert.throws(() => backup.validateBackup({
  ...incoming,
  financialSnapshots: [{ ...financialSnapshots[0], month: '2026-07-24' }],
}))
assert.throws(() => backup.validateBackup({
  ...incoming,
  financialSnapshots: [{ ...financialSnapshots[0], rateDate: '2026-08-23' }],
}))
const encrypted = await backup.encryptBackup(incoming, 'correct-horse-battery-staple')
const decrypted = await backup.parseBackup(encrypted, 'correct-horse-battery-staple')
assert.equal(decrypted.products[0].name, 'برنج')
await assert.rejects(() => backup.parseBackup(encrypted, 'wrong-password'))

await rm(out, { recursive: true, force: true })
console.log('All core logic tests passed.')
