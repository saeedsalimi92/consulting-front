import { test, expect, type Page } from '@playwright/test'

const validMobile = '09123456789'

async function waitForHydration(page: Page) {
    await expect(page.locator('.site-shell[data-app-hydrated="true"]')).toBeVisible()
}

async function openLogin(page: Page) {
    const response = await page.goto('/account/login')
    expect(response?.ok()).toBeTruthy()
    await waitForHydration(page)
    await expect(page.getByRole('heading', { name: 'ورود به حساب کاربری' })).toBeVisible()
    await expect(page.locator('#unified-login-title')).toHaveCount(1)
    await expect(page.getByLabel('شماره موبایل')).toHaveCount(1)
}

async function mockAuthConfig(page: Page) {
    await page.route('**/api/auth/config', route => route.fulfill({
        json: { data: { recaptcha: { enabled: true, version: 'v3', site_key: 'ui-test-site-key' }, otp: { code_length: 6, expires_in: 300, resend_after: 60 } } },
    }))
}

async function mockOtpApi(page: Page, { verificationStatus = 422, holdRequest = false, devOtp }: { verificationStatus?: number; holdRequest?: boolean; devOtp?: string } = {}) {
    let requestCount = 0
    let requestBody: Record<string, unknown> | undefined
    let verificationCount = 0
    let verificationBody: Record<string, unknown> | undefined
    let releaseRequest = () => {}
    const requestGate = holdRequest ? new Promise<void>(resolve => { releaseRequest = resolve }) : null

    await mockAuthConfig(page)
    await page.route('**/recaptcha/api.js*', route => route.fulfill({
        contentType: 'application/javascript',
        body: 'window.grecaptcha={ready:callback=>callback(),execute:async()=>"ui-test-token"};',
    }))
    await page.route('**/api/auth/otp/request', async route => {
        requestCount += 1
        requestBody = route.request().postDataJSON()
        if (requestGate) await requestGate
        await route.fulfill({ json: { success: true, data: { challenge_id: 'ui-challenge', expires_in: 300, resend_after: 60, code_length: 6, accepted_requests_remaining: 2, ...(devOtp ? { dev_otp: devOtp } : {}) } } })
    })
    await page.route('**/api/auth/otp/verify', async route => {
        verificationCount += 1
        verificationBody = route.request().postDataJSON()
        await route.fulfill({
            status: verificationStatus,
            json: { code: 'OTP_INVALID', message: 'The code is invalid.' },
        })
    })
    return {
        requestCount: () => requestCount,
        requestBody: () => requestBody,
        verificationCount: () => verificationCount,
        verificationBody: () => verificationBody,
        releaseRequest,
    }
}

async function mockOtpAuthenticatedUser(page: Page, initiallyHasPassword = false, profileComplete = true) {
    await mockAuthConfig(page)
    await page.route('**/recaptcha/api.js*', route => route.fulfill({
        contentType: 'application/javascript',
        body: 'window.grecaptcha={ready:callback=>callback(),execute:async()=>"ui-test-token"};',
    }))
    let hasPassword = initiallyHasPassword
    const user = () => ({
        id: 55,
        name: 'کاربر آزمایشی',
        first_name: 'کاربر',
        last_name: 'آزمایشی',
        email: null,
        phone: '+989123456789',
        phone_verified_at: '2026-10-17T08:00:00Z',
        mobile_verified: true,
        has_password: hasPassword,
        profile_complete: profileComplete,
        missing_profile_fields: profileComplete ? [] : ['first_name', 'last_name'],
    })
    await page.route('**/api/auth/otp/request', route => route.fulfill({
        json: { success: true, data: { challenge_id: 'otp-authenticated-user', expires_in: 300, resend_after: 60, code_length: 6, accepted_requests_remaining: 2 } },
    }))
    await page.route('**/api/auth/otp/verify', route => route.fulfill({
        json: { success: true, token: 'ui-session-token', data: user(), has_password: initiallyHasPassword, profile_complete: profileComplete, missing_profile_fields: profileComplete ? [] : ['first_name', 'last_name'], mobile_verified: true },
    }))
    await page.route('**/api/auth/me', route => route.fulfill({ json: { data: user() } }))
    await page.route('**/api/auth/password/set', async route => {
        hasPassword = true
        await route.fulfill({ json: { success: true, data: { has_password: true } } })
    })
    await page.route('**/api/booking/my-reservations*', route => route.fulfill({ json: { data: [], current_page: 1, last_page: 1 } }))
    await page.route('**/api/booking/services', route => route.fulfill({ json: { data: [] } }))
    await page.route('**/api/client/me', route => route.fulfill({ json: { data: user() } }))
}

