# Changelog

## 1.3.5

- جایگزینی کامل تمام `input[type=date]`های میلادی با Date Picker اختصاصی شمسی در رابط کاربری.
- تاریخ خرید و فیلترهای «از تاریخ / تا تاریخ» اکنون ماه، روز و سال را با تقویم هجری شمسی نمایش می‌دهند.
- داده تاریخ در دیتابیس همچنان به‌صورت ISO میلادی (`YYYY-MM-DD`) ذخیره می‌شود تا مرتب‌سازی، Backup و محاسبات قبلی بدون تغییر و ناسازگاری باقی بمانند؛ تبدیل فقط در لایه رابط کاربری انجام می‌شود.
- تقویم شمسی دارای جابه‌جایی ماه، نمایش روزهای هفته از شنبه، مشخص‌کردن امروز و تاریخ انتخاب‌شده، محدودیت انتخاب تاریخ آینده و گزینه «امروز» است.
- فیلترهای تحلیلی امکان پاک‌کردن تاریخ انتخابی را از داخل همان تقویم دارند.
- پیاده‌سازی بدون وابستگی یا CDN جدید انجام شده و از `Intl` استاندارد مرورگر برای تقویم Persian استفاده می‌کند؛ بنابراین عملکرد آفلاین و حریم خصوصی بدون تغییر باقی مانده است.
- تست regression برای نگاشت تاریخ میلادی/شمسی، شروع ماه و ناوبری ماه‌های شمسی اضافه شد.

## 1.3.4

- حذف کامل فیلد دستی «وزن شاخص» از افزودن/ویرایش کالا و جزئیات کالا.
- حذف `weight` از مدل Product و schema پشتیبان؛ پشتیبان‌های قدیمی همچنان قابل ورود هستند و فیلد legacy هنگام parse حذف می‌شود.
- اضافه شدن migration نسخه 2 دیتابیس برای پاک کردن `weight` از Productهای موجود بدون تغییر تاریخچه خرید.
- جایگزینی وزن دستی شاخص با وزن‌دهی خودکار بر اساس میانگین هزینه ماهانه تاریخی هر کالا تا ماه قبل از هر نقطه شاخص.
- به‌روزرسانی coverage شاخص بر اساس سهم هزینه خودکار کالاهای دارای سابقه.
- تحلیل تورم دسته‌ها اکنون سهم هزینه ثبت‌شده کالاها در بازه انتخابی را به‌صورت خودکار استفاده می‌کند و در نبود هزینه معتبر به وزن برابر برمی‌گردد.
- بازچینی فرم کالا پس از حذف فیلد وزن؛ «واحد مقایسه» تمام‌عرض شده تا چیدمان فرم ناقص یا نامتوازن نماند.
- اضافه شدن تست regression برای وزن‌دهی خودکار و سازگاری Import پشتیبان قدیمی دارای `weight`.


## 1.3.3

Release focused only on UX/UI cleanup and consistency; no new product features were added.

- Reduced redundant vertical chrome and tightened page-heading spacing across desktop and mobile.
- Improved contrast of secondary/help text for better readability.
- Standardized primary-action ordering in RTL page headers and backup controls.
- Grouped product edit/archive/delete icon actions into one visually coherent control cluster.
- Gave the product master list slightly more width and improved search/filter control sizing.
- Added safer chart margins and tick spacing to reduce clipped/overlapping date/category labels.
- Kept native date inputs and added Persian locale hints without replacing the browser’s accessible date picker.
- Purchase validation no longer paints an untouched empty price field red when the modal first opens; field errors appear after interaction.
- Simplified the derived “amount paid” summary by removing redundant helper copy when no discount exists.
- Replaced inconsistent English UI copy such as “Local-first” and implementation-oriented descriptive wording with clearer Persian copy.
- Preserved the existing scroll-to-top navigation behavior and responsive navigation model.


## 1.3.2

- هنگام جابه‌جایی بین تب‌های اصلی، صفحه همیشه از ابتدای محتوا باز می‌شود؛ لمس دوباره تب فعال نیز کاربر را به بالای همان صفحه می‌برد.
- بازطراحی ساختار Modal: هدر ثابت، بدنه اسکرول‌پذیر مجزا، عرض مناسب‌تر و Bottom Sheet تمیزتر در موبایل.
- فوکوس اولیه Modal اکنون روی اولین کنترل محتوایی قرار می‌گیرد، نه دکمه بستن پنجره.
- بازچینی فرم کالا برای هم‌گروه شدن فیلدهای مرتبط و حذف شکست بصری ناشی از متن‌های راهنما در ستون‌های نامتوازن.
- افزایش خوانایی label، help text، placeholder و حالت disabled فیلدها و یکدست‌سازی ارتفاع/فاصله کنترل‌ها.
- مرتب شدن ناحیه اکشن فرم‌ها و قرار گرفتن اکشن اصلی در سمت شروع رابط RTL.
- حذف spinner بومی inputهای عددی برای جلوگیری از ظاهر ناهماهنگ بین مرورگرها؛ ورودی عددی و validation بدون تغییر باقی مانده است.
- بهبود چیدمان در عرض‌های بسیار کوچک برای جلوگیری از فشرده شدن کارت‌ها، دکمه‌ها و سربرگ جزئیات کالا.
- هیچ قابلیت جدیدی اضافه نشده؛ این Release فقط شامل اصلاح UX/UI و رفتار ناوبری است.

