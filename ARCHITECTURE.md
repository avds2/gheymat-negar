# معماری قیمت‌نگار 1.4.0

## تاریخ و تقویم

رابط کاربری تمام انتخاب‌های تاریخ را با تقویم هجری شمسی نمایش می‌دهد. مقدار ذخیره‌شده در مدل `Purchase.date` و فیلترهای داخلی همچنان ISO محلی به فرم `YYYY-MM-DD` است؛ این قرارداد برای مرتب‌سازی lexicographic، Backup/Import و محاسبات تاریخ موجود حفظ شده است. `components/date-picker.tsx` فقط لایه انتخاب/نمایش را شمسی می‌کند و `lib/persian-date.ts` با `Intl` استاندارد مرورگر بین ماه شمسی و روزهای ISO پیمایش می‌کند؛ dependency یا سرویس بیرونی برای تقویم وجود ندارد.


## اصول طراحی

قیمت‌نگار بر پنج اصل بنا شده است:

1. **Local-first:** CRUD و تحلیل‌های اصلی روی IndexedDB همان مرورگر انجام می‌شوند.
2. **Offline-capable:** build production یک Service Worker اختصاصی و manifest قابل نصب دارد.
3. **Data integrity:** invariantهای واحد، ارز، روابط رکوردها و سازگاری مالی در مرزهای ورود/ویرایش کنترل می‌شوند.
4. **Single source of truth در UI:** navigation و primitiveهای مشترک در componentهای مرکزی تعریف شده‌اند تا رفتار desktop/tablet/mobile واگرا نشود.
5. **Minimal operational surface:** بک‌اند، telemetry و Workbox وجود ندارد؛ dependencyهای غیرضروری build/test حذف شده‌اند.

## لایه‌ها

- `src/App.tsx`: orchestration داده‌های Live Query، state صفحات و workflowهای سطح اپ
- `src/components/navigation.tsx`: تعریف واحد navigation و سه presentation واکنش‌گرا
- `src/components/forms.tsx`: فرم‌های دامنه و validation ورودی
- `src/components/date-picker.tsx`: کنترل مشترک انتخاب تاریخ شمسی
- `src/components/ui.tsx`: primitiveهای مشترک UI، Modal و confirmation
- `src/components/charts.tsx`: presentation مشترک نمودارها و Tooltip
- `src/lib/db.ts`: persistence و default settings
- `src/lib/persian-date.ts`: نگاشت تقویم شمسی روی تاریخ ISO داخلی
- `src/lib/analytics.ts`: توابع pure برای آمار، شاخص و مقایسه‌ها
- `src/lib/merge.ts`: برنامه Merge و invariantهای currency/unit
- `src/lib/backup.ts`: serialization، schema/integrity validation، CSV و encryption
- `src/lib/text.ts`: canonicalization متن فارسی برای search/deduplication
- `src/lib/pwa.ts`: ثبت Service Worker فقط در production
- `scripts/build-sw.mjs`: تولید Service Worker versioned از فایل‌های واقعی `dist`
- `scripts/test.mjs`: تست smoke/core بدون test runner اضافی

## مدل داده و invariantها

### FinancialTransaction

- `kind` فقط `income` یا `expense` است.
- `amount` باید عدد متناهی و بزرگ‌تر از صفر باشد.
- `date` همان قرارداد ISO محلی Purchase را دارد و تاریخ آینده پذیرفته نمی‌شود.
- `category` اجباری است؛ فهرست پیشنهادی فقط کمک رابط کاربری است و دسته سفارشی مجاز می‌ماند.
- Purchase در Transaction کپی نمی‌شود. لایه analytics هنگام ساخت دفتر و cashflow، `Purchase.totalPaid` را به‌عنوان هزینه کالایی با Transactionهای مستقل ترکیب می‌کند.
- جدول `transactions` در migration نسخه 3 Dexie افزوده می‌شود؛ جدول‌ها و داده‌های نسخه‌های قبلی حفظ می‌شوند.

### محاسبه مبلغ خرید

- ورودی اصلی خرید `quantity` و `totalPaid` واقعی است.
- `unitPrice = totalPaid / quantity` در زمان ذخیره محاسبه می‌شود و منبع مقایسه قیمت باقی می‌ماند.
- اگر مبلغ قبل از تخفیف وارد شود، `listedUnitPrice = listedTotal / quantity` و `discount = listedTotal - totalPaid` ذخیره می‌شوند.
- مبلغ قبل از تخفیف نمی‌تواند کمتر از مبلغ واقعی پرداخت‌شده باشد.

### Product

