# کنترل کیفیت ورود یکپارچه و اعلان‌ها

تاریخ: ۲۰۲۶-۱۰-۱۵

## بررسی خودکار

| بررسی | نتیجه |
|---|---|
| `npm test` | PASS — ۸ آزمون utility و بررسی ایستای endpoint ثبت‌نام قدیمی |
| `npm run typecheck` | PASS — هشدار محیطی: Node 20.20.2 خارج از نسخه‌های توصیه‌شده Nuxt است |
| `npm run build` | PASS — bundle تولید Nuxt/Nitro ساخته شد؛ هشدار cssnano اختیاری و سازگاری Node باقی است |
| Lint | اجرا نشد — script مربوطه در `package.json` تعریف نشده است |
| تست component/API mock و E2E | هنوز پیاده‌سازی/اجرا نشده است |
| مرورگر و screenshots | اجرا نشد؛ ابزار مرورگر در این محیط در دسترس نبود |

آزمون‌های فعلی تبدیل و اعتبارسنجی شماره ایرانی، نگاشت خطاهای OTP/provider، رعایت Retry-After، عادی‌سازی خطا و جلوگیری از Toast فرم‌های موردانتظار، dedupe اعلان، single-flight و نبود فراخوانی `/client/register` را پوشش می‌دهند. این آزمون‌ها جایگزین آزمون component یا end-to-end نیستند.

## قرارداد و وابستگی‌های بیرونی

- قرارداد routeها و فیلدها با راهنمای یکپارچه‌سازی backend، OpenAPI، routeها و controller بررسی شده است.
- provider پیامک backend هنوز ارسال واقعی را فعال نمی‌کند و ممکن است `SMS_PROVIDER_UNAVAILABLE` برگرداند؛ SMS یا ورود موفق OTP با provider زنده آزمایش نشده است.
- reCAPTCHA فقط در صورت وجود تنظیم عمومی معتبر بارگذاری می‌شود. کلید زنده، hostname مجاز و ارزیابی امتیاز backend در این محیط آزموده نشده‌اند.
- هیچ migration یا نوشتنی روی دیتابیس اصلی انجام نشده است.

## QA باقی‌مانده

- تست component با APIهای mock برای OTP request/verify/resend، CAPTCHA، cooldown/429، انقضا، ورود رمز، تکمیل پروفایل، ادامه رزرو، toast و تم‌ها.
- مرور واقعی در 1440، 390 و 360 پیکسل در تم روشن و تیره؛ modal، خطاها، ورود OTP/رمز و بازگشت به رزرو.
- آزمون یکپارچه backend ایزوله پس از آماده‌شدن provider پیامک و reCAPTCHA معتبر؛ بدون استفاده از دیتابیس اصلی.
- تکرار build/typecheck روی نسخه پشتیبانی‌شده Node و نصب/رفع پیکربندی cssnano در pipeline مناسب.
