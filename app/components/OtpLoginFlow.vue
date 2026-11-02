<script setup lang="ts">
import type {Client} from '~/types/booking'
import type {OtpLoginResponse} from '~/composables/useBookingApi'
import {
  normalizeIranianMobile,
  validIranianMobile,
  normalizePersianDigits,
  otpErrorMessage,
  retryAfterSeconds,
  formatOtpCountdown
} from '~/composables/otpAuthUtils.mjs'
import {normalizeAppError} from '~/composables/toastUtils.mjs'

const props = withDefaults(defineProps<{
  redirectTo?: string;
  initialMobile?: string;
  stepUpOnly?: boolean
}>(), {redirectTo: '/account/appointments', initialMobile: '', stepUpOnly: false})
const emit = defineEmits<{ authenticated: [client: Client]; passwordSetupFinished: [] }>()
const api = useBookingApi(), auth = useClientAuth(), flow = useOtpAuth(), toast = useAppToast(),
    route = useRoute(), {path} = useSiteLocale()
type Phase = 'mobile' | 'password' | 'otpRequest' | 'verify' | 'profile' | 'passwordSetup'
const phase = ref<Phase>(props.stepUpOnly ? 'otpRequest' : 'mobile'), mobile = ref(props.initialMobile), code = ref(''),
    password = ref(''), passwordConfirmation = ref(''), firstName = ref(''), lastName = ref(''),
    showPassword = ref(false), showSetupPassword = ref(false), showSetupConfirmation = ref(false), passwordSetupSkipped = ref(false)
const busy = ref(false), error = ref(''), now = ref(Date.now()), missing = ref<string[]>([]),
    client = ref<Client | null>(null), devOtp = ref(''), copyingDevOtp = ref(false)
const passwordInput = ref<HTMLInputElement | null>(null), otpInput = ref<HTMLInputElement | null>(null)
const challenge = flow.challenge, requestSeconds = computed(() => {
      now.value;
      return flow.cooldownSeconds(mobile.value)
    }),
    resendSeconds = computed(() => Math.max(requestSeconds.value, Math.ceil(((challenge.value?.resendAt || 0) - now.value) / 1000))),
    expiresSeconds = computed(() => Math.max(0, Math.ceil(((challenge.value?.expiresAt || 0) - now.value) / 1000)))
const codeLength = computed(() => challenge.value?.codeLength || 6)
let lastAutoSubmittedCode = ''
let clock: number | undefined
onMounted(() => {
  const stored = flow.restore()
  if (props.stepUpOnly) {
    void prepareStepUp()
  } else if (stored?.purpose === 'login') {
    mobile.value = stored.mobile;
    phase.value = 'verify'
  }
  clock = window.setInterval(() => now.value = Date.now(), 1000)
})
onBeforeUnmount(() => {
  if (clock) window.clearInterval(clock)
  devOtp.value = ''
})
watch(phase, async current => {
  await nextTick();
  if (current === 'password') passwordInput.value?.focus(); else if (current === 'verify') otpInput.value?.focus()
})
watch(code, value => {
  if (phase.value !== 'verify' || busy.value || value.length !== codeLength.value || value === lastAutoSubmittedCode) return
  lastAutoSubmittedCode = value
  void verify()
})

