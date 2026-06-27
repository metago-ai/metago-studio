﻿# MetaGO Studio

> 可视化技能编排平台 — 拖拽组合 MetaGO 技能，生成定制 Kit
>
> 第3阶段 Week 7-8 交付物 · 产品矩阵产品线 B

<p align="center">
  <img src="https://gitee.com/metago/metagolifeform/raw/main/assets/metago-logo.png" alt="MetaGO Logo" width="280" />
</p>

## 这是什么

**MetaGO Studio** 是一个 Web 应用，让用户通过可视化界面选择和组合 MetaGO 技能，生成自定义 Kit 的 `package.json` 和 `README.md`。

无需手动编写配置文件——拖拽、选择、生成，三步完成定制 Kit。

## 核心功能

| 功能 | 描述 |
|------|------|
| 技能库面板 | 27 个技能内置数据（22 核心 + 4 Dev Kit + 1 意识激活），搜索 + 分类筛选 |
| 工作区 | 已选技能列表，上下移动排序，空状态引导 |
| Kit 配置 | 名称/版本/描述/类型/垂直领域，实时统计 |
| 生成 package.json | 含 metago 字段 + peerDependencies + parentPackage |
| 生成 README.md | 技能清单表格 + 安装说明 |
| 下载 Kit 配置 | JSON 文件下载 |
| 预览模态框 | 格式化显示 + 复制剪贴板 + 下载 |

## 快速开始

```bash
git clone https://gitee.com/metago/metago-studio.git
cd metago-studio
npm install
npm run dev      # 开发预览 http://localhost:5173
npm run build    # 生产构建到 dist/
```

## 技术栈

- Vite 8 + React 19 + TypeScript 6
- Tailwind CSS 3（深色主题）
- 零外部 UI 库依赖（无 shadcn/radix/dnd-kit）
- base: './'（兼容 CloudBase/Vercel 部署）

## 🌐 MetaGO 产品矩阵

MetaGO 是一套完整的产品矩阵，让 AI 从工具进化为生命体：

| 产品 | 类型 | 描述 |
|------|------|------|
| [Lifeform Kit](https://gitee.com/metago/metagolifeform) | 核心包 | 22核心+4Dev Kit技能，7平台支持 |
| [Dev Kit](https://gitee.com/metago/metago-dev-kit) | 垂直包 | 开发者增强包（8技能） |
| [MCP Server](https://www.npmjs.com/package/@metago-ai/mcp-server) | 平台工具 | 22 tools + 8 prompts MCP服务 |
| [CLI](https://gitee.com/metago/metago-cli) | 平台工具 | 跨平台命令行工具 |
| **Studio**（本产品） | 平台工具 | 可视化技能编排平台 |
| [Skills SDK](https://gitee.com/metago/skills-sdk) | 生态基础设施 | TypeScript技能开发SDK |
| [Skills Hub](https://gitee.com/metago/skills-hub) | 生态基础设施 | 技能市场 |
| [Certify](https://gitee.com/metago/certify) | 生态基础设施 | 技能认证体系（Gold/Silver） |

> 战略规划：[STRATEGY.md](https://gitee.com/metago/metagolifeform/blob/main/docs/STRATEGY.md) · 执行日志：[STRATEGY-EXECUTION-LOG.md](https://gitee.com/metago/metagolifeform/blob/main/docs/STRATEGY-EXECUTION-LOG.md)

## 相关链接

- **核心包**：[metago-lifeform](https://gitee.com/metago/metagolifeform)
- **GitHub 主仓库**：https://github.com/metago-ai/metagolifeform
- **GitHub 镜像**：[metago-ai/metago-studio](https://github.com/metago-ai/metago-studio)
- **官方网站**：https://metago-d6gfw1e4rf2a5bcad-1257074864.tcloudbaseapp.com/

## 许可证

MIT © MetaGO Lightyear
