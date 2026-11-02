import { test, expect, type Page } from '@playwright/test'

const mobile = process.env.E2E_AUTH_MOBILE ?? ''
const password = process.env.E2E_AUTH_PASSWORD ?? ''
const diagnosticRunId = process.env.E2E_AUTH_RUN_ID ?? ''
const apiBase = 'http://127.0.0.1:8011/api'

test.skip(!mobile || !password, 'Requires a disposable password-enabled client in consulting_booking_test_20261012.')

async function requestHasBearerAuthorization(response: import('@playwright/test').Response) {
  const authorization = (await response.request().allHeaders()).authorization ?? ''
  return /^Bearer\s+\S+$/.test(authorization)
}

async function openPasswordLogin(page: Page) {
  if (/^[a-f0-9]{24}$/.test(diagnosticRunId)) {
    // Correlates this browser request with isolated, test-only controller logs.
    // This header does not enable diagnostics or affect authentication.
    await page.setExtraHTTPHeaders({ 'X-Auth-E2E-Run-Id': diagnosticRunId })
  }
  const response = await page.goto('/account/login')
  expect(response?.ok()).toBeTruthy()
  // SSR renders the form before Vue attaches its submit handler. Wait for the
  // same explicit hydration marker used by the passing UI-only login tests.
  await expect(page.locator('.site-shell[data-app-hydrated="true"]')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'ورود به حساب کاربری' })).toBeVisible()
  const mobileInput = page.getByLabel('شماره موبایل')
  await expect(mobileInput).toBeVisible()
  await mobileInput.fill(mobile)

  // Choose password from the initial mobile step so this integration test
  // never requests an OTP or invokes SMS/reCAPTCHA.
  await page.getByRole('button', { name: 'ورود با رمز عبور', exact: true }).click()
  await expect(page.getByText(`شماره موبایل ${mobile}`)).toBeVisible()
  await expect(page.locator('input[autocomplete="current-password"]')).toBeVisible()
}

test('rejects an incorrect password without establishing a client session', async ({ page }) => {
  await openPasswordLogin(page)
  const responsePromise = page.waitForResponse(response => response.url() === `${apiBase}/client/login`)
  await page.locator('input[autocomplete="current-password"]').fill(`${password}-incorrect`)
  await page.getByRole('button', { name: 'ورود', exact: true }).click()
  const response = await responsePromise
  expect(response.status()).toBe(422)
  await expect(page.getByText('شماره موبایل یا رمز عبور نادرست است.')).toBeVisible()
  expect(await page.evaluate(() => sessionStorage.getItem('client-token'))).toBeNull()
})

test('restores a Bearer session after reload and revokes it at logout', async ({ page, request }) => {
  let bearerToken: string | null = null
  let collectProfileResponse: ((response: import('@playwright/test').Response) => void) | undefined
  try {
    await openPasswordLogin(page)
    const observedProfileResponses: import('@playwright/test').Response[] = []
    collectProfileResponse = (response: import('@playwright/test').Response) => {
      if (response.url() === `${apiBase}/auth/me`) observedProfileResponses.push(response)
    }
    page.on('response', collectProfileResponse)
    const loginRequestPromise = page.waitForRequest(request => request.url() === `${apiBase}/client/login`)
    const loginPromise = page.waitForResponse(response => response.url() === `${apiBase}/client/login`)
    await page.locator('input[autocomplete="current-password"]').fill(password)
    await page.getByRole('button', { name: 'ورود', exact: true }).click()
    const loginRequest = await loginRequestPromise
    const submittedCredentials = loginRequest.postDataJSON() as { email?: string; password?: string }
    // Compare values without including either credential in assertion output.
    expect(submittedCredentials.email === mobile).toBe(true)
    expect(submittedCredentials.password === password).toBe(true)
    const loginResponse = await loginPromise
    if (loginResponse.status() !== 200) {
      const body = await loginResponse.json().catch(() => ({}))
      console.log('Login API diagnostic:', {
        status: loginResponse.status(),
        message: body.message,
        fields: Object.keys(body.errors ?? {}),
      })
    }
    expect(loginResponse.status()).toBe(200)

    await expect(page).toHaveURL(/\/account(?:\/appointments)?(?:\?.*)?$/)
    const profileResponse = observedProfileResponses[0]
      ?? await page.waitForResponse(response => response.url() === `${apiBase}/auth/me`)
    page.off('response', collectProfileResponse)
    collectProfileResponse = undefined
    expect(profileResponse.status()).toBe(200)
    expect(await requestHasBearerAuthorization(profileResponse)).toBe(true)
    bearerToken = await page.evaluate(() => sessionStorage.getItem('client-token'))
    expect(typeof bearerToken).toBe('string')
    expect(bearerToken?.length).toBeGreaterThan(0)

    const restoredProfilePromise = page.waitForResponse(response => response.url() === `${apiBase}/auth/me`)
    await page.reload()
    const restoredProfile = await restoredProfilePromise
    expect(restoredProfile.status()).toBe(200)
    expect(await requestHasBearerAuthorization(restoredProfile)).toBe(true)
    expect(await page.evaluate(() => Boolean(sessionStorage.getItem('client-token')))).toBe(true)

    const logoutPromise = page.waitForResponse(response => response.url() === `${apiBase}/client/logout`)
    await page.getByRole('button', { name: 'خروج از حساب' }).first().click()
    const dialog = page.getByRole('dialog', { name: 'از حساب خارج می‌شوید؟' })
    await dialog.getByRole('button', { name: 'خروج از حساب' }).click()
    expect((await logoutPromise).status()).toBe(204)
    await expect.poll(() => page.evaluate(() => sessionStorage.getItem('client-token'))).toBeNull()

    const revoked = await request.get(`${apiBase}/client/me`, {
      headers: { Authorization: `Bearer ${bearerToken}` },
    })
    expect(revoked.status()).toBe(401)
  } finally {
    if (collectProfileResponse) page.off('response', collectProfileResponse)
    // Best-effort cleanup prevents a failed assertion from leaving a PAT in the disposable DB.
    bearerToken ||= await page.evaluate(() => sessionStorage.getItem('client-token')).catch(() => null)
    if (bearerToken) {
      await request.post(`${apiBase}/client/logout`, {
        headers: { Authorization: `Bearer ${bearerToken}` },
      }).catch(() => undefined)
    }
  }
})