function safeDestination(value: string) {
  const destinationPath=value.split(/[?#]/,1)[0] || ''
  const authPaths=['/account/login','/account/forgot','/account/reset','/account/register'].map(path)
  return value.startsWith('/') && !value.startsWith('//') && !/[\\\u0000-\u001f]/.test(value)
    && !authPaths.includes(destinationPath) ? value : path('/account/appointments')
}

function wantsBooking() {
  return /(^|\/)appointment(?:[/?]|$)/.test(props.redirectTo)
}

function missingLabels(fields: string[]) {
  const labels: Record<string, string> = {
    first_name: 'نام',
    last_name: 'نام خانوادگی',
    mobile: 'شماره موبایل تأییدشده'
  };
  return fields.map(field => labels[field] || field).join('، ')
}

function showSecurityToast(problem: unknown) {
  const normalized = normalizeAppError(problem);
  if (['CAPTCHA_UNAVAILABLE', 'CAPTCHA_INVALID', 'SMS_PROVIDER_UNAVAILABLE'].includes(normalized.code || '') || normalized.status === 0 || (normalized.status === 429 && !['OTP_RATE_LIMITED','OTP_COOLDOWN'].includes(normalized.code || '')) || normalized.status >= 500) toast.error(normalized.message)
}

function goMobile() {
  flow.clear();
  code.value = '';
  devOtp.value = '';
  password.value = '';
  error.value = '';
  phase.value = 'mobile'
}

function showOtp() {
  error.value = ''
  const current = challenge.value
  if (current?.purpose === 'login' && current.expiresAt > Date.now()) {
    phase.value = 'verify';
    return
  }
  void sendCode(false)
}

function normalizeCodeInput(event: Event) {
  const input = event.target as HTMLInputElement;
  const value = normalizePersianDigits(input.value).replace(/\D/g, '').slice(0, codeLength.value);
  input.value = value;
  code.value = value
}

function continueWithPassword() {
  if (busy.value) return
  error.value = ''
  const canonical = normalizeIranianMobile(mobile.value)
  if (!validIranianMobile(canonical)) {
    error.value = 'شماره موبایل را با قالب معتبر وارد کنید.';
    return
  }
  mobile.value = canonical;
  devOtp.value = '';
  phase.value = 'password'
}

async function copyDevOtp() {
  if (!devOtp.value || copyingDevOtp.value) return
  copyingDevOtp.value = true
  try {
    await navigator.clipboard.writeText(devOtp.value)
    toast.success('کد آزمایشی کپی شد.')
  } catch {
    toast.error('کپی کد در این مرورگر انجام نشد.')
  } finally {
    copyingDevOtp.value = false
  }
}

async function continueWithOtp() {
  if (busy.value) return
  error.value = ''
  const canonical = normalizeIranianMobile(mobile.value)
  if (!validIranianMobile(canonical)) {
    error.value = 'شماره موبایل را با قالب معتبر وارد کنید.';
    return
  }
  mobile.value = canonical
  await sendCode(false)
}

async function refreshMe() {
  const result = await api.authMe();
  client.value = result.data;
  auth.client.value = result.data;
  return result.data
}

async function prepareStepUp() {
  try {
    const current = await refreshMe();
    mobile.value = normalizeIranianMobile(current.phone || '');
    if (!validIranianMobile(mobile.value)) {
      error.value = 'برای تأیید دوباره، ابتدا شماره موبایل حساب را ثبت کنید.';
      return
    }
  } catch (problem) {
    error.value = otpErrorMessage(problem);
    showSecurityToast(problem)
  }
}

async function finish() {
  const destination = safeDestination(props.redirectTo)
  const current = client.value || auth.client.value
  if (current?.profile_complete === false && wantsBooking()) {
    await navigateTo({path: path('/account/profile'), query: {redirect: destination}});
    return
  }
  emit('authenticated', current as Client)
  await navigateTo(destination)
}

async function passwordLogin() {
  if (busy.value) return
  if (!validIranianMobile(mobile.value)) {
    error.value = 'شماره موبایل را بررسی کنید.';
    phase.value = 'mobile';
    return
  }
  busy.value = true;
  error.value = ''
  try {
    const result = await api.login({email: mobile.value, password: password.value})
    auth.setSession(result.token, result.data);
    client.value = result.data
    try {
      client.value = await refreshMe()
    } catch {/* Keep the accepted login session while the profile endpoint recovers. */
    }
    toast.success('با موفقیت وارد شدید.')
    const current = client.value || result.data
    if (current.profile_complete === false && wantsBooking()) {
      await navigateTo({path: path('/account/profile'), query: {redirect: safeDestination(props.redirectTo)}});
      return
    }
    await finish()
  } catch (problem) {
    const normalized = normalizeAppError(problem);
    error.value = normalized.status === 422 ? 'شماره موبایل یا رمز عبور نادرست است.' : otpErrorMessage(problem);
    showSecurityToast(problem)
  } finally {
    busy.value = false
  }
}

async function sendCode(resend = false) {
  if (busy.value) return
  if (!validIranianMobile(mobile.value)) {
    error.value = 'شماره موبایل را بررسی کنید.';
    phase.value = 'mobile';
    return
  }
  if (resend && resendSeconds.value > 0) return
  busy.value = true;
  devOtp.value = '';
  error.value = ''
  if (!resend) phase.value = 'otpRequest'
  try {
    const accepted = await flow.request(mobile.value, props.stepUpOnly ? 'step_up' : 'login', resend);
    devOtp.value = !props.stepUpOnly && typeof accepted.dev_otp === 'string'
        && new RegExp(`^\\d{${accepted.code_length || 6}}$`).test(accepted.dev_otp)
      ? accepted.dev_otp
      : '';
    code.value = '';
    lastAutoSubmittedCode = '';
    phase.value = 'verify'
  } catch (problem) {
    error.value = otpErrorMessage(problem);
    showSecurityToast(problem);
    const normalized = normalizeAppError(problem);
    const wait = normalized.status === 429 ? retryAfterSeconds(problem) : 0;
    if (wait) flow.delayResend(wait, mobile.value, true);
    if (!resend) phase.value = 'otpRequest'
  } finally {
    busy.value = false
  }
}

async function verify() {
  if (busy.value || expiresSeconds.value === 0) return
  busy.value = true;
  error.value = ''
  try {
    const verified = await flow.verify(code.value)
    if (props.stepUpOnly) {
      devOtp.value = ''
      flow.clear();
      client.value = await refreshMe();
      toast.success('تأیید پیامکی انجام شد.');
      phase.value = 'passwordSetup';
      return
    }
    const result = verified as OtpLoginResponse
    if (!result.token) throw new Error('OTP_INVALID')
    devOtp.value = ''
    auth.setSession(result.token, result.data as Client);
    flow.clear()
    try {
      client.value = await refreshMe()
    } catch {
      client.value = result.data as Client
    }
    const current = client.value
    missing.value = current.missing_profile_fields || result.missing_profile_fields || []
    firstName.value = current.first_name || '';
    lastName.value = current.last_name || ''
    toast.success('با موفقیت وارد شدید.')
    if (current.profile_complete === false && wantsBooking()) {
      const mobileVerified = current.mobile_verified ?? Boolean(current.phone_verified_at)
      if (!mobileVerified) {
        await navigateTo({path: path('/account/profile'), query: {redirect: safeDestination(props.redirectTo)}});
        return
      }
      phase.value = 'profile';
      return
    }
    if (current.has_password === false) {
      phase.value = 'passwordSetup';
      return
    }
    await finish()
  } catch (problem) {
    error.value = otpErrorMessage(problem);
    showSecurityToast(problem);
    code.value = '';
    lastAutoSubmittedCode = '';
    await nextTick();
    otpInput.value?.focus()
  } finally {
    busy.value = false
  }
}

async function saveProfile() {
  if (busy.value) return
  busy.value = true;
  error.value = ''
  try {
    await api.updateAuthProfile({first_name: firstName.value.trim(), last_name: lastName.value.trim()});
    client.value = await refreshMe();
    missing.value = client.value.missing_profile_fields || []
    if (client.value.profile_complete === false) {
      error.value = `اطلاعات تکمیل‌نشده: ${missing.value.join('، ')}`;
      return
    }
    toast.success('اطلاعات شما ذخیره شد.')
    if (client.value.has_password === false) {
      phase.value = 'passwordSetup';
      return
    }
    await finish()
  } catch (problem) {
    error.value = otpErrorMessage(problem);
    showSecurityToast(problem)
  } finally {
    busy.value = false
  }
}

function validPassword(value: string) {
  return value.length >= 12 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value)
}

async function setupPassword() {
  if (busy.value || passwordSetupSkipped.value) return
  if (!validPassword(password.value)) {
    error.value = 'رمز عبور باید دست‌کم ۱۲ نویسه و شامل حروف کوچک، بزرگ و عدد باشد.';
    return
  }
  if (password.value !== passwordConfirmation.value) {
    error.value = 'تکرار رمز عبور یکسان نیست.';
    return
  }
  busy.value = true;
  error.value = ''
  try {
    const result = await api.setPassword({password: password.value, password_confirmation: passwordConfirmation.value});
    const current=client.value||auth.client.value
    if(current){client.value={...current,has_password:result.data.has_password};auth.client.value=client.value}
    try{client.value=await refreshMe()}catch{/* Password setup was confirmed by the backend; retain the updated shared state. */}
    toast.success('رمز عبور شما ثبت شد.');
    password.value = '';
    passwordConfirmation.value = '';
    emit('passwordSetupFinished')
    const updatedClient = client.value
    if (!updatedClient) {
      error.value = 'وضعیت حساب دریافت نشد. دوباره تلاش کنید.'
      return
    }
    if (updatedClient.profile_complete === false && wantsBooking()) {
      phase.value = 'profile';
      return
    }
    await finish()
  } catch (problem) {
    const normalized = normalizeAppError(problem);
    if (normalized.code === 'PASSWORD_ALREADY_CONFIGURED') {
      client.value = await refreshMe();
      toast.info(normalized.message);
      if (client.value.has_password) {
        emit('passwordSetupFinished')
        await finish();
        return
      }
    } else {
      error.value = otpErrorMessage(problem);
      showSecurityToast(problem)
    }
  } finally {
    busy.value = false
  }
}

async function skipPasswordSetup(){
  if(busy.value||passwordSetupSkipped.value)return
  passwordSetupSkipped.value=true
  password.value='';passwordConfirmation.value='';error.value=''
  emit('passwordSetupFinished')
  await finish()
}
</script>
<template>
  <section class="unified-login" aria-labelledby="unified-login-title">
    <header v-if="!stepUpOnly" class="unified-login-brand"><img src="/images/logo.png" width="42" height="42"
                                                                alt=""><span><strong>کلینیک پرواز</strong><small>مرکز مشاوره و روان‌شناختی پرواز</small></span>
    </header>
    <h2 id="unified-login-title" class="unified-login-title">
      {{ stepUpOnly ? (phase === 'passwordSetup' ? 'برای ورودهای بعدی رمز عبور تعیین کنید' : 'تأیید شماره برای تعیین رمز') : phase === 'profile' ? 'تکمیل اطلاعات حساب کاربری' : phase === 'passwordSetup' ? 'برای ورودهای بعدی رمز عبور تعیین کنید' : phase === 'verify' ? 'تأیید شماره موبایل' : phase === 'otpRequest' ? 'ورود با کد یک‌بارمصرف' : 'ورود به حساب کاربری' }}</h2>
    <template v-if="phase==='mobile'">
      <p class="unified-login-copy">شماره موبایل خود را وارد کنید.</p>
      <form class="auth-form unified-auth-form" @submit.prevent="continueWithOtp">
        <label for="login-mobile">شماره موبایل</label>
        <input id="login-mobile" v-model.trim="mobile" data-testid="login-mobile" type="tel" inputmode="tel"
               autocomplete="tel" dir="ltr" placeholder="۰۹۱۲۳۴۵۶۷۸۹" required :aria-invalid="Boolean(error)">
        <ApiNotice v-if="error">{{ error }}</ApiNotice>
        <button class="auth-submit" type="submit" :disabled="busy">{{ busy ? 'در حال آماده‌سازی…' : 'ادامه' }}</button>
      </form>
      <button class="auth-text-action" type="button" :disabled="busy" @click="continueWithPassword">ورود با رمز عبور
      </button>
    </template>
    <template v-else-if="phase==='password'">
      <p class="unified-login-copy">شماره موبایل
        <bdi dir="ltr">{{ mobile }}</bdi>
        <button class="inline-edit-action" type="button" @click="goMobile">ویرایش شماره</button>
      </p>
      <form class="auth-form unified-auth-form" @submit.prevent="passwordLogin">
        <label for="login-password">رمز عبور</label>
        <span class="auth-password-wrap"><input id="login-password" ref="passwordInput" v-model="password"
                                                data-testid="login-password" :type="showPassword?'text':'password'"
                                                autocomplete="current-password" required><button
            class="password-visibility" type="button" :aria-label="showPassword?'پنهان کردن رمز عبور':'نمایش رمز عبور'"
            :aria-pressed="showPassword" @mousedown.prevent @click="showPassword=!showPassword"><svg
            v-if="!showPassword" viewBox="0 0 24 24" aria-hidden="true"><path
            d="M2.5 12s3.3-6 9.5-6 9.5 6 9.5 6-3.3 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/></svg><svg
            v-else viewBox="0 0 24 24" aria-hidden="true"><path
            d="m3 3 18 18M10.6 6.2A10.6 10.6 0 0 1 12 6c6.2 0 9.5 6 9.5 6a14 14 0 0 1-3 3.5M6.2 6.2C3.8 7.8 2.5 12 2.5 12s3.3 6 9.5 6c.8 0 1.5-.1 2.2-.3"/><path
            d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg></button></span>
        <ApiNotice v-if="error">{{ error }}</ApiNotice>
        <button class="auth-submit" type="submit" :disabled="busy">{{ busy ? 'در حال بررسی…' : 'ورود' }}</button>
        <NuxtLink class="auth-text-action"
                  :to="{path:path('/account/forgot'),query:route.query.redirect?{redirect:String(route.query.redirect)}:{}}">
          فراموشی رمز عبور
        </NuxtLink>
      </form>
      <button class="auth-text-action" type="button" :disabled="busy" @click="showOtp">ورود با کد یک‌بارمصرف</button>
    </template>
    <template v-else-if="phase==='otpRequest'">
      <p class="unified-login-copy">
        {{ stepUpOnly ? 'برای شماره تأییدشده حساب، کد تازه دریافت کنید.' : 'شماره موبایل: ' }}
        <bdi dir="ltr">{{ mobile ? `${mobile.slice(0, 4)}•••••${mobile.slice(-2)}` : '' }}</bdi>
      </p>
      <p class="recaptcha-disclosure">این درخواست با reCAPTCHA محافظت می‌شود. <a
          href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">حریم خصوصی</a> و <a
          href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer">شرایط استفاده Google</a>.
      </p>
      <p v-if="busy" class="otp-flow-timer" role="status" aria-live="polite">در حال دریافت کد تأیید…</p>
      <ApiNotice v-if="error">{{ error }}</ApiNotice>
      <button v-if="stepUpOnly||error" class="auth-submit" type="button" :disabled="busy||requestSeconds>0"
              @click="sendCode(false)">
        {{ busy ? 'در حال درخواست…' : requestSeconds ? `تلاش دوباره پس از ${formatOtpCountdown(requestSeconds)}` : stepUpOnly ? 'دریافت کد تأیید' : 'تلاش دوباره' }}
      </button>
      <button v-if="!stepUpOnly" class="auth-text-action" type="button" :disabled="busy" @click="continueWithPassword">
        ورود با رمز عبور
      </button>
      <button v-if="!stepUpOnly" class="auth-text-action" type="button" :disabled="busy" @click="goMobile">ویرایش
        شماره
      </button>
    </template>
    <template v-else-if="phase==='verify'">
      <p class="unified-login-copy">درخواست کد برای شماره
        <bdi dir="ltr">{{ mobile.slice(0, 4) }}•••••{{ mobile.slice(-2) }}</bdi>
        پذیرفته شد.
        <button class="inline-edit-action" type="button" :disabled="busy" @click="goMobile">ویرایش شماره</button>
      </p>
      <form class="auth-form unified-auth-form" @submit.prevent="verify">
        <label for="login-otp">کد تأیید</label>
        <div v-if="devOtp" class="dev-otp-preview" role="status">
          <span><small>کد آزمایشی (فقط محیط توسعه)</small><bdi dir="ltr">{{ devOtp }}</bdi></span>
          <button type="button" :disabled="copyingDevOtp" aria-label="کپی کد آزمایشی" @click="copyDevOtp">
            {{ copyingDevOtp ? '…' : 'کپی' }}
          </button>
        </div>
        <input id="login-otp" ref="otpInput" :value="code" data-testid="login-otp" class="otp-code-input" type="text"
               inputmode="numeric" autocomplete="one-time-code" dir="ltr" maxlength="6" pattern="[0-9۰-۹٠-٩]{6}"
               placeholder="— — — — — —" required :aria-invalid="Boolean(error)" @input="normalizeCodeInput">
        <p class="otp-flow-timer" aria-live="polite">
          {{ expiresSeconds ? `اعتبار کد: ${Math.floor(expiresSeconds / 60)}:${String(expiresSeconds % 60).padStart(2, '0')}` : 'اعتبار کد به پایان رسیده است.' }}</p>
        <ApiNotice v-if="error">{{ error }}</ApiNotice>
        <p v-if="busy" class="otp-flow-timer" role="status" aria-live="polite">در حال بررسی کد…</p>
        <button class="auth-submit" type="submit" :disabled="busy||expiresSeconds===0">
          {{ busy ? 'در حال بررسی…' : stepUpOnly ? 'تأیید' : 'تأیید و ورود' }}
        </button>
      </form>
      <div class="auth-secondary-actions">
        <button class="auth-text-action" type="button" :disabled="busy||resendSeconds>0" @click="sendCode(true)">
          {{ resendSeconds ? `ارسال دوباره تا ${formatOtpCountdown(resendSeconds)}` : 'ارسال دوباره کد' }}
        </button>
        <button v-if="!stepUpOnly" class="auth-text-action" type="button" :disabled="busy"
                @click="continueWithPassword">ورود با رمز عبور
        </button>
      </div>
    </template>
    <template v-else-if="phase==='profile'"><p class="unified-login-copy">برای رزرو نوبت، نام و نام خانوادگی را تکمیل
      کنید.</p>
      <p v-if="missing.length" class="profile-missing-summary">اطلاعات لازم: {{ missingLabels(missing) }}</p>
      <form class="auth-form unified-auth-form" @submit.prevent="saveProfile"><label>نام<input v-model.trim="firstName"
                                                                                               autocomplete="given-name"
                                                                                               maxlength="120" required></label><label>نام
        خانوادگی<input v-model.trim="lastName" autocomplete="family-name" maxlength="120" required></label>
        <ApiNotice v-if="error">{{ error }}</ApiNotice>
        <button class="auth-submit" type="submit" :disabled="busy">{{ busy ? 'در حال ذخیره…' : 'ذخیره و ادامه' }}
        </button>
      </form>
    </template>
    <template v-else><p class="unified-login-copy">با تعیین رمز عبور، دفعات بعد می‌توانید بدون دریافت پیامک وارد
      شوید.</p>
      <form class="auth-form unified-auth-form" @submit.prevent="setupPassword"><label>رمز عبور<span class="auth-password-wrap"><input v-model="password"
                                                                                                      :type="showSetupPassword?'text':'password'"
                                                                                                      autocomplete="new-password"
                                                                                                      minlength="12"
                                                                                                      required><button class="password-visibility" type="button" :aria-label="showSetupPassword?'پنهان کردن رمز عبور':'نمایش رمز عبور'" :aria-pressed="showSetupPassword" @mousedown.prevent @click="showSetupPassword=!showSetupPassword"><svg v-if="!showSetupPassword" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.3-6 9.5-6 9.5 6 9.5 6-3.3 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/></svg><svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="m3 3 18 18M10.6 6.2A10.6 10.6 0 0 1 12 6c6.2 0 9.5 6 9.5 6a14 14 0 0 1-3 3.5M6.2 6.2C3.8 7.8 2.5 12 2.5 12s3.3 6 9.5 6c.8 0 1.5-.1 2.2-.3"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg></button></span></label><label>تکرار
        رمز عبور<span class="auth-password-wrap"><input v-model="passwordConfirmation" :type="showSetupConfirmation?'text':'password'" autocomplete="new-password" minlength="12"
                       required><button class="password-visibility" type="button" :aria-label="showSetupConfirmation?'پنهان کردن رمز عبور':'نمایش رمز عبور'" :aria-pressed="showSetupConfirmation" @mousedown.prevent @click="showSetupConfirmation=!showSetupConfirmation"><svg v-if="!showSetupConfirmation" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.3-6 9.5-6 9.5 6 9.5 6-3.3 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/></svg><svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="m3 3 18 18M10.6 6.2A10.6 10.6 0 0 1 12 6c6.2 0 9.5 6 9.5 6a14 14 0 0 1-3 3.5M6.2 6.2C3.8 7.8 2.5 12 2.5 12s3.3 6 9.5 6c.8 0 1.5-.1 2.2-.3"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg></button></span></label>
        <ApiNotice v-if="error">{{ error }}</ApiNotice>
        <button class="auth-submit" type="submit" :disabled="busy||passwordSetupSkipped">{{ busy ? 'در حال ثبت…' : 'تنظیم رمز عبور' }}</button>
      </form>
      <button class="auth-text-action" type="button" :disabled="busy||passwordSetupSkipped" @click="skipPasswordSetup">فعلاً رد می‌کنم</button>
    </template>
  </section>
</template>