- `name` و `unit` خالی نیستند.
- identity کاربردی کالا از `name + brand + unit` پس از نرمال‌سازی ساخته می‌شود.
- ساخت کالای تکراری با همین identity در فرم مسدود است.
- پس از اولین Purchase، `unit` در UI قفل می‌شود تا تاریخچه قبلی با واحد دیگری برچسب نخورد.
- Archive تاریخچه را حذف نمی‌کند.
- فیلد legacy به نام `weight` از نسخه 1.3.4 حذف شده و migration دیتابیس آن را از رکوردهای قدیمی پاک می‌کند؛ Import پشتیبان‌های قدیمی نیز این فیلد را نادیده می‌گیرد.

### Purchase

- `quantity > 0`
- قیمت ورودی قبل از تخفیف مثبت است.
- تخفیف منفی نیست و برای رکوردهای ساخته‌شده در UI باید کمتر از subtotal باشد.
- `unitPrice = totalPaid / quantity` و قیمت مؤثر بعد از تخفیف است.
- در Import، سازگاری `unitPrice × quantity ≈ totalPaid` بررسی می‌شود.
- اگر `listedUnitPrice` وجود داشته باشد، رابطه قیمت قبل از تخفیف، تخفیف و مبلغ نهایی نیز بررسی می‌شود.
- تاریخ خرید جدید نمی‌تواند در آینده باشد.

### Store

نام فروشگاه canonicalize می‌شود. مقایسه نام‌ها به اختلاف‌های متداول حروف عربی/فارسی، اعراب، نیم‌فاصله و رقم‌ها مقاوم است. ساخت Store جدید و Purchase در یک Dexie transaction انجام می‌شود.

### Currency

`currency` یک label سراسری برای همه مبالغ است و تبدیل نرخ ارز انجام نمی‌دهد. برای جلوگیری از relabel شدن مبالغ تاریخی:

- پس از اولین Purchase یا FinancialTransaction، ویرایش واحد پول در Settings قفل می‌شود.
- Merge وقتی هر دو طرف رکورد مالی دارند و currency متفاوت است، متوقف می‌شود.
- اگر داده محلی هنوز هیچ رکورد مالی ندارد، Merge می‌تواند currency پشتیبان را بپذیرد.

## جست‌وجوی فارسی

`text.ts` این canonicalization را انجام می‌دهد:

- Unicode NFKC
- حذف اعراب و کاراکترهای نامرئی
- یکسان‌سازی شکل‌های رایج `ي/ی`، `ك/ک`، همزه‌ها و ...
- حذف نیم‌فاصله برای matching
- تبدیل رقم فارسی و عربی به رقم ASCII
- collapse فاصله‌ها و lowercase محلی

کلید جست‌وجوی کالا از نام، برند، دسته، واحد و یادداشت ساخته می‌شود.

## شاخص تورم شخصی

### نماینده ماه

اگر یک کالا در یک ماه چند بار ثبت شده باشد، **median** قیمت مؤثر همان ماه استفاده می‌شود تا یک observation غیرعادی اثر بیش‌ازحد نداشته باشد.

### Sparse history

برای هر کالا آخرین قیمت شناخته‌شده نگه داشته می‌شود. هر بار median تازه ظاهر شود، با آخرین قیمت قبلی همان کالا مقایسه می‌شود. بنابراین نبود خرید در چند ماه زنجیره کالا را قطع نمی‌کند.

### تجمیع

برای ratioهای قابل‌مقایسه از **weighted geometric mean با وزن خودکار مخارج** استفاده می‌شود:

```text
R = exp( Σ(wᵢ × ln(rᵢ)) / Σwᵢ )
Indexₜ = Indexₜ₋₁ × R
```

وزن دستی در مدل `Product` وجود ندارد. برای هر ماه، وزن کالا از **میانگین هزینه ماهانه تاریخی پیش از همان ماه** محاسبه می‌شود: مجموع `totalPaid` قبلی کالا تقسیم بر تعداد ماه‌های تقویمی از اولین خرید ثبت‌شده تا ماه قبل. هزینه ماه جاری وارد وزن همان تغییر نمی‌شود تا تغییر مقدار خرید جاری، هم‌زمان وزن تغییر قیمت را جابه‌جا نکند. اگر سابقه هزینه معتبر موجود نباشد، fallback برابر `1` استفاده می‌شود.

`coveragePct` سهم وزنی کالاهایی را که در آن نقطه مقایسه تازه دارند نسبت به کالاهای دارای قیمت قبلی نشان می‌دهد. برای تحلیل دسته‌ها، وزن خودکار از سهم `totalPaid` کالاها در بازه انتخابی ساخته می‌شود و اگر هیچ هزینه معتبر وجود نداشته باشد، کالاها برابر در نظر گرفته می‌شوند.

مقایسه فروشگاه‌ها میانگین `unitPrice` را با `quantity` وزن می‌دهد تا خریدهای بسیار کوچک و بزرگ وزن یکسان نگیرند.

