# AI API Workspace

> AI 接口跑批评测平台 — 统一模型池管理、批量调用对比、AI 自动评分，全本地运行，数据不上传。

## ✨ 功能特性

- **统一模型池**：所有模型配置集中管理，按能力标签（文本/多模态/图片）自动匹配到对应场景
- **首次引导配置**：首次打开自动引导配置基础大模型，验证通过即可使用
- **跑批评测**：批量调用多个 AI 接口，横向对比输出结果
- **AI 自动评分**：配置评测维度和评价 Prompt，由 AI 裁判自动打分
- **智能接入**：通过 AI Agent 自动解析 API 文档，一键接入新接口
- **AI 造数据**：利用大模型自动生成测试用例（文本 / 图片）
- **全本地存储**：所有配置和数据存在浏览器 IndexedDB 中，API Key 不上传、不写入代码

## 🛠 技术栈

- **框架**：Next.js 14 (App Router)
- **语言**：TypeScript
- **样式**：Tailwind CSS
- **本地存储**：Dexie.js (IndexedDB)
- **数据导出**：SheetJS (xlsx)

## 🚀 快速开始

### 环境要求

- Node.js >= 18
- npm / yarn / pnpm

### 安装与运行

```bash
# 克隆仓库
git clone https://github.com/你的用户名/ai-api-workspace.git
cd ai-api-workspace

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 指定端口启动（例如 4000）
PORT=4000 npm run dev
```

打开浏览器访问 `http://localhost:3000`。

### 首次使用

1. 首次打开会进入**引导配置页**
2. 填入你的大模型 API 信息：
   - **Base URL**：如 `https://api.deepseek.com/v1`（OpenAI 兼容）或 `https://xxx.com/anthropic`（Anthropic 兼容）
   - **API Key**：你的密钥（仅存在本地浏览器中）
   - **Model Name**：如 `deepseek-chat`
   - **协议类型**：建议选 `自动探测（auto）`
3. 点击验证，通过后自动进入主界面
4. 后续可在「接口管理」中添加更多模型或算法接口

### 基础模型协议兼容

- **自动探测（推荐）**：会按 Base URL 特征优先尝试 OpenAI / Anthropic 兼容协议，可自动兜底另一条协议
- **OpenAI Compatible**：适用于 `/v1`、`/chat/completions` 一类入口
- **Anthropic Compatible**：适用于 `/anthropic`、`/v1/messages` 一类入口
- **Agent 自动接入**：同样支持 `auto`，但会在会话启动时锁定探测成功的协议，避免中途切换

## 📁 项目结构

```
src/
├── app/                  # Next.js App Router 路由与 API
│   └── api/              # 后端 API 路由（chat、evaluate、run 等）
├── components/           # UI 组件
│   ├── api/              # 接口管理相关组件
│   ├── evaluation/       # 评测评分组件
│   ├── input/            # 输入区域组件
│   ├── run/              # 跑批面板
│   └── SetupGuard.tsx    # 首次引导配置页
├── hooks/                # 自定义 React Hooks
├── services/             # 业务服务层（API 调用、评测等）
├── lib/                  # 工具函数
├── types/                # TypeScript 类型定义
└── config/               # 运行时配置与预设
```

## 📋 主要模块

| 模块 | 说明 |
|------|------|
| 引导配置 | 首次使用引导配置基础大模型 |
| 接口管理 | 管理所有模型和算法接口 |
| 跑批 | 批量输入 → 并行调用多个接口 → 查看对比结果 |
| AI 评价 | 配置评测维度 → AI 自动评分 → 查看评测报告 |
| 历史记录 | 查看跑批和评测的历史数据 |

## 🔒 数据安全

- 所有 API Key 仅存储在你本地浏览器的 IndexedDB 中
- 代码中不包含任何硬编码的密钥
- 不向任何第三方服务上传你的配置和数据
- 清除浏览器数据即可彻底删除所有配置

## 📄 License

[MIT](./LICENSE)
