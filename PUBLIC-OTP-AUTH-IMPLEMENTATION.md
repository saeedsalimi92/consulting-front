# یکپارچه‌سازی ورود موبایلی، OTP و reCAPTCHA

بازبینی: ۲۰۲۶-۱۰-۱۵

## قراردادهای واقعی مورد استفاده

| Endpoint | رفتار فرانت |
|---|---|
| `GET /api/auth/config` | خواندن تنظیمات عمومی reCAPTCHA و OTP هنگام انتخاب مسیر OTP |
| `POST /api/client/login` | ورود رمز با موبایل canonical در فیلد سازگار قدیمی `email` |
| `POST /api/auth/otp/request` | درخواست کد با action برابر `otp_request` |
| `POST /api/auth/otp/resend` | ارسال مجدد با action برابر `otp_resend` |
| `POST /api/auth/otp/verify` | تأیید کد و دریافت token Sanctum |
| `GET /api/auth/me` | دریافت capabilityهای جاری حساب |
| `PUT /api/auth/profile` | تکمیل نام/نام خانوادگی |
| `POST /api/auth/password/set` | تعیین رمز، فقط برای حساب فاقد رمز |
| `POST /api/auth/otp/step-up/request` و `/verify` | تأیید مجدد مالک حساب پیش از تعیین رمز در ادامهٔ کار |
| `POST /api/auth/mobile/change/request` و `/verify` | تأیید تغییر شماره |

## ورود یکپارچه

یک مسیر UI شماره موبایل را می‌گیرد و سپس روش را پیشنهاد می‌دهد. دستگاه ناشناس OTP را پیش‌فرض می‌گیرد؛ ورود موفق با رمز، ترجیح غیرحساس همان دستگاه را برای دفعات بعد ثبت می‌کند. API ناشناس برای پرس‌وجوی وجود حساب استفاده نمی‌شود. ورود رمز به `/client/login` می‌رود؛ ورود OTP فقط پس از verify موفق نشست را می‌سازد. حساب تازه را backend پس از تأیید OTP ایجاد می‌کند.

هیچ فرم ثبت‌نام جداگانه یا فراخوانی `POST /api/client/register` در فرانت وجود ندارد. URL قدیمی `/account/register` فقط به ورود یکپارچه هدایت می‌شود؛ endpoint backend برای سازگاری deprecated و پاسخ آن 410 است.

## OTP، محدودیت و امنیت

- ورود ارقام فارسی/عربی/لاتین و شمارهٔ ایرانی پشتیبانی می‌شود.
- challenge و زمان مجاز ارسال مجدد، بدون ذخیرهٔ OTP یا CAPTCHA token، در `sessionStorage` نگهداری می‌شوند.
- ارسال در حال اجرا قفل می‌شود و درخواست‌های یکسان هم‌زمان single-flight هستند؛ retry خودکار ارسال/رمز/تأیید نداریم.
- `Retry-After` و `retry_after_seconds` مرجع cooldown هستند؛ cooldown کلاینت پس از refresh در همان session حفظ می‌شود و محدودیت backend دور زده نمی‌شود.
- OTP request فقط پس از پاسخ پذیرفته‌شده به مرحلهٔ ورود کد می‌رود و خودش login موفق نیست.
- token احراز هویت در مسیر فعلی Bearer Sanctum و `sessionStorage` می‌ماند؛ کد، رمز و token در URL/log قرار نمی‌گیرند.

## reCAPTCHA v3

`useOtpAuth` loader سمت‌کلاینت و lazy دارد؛ script و promise بین callerهای هم‌زمان مشترک است. تنظیم public key از backend خوانده می‌شود و برای هر action توکن تازه می‌گیریم. actionها مطابق backend هستند: `otp_request`، `otp_resend`، `mobile_change` و `auth_step_up`. در نبود key/config، خطای load، privacy blocking یا رد backend، OTP fail-closed است و ورود رمز پیشنهاد می‌شود. Secret key به مرورگر داده نمی‌شود. صفحه لینک‌های Privacy Policy و Terms گوگل را کنار مسیر OTP نمایش می‌دهد و badge گوگل مخفی نشده است.

## Toast و خطا

`useAppToast()` سرویس سراسری success/error/warning/info با RTL، تم متغیر، live region، بستن دستی، حداکثر سه مورد و dedupe کوتاه دارد. Host عمومی در پوستهٔ اصلی نصب شده و host top-layer در dialog احراز هویت Toast را هنگام بازبودن native dialog قابل‌مشاهده نگه می‌دارد. transport خطاهای شبکه، 429 و 5xx را به پیام فارسی امن تبدیل می‌کند؛ `suppressToast` برای handlerهایی که پیام محلی دارند موجود است. خطای validation و تعارض معمولی inline می‌ماند.

Success Toast فقط پس از پاسخ موفق backend نشان داده می‌شود؛ پرداخت فقط پس از واکشی وضعیت `verified` نمایش موفق می‌گیرد.

## تکمیل پروفایل و بازگشت رزرو

پس از OTP/رمز، وضعیت از `/auth/me` تازه می‌شود. پروفایل ناقص هنگام مرور محتوا مانع ایجاد نمی‌کند؛ در رزرو به فرم تکمیل اطلاعات هدایت می‌شود. موبایل تأییدنشده به خود فرم پروفایل و جریان تأیید واقعی هدایت می‌شود. مقصد داخلی رزرو و انتخاب‌های آن در query حفظ می‌شود، سپس صفحه رزرو availability و قیمت backend را دوباره می‌گیرد. تکرار خودکار رزرو انجام نمی‌شود.

برای تعیین رمز خارج از ۱۰ دقیقهٔ تأیید OTP، endpointهای authenticated step-up درخواست و تأیید OTP همان حساب را انجام می‌دهند؛ این مسیر کاربر را به حساب دیگری منتقل نمی‌کند.

## محدودیت provider

backend فعلی SMS.ir را تا آماده‌شدن adapter واقعی با `SMS_PROVIDER_UNAVAILABLE` رد می‌کند. UI این وضعیت را نشان می‌دهد و موفقیت یا کد ساختگی تولید نمی‌کند. reCAPTCHA زنده نیز به key معتبر و hostname مجاز نیاز دارد. این موارد در این محیط runtime-test نشده‌اند.
