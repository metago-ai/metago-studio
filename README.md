# MetaGO Studio

> AI Agent 智能体工作台 — 让非技术用户也能"开箱即用"使用元构能力
>
> **让智能，学会进化。从 Agent 到生命体的范式跃迁。**

<p align="center">
  <img src="https://gitee.com/metago/metagolifeform/raw/main/assets/metago-logo.png" alt="MetaGO Logo" width="280" />
</p>

<p align="center">
  <a href="https://metago.life/studio/"><img alt="Studio" src="https://img.shields.io/badge/Studio-在线使用-10d985?logo=react"></a>
  <a href="https://metago.life"><img alt="Website" src="https://img.shields.io/badge/Website-MetaGO-00d4ff"></a>
  <a href="https://github.com/metago-ai/metago-studio"><img alt="GitHub" src="https://img.shields.io/badge/GitHub-metago--studio-181717?logo=github"></a>
  <a href="https://gitee.com/metago/metago-studio"><img alt="Gitee" src="https://img.shields.io/badge/Gitee-metago--studio-C71D23?logo=gitee"></a>
  <a href="./LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-success"></a>
</p>

## 这是什么

**MetaGO Studio** 是一个 Web 应用，让用户通过可视化界面选择和组合 MetaGO 技能，生成自定义 Kit 的 `package.json` 和 `README.md`。

无需手动编写配置文件——拖拽、选择、生成，三步完成定制 Kit。

**在线体验**：<https://metago.life/studio/>

## 核心功能

| 功能 | 描述 |
|------|------|
| 技能库面板 | 39 个技能内置数据（22 核心 + 4 Dev Kit + 1 意识激活 + 5 方法论 + 5 架构 + 2 工程质量），搜索 + 分类筛选 |
| 决策锁可视化 | 四道关卡实时可视化校验过程（IVL/ILT/OSG/完整性） |
| 进化档案 | 个人/组织进化历史可视化，云端同步 |
| 工作区 | 已选技能列表，上下移动排序，空状态引导 |
| Kit 配置 | 名称/版本/描述/类型/垂直领域，实时统计 |
| 生成 package.json | 含 metago 字段 + peerDependencies + parentPackage |
| 生成 README.md | 技能清单表格 + 安装说明 |
| 下载 Kit 配置 | JSON 文件下载 |
| 预览模态框 | 格式化显示 + 复制剪贴板 + 下载 |
| 私有技能库 | AES-GCM 加密的个人专属技能存储 |
| 用户系统 | 邮箱/手机/GitHub OAuth 多方式登录 |
| Pro 升级 | V3 五档定价：Free / Pro（¥39/月）/ Pro+（¥99/月）/ Team（¥199/月起）/ Enterprise（¥3万/年起），支持在线支付 + 授权码激活 |
| 行为银行 | 数字行为 + AI 行为 5 级信用体系（元构学徒→元构宗师），开放 API 预留 |
| Certify 认证 | L1-L4 四级独立认证（¥999-9999/次），独立入口 /certify |
| 管理后台 | 独立的用户/订单/许可证/反馈管理（/admin） |

## 快速开始

```bash
git clone https://gitee.com/metago/metago-studio.git
cd metago-studio
npm install
npm run dev      # 开发预览 http://localhost:5173
npm run build    # 生产构建到 dist/
```

## 技术栈

- **Vite 8** + **React 19** + **TypeScript 6**
- **Tailwind CSS 3**（深色主题，MetaGO Emerald 品牌色 `#10d985`）
- **React Router 7**（HashRouter）
- **CloudBase Web SDK**（认证 + 数据库 + 云函数）
- 零外部 UI 库依赖（无 shadcn/radix/dnd-kit）

## 部署架构

| 路径 | 内容 | 仓库 |
|------|------|------|
| `metago.life/` | 官网 | metago-website |
| `metago.life/studio/` | Studio（本产品） | metago-studio |

- **Vite base**：`/studio/`（绝对路径，避免无尾部斜杠时资源 404）
- **路由**：HashRouter（避免 CloudBase 静态托管刷新重定向问题）
- **管理后台**：独立路由 `/admin`，不渲染 Studio Header/Onboarding/FeedbackButton
- **后端**：腾讯云 CloudBase（CloudBase DB + Cloud Functions）

### 部署命令

```bash
# 构建并审计
npm run predeploy   # = npm run build && npm run audit

# 部署到 CloudBase（必须指定 cloudPath=studio，否则会覆盖官网根目录！）
npm run deploy:studio
# 等价于：tcb hosting deploy ./dist studio --env-id metago-d6gfw1e4rf2a5bcad
```

