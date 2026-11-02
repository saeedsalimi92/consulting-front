export const normalizePersianDigits = value => value.replace(/[۰-۹٠-٩]/g, digit => String('۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩'.indexOf(digit) % 10))

export const normalizeIranianMobile = value => {
  let mobile = normalizePersianDigits(value).replace(/[\s()\-]/g, '')
  if (mobile.startsWith('+98')) mobile = `0${mobile.slice(3)}`
  else if (mobile.startsWith('0098')) mobile = `0${mobile.slice(4)}`
  return mobile
}

export const validIranianMobile = value => /^09\d{9}$/.test(normalizeIranianMobile(value))

export const retryAfterSeconds = error => {
  const value = error || {}
  return Math.max(0, Number(value.data?.retry_after_seconds) || Number(value.response?._data?.retry_after_seconds) || Number(value.retry_after_seconds) || Number(value.response?.headers?.get('Retry-After')) || 0)
}

export const formatOtpCountdown = value => {
  const seconds = Math.max(0, Math.ceil(Number(value) || 0))
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

export const otpErrorMessage = error => {
  const value = error || {}
  const localCodes = new Set(['CAPTCHA_UNAVAILABLE', 'MOBILE_INVALID', 'OTP_INVALID', 'OTP_EXPIRED'])
  const code = value.data?.code || value.response?._data?.code || value.data?.error_code || (localCodes.has(value.message) ? value.message : undefined)
  if (value.message === 'CAPTCHA_UNAVAILABLE' || code === 'CAPTCHA_UNAVAILABLE') return 'اعتبارسنجی امنیتی در دسترس نیست. ورود با رمز عبور را انتخاب کنید یا کمی بعد دوباره تلاش کنید.'
  if (code === 'SMS_PROVIDER_UNAVAILABLE') return 'ارسال کد تأیید موقتاً در دسترس نیست. لطفاً از ورود با رمز عبور استفاده کنید.'
  if (code === 'MOBILE_INVALID') return 'شماره موبایل را به‌درستی وارد کنید.'
  if (code === 'CAPTCHA_INVALID') return 'اعتبارسنجی امنیتی انجام نشد. دوباره تلاش کنید.'
  if (code === 'OTP_EXPIRED' || code === 'OTP_CONSUMED') return 'کد تأیید منقضی شده است. کد تازه درخواست کنید.'
  if (code === 'OTP_INVALID') return 'کد واردشده درست نیست.'
  if (code === 'OTP_TOO_MANY_ATTEMPTS') return 'تعداد تلاش‌های مجاز تمام شده است. کد تازه درخواست کنید.'
  if (code === 'OTP_COOLDOWN') return 'برای دریافت دوباره کد، تا پایان زمان انتظار صبر کنید.'
  if (code === 'OTP_RATE_LIMITED' || value.status === 429 || value.statusCode === 429) return 'به سقف درخواست‌های پیامکی رسیده‌اید. ارسال دوباره پس از پایان زمان انتظار فعال می‌شود.'
  if (code === 'MOBILE_ALREADY_USED') return 'این شماره موبایل قابل استفاده نیست.'
  if (code === 'PROFILE_INCOMPLETE') return 'برای ادامه، اطلاعات حساب‌تان را تکمیل کنید.'
  if (code === 'PASSWORD_NOT_CONFIGURED') return 'برای این حساب امکان تعیین رمز وجود ندارد.'
  if (code === 'PASSWORD_ALREADY_CONFIGURED') return 'برای این حساب قبلاً رمز عبور تعیین شده است.'
  if (code === 'OTP_REGISTRATION_REQUIRED') return 'برای ساخت حساب، ورود با کد پیامکی را ادامه دهید.'
  if (value.status === 410 || value.statusCode === 410) return 'این روش دیگر در دسترس نیست. با کد پیامکی وارد شوید.'
  if (value.status === 503 || value.statusCode === 503) return 'سرویس موقتاً در دسترس نیست. کمی بعد دوباره تلاش کنید.'
  if (value.status === 0 || value.name === 'FetchError' || value.name === 'TypeError') return 'ارتباط با سامانه برقرار نشد. اتصال اینترنت را بررسی کنید.'
  return 'ورود انجام نشد. اطلاعات را بررسی کنید و دوباره تلاش کنید.'
}
