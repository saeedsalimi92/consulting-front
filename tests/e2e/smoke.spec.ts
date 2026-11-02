import { test, expect } from '@playwright/test'

test('Nuxt homepage opens in Chrome', async ({ page }) => {
    const response = await page.goto('/')

    expect(response?.ok()).toBeTruthy()
    await expect(page.locator('body')).toBeVisible()
})