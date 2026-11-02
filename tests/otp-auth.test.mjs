import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { generateAuthE2EMobile } from '../scripts/auth-e2e-fixture-mobile.mjs'
import { normalizeIranianMobile, normalizePersianDigits, validIranianMobile, retryAfterSeconds, formatOtpCountdown, otpErrorMessage } from '../app/composables/otpAuthUtils.mjs'
import { normalizeAppError, shouldAutoToast, isDuplicateToast, createSingleFlight } from '../app/composables/toastUtils.mjs'
import { submitAfterRecaptcha } from '../app/composables/recaptchaV3.mjs'
import {addGregorianDays,addGregorianMonths,formatPersianJalaliDate,jalaliMonthCells,jalaliMonthTitle,jalaliMonthsInYear,jalaliYearAndMonth,parseGregorianDateKey} from '../app/utils/jalaliDate.mjs'

test('formats Jalali dates while preserving Gregorian ISO keys for API payloads', () => {
  assert.equal(formatPersianJalaliDate('2026-10-17'), '۱۴۰۵/۰۷/۲۵')
  assert.equal(jalaliMonthTitle('2026-10-17'), 'مهر ۱۴۰۵')
  assert.equal(parseGregorianDateKey('2026-02-30'), null)
  assert.equal(addGregorianDays('2026-10-17', 1), '2026-10-18')
  assert.equal(addGregorianMonths('2026-10-17', 3), '2027-01-17')
})

test('Jalali calendar grid starts on Saturday and applies bounds and disabled days', () => {
  const cells=jalaliMonthCells('2026-10-17',{min:'2026-10-01',max:'2026-10-31',disabledDates:['2026-10-18']})
  const first=new Date(cells[0].key+'T12:00:00Z')
  assert.equal(first.getUTCDay(),6)
  assert.match(cells.find(cell=>cell.key==='2026-10-17').label,/^[۰-۹]+$/)
  assert.equal(cells.find(cell=>cell.key==='2026-10-18').disabled,true)
  assert.equal(cells.find(cell=>cell.key==='2026-09-26').disabled,true)
})

test('Jalali month and year navigation maps selected months back to Gregorian API keys', () => {
  const months = jalaliMonthsInYear(1405)
  assert.equal(months.length, 12)
  assert.deepEqual(months[0], {month: 1, name: 'فروردین', start: '2026-03-21'})
  assert.equal(jalaliYearAndMonth('2026-10-18')?.year, 1405)
  assert.equal(jalaliYearAndMonth('2026-10-18')?.month, 7)
  assert.equal(jalaliYearAndMonth(months[6].start)?.month, 7)
})