> ⚠️ **严重警告**：禁止使用 `tcb hosting deploy ./dist` 不带 `cloudPath` 的形式，会覆盖根目录全部文件（官网）。2026-07-01 事故记录：误用此命令导致 Studio 覆盖官网，已紧急恢复。

### 产品完整性审计

Studio 集成了 50 项检查的产品完整性审计脚本，覆盖 5 大维度：
- 用户流程完整性（7 项）
- 数据链路完整性（10 项）
- 功能真实性（20 项）
- UI/UX 一致性（7 项）
- 部署一致性（6 项）

```bash
npm run audit       # 运行审计
npm run audit:data  # 数据链路专项审计
```

任何一项失败 = 禁止交付。

## 云函数

| 云函数 | 功能 |
|--------|------|
| `auth` | 用户认证（CloudBase Auth 内置） |
| `sync` | 进化记录/决策锁/私有技能/用户档案 CRUD |
| `subscription` | V3 五档订阅激活（Pro/Pro+/Team/Enterprise）、授权码激活、状态查询、许可证生成 |
| `payment` | V3 在线支付（微信/支付宝）、订单创建、支付回调、Certify 认证订单、Enterprise 加席 |
| `admin` | V3 五档用户统计、Certify 订单统计、订单/许可证/反馈管理 |
| `github-oauth` | GitHub OAuth token 交换、用户信息、解绑 |
| `aiProxy` | AI 代理（DeepSeek V4 Pro + GLM-5V Turbo），function calling 透传 39 个 MCP 工具 |
| `byok` | BYOK（自带 API Key）AES-GCM 256 加密存储与校验，Pro/Pro+/Team 可选，Enterprise 强制 |
| `behaviorBank` | 行为银行 MVP，记录数字行为+AI行为，计算 5 级信用分，开放 API |

## 数据库集合

| 集合 | 用途 | 权限 |
|------|------|------|
| `user_profiles` | 用户档案 | 创建者可读写 |
| `evolution_records` | 进化记录 | 创建者可读写 |
| `decision_locks` | 决策锁历史 | 创建者可读写 |
| `private_skills` | 私有技能（AES-GCM 加密） | 创建者可读写 |
| `feedback` | 用户反馈 | 创建者可读写，管理员可读 |
| `orders` | 订单（订阅 + 加席） | 创建者可读，管理员可读写 |
| `certify_orders` | Certify 认证订单（L1-L4） | 创建者可读，管理员可读写 |
| `licenses` | 许可证 | 创建者可读，管理员可读写 |
| `behavior_records` | 行为银行记录（数字+AI） | 创建者可读写 |
| `token_usage` | Token 计量记录 | 创建者可读写 |

## 🌐 MetaGO 产品矩阵

MetaGO 是一套完整的产品矩阵，让 AI 从工具进化为生命体：

| 产品线 | 产品 | 描述 |
|--------|------|------|
| **核心** | [Lifeform Kit](https://gitee.com/metago/metagolifeform) | 39 技能 + 7 平台适配器（MIT 开源） |
| **核心** | [MCP Server](https://www.npmjs.com/package/@metago-ai/mcp-server) | 53 tools + 8 prompts 的 MCP 服务 |
| **平台工具** | **Studio**（本产品） | 可视化技能编排平台（SaaS） |
| **平台工具** | [CLI](https://www.npmjs.com/package/metago-cli) | 跨平台命令行工具 |
| **垂直包** | [Dev Kit](https://www.npmjs.com/package/@metago-ai/dev-kit) | 开发者增强包（4 专用技能） |
| **生态** | [Engine](https://www.npmjs.com/package/@metago-ai/engine) | 元构全息智能引擎核心本体 |
| **生态** | [Skills SDK](https://gitee.com/metago/skills-sdk) | TypeScript 技能开发 SDK |
| **生态** | [Certify](https://www.npmjs.com/package/@metago-ai/certify) | 独立认证体系（L1 基础级 / L2 进阶级 / L3 专业级 / L4 专家级） |

> 战略规划：[商业战略 V1.1](https://gitee.com/metago/metagolifeform/blob/main/docs/经营管理战略-V1.1.md) · 执行日志：[STRATEGY-EXECUTION-LOG.md](https://gitee.com/metago/metagolifeform/blob/main/docs/STRATEGY-EXECUTION-LOG.md)

## 相关链接

- **核心包**：[metago-lifeform](https://gitee.com/metago/metagolifeform)
- **GitHub 主仓库**：<https://github.com/metago-ai/metago-studio>
- **Gitee 仓库**：<https://gitee.com/metago/metago-studio>
- **官方网站**：<https://metago.life>
- **Studio 在线**：<https://metago.life/studio/>
- **官方邮箱**：<metago@metago.life>

## 许可证

MIT © MetaGO Lightyear