async function completeMockOtpLogin(page: Page, redirect = '/account') {
    await page.goto(`/account/login?redirect=${encodeURIComponent(redirect)}`)
    await waitForHydration(page)
    await page.getByLabel('شماره موبایل').fill(validMobile)
    await page.getByRole('button', { name: 'ادامه' }).click()
    const otp = page.getByLabel('کد تأیید')
    await expect(otp).toBeVisible()
    await otp.fill('123456')
}

test('login page loads and provides a usable mobile input', async ({ page }) => {
    await openLogin(page)

    const mobile = page.getByLabel('شماره موبایل')
    await expect(mobile).toHaveCount(1)
    await mobile.click()
    await expect(mobile).toBeFocused()
    await expect(mobile).toBeVisible()
    await mobile.fill(validMobile)
    await expect(mobile).toHaveValue(validMobile)
    await expect(page.getByRole('button', { name: 'ورود با رمز عبور' })).toBeVisible()
})

test('global account control mounts its login dialog only when requested', async ({ page }) => {
    await page.goto('/')
    await waitForHydration(page)
    await expect(page.locator('#unified-login-title')).toHaveCount(0)
    await page.getByRole('button', { name: 'ورود / حساب کاربری' }).click()

    const dialog = page.getByRole('dialog', { name: 'ورود به حساب کاربری' })
    await expect(dialog).toBeVisible()
    await expect(dialog.locator('#unified-login-title')).toHaveCount(1)
    await expect(dialog.getByLabel('شماره موبایل')).toHaveCount(1)
})

test('reCAPTCHA badge stays page-level and visible above the authentication dialog', async ({ page }) => {
    await page.goto('/')
    await waitForHydration(page)
    await page.getByRole('button', { name: 'ورود / حساب کاربری' }).click()
    await expect(page.getByRole('dialog', { name: 'ورود به حساب کاربری' })).toBeVisible()
    await page.evaluate(() => {
        const badge = document.createElement('div')
        badge.className = 'grecaptcha-badge'
        badge.setAttribute('aria-label', 'reCAPTCHA')
        badge.style.width = '256px'
        badge.style.height = '60px'
        document.body.appendChild(badge)
    })
    const badge = page.locator('.grecaptcha-badge')
    await expect(badge).toBeVisible()
    await expect.poll(() => badge.evaluate(element => element.parentElement?.classList.contains('recaptcha-badge-host'))).toBe(true)
    await expect.poll(() => page.locator('.recaptcha-badge-host').evaluate(element => element.matches(':popover-open'))).toBe(true)
    expect(await badge.evaluate(element => element.closest('dialog'))).toBeNull()
    expect(await badge.evaluate(element => getComputedStyle(element).position)).toBe('fixed')
})

test('rejects an invalid Iranian mobile without leaving the mobile step', async ({ page }) => {
    await openLogin(page)
    const mobile = page.getByLabel('شماره موبایل')
    await mobile.fill('09123')
    // `type=tel` only rejects an empty value here; format validation belongs to the app.
    expect(await mobile.evaluate(element => (element as HTMLInputElement).checkValidity())).toBe(true)
    await page.getByRole('button', { name: 'ادامه' }).click()

    await expect(page.getByText('شماره موبایل را با قالب معتبر وارد کنید.')).toBeVisible()
    await expect(page.getByLabel('شماره موبایل')).toBeVisible()
})

test('mobile continues directly to OTP and starts one reCAPTCHA-protected request', async ({ page }) => {
    const otp = await mockOtpApi(page)
    await openLogin(page)
    await page.getByLabel('شماره موبایل').fill(validMobile)
    await page.getByRole('button', { name: 'ادامه' }).click()
    await expect(page.getByLabel('کد تأیید')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'تأیید شماره موبایل' })).toBeVisible()
    await expect(page.getByText('کد آزمایشی (فقط محیط توسعه)')).toHaveCount(0)
    await expect(page.getByText(/روش ورود برای/)).toHaveCount(0)
    expect(otp.requestCount()).toBe(1)
    expect(otp.requestBody()).toMatchObject({ mobile: validMobile, recaptcha_token: 'ui-test-token', recaptcha_action: 'otp_request' })
    await expect(page.getByRole('button', { name: /ارسال دوباره تا/ })).toBeDisabled()
})

