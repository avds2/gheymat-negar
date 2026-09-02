# QA / Release checklist — 1.3.5

## بررسی‌های انجام‌شده روی سورس این Release

- parse/transpile نحوی تمام فایل‌های TS/TSX با TypeScript 5.8.3
- smoke test منطق pure برای:
  - نرمال‌سازی حروف و رقم فارسی/عربی
  - شاخص زنجیره‌ای sparse-history
  - dedup/remap کالا و فروشگاه در Merge
  - جلوگیری از Merge واحد پول ناسازگار
  - نگاشت تاریخ ISO به تقویم شمسی و شروع/ناوبری ماه فارسی
- syntax check برای scriptهای Node
- اجرای `build-sw.mjs` روی یک `dist` نمونه و syntax check فایل Service Worker تولیدشده
- بررسی breakpointهای CSS برای انحصاری بودن Sidebar / Drawer / Bottom Navigation
- بررسی نبود فایل فونت خام، `node_modules` یا `dist` در source archive

## Gate نهایی روی دستگاه توسعه یا GitHub Actions

بعد از دسترسی به npm registry اجرا شود:

```bash
npm install
npm audit --omit=dev --audit-level=high
npm run check
npm run preview
```

`npm run check` شامل core tests، TypeScript build، Vite production build و تولید Service Worker است.

> در محیط تولید این آرشیو، اتصال مستقیم npm registry برای نصب dependencyها timeout شد؛ بنابراین نتیجه build نهایی dependency-resolved باید توسط دستور بالا یا workflow GitHub Actions تأیید شود. Workflow داخل repository قبل از Deploy همین gateها را اجرا می‌کند و در صورت خطا Deploy انجام نمی‌شود.

## بررسی دستی پیشنهادی در Preview

1. از وسط هر صفحه به تب دیگری بروید؛ صفحه مقصد باید از بالای محتوا باز شود. لمس دوباره تب فعال نیز باید همان صفحه را به بالا ببرد.
2. Modal «ویرایش کالا» را در دسکتاپ، تبلت و موبایل باز کنید؛ عنوان و دکمه بستن ثابت، بدنه بدون overflow افقی و فیلدها با hierarchy منظم دیده شوند.
3. در عرض موبایل <=620px فقط Bottom Navigation دیده شود و Hamburger وجود نداشته باشد.
4. در 621–900px فقط Hamburger/Drawer دیده شود و Bottom Navigation مخفی باشد.
5. Search صفحه کالاها عرض کامل داشته باشد و در <=420px فیلترها تک‌ستونه شوند.
6. در عرض 320–360px کارت‌های داشبورد و اکشن‌های صفحه نباید فشرده یا بریده شوند.
7. یک کالا و دو خرید ثبت شود؛ unit کالا و currency پس از وجود history قفل شوند.
8. JSON Backup گرفته، داده پاک و Replace Import تست شود.
9. Merge با Backup هم‌واحد و سپس Merge آزمایشی با currency متفاوت بررسی شود.
10. بعد از `npm run preview` صفحه یک‌بار آنلاین باز، سپس DevTools روی Offline قرار داده و reload شود.


## Regression checks for automatic basket weighting

- فرم افزودن و ویرایش کالا هیچ فیلدی برای «وزن شاخص» ندارد و چیدمان پس از حذف آن متوازن است.
- Product جدید در IndexedDB فیلد `weight` ندارد.
- باز کردن دیتابیس قدیمی باعث migration بدون حذف Product/Purchase می‌شود و فقط `weight` قدیمی پاک می‌شود.
- Backup نسخه قدیمی که Product آن `weight` دارد همچنان Import می‌شود و فیلد legacy پس از validation حذف می‌شود.
- در تست دو کالا با رشد قیمت متفاوت، کالایی که سابقه هزینه ماهانه بیشتری دارد اثر بیشتری بر شاخص ترکیبی می‌گذارد.
- متن داشبورد و جزئیات کالا دیگر به وزن دستی اشاره نمی‌کند.

## UX regression checks for 1.3.5

- Open each primary tab after scrolling down another page; the window starts at the top.
- On the Products page, confirm the primary “ثبت خرید” action appears before the secondary “کالای جدید” action in RTL visual order.
- Product detail edit/archive/delete actions render as one grouped control, with delete retaining destructive hover styling.
- Open “ثبت خرید جدید”: the empty required price field is neutral initially; after leaving it empty, the inline error appears.
- تمام فیلدهای انتخاب تاریخ از Date Picker شمسی مشترک استفاده کنند؛ تاریخ انتخاب‌شده با ماه شمسی نمایش داده شود، تاریخ آینده قابل انتخاب نباشد و Escape تقویم را بدون بستن Modal ببندد.
- Chart first/last X-axis labels are not visibly clipped at common desktop widths.
- Sidebar status and descriptive privacy copy are fully Persian except necessary technical names such as IndexedDB/JSON/CSV.
