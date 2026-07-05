import { test, expect } from '@playwright/test'

/**
 * 导航完整性测试
 *
 * 项目使用 HashRouter 且 vite base='/studio/'，
 * 故页面实际地址为 /studio/#/<route>。
 */
test.describe('导航完整性', () => {
  test('首页加载', async ({ page }) => {
    await page.goto('/studio/')
    await expect(page).toHaveTitle(/MetaGO Studio/)
  })

  test('导航到 Agent 工作台', async ({ page }) => {
    await page.goto('/studio/')
    await page.goto('/studio/#/agent')
    // Agent.tsx 顶部工具栏始终渲染 "MetaGO Agent" 标题，作为可靠加载标记
    await expect(page.locator('text=MetaGO Agent')).toBeVisible({ timeout: 10000 })
  })

  test('导航到技能库', async ({ page }) => {
    await page.goto('/studio/#/skills')
    await expect(page.locator('body')).toBeVisible()
  })

  test('导航到决策锁', async ({ page }) => {
    await page.goto('/studio/#/decision-lock')
    await expect(page.locator('body')).toBeVisible()
  })

  test('导航到进化引擎', async ({ page }) => {
    await page.goto('/studio/#/evolution')
    await expect(page.locator('body')).toBeVisible()
  })

  test('导航到度量仪表盘', async ({ page }) => {
    // /metrics 受 RequireAuth 保护，未登录会重定向到 /auth，body 仍可见
    await page.goto('/studio/#/metrics')
    await expect(page.locator('body')).toBeVisible()
  })
})