test('shows only a backend-provided development OTP preview and clears it when changing mobile', async ({ page, context }) => {
    const otp = await mockOtpApi(page, { devOtp: '654321' })
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await openLogin(page)
    await page.getByLabel('شماره موبایل').fill(validMobile)
    await page.getByRole('button', { name: 'ادامه' }).click()

    const preview = page.getByText('کد آزمایشی (فقط محیط توسعه)')
    await expect(preview).toBeVisible()
    await expect(page.getByText('654321')).toBeVisible()
    await page.getByRole('button', { name: 'کپی کد آزمایشی' }).click()
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('654321')
    expect(otp.requestCount()).toBe(1)
    expect(await page.evaluate(() => sessionStorage.getItem('otp-pending-challenge'))).not.toContain('654321')

    await page.getByRole('button', { name: 'ویرایش شماره' }).click()
    await expect(preview).toHaveCount(0)
    await expect(page.getByLabel('شماره موبایل')).toBeVisible()
})

test('does not restore the development OTP preview after closing and reopening the login dialog', async ({ page }) => {
    await mockOtpApi(page, { devOtp: '654321' })
    await page.goto('/')
    await waitForHydration(page)
    await page.getByRole('button', { name: 'ورود / حساب کاربری' }).click()

    let dialog = page.getByRole('dialog', { name: 'ورود به حساب کاربری' })
    await expect(dialog).toBeVisible()
    await dialog.getByLabel('شماره موبایل').fill(validMobile)
    await dialog.getByRole('button', { name: 'ادامه' }).click()
    await expect(dialog.getByText('کد آزمایشی (فقط محیط توسعه)')).toBeVisible()
    await dialog.getByRole('button', { name: 'بستن پنجره ورود' }).click()
    await expect(dialog).toHaveCount(0)

    await page.getByRole('button', { name: 'ورود / حساب کاربری' }).click()
    dialog = page.getByRole('dialog', { name: 'ورود به حساب کاربری' })
    await expect(dialog.getByLabel('کد تأیید')).toBeVisible()
    await expect(dialog.getByText('کد آزمایشی (فقط محیط توسعه)')).toHaveCount(0)
})

test('OTP HTTP request waits for the Google script and token execution', async ({ page }) => {
    await mockAuthConfig(page)
    let releaseScript = () => {}
    let signalScriptRequested = () => {}
    const scriptGate = new Promise<void>(resolve => { releaseScript = resolve })
    const scriptRequested = new Promise<void>(resolve => { signalScriptRequested = resolve })
    let otpRequests = 0
    await page.route('**/recaptcha/api.js*', async route => {
        signalScriptRequested()
        await scriptGate
        await route.fulfill({
            contentType: 'application/javascript',
            body: 'window.__resolveCaptchaToken=null;window.grecaptcha={ready:callback=>callback(),execute:async()=>new Promise(resolve=>window.__resolveCaptchaToken=resolve)};',
        })
    })
    await page.route('**/api/auth/otp/request', async route => {
        otpRequests += 1
        await route.fulfill({ json: { success: true, data: { challenge_id: 'delayed-script-challenge', expires_in: 300, resend_after: 60, code_length: 6, accepted_requests_remaining: 2 } } })
    })

    await openLogin(page)
    await page.getByLabel('شماره موبایل').fill(validMobile)
    await page.getByRole('button', { name: 'ادامه' }).click()
    await scriptRequested
    expect(otpRequests).toBe(0)
    releaseScript()
    await page.waitForFunction(() => typeof (window as Window & { __resolveCaptchaToken?: unknown }).__resolveCaptchaToken === 'function')
    expect(otpRequests).toBe(0)
    await page.evaluate(() => (window as Window & { __resolveCaptchaToken?: (token: string) => void }).__resolveCaptchaToken?.('fresh-ui-token'))
    await expect(page.getByLabel('کد تأیید')).toBeVisible()
    expect(otpRequests).toBe(1)
})

