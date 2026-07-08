import { useState, useEffect } from 'react'
import { Section, Field, selectCls, PrimaryButton, GhostButton } from './_shared'
import {
  getGeneralSettings, saveGeneralSettings,
  type Theme, type Language, type KeymapStyle,
} from '../../../lib/settingsStore'

/** 通用配置面板（对标 Trae 通用设置） */
export function GeneralPanel() {
  const [settings, setSettings] = useState(getGeneralSettings())

  useEffect(() => { setSettings(getGeneralSettings()) }, [])

  const update = <K extends keyof typeof settings>(key: K, value: typeof settings[K]) => {
    const next = { ...settings, [key]: value }
    setSettings(next)
    saveGeneralSettings(next)
  }

  return (
    <div>
      <Section title="基础设置" description="IDE 外观和语言偏好">
        <Field label="主题">
          <select
            value={settings.theme}
            onChange={e => update('theme', e.target.value as Theme)}
            className={selectCls}
          >
            <option value="dark">暗色</option>
            <option value="deep-blue">深蓝</option>
            <option value="light">亮色</option>
          </select>
        </Field>

        <Field label="语言">
          <select
            value={settings.language}
            onChange={e => update('language', e.target.value as Language)}
            className={selectCls}
          >
            <option value="zh-CN">简体中文</option>
            <option value="en">English</option>
            <option value="ja">日本語</option>
          </select>
        </Field>
      </Section>

      <Section title="偏好设置" description="编辑器、快捷键和外部 IDE 导入">
        <Field label="快捷键风格">
          <select
            value={settings.keymap}
            onChange={e => update('keymap', e.target.value as KeymapStyle)}
            className={selectCls}
          >
            <option value="vscode">VS Code 风格</option>
            <option value="jetbrains">JetBrains 风格</option>
            <option value="vim">Vim 风格</option>
          </select>
        </Field>

        <Field label="Markdown 文件默认打开方式">
          <select
            value={settings.markdownDefaultMode}
            onChange={e => update('markdownDefaultMode', e.target.value as 'code' | 'preview')}
            className={selectCls}
          >
            <option value="code">代码编辑器（纯文本）</option>
            <option value="preview">Markdown 预览模式</option>
          </select>
        </Field>

        <Field label="本地链接默认打开方式">
          <select
            value={settings.localLinkOpenMode}
            onChange={e => update('localLinkOpenMode', e.target.value as 'ask' | 'internal' | 'system')}
            className={selectCls}
          >
            <option value="ask">始终询问</option>
            <option value="internal">内置浏览器</option>
            <option value="system">系统浏览器</option>
          </select>
        </Field>

        <Field label="导入配置" hint="从外部 IDE 导入插件、设置、代码片段及快捷键配置">
          <div className="flex gap-2">
            <GhostButton onClick={() => alert('VS Code 配置导入功能：检测到 VS Code 安装路径后可一键导入')}>从 VS Code 导入</GhostButton>
            <GhostButton onClick={() => alert('Cursor 配置导入功能：检测到 Cursor 安装路径后可一键导入')}>从 Cursor 导入</GhostButton>
          </div>
        </Field>

        <Field label="Editor 设置" hint="字体、word-wrap、window 等编辑器参数">
          <PrimaryButton onClick={() => alert('Editor 设置面板：可配置字体大小、行高、自动换行等')}>去设置</PrimaryButton>
        </Field>
      </Section>
    </div>
  )
}
