# Elham Nuxt 4 frontend

بازنویسی اولیه فرانت Vue 2 قدیمی با Nuxt 4، Vue 3، TypeScript و Pinia.

## اجرا

```bash
cp .env.example .env
npm install
npm run dev
```

برای اتصال از مرورگر به Laravel، مقدار `NUXT_PUBLIC_API_BASE` را تنظیم کنید. مقدار پیش‌فرض `http://localhost:8010/api` است. برای SSR باید آدرس API از محیط اجرای Nuxt نیز قابل دسترسی باشد؛ اگر Nuxt در Docker اجرا می‌شود، `localhost` داخل کانتینر به خود کانتینر اشاره می‌کند.

## Endpointهای موجود در فایل Laravel ارائه‌شده

- `GET /api/counselors` — لیست مشاوران (پاسخ Laravel Resource Collection)
- `GET /api/counselors/{slug}` — جزئیات مشاور
- `GET /api/specialties` — تخصص‌ها
- `GET /api/comments` — نظرات

صفحات مشاوران، تخصص‌ها، CMS (صفحات، خدمات، پرسش‌ها، مقالات و گالری)، زمان‌های رزرو، حساب مراجع و پرداخت آزمایشی به endpointهای Laravel متصل‌اند. قیمت عمومی خدمت قیمت پایه است؛ قیمت مؤثر، مالیات و مبلغ دقیق فقط پس از ایجاد رزرو از پاسخ backend خوانده می‌شوند.

## نوبت‌دهی مراجعان

- ثبت‌نام، ورود، بازیابی رمز و ویرایش پروفایل از endpointهای `/api/client/*` استفاده می‌کنند. توکن مراجع فقط در `sessionStorage` مرورگر نگهداری می‌شود؛ درخواست‌های خصوصی فقط بعد از mount در مرورگر انجام می‌شوند و در SSR payload قرار نمی‌گیرند.
- مسیرهای `/appointment` و `/account/*` شامل رزرو چندمرحله‌ای، حساب، پروفایل، نوبت‌ها، پرداخت‌ها، رسیدها، اعلان‌ها و تنظیمات هستند. مسیرهای `/en/*` نیز با سازوکار route فعلی ساخته می‌شوند.
- قیمت فهرست خدمات، قیمت پایه است. API عمومی قیمت اختصاصی مشاور را برنمی‌گرداند؛ `total_irr` و `required_irr` قطعی پس از ایجاد رزرو و پیش از پرداخت نمایش داده می‌شوند.
- درگاه Fake Bank با `GET /api/booking/fake-bank/payments/{payment}?token=…` و `POST /api/booking/fake-bank/payments/{payment}/result` کار می‌کند. فقط پاسخ تأیید سرور، وضعیت پرداخت را تأیید می‌کند. پیوند بانک زنده در قرارداد فعلی آماده نیست.
- حساب مراجع از `GET/PATCH /api/client/me`، فهرست نوبت و جزئیات، پرداخت‌ها، رسیدها، یادداشت‌های قابل‌نمایش و اعلان‌های واقعی استفاده می‌کند. درخواست لغو با endpoint فعلی ثبت می‌شود.
- API مراجع endpoint مشاهدهٔ دوبارهٔ درخواست/وضعیت لغو، تغییر رمز پس از ورود یا ترجیحات اعلان ندارد. endpoint تغییر زمان نوبت پیاده‌سازی شده است: `PATCH /api/booking/my-reservations/{id}/reschedule` با `{starts_at}`. جریمه/بازپرداخت فقط در پاسخ ثبت درخواست لغو دریافت می‌شود و پس از reload قابل بازیابی نیست. تاریخچهٔ پرداخت و رسیدها endpoint فهرست سراسری ندارد و فرانت از فهرست صفحه‌بندی‌شدهٔ نوبت‌ها برای واکشی آن‌ها استفاده می‌کند.
- زمان جلسه و جزئیات Meet/voice فقط از فیلدهای مجازشدهٔ پاسخ جزئیات رزرو نمایش داده می‌شوند. API نقل‌مکان جلسه در قرارداد مراجع وجود ندارد. بازنشانی رمز به تنظیم بودن `BOOKING_CLIENT_RESET_URL` و ایمیل backend وابسته است.

## نکات توسعه

- اگر CMS داده نداشته باشد، صفحات محتوا وضعیت خالی نشان می‌دهند؛ اطلاعات ساختگی جایگزین نمی‌شود.
- جزئیات قیمت پیش از ایجاد reservation نیازمند quote endpoint است؛ اکنون مبلغ قطعی بعد از ایجاد رزرو موقت از API خوانده می‌شود.
- ترجیحات اعلان و تغییر رمز پس از ورود نیازمند endpoint جدید مراجع هستند.
- قرارداد پیشنهادی برای تکمیل قابلیت‌های فاقد endpoint: `POST /api/booking/quotes` با `{counselor_id, service_id, starts_at, mode, session_mode, payment_option}` و پاسخ `{data:{total_irr,tax_irr,required_irr,expires_at}}`؛ `GET /api/booking/my-reservations/{id}/cancellation-request` با همان `id/status/penalty_irr/refund_amount_irr` ایجادشده؛ `POST /api/client/password/change` با `{current_password,password,password_confirmation}`؛ و `GET/PATCH /api/client/notification-preferences` با کلیدهای کانال/رویدادِ موردتأیید backend. تا زمان اضافه‌شدن این endpointها رابط موفقیت یا ذخیره‌سازی محلی ادعا نمی‌کند.
- تنظیمات CORS در Laravel باید Origin فرانت را مجاز کند.
- محدودیت‌های قابل‌ردیابی قرارداد و فهرست مسیرهای نیازمند endpoint جدید در [API-GAPS.md](API-GAPS.md) ثبت شده‌اند. فایل Laravel overlay در workspace مسیرهای booking/client را نشان نمی‌دهد و API محلی در آزمون یکپارچه روی پورت 8011 با دیتابیس آزمایشی ایزوله تأیید شد؛ نشانی پیش‌فرض سایت پورت 8010 است.
- تصاویر قدیمی در `public/images` و فونت در `public/fonts` کپی شده‌اند.
- توکن‌های طراحی و الگوهای رابط در [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md) مستند شده‌اند.
- این پروژه در این محیط نصب و Build نشده و باید با `npm install && npm run build` تست شود.