test('failed Google script shows retry guidance and sends no OTP request', async ({ page }) => {
    await mockAuthConfig(page)
    let signalScriptRequested = () => {}
    const scriptRequested = new Promise<void>(resolve => { signalScriptRequested = resolve })
    let otpRequests = 0
    await page.route('**/recaptcha/api.js*', async route => {
        signalScriptRequested()
        await route.abort('failed')
    })
    await page.route('**/api/auth/otp/request', async route => {
        otpRequests += 1
        await route.fulfill({ json: { success: true, data: { challenge_id: 'should-not-exist', expires_in: 300, resend_after: 60, code_length: 6, accepted_requests_remaining: 2 } } })
    })

    await openLogin(page)
    await page.getByLabel('شماره موبایل').fill(validMobile)
    await page.getByRole('button', { name: 'ادامه' }).click()
    await scriptRequested
    await expect(page.getByText('اعتبارسنجی امنیتی در دسترس نیست. ورود با رمز عبور را انتخاب کنید یا کمی بعد دوباره تلاش کنید.')).toBeVisible()
    expect(otpRequests).toBe(0)
})

test('pending OTP request replaces the mobile form and rapid clicks still send once', async ({ page }) => {
    const otp = await mockOtpApi(page, { holdRequest: true })
    await openLogin(page)
    await page.getByLabel('شماره موبایل').fill(validMobile)
    const submit = page.getByRole('button', { name: 'ادامه' })
    // Dispatch two real button click events in one browser task, before Vue's
    // pending render removes the mobile form. The component guard must ignore
    // the second submit, and the OTP endpoint must still be called once.
    await submit.evaluate(element => {
        const button = element as HTMLButtonElement
        button.click()
        button.click()
    })
    await expect(page.getByRole('status')).toContainText('در حال دریافت کد تأیید…')
    await expect(page.getByLabel('شماره موبایل')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'ادامه', exact: true })).toHaveCount(0)
    await expect.poll(otp.requestCount).toBe(1)
    otp.releaseRequest()
    await expect(page.getByLabel('کد تأیید')).toBeVisible()
    expect(otp.requestCount()).toBe(1)
})

test('password login is directly available and visibility toggle works', async ({ page }) => {
    await openLogin(page)
    await page.getByLabel('شماره موبایل').fill(validMobile)
    await page.getByRole('button', { name: 'ورود با رمز عبور' }).click()

    const password = page.locator('input[autocomplete="current-password"]')
    await expect(password).toBeVisible()
    await expect(password).toBeFocused()
    await expect(password).toHaveAttribute('type', 'password')
    await page.getByRole('button', { name: 'نمایش رمز عبور' }).click()
    await expect(password).toHaveAttribute('type', 'text')
    await page.getByRole('button', { name: 'پنهان کردن رمز عبور' }).click()
    await expect(password).toHaveAttribute('type', 'password')
})

test('OTP accepts pasted Persian digits, normalizes them and verifies once automatically', async ({ page }) => {
    const otp = await mockOtpApi(page)
    await openLogin(page)
    await page.getByLabel('شماره موبایل').fill(validMobile)
    await page.getByRole('button', { name: 'ادامه' }).click()
    const code = page.getByLabel('کد تأیید')
    await expect(code).toBeVisible()
    await code.fill('۱۲۳۴۵۶')
    await expect(page.getByText('کد واردشده درست نیست.')).toBeVisible()
    expect(otp.verificationCount()).toBe(1)
    expect(otp.verificationBody()).toMatchObject({ mobile: validMobile, challenge_id: 'ui-challenge', code: '123456' })
})

