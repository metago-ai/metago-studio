import { useState, useEffect } from 'react'
import { Section, ToggleRow, Field, selectCls, inputCls } from './_shared'
import {
  getChatFlowSettings, saveChatFlowSettings,
  type CodeReviewScope, type AutoRunMode,
} from '../../../lib/settingsStore'

/** 对话流配置面板（对标 Trae 对话流设置） */
export function ChatFlowPanel() {
  const [settings, setSettings] = useState(getChatFlowSettings())

  useEffect(() => { setSettings(getChatFlowSettings()) }, [])

  const update = <K extends keyof typeof settings>(key: K, value: typeof settings[K]) => {
    const next = { ...settings, [key]: value }
    setSettings(next)
    saveChatFlowSettings(next)
  }

  return (
    <div>
      <Section title="待办清单" description="智能体任务进度跟踪">
        <ToggleRow
          label="待办清单"
          description="允许智能体使用待办清单来跟踪任务进度"
          checked={settings.todoListEnabled}
          onChange={v => update('todoListEnabled', v)}
        />
        <ToggleRow
          label="对话流节点自动折叠"
          description="(仅 SOLO 模式) 已完成的任务将被自动总结并折叠"
          checked={settings.autoCollapseNodes}
          onChange={v => update('autoCollapseNodes', v)}
        />
      </Section>

      <Section title="自动修复代码规范问题">
        <ToggleRow
          label="自动修复"
          description="自动修复在对话过程中识别到的代码规范问题（SOLO 模式默认开启）"
          checked={settings.autoFixLint}
          onChange={v => update('autoFixLint', v)}
        />
      </Section>

      <Section title="智能体主动提问">
        <ToggleRow
          label="智能体主动提问"
          description="遇到多种可行方案或需要了解用户偏好时，AI 会主动暂停并提问"
          checked={settings.agentProactiveQuestion}
          onChange={v => update('agentProactiveQuestion', v)}
        />
      </Section>

      <Section title="代码审查" description="智能体生成的代码会写入磁盘，可决定是否保留或撤销">
        <Field label="审查范围">
          <select
            value={settings.codeReviewScope}
            onChange={e => update('codeReviewScope', e.target.value as CodeReviewScope)}
            className={selectCls}
          >
            <option value="all">审查所有变更</option>
            <option value="latest">仅审查最近一轮变更</option>
            <option value="none">无需审查（直接保留）</option>
          </select>
        </Field>
        <ToggleRow
          label="审查后跳转到下一处变更"
          description="保留或撤销变更后，自动跳转到文件内的下一处变更"
          checked={settings.jumpToNextChangeAfterReview}
          onChange={v => update('jumpToNextChangeAfterReview', v)}
        />
      </Section>

      <Section title="自动运行" description="使用智能体时自动运行 MCP Server 和命令（注意安全性）">
        <ToggleRow
          label="自动运行 MCP"
          description="使用智能体时将自动运行 MCP Server 及其内部的工具"
          checked={settings.autoRunMCP}
          onChange={v => update('autoRunMCP', v)}
        />
        <Field label="自动运行命令">
          <select
            value={settings.autoRunCommand}
            onChange={e => update('autoRunCommand', e.target.value as AutoRunMode)}
            className={selectCls}
          >
            <option value="manual">始终手动运行</option>
            <option value="whitelist">使用白名单</option>
            <option value="blacklist">使用黑名单</option>
            <option value="always">始终自动运行</option>
          </select>
        </Field>
        {settings.autoRunCommand === 'whitelist' && (
          <Field label="命令白名单" hint="每行一个命令">
            <textarea
              value={settings.commandWhitelist.join('\n')}
              onChange={e => update('commandWhitelist', e.target.value.split('\n').filter(Boolean))}
              className={`${inputCls} font-mono h-20 resize-none`}
            />
          </Field>
        )}
        {settings.autoRunCommand === 'blacklist' && (
          <Field label="命令黑名单" hint="每行一个命令">
            <textarea
              value={settings.commandBlacklist.join('\n')}
              onChange={e => update('commandBlacklist', e.target.value.split('\n').filter(Boolean))}
              className={`${inputCls} font-mono h-20 resize-none`}
            />
          </Field>
        )}
      </Section>

      <Section title="任务状态通知">
        <ToggleRow
          label="横幅通知"
          description="任务完成或失败时显示横幅"
          checked={settings.taskNotificationBanner}
          onChange={v => update('taskNotificationBanner', v)}
        />
        <ToggleRow
          label="声音通知"
          description="任务完成或失败时播放提示音"
          checked={settings.taskNotificationSound}
          onChange={v => update('taskNotificationSound', v)}
        />
        {settings.taskNotificationSound && (
          <Field label={`音量：${settings.soundVolume}%`}>
            <input
              type="range"
              min={0}
              max={100}
              value={settings.soundVolume}
              onChange={e => update('soundVolume', parseInt(e.target.value))}
              className="w-full"
            />
          </Field>
        )}
      </Section>
    </div>
  )
}