## 1.3.1

- رفع خطای TypeScript برای `import.meta.env` با افزودن type declarations رسمی Vite.
- اصلاح `tsconfig.node.json` تا پروژه‌ی config در build mode بدون emit بررسی شود و خطای TS5096 رخ ندهد.
- پاک‌سازی `dist` پیش از هر build برای جلوگیری از باقی‌ماندن خروجی قدیمی در صورت شکست type-check.
- `npm run preview` اکنون ابتدا build کامل را اجرا می‌کند؛ بنابراین دیگر نمی‌تواند به‌صورت ناخواسته یک `dist` قدیمی را نمایش دهد.

## 1.3.0

### UX / UI

- متمرکز شدن تمام navigationها در `components/navigation.tsx` برای جلوگیری از drift بین Sidebar، Drawer و Bottom Navigation.
- تضمین breakpointهای انحصاری: موبایل فقط Bottom Nav، تبلت فقط Hamburger/Drawer و دسکتاپ فقط Sidebar.
- Search کالا همیشه ردیف کامل است و در عرض `<=420px` تمام فیلترها تک‌ستونه می‌شوند.
- اضافه شدن «بازگشت به فهرست کالاها» و CTA «ثبت خرید» در Detail موبایل.
- افزایش خوانایی متن‌های ثانویه کوچک و حفظ spacing/Hierarchy یکدست در کارت‌ها و فیلترها.
- نمایش وضعیت آخرین Backup کامل و نسخه اپ در صفحه داده و تنظیمات.
- اضافه شدن یادآور Backup در Dashboard برای داده‌های رشدکرده یا Backup قدیمی.

### Data integrity / Logic

- قفل شدن واحد مقایسه Product بعد از اولین Purchase.
- جلوگیری از Product تکراری بر اساس identity نرمال‌شده `name + brand + unit`.
- نرمال‌سازی رقم‌های فارسی و عربی در Search و deduplication.
- استخراج منطق Merge در `lib/merge.ts` و remap امن Product/Store/Purchase.
- جلوگیری از Merge دو dataset دارای Purchase با واحد پول متفاوت.
- جلوگیری از مخلوط شدن history یک Product هم‌شناسه با unit متفاوت.
- reset شدن `lastBackupAt` بعد از Merge/پاک‌سازی، چون Backup قبلی دیگر snapshot وضعیت فعلی نیست.
- میانگین مقایسه فروشگاه‌ها از simple average به quantity-weighted average تغییر کرد.

### Backup / Security

- اضافه شدن محدودیت ۵۰MB برای Import مستقیم.
- بررسی سازگاری `unitPrice × quantity` با `totalPaid` و رابطه listed price/discount هنگام Import.
- پاک شدن رمز Backup از state بعد از Export/Import موفق.
- نگهداری زمان آخرین Backup کامل در Settings.
- حفظ JSON/CSV/Encrypted Backup و محافظت CSV در برابر Formula Injection.

### PWA / Dependencies

- حذف `vite-plugin-pwa` و Workbox؛ Service Worker کوچک و اختصاصی در build تولید می‌شود.
- cache version بر اساس hash محتوای واقعی `dist` ساخته می‌شود و cacheهای قدیمی اپ پاک می‌شوند.
- Service Worker در dev ثبت نمی‌شود و فقط build production را پوشش می‌دهد.
- حذف ESLint/Vitest از dependency tree پروژه و جایگزینی تست‌های core با script سبک مبتنی بر Node + TypeScript.
- workflow GitHub Pages اکنون runtime audit، core tests، TypeScript/build و سپس deploy را اجرا می‌کند.
- `Vazirmatn Variable` از package dependency وارد bundle می‌شود؛ CDN خارجی برای فونت استفاده نمی‌شود.

## 1.2.0

### UX / UI

- رفع هم‌زمانی Hamburger و Bottom Navigation در موبایل.
- حذف FAB تکراری «ثبت خرید» روی نمودار.
- رفع collapse شدن Search در پنل کالا.
- حذف nested scroll آزاردهنده لیست کالا در موبایل.
- بهبود Empty State، فیلترها و Modalهای keyboard-friendly.

### Data / Logic

- بازنویسی شاخص ماهانه با median ماهانه، sparse-history comparison و weighted geometric mean.
- اضافه شدن coverage درصدی برای نقاط شاخص.
- هماهنگ شدن تورم دسته‌ها با همان منطق weighted geometric.
- جست‌وجو و dedup فروشگاه با normalization فارسی/عربی.
- Import merge با mapping فروشگاه‌های هم‌نام و confirmation summary.
- تکمیل گزینه نمایش اعداد فشرده.

### Validation / Security

- validation کامل‌تر فرم خرید و کالا.
- schema و referential-integrity check برای Backup.
- بررسی duplicate ID و duplicate normalized store name.
- خنثی‌سازی Spreadsheet Formula Injection در CSV.
- Backup رمزدار با PBKDF2-SHA256 + AES-256-GCM.