test('first OTP login offers optional password setup and skip keeps the account session', async ({ page }) => {
    await mockOtpAuthenticatedUser(page)
    await completeMockOtpLogin(page)
    await expect(page.getByRole('heading', { name: 'برای ورودهای بعدی رمز عبور تعیین کنید' })).toBeVisible()
    const password = page.getByLabel('رمز عبور', { exact: true })
    const confirmation = page.getByLabel('تکرار رمز عبور', { exact: true })
    await expect(password).toBeVisible()
    await expect(confirmation).toBeVisible()
    await expect(password).toHaveAttribute('type', 'password')
    await page.getByRole('button', { name: 'نمایش رمز عبور' }).first().click()
    await expect(password).toHaveAttribute('type', 'text')

    await page.getByRole('button', { name: 'فعلاً رد می‌کنم' }).click()
    await expect(page).toHaveURL(/\/account$/)
    await expect(page.locator('.account-nav')).toBeVisible()
    await expect(page.locator('.account-content .unified-login')).toHaveCount(0)
    await expect.poll(() => page.evaluate(() => sessionStorage.getItem('client-token'))).toBe('ui-session-token')
    await page.reload()
    await waitForHydration(page)
    await expect(page.locator('.account-nav')).toBeVisible()
    await expect(page.locator('.account-content .unified-login')).toHaveCount(0)
})

test('password setup uses the existing authenticated endpoint and updates shared account state', async ({ page }) => {
    await mockOtpAuthenticatedUser(page)
    let submitted = false
    await page.route('**/api/auth/password/set', async route => {
        expect(route.request().method()).toBe('POST')
        expect(route.request().postDataJSON()).toEqual({ password: 'Counseling123', password_confirmation: 'Counseling123' })
        submitted = true
        await route.fulfill({ json: { success: true, data: { has_password: true } } })
    })
    await completeMockOtpLogin(page, '/')
    const password = page.getByLabel('رمز عبور', { exact: true })
    const confirmation = page.getByLabel('تکرار رمز عبور', { exact: true })
    await expect(password).toBeVisible()
    await password.fill('Counseling123')
    await confirmation.fill('Counseling123')
    await page.getByRole('button', { name: 'تنظیم رمز عبور' }).click()
    await expect.poll(() => submitted).toBe(true)
    await expect(page).toHaveURL(/\/$/)
    await expect.poll(() => page.evaluate(() => sessionStorage.getItem('client-token'))).toBe('ui-session-token')
})

test('existing-password user bypasses the optional password setup screen', async ({ page }) => {
    await mockOtpAuthenticatedUser(page, true)
    await completeMockOtpLogin(page)
    await expect(page).toHaveURL(/\/account$/)
    await expect(page.locator('.account-nav')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'برای ورودهای بعدی رمز عبور تعیین کنید' })).toHaveCount(0)
    await expect(page.locator('.account-content .unified-login')).toHaveCount(0)
})

test('incomplete profile does not turn an authenticated account into a login form', async ({ page }) => {
    await mockOtpAuthenticatedUser(page, true, false)
    await completeMockOtpLogin(page)
    await expect(page).toHaveURL(/\/account$/)
    await expect(page.locator('.account-nav')).toBeVisible()
    await expect(page.locator('.account-content .unified-login')).toHaveCount(0)
})

test('mobile login layout works at 390 by 844 without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await openLogin(page)
    await page.getByLabel('شماره موبایل').fill(validMobile)
    await expect(page.getByRole('button', { name: 'ادامه' })).toBeVisible()

    const dimensions = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        content: document.documentElement.scrollWidth,
    }))
    expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport)
})

test('legacy registration URL redirects to unified login', async ({ page }) => {
    await page.goto('/account/register')
    await expect(page).toHaveURL(/\/account\/login(?:\?.*)?$/)
    await waitForHydration(page)
    await expect(page.getByRole('heading', { name: 'ورود به حساب کاربری' })).toBeVisible()
})

test('keyboard navigation exposes a visible focus indicator', async ({ page }) => {
    await openLogin(page)
    await page.keyboard.press('Tab')

    const skipLink = page.locator('.skip-link')
    await expect(skipLink).toBeFocused()
    await expect(skipLink).toBeVisible()
    const focusStyle = await skipLink.evaluate(element => ({
        outlineStyle: getComputedStyle(element).outlineStyle,
        outlineWidth: getComputedStyle(element).outlineWidth,
    }))
    expect(focusStyle.outlineStyle).not.toBe('none')
    expect(parseFloat(focusStyle.outlineWidth)).toBeGreaterThan(0)

    // Continue through the document's tab order and confirm the input is keyboard reachable.
    const mobile = page.getByLabel('شماره موبایل')
    for (let index = 0; index < 30 && !(await mobile.evaluate(el => el === document.activeElement)); index++) {
        await page.keyboard.press('Tab')
    }
    await expect(mobile).toBeFocused()
})

