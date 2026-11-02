const messages={
  OTP_INVALID:'کد واردشده صحیح نیست.',OTP_EXPIRED:'اعتبار کد به پایان رسیده است.',OTP_CONSUMED:'این کد قبلاً استفاده شده است.',
  OTP_TOO_MANY_ATTEMPTS:'تعداد تلاش‌های مجاز برای این کد به پایان رسیده است.',OTP_RATE_LIMITED:'تعداد درخواست‌های شما به حد مجاز رسیده است.',
  OTP_COOLDOWN:'برای دریافت کد تازه کمی صبر کنید.',CAPTCHA_INVALID:'تأیید امنیتی انجام نشد. دوباره تلاش کنید.',
  CAPTCHA_UNAVAILABLE:'سرویس تأیید امنیتی موقتاً در دسترس نیست.',SMS_PROVIDER_UNAVAILABLE:'ارسال پیامک موقتاً در دسترس نیست.',
  PROFILE_INCOMPLETE:'برای رزرو نوبت، اطلاعات حساب خود را تکمیل کنید.',PASSWORD_ALREADY_CONFIGURED:'برای این حساب قبلاً رمز عبور تعیین شده است.',
  OTP_REGISTRATION_REQUIRED:'برای ساخت حساب، ورود با کد پیامکی را ادامه دهید.',MOBILE_INVALID:'شماره موبایل معتبر نیست.',MOBILE_ALREADY_USED:'این شماره موبایل قابل استفاده نیست.'
}
export function normalizeAppError(error){
  const status=Number(error?.statusCode||error?.status||error?.response?.status||0)
  const known=['OTP_INVALID','OTP_EXPIRED','OTP_CONSUMED','OTP_TOO_MANY_ATTEMPTS','OTP_RATE_LIMITED','OTP_COOLDOWN','CAPTCHA_INVALID','CAPTCHA_UNAVAILABLE','SMS_PROVIDER_UNAVAILABLE','PROFILE_INCOMPLETE','PASSWORD_ALREADY_CONFIGURED','OTP_REGISTRATION_REQUIRED','MOBILE_INVALID','MOBILE_ALREADY_USED']
  const code=error?.data?.code||error?.response?._data?.code||error?.data?.error?.code||(known.includes(error?.message)?error.message:undefined)
  const retry=Number(error?.data?.retry_after_seconds||error?.response?._data?.retry_after_seconds||error?.retry_after_seconds||error?.response?.headers?.get?.('Retry-After'))
  if(code&&messages[code])return{status,code,message:messages[code],retryAfter:retry||0}
  if(status===400)return{status,message:'درخواست انجام نشد. اطلاعات را بررسی کنید.'}
  if(status===401)return{status,message:'برای ادامه دوباره وارد حساب شوید.'}
  if(status===403)return{status,message:'دسترسی به این عملیات مجاز نیست.'}
  if(status===404)return{status,message:'اطلاعات درخواستی پیدا نشد.'}
  if(status===409)return{status,message:'این درخواست با وضعیت فعلی سازگار نیست. اطلاعات را تازه کنید.'}
  if(status===410)return{status,message:'این روش دیگر در دسترس نیست. با کد پیامکی وارد شوید.'}
  if(status===422)return{status,message:'اطلاعات واردشده را بررسی کنید.'}
  if(status===429)return{status,message:'تعداد درخواست‌ها به حد مجاز رسیده است؛ ارسال دوباره پس از پایان زمان انتظار فعال می‌شود.',retryAfter:retry||0}
  if(status===502||status===503||status===504)return{status,message:'سامانه موقتاً در دسترس نیست. کمی بعد دوباره تلاش کنید.'}
  if(status>=500)return{status,message:'خطایی رخ داد. لطفاً دوباره تلاش کنید.'}
  if(error?.name==='AbortError'||error?.name==='CanceledError')return{status,cancelled:true,message:''}
  if(!status)return{status,message:'ارتباط با سامانه برقرار نشد. اتصال اینترنت را بررسی کنید.'}
  return{status,message:'خطایی رخ داد. لطفاً دوباره تلاش کنید.'}
}
export function shouldAutoToast(error){const normalized=normalizeAppError(error);return !normalized.cancelled&&(normalized.status===0||normalized.status===429||normalized.status>=500)}
export function isDuplicateToast(previous,kind,message,now,windowMs=2400){return previous?.kind===kind&&previous?.message===message&&now-previous.at<windowMs}
export function createSingleFlight(){
  const active=new Map()
  return function singleFlight(key,task){
    if(active.has(key))return active.get(key)
    const result=Promise.resolve().then(task).finally(()=>active.delete(key))
    active.set(key,result);return result
  }
}
