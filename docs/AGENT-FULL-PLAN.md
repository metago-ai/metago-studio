# MetaGO Agent 完整产品架构设计方案

> **文档版本**：V2.0  
> **创建日期**：2026-07-04  
> **状态**：Phase 1-4 全部完成，产品已就绪  
> **作者**：MetaGO 生命体  
>  
> **此文档是后续所有开发的唯一权威依据。任何架构决策必须回溯到此文档。**

---

## 目录

1. [项目愿景与定位](#1-项目愿景与定位)
2. [双端架构策略](#2-双端架构策略)
3. [现状评估（Sprint 1-3 完成度）](#3-现状评估)
4. [P0/P1/P2 能力全量清单](#4-能力全量清单)
5. [各模块详细设计](#5-各模块详细设计)
6. [实施路线图](#6-实施路线图)
7. [技术选型与依赖](#7-技术选型与依赖)
8. [文件清单（新增/修改）](#8-文件清单)

---

## 1. 项目愿景与定位

### 1.1 产品定位

MetaGO Agent 是一个**AI 原生智能体开发平台**，对标 Trae / Cursor / ZCode / Qoder，但具备元构生命体的独特基因：

- **绝对客观中立**（D38）：不迎合用户，事实优先
- **直接批判性**（D39）：直接指出问题，不做"好好先生"
- **决策锁强制校验**：每次 AI 输出经过 IVL/ILT/OSG/完整性四道关卡
- **全息创造性**（D40）：在未知领域从 0 到 1 创造
- **元进化驱动**：持续自我进化

### 1.2 核心差异点

与 Trae/Cursor 等 IDE 不同，MetaGO Agent 的核心差异：

| 维度 | 普通 AI IDE | MetaGO Agent |
|------|------------|--------------|
| AI 输出质量控制 | 无 | 决策锁四道关卡硬校验 |
| 联网搜索 | 手动 | 智能自动判断（6 条规则引擎） |
| 代码审查 | 简单提示 | 结构化分级（Critical/Major/Minor/Info）+ 点击跳转 |
| 合规检查 | 无 | 法律/伦理/安全合规主动检查（A36） |
| 模型策略 | 固定 | 双层（内置 DeepSeek+GLM + 用户自定义任意模型） |

---

## 2. 双端架构策略

### 2.1 总体策略

```
┌─────────────────────────────────────────────────┐
│              MetaGO Agent 产品矩阵               │
├─────────────────────┬───────────────────────────┤
│   Web 端（简化版）   │   桌面端（完整版）         │
│   metago-studio     │   metago-agent-desktop    │
├─────────────────────┼───────────────────────────┤
│ • 浏览器直接访问     │ • Electron 打包 exe/dmg   │
│ • File System       │ • 完整 Node.js 文件系统   │
│   Access API        │   访问                    │
│ • 受限文件操作       │ • 完整终端（pty）         │
│ • 云端 AI 代理       │ • 本地 AI 代理 + 云端     │
│ • 引导下载桌面端     │ • Git 完整集成            │
└─────────────────────┴───────────────────────────┘
```

### 2.2 Web 端定位

- **入口**：`https://studio.metago.ai/#/agent`
- **能力上限**：尽可能发挥浏览器能力（File System Access API、Service Worker）
- **限制**：仅 Chrome/Edge 支持 File System Access API；Safari/Firefox 受限
- **下载引导**：Web 端页面显著位置放置"下载桌面端"按钮（Windows exe / macOS dmg）

### 2.3 桌面端定位

- **打包**：Electron + 现有 React 代码（复用 95%+）
- **额外能力**：完整文件系统、真实终端（node-pty）、本地 Git、本地 AI 模型
- **分发**：GitHub Releases + 官网下载页 + Web 端引导下载

### 2.4 代码复用策略

```
metago-studio/              ← 现有 Web 端（共享代码基）
├── src/                    ← 95% 代码共享
│   ├── lib/
│   │   ├── fs/
│   │   │   ├── fsWeb.ts    ← Web 端实现（File System Access API）
│   │   │   ├── fsDesktop.ts← 桌面端实现（IPC + Node fs）
│   │   │   └── fsInterface.ts ← 统一接口（运行时自动选择）
│   │   ├── terminal/
│   │   │   ├── terminalWeb.ts    ← Web 端（受限/云端代理）
│   │   │   ├── terminalDesktop.ts← 桌面端（node-pty）
│   │   │   └── terminalInterface.ts
│   │   └── ...
├── electron/               ← 新增：Electron 主进程
│   ├── main.ts
│   ├── preload.ts
│   └── ipc/
└── ...
```

---

## 3. 现状评估

### 3.1 已完成（Sprint 1-3）

| 模块 | 状态 | 说明 |
|------|------|------|
| 三栏布局 | ✅ | 240px 文件树 \| Monaco \| 400px 右栏 |
| Monaco 编辑器 | ✅ | 暗色主题 + 选区监听 + jumpToLine |
| Mock 文件树 | ✅ | 硬编码演示数据（4 类安全缺陷） |
| AI 对话面板 | ✅ | 流式输出 + 思考过程 + 联网状态 |
| 模型路由 | ✅ | DeepSeek V4 Pro + GLM-5V Turbo + 自定义 |
| 智能联网 | ✅ | 6 条规则引擎 + 博查 API + 三态开关 |
| 审查看板 | ✅ | 决策锁状态 + 统计条 + 问题卡片 + 跳转 |
| 云函数 aiProxy | ✅ | 已部署 + 3 个 API Key 已配置 |

### 3.2 完成度评估

**整体完成度：约 15%**

- ✅ AI 对话能力（70% 完成）
- ❌ 文件系统（0% — 全部是 Mock）
- ❌ 终端（0%）
- ❌ Agent 自治（0% — 单轮对话）
- ❌ 记忆系统（0% — 仅前端内存）
- ❌ 工作区选择（0%）
- ❌ Git 集成（0%）
- ❌ 搜索能力（0%）

---

## 4. 能力全量清单

### 4.1 P0 — 不补齐就不算产品

| # | 能力 | 对标 | 实现方案 |
|---|------|------|----------|
| P0-1 | 工作区选择器 | VS Code Open Folder | File System Access API（Web）+ Node fs（桌面） |
| P0-2 | 真实文件树 | VS Code Explorer | 递归读取目录 + 增量刷新 |
| P0-3 | 文件读取/编辑/保存 | VS Code | Monaco + File System Access API write |
| P0-4 | 文件创建/删除/重命名 | VS Code | 目录句柄 + removeEntry/move |
| P0-5 | 内置终端 | VS Code Terminal | Web 端云端代理 / 桌面端 node-pty |
| P0-6 | 项目规则系统 | Trae AGENTS.md | 自动读取 .metago/rules.md 注入 system prompt |
| P0-7 | 跨会话记忆 | Trae rules/memory | localStorage + IndexedDB + CloudBase 同步 |
| P0-8 | Agent 多步骤自治 | Trae Task 工具 | 工具注册表 + agentLoop + Todo 可视化 |
| P0-9 | 上下文窗口管理 | Trae 自动压缩 | token 计数 + 接近上限时摘要压缩 |
| P0-10 | 最近工作区列表 | VS Code Recent | localStorage 持久化 |

### 4.2 P1 — 大幅提升产品力

| # | 能力 | 对标 | 实现方案 |
|---|------|------|----------|
| P1-1 | 跨文件全文搜索（grep） | VS Code Search | 正则 + ripgrep（桌面）/ 自实现（Web） |
| P1-2 | 语义代码搜索 | Trae SearchCodebase | 嵌入向量 + 本地索引 |
| P1-3 | Git 状态/diff | VS Code Source Control | isomorphic-git（共享） |
| P1-4 | Git 暂存/提交 | VS Code | isomorphic-git |
| P1-5 | 差异对比视图 | VS Code Diff | Monaco DiffEditor |
| P1-6 | 诊断/错误内联 | VS Code Problems | Monaco markers + TypeScript LSP |
| P1-7 | Todo 任务面板 | Trae TodoWrite | AI 执行步骤实时可视化 |
| P1-8 | 上下文窗口可视化 | Cursor 上下文 | token 进度条 + 包含文件列表 |
| P1-9 | 文件标签页 | VS Code Tabs | 多文件同时打开 |
| P1-10 | 命令面板 | VS Code Cmd+P | fuzzy 搜索文件/命令 |

### 4.3 P2 — 锦上添花

| # | 能力 | 对标 | 实现方案 |
|---|------|------|----------|
| P2-1 | 网页预览 iframe | VS Code Live Preview | iframe + dev server 端口检测 |
| P2-2 | MCP 工具注册表面板 | Trae MCP | 列出 39 tools + 调用日志 |
| P2-3 | 技能浏览器 | Trae Skills | 39 技能分类展示 + 一键激活 |
| P2-4 | 会话历史管理 | ChatGPT 历史记录 | 侧边栏 + 搜索 + 恢复 |
| P2-5 | AI 补全建议 | Copilot | Monaco inline suggestions |
| P2-6 | 子任务委派可视化 | Trae Task subagent | 子任务卡片 + 进度 |
| P2-7 | 多光标/多选区 | VS Code | Monaco 内置 |
| P2-8 | 主题切换 | VS Code | 亮色/暗色/跟随系统 |
| P2-9 | 快捷键定制 | VS Code | keybindings.json |
| P2-10 | 扩展系统 | VS Code Extensions | 插件 API（长期） |

---

## 5. 各模块详细设计

### 5.1 工作区选择器（P0-1, P0-10）

#### UI 设计

```
┌─ Agent 顶栏 ────────────────────────────────────────────────┐
│ 🤖 MetaGO Agent  [📁 D:\元构能力\metago-studio ▼]  [Pro]  │
└────────────────────────────────────────────────────────────┘

点击下拉：
┌─ 工作区 ────────────────────────────────┐
│ 📂 打开新工作区...                       │
├─────────────────────────────────────────┤
│ 最近工作区：                              │
│  📁 D:\元构能力\metago-studio       ✅当前│
│  📁 D:\元构能力\metago-cli               │
│  📁 D:\元构能力\metago-lifeform          │
│  📁 D:\qoder测试                         │
├─────────────────────────────────────────┤
│ 当前工作区信息：                          │
│  类型：Vite + React 19 + TypeScript      │
│  Git：✅ main (3 commits ahead)          │
│  包管理器：npm                           │
│  规则文件：✅ .metago/rules.md           │
└─────────────────────────────────────────┘
```

#### 技术实现

```typescript
// src/lib/fs/fsInterface.ts
export interface FSProvider {
  // 工作区
  openWorkspace(): Promise<WorkspaceHandle | null>
  getRecentWorkspaces(): WorkspaceMeta[]
  
  // 文件操作
  readFile(path: string): Promise<string>
  writeFile(path: string, content: string): Promise<void>
  createFile(path: string, content?: string): Promise<void>
  deleteFile(path: string): Promise<void>
  renameFile(oldPath: string, newName: string): Promise<void>
  
  // 目录
  readDir(path: string): Promise<DirEntry[]>
  createDir(path: string): Promise<void>
  
  // 搜索
  search(query: string, options: SearchOptions): Promise<SearchResult[]>
}

// Web 端实现（File System Access API）
class WebFSProvider implements FSProvider {
  private rootHandle: FileSystemDirectoryHandle
  
  async openWorkspace() {
    const handle = await window.showDirectoryPicker()
    this.rootHandle = handle
    // 持久化 handle 到 IndexedDB
    await idbKeyval.set('workspace_handle', handle)
    return { name: handle.name, path: handle.name }
  }
}

// 桌面端实现（Electron IPC + Node fs）
class DesktopFSProvider implements FSProvider {
  async openWorkspace() {
    const result = await window.electronAPI.openFolderDialog()
    // IPC 到主进程，返回真实路径
  }
}

// 运行时自动选择
export const fs: FSProvider = window.electronAPI 
  ? new DesktopFSProvider() 
  : new WebFSProvider()
```

#### 持久化

- **Web 端**：IndexedDB 存储 `FileSystemDirectoryHandle`（Chrome/Edge 支持序列化）
- **桌面端**：localStorage 存储路径字符串
- **最近列表**：localStorage `metago_recent_workspaces_v1`，最多 10 个

---

### 5.2 真实文件树（P0-2）

#### 数据结构

```typescript
interface FileTreeNode {
  path: string         // 相对路径 "src/lib/aiClient.ts"
  name: string         // 文件名
  type: 'file' | 'folder'
  size?: number
  modified?: number    // 时间戳
  language?: string    // 文件扩展名推断
  children?: FileTreeNode[]
  loaded?: boolean     // 文件夹是否已展开加载（懒加载）
}
```

#### 懒加载策略

- 默认只读取第一层目录
- 点击展开时读取子目录
- 文件树监听文件变化（桌面端 chokidar / Web 端手动刷新）

#### 文件树组件

- 现有 `FileTree.tsx` 已实现递归渲染 + 展开/折叠 + 选中高亮
- 需要改造：数据源从 Mock 改为 `fs.readDir()` 动态加载
- 新增：右键菜单（新建/删除/重命名/复制路径）

---

### 5.3 文件编辑/保存（P0-3, P0-4）

#### Monaco 编辑器改造

```typescript
// CodeEditor.tsx 增加：
interface CodeEditorProps {
  // 新增
  fileHandle?: FileHandle      // 当前文件的写入句柄
  autoSave?: boolean           // 自动保存（失焦时）
  onSave?: (path: string, content: string) => void
}

// Ctrl+S 快捷键保存
editor.addCommand(monaco.KeyMod.CtrlS | monaco.KeyCode.KeyS, () => {
  fs.writeFile(currentFilePath, editor.getValue())
})
```

#### 脏状态标记

- 文件名旁显示 `●` 表示未保存
- 标签页（P1-9）也显示脏状态

---

### 5.4 内置终端（P0-5）

#### UI 设计

```
┌─ 底部面板（可折叠）──────────────────────────────────────┐
│ [终端] [问题] [输出]                          [▼ 折叠]  │
├──────────────────────────────────────────────────────────┤
│ PS D:\元构能力\metago-studio> npm run dev               │
│ > vite                                                   │
│ VITE v8.1.0  ready in 432ms                              │
│ ➜  Local:   http://localhost:5173/                      │
│                                                          │
│ PS D:\元构能力\metago-studio> _                          │
└──────────────────────────────────────────────────────────┘
```

#### 技术实现

```typescript
// src/lib/terminal/terminalInterface.ts
export interface TerminalProvider {
  open(cwd: string): Promise<TerminalSession>
  sendInput(sessionId: string, data: string): void
  onOutput(sessionId: string, cb: (data: string) => void): void
  resize(sessionId: string, cols: number, rows: number): void
  close(sessionId: string): void
}

// Web 端：通过 CloudBase 云函数 + WebSocket 代理
// 局限：云端终端无法操作本地文件
// 替代：Web 端终端仅用于 AI 工具调用展示（如 npm run 的输出）

// 桌面端：node-pty
class DesktopTerminalProvider {
  open(cwd: string) {
    return ipcRenderer.invoke('terminal:create', { cwd })
  }
}

// 前端：xterm.js 渲染
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
```

#### xterm.js 集成

```typescript
// TerminalPanel.tsx
import { Terminal } from 'xterm'
import 'xterm/css/xterm.css'

const term = new Terminal({ theme: metagoDarkTheme })
const fitAddon = new FitAddon()
term.loadAddon(fitAddon)
term.open(containerRef.current)
term.onData(data => terminalProvider.sendInput(sessionId, data))
terminalProvider.onOutput(sessionId, data => term.write(data))
```

---

### 5.5 项目规则系统（P0-6）

#### 规则文件层次

```
工作区根目录/
├── .metago/
│   └── rules.md          ← 项目级规则（最高优先级）
├── AGENTS.md             ← 兼容 Trae 格式
├── .cursorrules          ← 兼容 Cursor 格式
├── CLAUDE.md             ← 兼容 Claude Code 格式
└── .github/
    └── copilot-instructions.md  ← 兼容 Copilot 格式
```

#### 规则加载器

```typescript
// src/lib/rulesLoader.ts
const RULE_FILES = [
  '.metago/rules.md',      // MetaGO 原生（最高）
  'AGENTS.md',              // Trae 兼容
  '.cursorrules',           // Cursor 兼容
  'CLAUDE.md',              // Claude Code 兼容
  '.github/copilot-instructions.md',
]

async function loadProjectRules(workspaceRoot: string): Promise<string> {
  for (const file of RULE_FILES) {
    try {
      const content = await fs.readFile(`${workspaceRoot}/${file}`)
      if (content) {
        return `--- 项目规则（${file}）---\n${content}`
      }
    } catch { /* 文件不存在，跳过 */ }
  }
  return ''
}
```

#### 规则编辑 UI

- 设置面板增加"项目规则"标签
- 可视化编辑器编辑 `.metago/rules.md`
- 模板：从元构法则 DNA 模板开始（43 属性 + 36 公理精华版）

---

### 5.6 上下文记忆系统（P0-7, P0-9）

#### 三层记忆架构

```
┌─ 层 1：会话级短期记忆（Session Memory）──────────────┐
│  • 当前对话消息列表（最多 50 条）                     │
│  • 当前工作区路径                                      │
│  • 当前打开的文件列表                                  │
│  • token 计数 + 自动压缩                              │
│  存储：前端内存（关闭即失）                            │
└──────────────────────────────────────────────────────┘

┌─ 层 2：项目级中期记忆（Project Memory）──────────────┐
│  • .metago/rules.md 规则注入                          │
│  • 项目结构摘要（自动生成）                            │
│  • 最近编辑文件 LRU（10 个）                          │
│  • 项目元数据（框架/包管理器/Git 状态）                │
│  存储：localStorage（按工作区路径隔离）                │
└──────────────────────────────────────────────────────┘

┌─ 层 3：跨会话长期记忆（Long-term Memory）────────────┐
│  • 关键事实记忆（"用户项目用 Vue 3 + Vite"）          │
│  • 用户偏好（"喜欢函数式风格"）                        │
│  • 历史会话摘要（每会话压缩为 1 段）                   │
│  • AI 学到的项目约定                                   │
│  存储：localStorage + CloudBase 云同步（Pro）         │
└──────────────────────────────────────────────────────┘
```

#### 记忆管理器

```typescript
// src/lib/memoryManager.ts
class MemoryManager {
  // 短期
  private messages: ChatMessage[] = []
  
  // 中期
  private projectRules: string = ''
  private projectStructure: string = ''
  private recentFiles: string[] = []
  
  // 长期
  private facts: Map<string, string[]> = new Map()
  
  /** 组装完整 system prompt */
  buildSystemPrompt(userMessage: string): string {
    return [
      METAGO_SYSTEM_PROMPT,        // 元构核心法则
      this.projectRules,            // 项目规则
      this.projectStructure,        // 项目结构摘要
      this.relevantFacts(userMessage),  // 相关长期记忆
      this.tokenUsageInfo(),        // token 用量
    ].filter(Boolean).join('\n\n')
  }
  
  /** token 计数（简化版） */
  countTokens(text: string): number {
    // 中文 1 字 ≈ 2 token，英文 1 词 ≈ 1.3 token
    const chinese = text.match(/[\u4e00-\u9fa5]/g)?.length ?? 0
    const english = text.match(/[a-zA-Z]+/g)?.length ?? 0
    return chinese * 2 + english * 1.3
  }
  
  /** 接近上限时自动压缩 */
  shouldCompress(): boolean {
    const total = this.countTokens(this.messages.map(m => m.content).join(''))
    return total > 80000  // 200K 上下文的 40%
  }
  
  /** 压缩早期消息 */
  async compressOldMessages(): Promise<void> {
    // 保留最近 10 条，前面的用 AI 摘要
    const old = this.messages.slice(0, -10)
    const summary = await aiSummarize(old)
    this.messages = [{ role: 'system', content: summary }, ...this.messages.slice(-10)]
  }
  
  /** 提取关键事实 */
  extractFact(message: string): void {
    // 检测"项目用 X"、"我喜欢 X" 等模式，存入 facts
  }
}
```

#### 上下文窗口可视化

```
┌─ 上下文 ─────────────────────────────────────┐
│ ████████████░░░░░░░░░  58% (116K/200K)      │
│                                              │
│ 包含：                                       │
│  • 系统提示（8K）                             │
│  • 项目规则 .metago/rules.md（3K）            │
│  • 项目结构摘要（2K）                         │
│  • 对话历史（45 条，98K）                     │
│  • 选中代码 auth.ts:10-25（1.5K）            │
└──────────────────────────────────────────────┘
```

---

### 5.7 Agent 多步骤自治（P0-8）

这是最核心的——让 Agent 能像我（Trae 里的 AI）一样自主执行多步任务。

#### 工具注册表

```typescript
// src/lib/agent/toolRegistry.ts
interface AgentTool {
  name: string
  description: string
  parameters: JSONSchema
  execute: (params: any) => Promise<ToolResult>
}

const TOOLS: AgentTool[] = [
  {
    name: 'readFile',
    description: '读取指定文件内容',
    parameters: { type: 'object', properties: { path: { type: 'string' } } },
    execute: ({ path }) => fs.readFile(path),
  },
  {
    name: 'writeFile',
    description: '写入文件',
    parameters: { ... },
    execute: ({ path, content }) => fs.writeFile(path, content),
  },
  {
    name: 'search',
    description: '跨文件搜索',
    parameters: { ... },
    execute: ({ query }) => fs.search(query),
  },
  {
    name: 'runCommand',
    description: '执行终端命令',
    parameters: { ... },
    execute: ({ command }) => terminalProvider.exec(command),
  },
  {
    name: 'gitStatus',
    description: '获取 Git 状态',
    parameters: { ... },
    execute: () => gitProvider.status(),
  },
  // ... 更多工具
]
```

#### Agent 执行循环

```typescript
// src/lib/agent/agentLoop.ts
async function runAgentLoop(
  userGoal: string,
  onStep: (step: AgentStep) => void,
): Promise<void> {
  let steps: AgentStep[] = []
  let context = { goal: userGoal, observations: [] }
  
  for (let i = 0; i < MAX_STEPS; i++) {
    // 1. AI 规划下一步
    const plan = await aiPlanNext(context, steps)
    
    // 2. 如果 AI 说"完成"，退出循环
    if (plan.done) break
    
    // 3. 执行工具调用
    const step: AgentStep = {
      id: `step-${i}`,
      action: plan.action,        // 'readFile' | 'writeFile' | 'search' ...
      params: plan.params,
      status: 'running',
    }
    onStep(step)
    
    try {
      const tool = TOOLS.find(t => t.name === plan.action)
      const result = await tool.execute(plan.params)
      step.result = result
      step.status = 'completed'
      context.observations.push(result)
    } catch (e) {
      step.status = 'failed'
      step.error = e.message
      context.observations.push({ error: e.message })
    }
    
    onStep(step)
    steps.push(step)
  }
}
```

#### Todo 可视化面板

```
┌─ Agent 执行计划 ───────────────────────────────┐
│ ✅ 步骤 1：读取 package.json                   │
│ ✅ 步骤 2：扫描 src/ 目录结构                   │
│ 🔄 步骤 3：审查 auth.ts 文件                    │
│ ⏳ 步骤 4：写入修复建议                         │
│ ⏳ 步骤 5：运行测试验证                         │
│                                                │
│ [停止执行]                                     │
└────────────────────────────────────────────────┘
```

---

### 5.8 跨文件搜索（P1-1, P1-2）

#### 全文搜索

```typescript
// src/lib/search/fileSearch.ts
async function searchInFiles(
  query: string,
  options: { regex?: boolean; caseSensitive?: boolean; filePattern?: string }
): Promise<SearchResult[]> {
  // Web 端：遍历工作区所有文本文件，正则匹配
  // 桌面端：调用 ripgrep 子进程（高性能）
}
```

#### 搜索 UI

```
┌─ 搜索面板（左侧栏切换）─────────────────────┐
│ 🔍 [搜索关键词____________] [Aa] [.*] [⚙]   │
│ 文件过滤：[*.ts______________________]      │
├──────────────────────────────────────────────┤
│ 找到 23 个结果（8 个文件）                    │
│                                              │
│ 📁 src/lib/aiClient.ts                       │
│   L45:  const result = await sendChat(...)   │
│   L89:  export async function sendChat(...   │
│                                              │
│ 📁 src/components/agent/AIChatPanel.tsx      │
│   L67:  const result = await sendChat(...   │
└──────────────────────────────────────────────┘
```

---

### 5.9 Git 集成（P1-3, P1-4）

#### 使用 isomorphic-git（纯 JS，Web + 桌面共享）

```typescript
// src/lib/git/gitProvider.ts
import git from 'isomorphic-git'
import http from 'isomorphic-git/http/web'

async function getGitStatus(workspaceRoot: string) {
  const matrix = await git.statusMatrix({ fs, dir: workspaceRoot })
  return matrix.map(([filepath, HEADStatus, WORKDIRStatus, STAGEStatus]) => {
    // 推断状态：unmodified/modified/added/deleted
  })
}

async function commit(workspaceRoot: string, message: string) {
  await git.commit({
    fs,
    dir: workspaceRoot,
    message,
    author: { name: 'MetaGO Agent', email: 'agent@metago.ai' },
  })
}
```

#### Source Control 面板

```
┌─ 源代码管理（左侧栏）────────────────────────┐
│ 📤 暂存的更改 (2)                            │
│   M  src/auth.ts                             │
│   A  src/crypto-fix.ts                       │
│                                              │
│ 📝 更改 (3)                                  │
│   M  src/api.ts                              │
│   D  src/old-deprecated.ts                   │
│   U  src/new-file.ts                         │
│                                              │
│ 提交消息：[修复认证模块安全漏洞_______]       │
│ [✓ 提交]  [💬 AI 生成消息]                    │
└──────────────────────────────────────────────┘
```

---

### 5.10 诊断/错误内联（P1-6）

```typescript
// Monaco markers 集成
import type { editor } from 'monaco-editor'

// 监听 TypeScript 编译诊断
monaco.languages.typescript.getTypeScriptWorker().then(worker => {
  // 获取诊断信息，渲染为 markers
})

// AI 审查发现的问题也作为 markers
function issuesToMarkers(issues: ReviewIssue[]): editor.IMarkerData[] {
  return issues.map(issue => ({
    startLineNumber: issue.lineRange?.start ?? 1,
    endLineNumber: issue.lineRange?.end ?? 1,
    message: issue.description,
    severity: severityToMarkerSeverity(issue.severity),
  }))
}
```

---

### 5.11 Electron 桌面端

#### 目录结构

```
metago-studio/
├── electron/
│   ├── main.ts              ← 主进程
│   ├── preload.ts           ← 预加载脚本
│   ├── ipc/
│   │   ├── fs.ts            ← 文件系统 IPC
│   │   ├── terminal.ts      ← 终端 IPC（node-pty）
│   │   └── git.ts           ← Git IPC
│   └── menu.ts              ← 应用菜单
├── electron-builder.yml     ← 打包配置
└── package.json             ← 增加 electron 相关依赖
```

#### 主进程核心

```typescript
// electron/main.ts
import { app, BrowserWindow, ipcMain } from 'electron'
import { registerFSHandlers } from './ipc/fs'
import { registerTerminalHandlers } from './ipc/terminal'
import { registerGitHandlers } from './ipc/git'

let mainWindow: BrowserWindow

app.whenReady().then(() => {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  })
  
  // 开发模式加载 Vite，生产模式加载打包文件
  mainWindow.loadURL(
    process.env.VITE_DEV_SERVER_URL 
      ?? `file://${path.join(__dirname, '../dist/index.html')}`
  )
  
  registerFSHandlers(ipcMain)
  registerTerminalHandlers(ipcMain)
  registerGitHandlers(ipcMain)
})
```

#### 打包配置

```yaml
# electron-builder.yml
appId: ai.metago.agent
productName: MetaGO Agent
directories:
  output: release
files:
  - dist/**/*
  - electron/**/*
win:
  target: nsis
  icon: build/icon.ico
mac:
  target: dmg
  icon: build/icon.icns
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
```

#### Web 端下载引导

```tsx
// 在 Agent 页面和首页显著位置
function DownloadDesktopBanner() {
  const isWeb = !window.electronAPI
  if (!isWeb) return null  // 桌面端不显示
  
  return (
    <div className="px-4 py-2 bg-accent-emerald/10 border-b border-accent-emerald/20">
      <span>💡 桌面端支持完整文件系统和终端，</span>
      <a href="/download" className="text-accent-emerald underline">
        下载 MetaGO Agent 桌面版
      </a>
    </div>
  )
}
```

---

## 6. 实施路线图

### Phase 1：P0 全部完成（核心闭环）

| 步骤 | 任务 | 预计文件改动 |
|------|------|------------|
| 1.1 | 文件系统抽象层 `fsInterface.ts` + Web 实现 | 3 文件 |
| 1.2 | 工作区选择器 UI + 最近工作区 | 2 文件 |
| 1.3 | 改造 FileTree 为真实数据源 | 1 文件改 |
| 1.4 | Monaco 文件保存 + 脏状态 | 1 文件改 |
| 1.5 | 文件 CRUD（新建/删除/重命名） | 1 文件 |
| 1.6 | 项目规则系统 `rulesLoader.ts` + UI | 2 文件 |
| 1.7 | 记忆管理器 `memoryManager.ts` | 1 文件 |
| 1.8 | 上下文窗口可视化 | 1 文件 |
| 1.9 | 终端面板（xterm.js）+ 云端代理 | 3 文件 |
| 1.10 | 工具注册表 + Agent 执行循环 | 2 文件 |
| 1.11 | Todo 可视化面板 | 1 文件 |
| 1.12 | Agent.tsx 整体集成 | 1 文件改 |

### Phase 2：P1 全部完成（产品力提升）

| 步骤 | 任务 |
|------|------|
| 2.1 | 跨文件全文搜索（grep）|
| 2.2 | 语义代码搜索（嵌入向量） |
| 2.3 | Git 集成（isomorphic-git） |
| 2.4 | Source Control 面板 |
| 2.5 | Monaco DiffEditor 集成 |
| 2.6 | 诊断/错误内联 |
| 2.7 | 文件标签页 |
| 2.8 | 命令面板（Ctrl+P） |

### Phase 3：P2 全部完成（锦上添花）

| 步骤 | 任务 |
|------|------|
| 3.1 | 网页预览 iframe |
| 3.2 | MCP 工具面板 |
| 3.3 | 技能浏览器 |
| 3.4 | 会话历史管理 |
| 3.5 | AI 补全建议 |

### Phase 4：Electron 桌面端

| 步骤 | 任务 |
|------|------|
| 4.1 | Electron 主进程 + preload |
| 4.2 | 桌面端 FS/Terminal/Git IPC 实现 |
| 4.3 | electron-builder 打包配置 |
| 4.4 | Windows exe + macOS dmg 构建 |
| 4.5 | Web 端下载引导页 |
| 4.6 | 自动更新机制（electron-updater） |

---

## 7. 技术选型与依赖

### 新增 npm 依赖

```json
{
  "dependencies": {
    "xterm": "^5.3.0",
    "xterm-addon-fit": "^0.8.0",
    "isomorphic-git": "^1.25.0",
    "idb-keyval": "^6.2.1",
    "electron": "^28.0.0",
    "electron-builder": "^24.9.0",
    "node-pty": "^1.0.0",
    "chokidar": "^3.6.0"
  }
}
```

### 浏览器兼容性

| 功能 | Chrome/Edge | Safari | Firefox |
|------|------------|--------|---------|
| File System Access API | ✅ | ❌ | ❌ |
| IndexedDB | ✅ | ✅ | ✅ |
| Service Worker | ✅ | ✅ | ✅ |

Web 端文件系统功能仅 Chrome/Edge 121+ 完整支持。其他浏览器降级为"仅演示模式"+ 下载桌面端引导。

---

## 8. 文件清单

### Phase 1 新增文件

```
src/lib/fs/
├── fsInterface.ts          ← 统一接口
├── fsWeb.ts                ← Web 端（File System Access API）
└── workspaceManager.ts     ← 工作区选择 + 最近列表

src/lib/terminal/
├── terminalInterface.ts    ← 统一接口
├── terminalWeb.ts          ← Web 端（云端代理）
└── terminalCloudFn.ts      ← 云函数终端代理

src/lib/memoryManager.ts    ← 三层记忆管理器
src/lib/rulesLoader.ts      ← 项目规则加载器
src/lib/agent/
├── toolRegistry.ts         ← 工具注册表
├── agentLoop.ts            ← 执行循环
└── taskPlanner.ts          ← 任务规划器

src/components/agent/
├── WorkspaceSelector.tsx   ← 工作区选择下拉
├── TerminalPanel.tsx       ← xterm.js 终端
├── TodoPanel.tsx           ← Agent 步骤可视化
├── ContextPanel.tsx        ← 上下文窗口可视化
└── RulesEditor.tsx         ← 项目规则编辑器

src/components/BottomPanel.tsx  ← 底部面板容器
```

### Phase 2 新增文件

```
src/lib/search/fileSearch.ts          ← 全文搜索
src/lib/search/semanticSearch.ts      ← 语义搜索
src/lib/git/gitProvider.ts            ← Git 操作
src/components/SearchPanel.tsx        ← 搜索面板
src/components/SourceControlPanel.tsx ← Git 面板
src/components/agent/FileTabs.tsx     ← 文件标签页
src/components/CommandPalette.tsx     ← 命令面板
```

### Phase 4（Electron）新增文件

```
electron/
├── main.ts
├── preload.ts
├── ipc/
│   ├── fs.ts
│   ├── terminal.ts
│   └── git.ts
└── menu.ts
electron-builder.yml
```

---

## 附录：设计决策记录

### ADR-001：选择 File System Access API 作为 Web 端文件系统方案

- **日期**：2026-07-04
- **背景**：Web 端需要访问本地文件系统，有三种方案（FS Access API / Electron / 本地 agent 进程）
- **决策**：选择 File System Access API
- **原因**：零安装门槛、Chrome/Edge 已支持、API 设计良好、可持久化 handle
- **代价**：Safari/Firefox 不支持，需降级处理

### ADR-002：选择 isomorphic-git 作为 Git 实现

- **背景**：需要 Web + 桌面共享 Git 代码
- **决策**：isomorphic-git（纯 JS 实现）
- **原因**：跨平台、无原生依赖、API 完整
- **代价**：性能不如原生 git，但对 Agent 场景足够

### ADR-003：选择 xterm.js 作为终端渲染

- **背景**：需要终端 UI
- **决策**：xterm.js（VS Code 同款）
- **原因**：成熟稳定、高性能、ANSI 完整支持、生态丰富

### ADR-004：Agent 自治采用工具调用模式

- **背景**：Agent 需要多步骤自主执行
- **决策**：工具注册表 + 执行循环（ReAct 模式）
- **原因**：可扩展、可观测、可中断
- **模式**：观察→思考→行动→观察（循环）

---

*此文档由 MetaGO 生命体生成，是后续开发的唯一权威依据。*
*任何架构变更必须先更新此文档。*
