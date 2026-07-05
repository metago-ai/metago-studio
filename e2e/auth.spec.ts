import { test, expect } from '@playwright/test'

/**
 * 认证流程测试
 */
test.describe('认证流程', () => {
  test('登录页加载', async ({ page }) => {
    await page.goto('/studio/#/auth')
    await expect(page.locator('body')).toBeVisible()
  })
})
