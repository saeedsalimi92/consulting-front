# قرارداد API و قابلیت‌های نیازمند تأیید

این فرانت‌اند درخواست‌ها را از طریق `useBackend` و `useBookingApi` ارسال می‌کند. فایل `../consulting-backend-laravel12/routes/api.php` موجود در workspace فقط مسیرهای عمومی مشاور، تخصص، نظر، CMS و مسیرهای مدیریتی را نشان می‌دهد؛ مسیرهای مراجع و رزرو در این overlay تعریف نشده‌اند. سرویس `http://localhost:8010/api` هنگام پیاده‌سازی در دسترس نبود. بنابراین فهرست زیر قرارداد مصرف‌شده توسط فرانت‌اند است، نه تأیید اجرای backend.

## مسیرهای عمومی

- `GET /counselors` و `GET /counselors/{slug}`
- `GET /specialties`
- `GET /comments?type=counselor&id={id}`
- `GET /content/{type}` و `GET /content/{type}/{slug}`
- `GET /booking/services`
- `GET /booking/availability?counselor_id={id}&service_id={id}&date=YYYY-MM-DD`

## قراردادهای مصرف‌شده برای مراجع

این مسیرها از مستند فرانت‌اند و composableهای موجود خوانده شده‌اند؛ لازم است با backend مستقر تطبیق داده شوند:

- `POST /client/register`, `POST /client/login`, `POST /client/password/forgot`, `POST /client/password/reset`
- `GET/PATCH /client/me`, `POST /client/logout`
- `POST /booking/reservations`, `GET /booking/my-reservations`, `GET /booking/my-reservations/{id}`
- `GET /booking/my-reservations/{id}/payments`, `/receipts`, `/notes`
- `POST /booking/my-reservations/{id}/payments`
- `POST /booking/my-reservations/{id}/cancellation-request`
- `GET /booking/fake-bank/payments/{payment}?token=…`
- `POST /booking/fake-bank/payments/{payment}/result` با `{token,result}`
- `POST /booking/payments/callback` برای authority آزمایشی
- `GET /client/notifications`, `POST /client/notifications/{id}/read`

رزرو و پرداخت تا پاسخ معتبر سرور تأیید نمی‌شوند. اتصال Meet و تلفن تنها از فیلدهای مجاز پاسخ جزئیات نوبت خوانده می‌شود. درخواست API ناموفق، خطای قابل مشاهده دارد و موفقیت سمت مرورگر جایگزین پاسخ backend نیست.

## قابلیت‌های نیازمند endpoint جدید

1. **Quote دقیق پیش از رزرو:** `POST /booking/quotes` با `{counselor_id,service_id,starts_at,mode,session_mode,payment_option}` و پاسخ شامل `total_irr`, `tax_irr`, `required_irr`, `expires_at`. اکنون API قیمت اختصاصی مشاور و مالیات نهایی را قبل از رزرو ارائه نمی‌دهد؛ صفحه بازبینی این محدودیت را توضیح می‌دهد و مبلغ قطعی را بعد از رزرو از سرور می‌گیرد.
2. **تغییر زمان:** موجود است: `PATCH /booking/my-reservations/{id}/reschedule` با `{starts_at}` و پاسخ رزرو به‌روزشده. UI حساب کاربری از زمان‌های آزاد API استفاده می‌کند.
3. **بازیابی درخواست لغو:** `GET /booking/my-reservations/{id}/cancellation-request` برای بازیابی وضعیت، جریمه و بازپرداخت پس از بارگذاری مجدد.
4. **تغییر رمز واردشده:** `POST /client/password/change` با `{current_password,password,password_confirmation}`.
5. **تنظیم اعلان:** `GET/PATCH /client/notification-preferences` با کلیدهای تأییدشدهٔ backend.
6. **تاریخچه مستقل پرداخت/رسید:** فهرست صفحه‌بندی‌شدهٔ `/client/payments` و `/client/receipts`؛ فعلاً فرانت از فهرست رزروهای مراجع، endpointهای جزئیات پرداخت و رسید را واکشی می‌کند.

موارد 1 و 3 تا 6 همچنان endpointهای تکمیل‌نشده هستند؛ رابط برای آن‌ها موفقیت ساختگی یا ذخیره‌سازی محلی نشان نمی‌دهد. تغییر زمان (مورد 2) پیاده‌سازی شده است.
