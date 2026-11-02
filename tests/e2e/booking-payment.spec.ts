import { test, expect, type Page } from '@playwright/test'

function tehranDateKey(offsetDays = 1) {
  const date = new Date(Date.now() + offsetDays * 86_400_000)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

async function setClientToken(page: Page) {
  await page.addInitScript(() => sessionStorage.setItem('client-token', 'mock-booking-session'))
}

async function mockBookingDependencies(page: Page, options: { paymentFailsOnce?: boolean } = {}) {
  const date = tehranDateKey()
  const startsAt = `${date}T10:00:00+03:30`
  let bookingRequests = 0
  let paymentRequests = 0
  const booking = {
    id: 181, counselor_id: 7, booking_service_id: 3, mode: 'online', session_mode: 'meet',
    starts_at: startsAt, ends_at: `${date}T11:00:00+03:30`, status: 'held', payment_option: 'full',
    total_irr: 2_800_000, required_irr: 2_800_000, paid_irr: 0, remaining_irr: 2_800_000,
    hold_expires_at: `${date}T09:55:00+03:30`,
  }

  await page.route('**/api/counselors**', route => route.fulfill({ json: { data: [{ id: 7, name: 'مشاور آزمایشی', degree: 'مشاور', avatar_url: null }] } }))
  await page.route('**/api/booking/counselors/7/services', route => route.fulfill({ json: { data: [{ service_id: 3, title: 'مشاوره فردی', duration_minutes: 50, price_irr: 2_800_000, deposit_irr: 700_000, is_active: true }] } }))
  await page.route('**/api/booking/availability**', route => route.fulfill({ json: { timezone: 'Asia/Tehran', slots: [{ starts_at: startsAt, ends_at: booking.ends_at, available: true }] } }))
  await page.route('**/api/auth/me', route => route.fulfill({ json: { data: { id: 55, first_name: 'کاربر', last_name: 'آزمایشی', profile_complete: true, mobile_verified: true } } }))
  await page.route('**/api/booking/reservations', async route => {
    bookingRequests += 1
    await route.fulfill({ json: { data: booking } })
  })
  await page.route('**/api/booking/my-reservations/181/payments', async route => {
    paymentRequests += 1
    if (options.paymentFailsOnce && paymentRequests === 1) {
      await route.fulfill({ status: 503, json: { message: 'Unavailable' } })
      return
    }
    await route.fulfill({ json: { data: { payment_id: 902, status: 'pending', url: 'https://gateway.example/checkout/902' } } })
  })
  await page.route('https://gateway.example/**', route => route.fulfill({ contentType: 'text/html', body: '<title>Mock gateway</title>' }))
  return { date, booking, bookingRequests: () => bookingRequests, paymentRequests: () => paymentRequests }
}

async function reachReviewAndSubmit(page: Page, date: string) {
  await page.goto(`/appointment?counselor=7&service=3&date=${date}`)
  await expect(page.getByRole('heading', { name: 'تاریخ و زمان' })).toBeVisible()
  await expect(page.getByRole('checkbox', { name: /۱۰:۰۰/ })).toBeVisible()
  await page.getByRole('checkbox', { name: /۱۰:۰۰/ }).check()
  await page.getByRole('button', { name: /ادامه/ }).click()
  await page.getByLabel('پرداخت کامل').check()
  await page.getByRole('button', { name: /ادامه به مرور/ }).click()
  await page.getByRole('button', { name: 'رزرو و پرداخت' }).click()
}

test('booking creates one pending reservation and immediately starts payment', async ({ page }) => {
  await setClientToken(page)
  const api = await mockBookingDependencies(page)
  await reachReviewAndSubmit(page, api.date)

  await expect(page).toHaveURL(/gateway\.example\/checkout\/902/)
  expect(api.bookingRequests()).toBe(1)
  expect(api.paymentRequests()).toBe(1)
})

test('payment retry reuses the pending booking instead of creating a duplicate', async ({ page }) => {
  await setClientToken(page)
  const api = await mockBookingDependencies(page, { paymentFailsOnce: true })
  await reachReviewAndSubmit(page, api.date)
  await expect(page.getByRole('heading', { name: 'رزرو موقت ثبت شد' })).toBeVisible()
  await page.getByRole('button', { name: 'تلاش دوباره برای پرداخت' }).click()
  await expect(page).toHaveURL(/gateway\.example\/checkout\/902/)
  expect(api.bookingRequests()).toBe(1)
  expect(api.paymentRequests()).toBe(2)
})

for (const paymentStatus of ['verified', 'failed', 'pending'] as const) {
  test(`payment return displays the backend ${paymentStatus} state`, async ({ page }) => {
    await setClientToken(page)
    const booking = {
      id: 181, counselor_id: 7, booking_service_id: 3, mode: 'online', session_mode: 'meet',
      starts_at: `${tehranDateKey()}T10:00:00+03:30`, ends_at: `${tehranDateKey()}T11:00:00+03:30`,
      status: paymentStatus === 'verified' ? 'confirmed' : 'held', payment_option: 'full',
      total_irr: 2_800_000, required_irr: 2_800_000, paid_irr: paymentStatus === 'verified' ? 2_800_000 : 0,
      remaining_irr: paymentStatus === 'verified' ? 0 : 2_800_000, hold_expires_at: null,
    }
    await page.route('**/api/booking/my-reservations**', route => route.fulfill({ json: { data: [booking], current_page: 1, last_page: 1 } }))
    await page.route('**/api/booking/my-reservations/181/payments', route => route.fulfill({ json: { data: [{ id: 902, status: paymentStatus, amount_irr: 2_800_000, created_at: '2026-10-17T08:00:00Z' }] } }))
    await page.route('**/api/booking/my-reservations/181', route => route.fulfill({ json: { data: booking } }))
    await page.route('**/api/booking/my-reservations/181/receipts', route => route.fulfill({ json: { data: paymentStatus === 'verified' ? [{ id: 4, payment_id: 902, receipt_number: 'R-902', amount_irr: 2_800_000, created_at: '2026-10-17T08:00:00Z' }] : [] } }))

    // The callback query deliberately says success for all cases; the page must
    // render only the state fetched from the authenticated payment API.
    await page.goto('/fake-bank?payment_id=902&status=success')
    const expectedHeading = paymentStatus === 'verified'
      ? 'پرداخت توسط سامانه تأیید شد'
      : paymentStatus === 'failed'
        ? 'پرداخت ناموفق بود'
        : 'تأیید پرداخت در انتظار پاسخ است'
    await expect(page.getByRole('heading', { name: expectedHeading })).toBeVisible()
    await expect(page.getByRole('link', { name: 'مشاهده نوبت' })).toHaveAttribute('href', /account\/appointments\/181/)
  })
}