test('Jalali picker keeps its shell separate from the seven-column day grid', async () => {
  const [css, picker, panel] = await Promise.all([
    readFile(new URL('../app/assets/css/main.css', import.meta.url), 'utf8'),
    readFile(new URL('../app/components/JalaliDatePicker.vue', import.meta.url), 'utf8'),
    readFile(new URL('../app/components/JalaliCalendarPanel.vue', import.meta.url), 'utf8'),
  ])
  assert.match(picker, /class="jalali-calendar-shell"/)
  assert.doesNotMatch(css, /\.jalali-calendar\s*\{\s*display\s*:\s*grid/)
  assert.match(css, /\.jalali-calendar-weekdays,\.jalali-calendar-week\s*\{[^}]*grid-template-columns:\s*repeat\(7,minmax\(0,1fr\)\)/)
  assert.match(panel, /'ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'/)
  assert.match(panel, /'is-today'/)
  assert.match(panel, /jalali-month-year-picker/)
  assert.match(panel, /aria-expanded="monthPickerOpen"/)
})

test('normalizes Persian and Arabic digits before API submission', () => {
  assert.equal(normalizePersianDigits('۰۹۱٢٣٤۵۶۷۸۹'), '09123456789')
  assert.equal(normalizeIranianMobile('+98 912 345 6789'), '09123456789')
  assert.equal(normalizeIranianMobile('00989123456789'), '09123456789')
})

test('accepts only Iranian mobile numbers after normalization', () => {
  assert.equal(validIranianMobile('۰۹۱۲۳۴۵۶۷۸۹'), true)
  assert.equal(validIranianMobile('+989123456789'), true)
  assert.equal(validIranianMobile('0912345678'), false)
  assert.equal(validIranianMobile('08123456789'), false)
})

test('generates disposable integration mobiles accepted by frontend and Laravel formats', () => {
  const generated = Array.from({ length: 100 }, generateAuthE2EMobile)
  for (const mobile of generated) {
    assert.match(mobile, /^09\d{9}$/)
    assert.equal(validIranianMobile(mobile), true)
    assert.match(`+98${mobile.slice(1)}`, /^\+989\d{9}$/)
  }
})

test('maps backend OTP and provider errors to safe Persian messages', () => {
  assert.match(otpErrorMessage({ data: { code: 'SMS_PROVIDER_UNAVAILABLE' } }), /موقتاً در دسترس نیست/)
  assert.match(otpErrorMessage({ data: { code: 'CAPTCHA_INVALID' } }), /اعتبارسنجی امنیتی/)
  assert.match(otpErrorMessage({ data: { code: 'OTP_EXPIRED' } }), /منقضی شده/)
  assert.match(otpErrorMessage({ data: { code: 'PROFILE_INCOMPLETE' } }), /تکمیل کنید/)
})

test('honors backend retry_after_seconds and Retry-After headers', () => {
  assert.equal(retryAfterSeconds({ data: { retry_after_seconds: 75 } }), 75)
  assert.equal(retryAfterSeconds({ response: { headers: new Headers({ 'Retry-After': '60' }) } }), 60)
  assert.equal(otpErrorMessage({ status: 429, data: { retry_after_seconds: 32 } }), 'به سقف درخواست‌های پیامکی رسیده‌اید. ارسال دوباره پس از پایان زمان انتظار فعال می‌شود.')
  assert.equal(otpErrorMessage({ data: { code: 'OTP_COOLDOWN', retry_after_seconds: 60 } }), 'برای دریافت دوباره کد، تا پایان زمان انتظار صبر کنید.')
})

test('formats OTP resend countdowns as mm:ss', () => {
  assert.equal(formatOtpCountdown(59), '00:59')
  assert.equal(formatOtpCountdown(1036), '17:16')
  assert.equal(formatOtpCountdown(0), '00:00')
})

test('normalizes API errors to safe Persian copy and avoids expected-form error Toasts', () => {
  assert.equal(normalizeAppError({ data: { code: 'PASSWORD_ALREADY_CONFIGURED' } }).message, 'برای این حساب قبلاً رمز عبور تعیین شده است.')
  assert.equal(normalizeAppError({ status: 422, data: { message: 'SQL/internal detail' } }).message, 'اطلاعات واردشده را بررسی کنید.')
  assert.equal(shouldAutoToast({ status: 503 }), true)
  assert.equal(shouldAutoToast({ status: 422 }), false)
  assert.equal(shouldAutoToast({ name: 'AbortError' }), false)
  assert.equal(normalizeAppError({ status: 429, data: { retry_after_seconds: 75 } }).message, 'تعداد درخواست‌ها به حد مجاز رسیده است؛ ارسال دوباره پس از پایان زمان انتظار فعال می‌شود.')
})

test('deduplicates identical global Toast notifications within the suppression window', () => {
  const previous = { kind: 'error', message: 'خطای شبکه', at: 1000 }
  assert.equal(isDuplicateToast(previous, 'error', 'خطای شبکه', 2000), true)
  assert.equal(isDuplicateToast(previous, 'error', 'خطای شبکه', 5000), false)
  assert.equal(isDuplicateToast(previous, 'success', 'خطای شبکه', 2000), false)
})

test('single-flight shares concurrent identical operations but allows a later retry', async () => {
  const flight = createSingleFlight()
  let calls = 0
  let finish
  const task = () => { calls++; return new Promise(resolve => { finish = resolve }) }
  const first = flight('otp:request:mobile', task)
  const second = flight('otp:request:mobile', task)
  assert.equal(first, second)
  assert.equal(calls, 0)
  await Promise.resolve()
  assert.equal(calls, 1)
  finish('accepted')
  assert.equal(await first, 'accepted')
  assert.equal(await flight('otp:request:mobile', async () => 'retry'), 'retry')
})

test('OTP HTTP dispatch waits until a reCAPTCHA token resolves', async () => {
  let resolveToken
  let sent = 0
  const tokenPromise = new Promise(resolve => { resolveToken = resolve })
  const pending = submitAfterRecaptcha(() => tokenPromise, async token => { sent += 1; return token }, 'otp_request')
  await Promise.resolve()
  assert.equal(sent, 0)
  resolveToken('fresh-test-token')
  assert.equal(await pending, 'fresh-test-token')
  assert.equal(sent, 1)
})

test('failed reCAPTCHA prevents OTP HTTP dispatch', async () => {
  let sent = 0
  await assert.rejects(
    submitAfterRecaptcha(async () => { throw new Error('CAPTCHA_UNAVAILABLE') }, async () => { sent += 1 }, 'otp_request'),
    /CAPTCHA_UNAVAILABLE/,
  )
  assert.equal(sent, 0)
})

test('public auth no longer calls the deprecated client registration endpoint', async () => {
  const [api, page, dialog, flow] = await Promise.all([
    readFile(new URL('../app/composables/useBookingApi.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/pages/account/[action].vue', import.meta.url), 'utf8'),
    readFile(new URL('../app/components/AuthDialog.vue', import.meta.url), 'utf8'),
    readFile(new URL('../app/components/OtpLoginFlow.vue', import.meta.url), 'utf8'),
  ])
  for (const source of [api, page, dialog, flow]) assert.equal(source.includes('/client/register'), false)
  assert.match(page, /action==='register'.*navigateTo/)
  assert.match(flow, /\/auth\/otp\/verify|flow\.verify/)
  assert.match(flow, /@submit\.prevent="continueWithOtp"/)
  assert.match(flow, /await sendCode\(false\)/)
  assert.doesNotMatch(flow, /phase==='method'|continueToMethod|continueMethod/)
  assert.match(flow, /value\.length\s*!==\s*codeLength\.value/)
})