test('light and dark themes render without a layout overflow', async ({ page }) => {
    await openLogin(page)
    const theme = page.locator('.header-actions .theme-control')
    await theme.locator('.theme-toggle').click()
    const themeMenu = theme.getByRole('group', { name: 'انتخاب پوسته' })
    const darkMode = themeMenu.getByRole('button', { name: 'تیره' })
    await expect(darkMode).toBeVisible()
    await darkMode.click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect.poll(() => page.evaluate(() => localStorage.getItem('appearance-mode'))).toBe('dark')
    await expect(page.getByLabel('شماره موبایل')).toBeVisible()

    // Selecting a theme closes the native <details> menu, removing its buttons
    // from the accessibility tree. Reopen it before checking the selected state.
    await theme.locator('.theme-toggle').click()
    const selectedDark = theme.getByRole('group', { name: 'انتخاب پوسته' }).getByRole('button', { name: 'تیره' })
    await expect(selectedDark).toBeVisible()
    await expect(selectedDark).toHaveAttribute('aria-pressed', 'true')

    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect.poll(() => page.evaluate(() => localStorage.getItem('appearance-mode'))).toBe('dark')
    await waitForHydration(page)
    await expect(page.getByLabel('شماره موبایل')).toBeVisible()

    await theme.locator('.theme-toggle').click()
    const lightMode = theme.getByRole('group', { name: 'انتخاب پوسته' }).getByRole('button', { name: 'روشن' })
    await expect(lightMode).toBeVisible()
    await lightMode.click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    await expect.poll(() => page.evaluate(() => localStorage.getItem('appearance-mode'))).toBe('light')
    await expect(page.getByLabel('شماره موبایل')).toBeVisible()

    await theme.locator('.theme-toggle').click()
    const selectedLight = theme.getByRole('group', { name: 'انتخاب پوسته' }).getByRole('button', { name: 'روشن' })
    await expect(selectedLight).toBeVisible()
    await expect(selectedLight).toHaveAttribute('aria-pressed', 'true')

    const dimensions = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        content: document.documentElement.scrollWidth,
    }))
    expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport)
})

test('protected page waits for session validation and redirects on an expired token', async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('client-token', 'expired-test-token'))
    let release!: () => void
    const pending = new Promise<void>(resolve => { release = resolve })
    await page.route('**/api/auth/me', async route => {
        await pending
        await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'Unauthenticated.' }) })
    })
    await page.goto('/account/profile')
    await expect(page.getByText(/در حال دریافت|بارگذاری/)).toBeVisible()
    await expect(page.locator('.account-profile-form')).toHaveCount(0)
    release()
    await expect(page).toHaveURL(/\/account\/login\?redirect=/)
    await expect.poll(() => page.evaluate(() => sessionStorage.getItem('client-token'))).toBeNull()
})

test('logout network failure clears local session and reports unconfirmed server revocation', async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('client-token', 'logout-test-token'))
    await page.route('**/api/client/logout', route => route.abort('failed'))
    await page.goto('/')
    await page.getByRole('button', { name: 'خروج از حساب' }).first().click()
    const dialog = page.getByRole('dialog', { name: 'از حساب خارج می‌شوید؟' })
    await dialog.getByRole('button', { name: 'خروج از حساب' }).click()
    await expect.poll(() => page.evaluate(() => sessionStorage.getItem('client-token'))).toBeNull()
    await expect(page.getByText('در این دستگاه خارج شدید، اما لغو نشست در سرور تأیید نشد.')).toBeVisible()
})

test('global toast is outside and above the login modal', async ({ page }) => {
    await page.route('**/api/client/login', route => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Unavailable' }) }))
    await openLogin(page)
    await page.getByLabel('شماره موبایل').fill(validMobile)
    await page.getByRole('button', { name: 'ورود با رمز عبور' }).click()
    await page.locator('#login-password').fill('wrong-password')
    await page.getByRole('button', { name: 'ورود', exact: true }).click()
    const host = page.locator('.app-toast-host')
    await expect(host).toBeVisible()
    await expect.poll(() => host.evaluate(element => element.matches(':popover-open'))).toBe(true)
    expect(await host.evaluate(element => element.closest('dialog'))).toBeNull()
    await expect(host.locator('.app-toast')).toHaveCount(1)
})
