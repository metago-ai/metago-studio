import { useState, useEffect } from 'react'
import {
  X, User, Settings as SettingsIcon, Bot, Network, MessageSquare,
  FileText, Sparkles, Cpu, BookOpen, Webhook,
} from 'lucide-react'
import { GeneralPanel } from './settings/GeneralPanel'
import { ChatFlowPanel } from './settings/ChatFlowPanel'
import { AgentsPanel } from './settings/AgentsPanel'
import { MCPPanel } from './settings/MCPPanel'
import { RulesPanel } from './settings/RulesPanel'
import { SkillsPanel } from './settings/SkillsPanel'
import { ModelPanel } from './settings/ModelPanel'
import { IndexDocsPanel } from './settings/IndexDocsPanel'
import { HooksPanel } from './settings/HooksPanel'
import { AccountPanel } from './settings/AccountPanel'

export type SettingsTab =
  | 'account' | 'general' | 'agents' | 'mcp' | 'chatflow'
  | 'rules' | 'skills' | 'model' | 'index' | 'hooks'

interface SettingsHubProps {
  open: boolean
  onClose: () => void
  initialTab?: SettingsTab
}

const TABS: Array<{ id: SettingsTab; label: string; icon: typeof User }> = [
  { id: 'account',  label: '账号',          icon: User },
  { id: 'general',  label: '通用',          icon: SettingsIcon },
  { id: 'agents',   label: '智能体',        icon: Bot },
  { id: 'mcp',      label: 'MCP',           icon: Network },
  { id: 'chatflow', label: '对话流',        icon: MessageSquare },
  { id: 'rules',    label: '规则与记忆',    icon: FileText },
  { id: 'skills',   label: '技能与命令',    icon: Sparkles },
  { id: 'model',    label: '模型配置',      icon: Cpu },
  { id: 'index',    label: '索引与文档',    icon: BookOpen },
  { id: 'hooks',    label: 'HOOKS',         icon: Webhook },
]

/** 统一设置中心（对标 Trae 设置面板） */
export function SettingsHub({ open, onClose, initialTab = 'general' }: SettingsHubProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab)

  useEffect(() => {
    if (open) setActiveTab(initialTab)
  }, [open, initialTab])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg-deep/80 backdrop-blur-sm">
      <div className="bg-bg-card border border-border-default rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border-subtle flex-shrink-0">
          <h3 className="text-sm font-semibold text-zinc-100">设置</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* 左侧导航 */}
          <div className="w-48 flex-shrink-0 border-r border-border-subtle overflow-y-auto py-2">
            {TABS.map(tab => {
              const Icon = tab.icon
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-2 px-4 py-2 text-xs transition-colors ${
                    active
                      ? 'bg-accent-emerald/10 text-accent-emerald border-l-2 border-accent-emerald'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-bg-hover border-l-2 border-transparent'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{tab.label}</span>
                </button>
              )
            })}
          </div>

          {/* 右侧内容 */}
          <div className="flex-1 overflow-y-auto p-5">
            {activeTab === 'account'  && <AccountPanel />}
            {activeTab === 'general'  && <GeneralPanel />}
            {activeTab === 'agents'   && <AgentsPanel />}
            {activeTab === 'mcp'      && <MCPPanel />}
            {activeTab === 'chatflow' && <ChatFlowPanel />}
            {activeTab === 'rules'    && <RulesPanel />}
            {activeTab === 'skills'   && <SkillsPanel />}
            {activeTab === 'model'    && <ModelPanel />}
            {activeTab === 'index'    && <IndexDocsPanel />}
            {activeTab === 'hooks'    && <HooksPanel />}
          </div>
        </div>

        {/* 底部 */}
        <div className="flex-shrink-0 px-5 py-3 border-t border-border-subtle flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-medium bg-bg-hover text-zinc-200 hover:bg-border-subtle"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  )
}
