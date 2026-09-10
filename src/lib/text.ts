const ARABIC_DIACRITICS = /[\u064B-\u065F\u0670\u06D6-\u06ED]/g
const INVISIBLE_CHARS = /[\u200B\u200D-\u200F\u202A-\u202E\u2060\uFEFF]/g

function canonicalize(value: string) {
  return value
    .normalize('NFKC')
    .replace(ARABIC_DIACRITICS, '')
    .replace(INVISIBLE_CHARS, ' ')
    .replace(/[يىئ]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[ۀة]/g, 'ه')
    .replace(/[أإٱ]/g, 'ا')
    .replace(/ؤ/g, 'و')
    .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/\u200c/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizePersianText(value: string) {
  return canonicalize(value).toLocaleLowerCase('fa')
}

export function normalizeStoreName(value: string) {
  return canonicalize(value)
}

export function sameNormalizedText(a: string, b: string) {
  return normalizePersianText(a) === normalizePersianText(b)
}

const persianCollator = new Intl.Collator('fa', { numeric: true, sensitivity: 'base' })

export function comparePersianText(a: string, b: string) {
  return persianCollator.compare(normalizePersianText(a), normalizePersianText(b))
}

export function makeSearchKey(...values: Array<string | undefined | null>) {
  return normalizePersianText(values.filter(Boolean).join(' '))
}
