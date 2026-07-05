import { test, expect } from '@playwright/test'

/**
 * Agent 工作台核心功能测试
 */
test.describe('Agent 工作台', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/studio/#/agent')
    await page.waitForLoadState('networkidle')
  })

  test('页面加载并显示侧边栏', async ({ page }) => {
    // Agent 侧边栏标题为“文件资源管理器”，包含“资源管理器”子串
    await expect(page.locator('text=资源管理器').or(page.locator('text=文件')).first()).toBeVisible({ timeout: 10000 })
  })

  test('AI 对话输入框可见', async ({ page }) => {
    // AIChatPanel 渲染了一个 textarea 作为对话输入
    await expect(page.locator('textarea').first()).toBeVisible({ timeout: 10000 })
  })

  test('底部面板标签可见', async ({ page }) => {
    // Agent 底部面板默认展开，“终端”标签始终可见
    await expect(page.locator('text=终端').or(page.locator('text=AI 活动')).first()).toBeVisible({ timeout: 10000 })
  })
})