## Import / Export و یکپارچگی

پشتیبان قبل از ورود با Zod و validation دامنه بررسی می‌شود:

- schema/version معتبر
- محدودیت اندازه آرایه‌ها و متن‌ها
- شناسه یکتا در هر collection
- وجود Product برای همه Purchaseها
- وجود Store برای `storeId`های موجود
- نبود Store تکراری پس از normalization
- سازگاری محاسبات مالی Purchase

فایل بزرگ‌تر از ۵۰MB در UI Import رد می‌شود تا parse سنگین ناخواسته روی main thread رخ ندهد.

### Replace

پنج store شامل Product، Store، Purchase، FinancialTransaction و Settings در یک transaction پاک می‌شوند و سپس Backup معتبر جایگزین می‌شود. تنظیمات Backup نیز جایگزین می‌شوند.

### Merge

`planBackupMerge()` ابتدا برنامه pure ادغام را می‌سازد:

- Store هم‌نام به ID محلی remap می‌شود.
- Product همسان بر اساس `name + brand + unit` به ID محلی remap می‌شود.
- Purchaseهای وابسته با IDهای remap‌شده ذخیره می‌شوند.
- FinancialTransactionها با semantics upsert و بر اساس شناسه ادغام می‌شوند.
- رکوردهای هم‌شناسه با `bulkPut` upsert می‌شوند.
- تغییر `unit` برای Product هم‌شناسه‌ای که history دارد باعث توقف Merge می‌شود.
- ناسازگاری currency طبق invariant بالا باعث توقف Merge می‌شود.
- تنظیمات ظاهری محلی حفظ می‌شوند.
- `lastBackupAt` بعد از Merge reset می‌شود، چون Backup قبلی دیگر نماینده وضعیت ادغام‌شده نیست.

## امنیت فایل

Backup رمزدار از Web Crypto استفاده می‌کند:

- PBKDF2-SHA256
- salt تصادفی 16 بایت
- 600,000 iteration
- AES-256-GCM
- IV تصادفی 12 بایت

رمز در IndexedDB ذخیره نمی‌شود و بعد از Export/Import موفق از state فرم پاک می‌شود.

CSV قبل از quote کردن متن، cellهای شروع‌شونده با `=`, `+`, `-`, `@` را برای کاهش خطر Spreadsheet Formula Injection خنثی می‌کند.

## PWA و Service Worker

برای کاهش dependency surface، Service Worker از Workbox استفاده نمی‌کند.

فرآیند build:

1. TypeScript و Vite پوشه `dist` را می‌سازند.
2. `scripts/build-sw.mjs` تمام فایل‌های واقعی `dist` را می‌خواند.
3. hash محتوایی ساخته و نام cache به شکل `gheymat-negar-<hash>` تولید می‌شود.
4. Service Worker generated assetها را precache می‌کند.
5. در activate، cacheهای قدیمی همین اپ پاک می‌شوند.
6. navigationها network-first با fallback به `index.html` هستند؛ assetهای static cache-first رفتار می‌کنند.

Service Worker فقط در `import.meta.env.PROD` ثبت می‌شود. بنابراین cache توسعه روی HMR اثر نمی‌گذارد.

## Responsive navigation

- `>900px`: Sidebar ثابت؛ Hamburger و Bottom Nav مخفی
- `621–900px`: Sidebar به Drawer تبدیل می‌شود؛ Hamburger تنها ورودی آن است؛ Bottom Nav مخفی
- `<=620px`: Sidebar/Drawer و Hamburger با `display:none` حذف می‌شوند؛ Bottom Nav تنها navigation اصلی است

تعریف آیتم‌ها در `components/navigation.tsx` مشترک است تا label/icon/page ID بین سه حالت drift نکند.

## Product filters

- Search یک ردیف کامل grid است.
- Category و Sort در ردیف بعدی قرار می‌گیرند.
- در `<=420px` همه کنترل‌ها تک‌ستونه می‌شوند.
- لیست کالا در موبایل nested scroll ندارد و Detail دکمه «بازگشت به فهرست کالاها» دارد.

## Accessibility

- `aria-current` برای navigation فعال
- `aria-label` برای icon buttonها
- Modal با `aria-modal` و `aria-labelledby`
- Escape، focus trap و focus restoration
- keyboard activation برای ردیف‌های clickable
- `:focus-visible`
- احترام به `prefers-reduced-motion`

## حریم خصوصی

داده کاربر به API ارسال نمی‌شود. با این حال HTML/JS/CSS در بارگذاری اولیه از host دریافت می‌شوند و مرورگر طبیعتاً درخواست‌های static asset را به میزبان می‌فرستد. پس ادعای دقیق محصول «عدم ارسال داده کاربر» است، نه «عدم ارتباط شبکه‌ای مطلق».
