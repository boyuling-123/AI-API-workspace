# AI API Workspace

本地优先的 AI 模型与算法跑批评测工作台，用于统一接入测试目标、批量执行测试集、对比模型输出，并通过 AI Judge 做横向评价或标准答案评价。

## 当前能力

- 文本与生图两类工作区，支持单条输入、Excel 批量导入和可编辑数据表。
- AI 生成测试数据，支持大批量分批生成、暂停、保留、续跑、清空和 Excel 下载。
- 统一管理文本模型、多模态模型、生图算法、ComfyUI 和自定义脚本目标。
- 支持试运行、正式跑批、并发控制、取消、结果对比和跑批历史。
- 支持横向对比评价与逐条标准答案评价，可编辑评价维度和 Judge Prompt。
- 评价记录独立留存，可回看逐模型、逐 Case、逐维度评分并导出 Excel。
- 提供评测工作区导入接口 `/api/import-evaluation-workspace`，供外部 Skill 生成 Deep Link。
- 项目、任务和评价记录保存在浏览器 IndexedDB；API Key 真值只从服务端环境变量读取。

旧 75 项状态见 [v5.0 能力矩阵](docs/product/capability-matrix.md)；新需求与旧实现的差距见 [2026-09 阶段审计](docs/product/stage-gap-audit-2026-09-07.md)。两者不可合并计算完成率。页面中标为“设计中”或“Demo”的规划路由不可直接调用。

## 快速开始

推荐 Node.js 22，与 GitHub CI 一致。当前锁定的 MCP / LangChain / Vitest 等依赖不再支持原 README 的 Node.js 18 基线；本机 Node.js 24.14.1 的验收另见证据，不代表所有版本都经过认证。

先启动不需要模型密钥的演示：

```bash
npm ci
npm run dev -- --hostname 127.0.0.1 --port 3002
```

访问 [中文演示导览](http://127.0.0.1:3002/interview-demo)。页面不会自动生成数据、运行 Agent 或启动评价；观测实验使用固定 Mock 节点。首次安装依赖及构建可能需要网络，不能将此称为完全离线安装。

真实模型为可选接入：仅在自行配置服务端环境变量并确认数据外发、调用次数和费用后运行。可参考 `.env.local.example`，不要将真实密钥提交到 Git。常规开发与 CI 使用 Mock。

## 本机演示入口

- [2026-09-07早间交付](docs/product/morning-handoff-2026-09-07.md)：实际合成实验结果、可回读文件、演示口径与下一步缺口。
- [五章演示导览](http://127.0.0.1:3002/interview-demo)：讲解产品判断、数据口径和工程证据。
- [Agent 观测实验室](http://127.0.0.1:3002/observability)：手工 OTel 埋点及真实 LangGraph 调度固定 Mock 节点，支持受限观测 JSON 确认回读，不是任意框架导入。
- [本地历史演示](http://127.0.0.1:3002/history-demo)：需要按 [只读归档说明](docs/product/local-history-demo.md) 配置本机目录；新克隆不会携带任何真实数据。
- 完整讲解、MCP 接入、存储边界见 [面试说明](docs/product/interview-demo.md)、[开源复用清单](docs/product/open-source-reuse.md) 和 [项目存储契约](docs/product/project-storage-boundary.md)。

项目保存在浏览器当前 origin 的 IndexedDB 中。更换端口或从 `localhost` 换到 `127.0.0.1` 不会自动迁移原浏览器数据，原记录并未因此删除。

## 核心流程

1. 在“接口创建&管理”中确认或接入测试目标。
2. 在“跑批”中导入或生成测试数据，并选择被测模型或算法。
3. 先试运行一条，确认参数和输出后再正式跑批。
4. 在“跑批历史”查看结果，选择批次进入 AI 评价。
5. 选择横向对比或标准答案模式，确认维度、Prompt 和 Judge 后再启动评价。
6. 在“AI历史评价”回看详情或导出结果。

## 目录

```text
src/app/          Next.js 页面与 API Routes
src/components/   跑批、接入、结果和评价 UI
src/hooks/        前端业务状态
src/services/     调用、评价、导入导出和持久化服务
src/adapters/     模型、算法、脚本和 ComfyUI 适配器
src/config/       预置目标与运行参数
src/types/        核心数据结构
scripts/          压力测试与迁移辅助脚本
docs/             当前 PRD、能力矩阵和开发纪实
测试数据/         本地 Mock 与边界测试样例
```

## 开发状态

当前仓库正在按短生命周期分支和 Pull Request 进行 v5.0 工程化升级。每个 PR 必须覆盖功能验收、异常路径、真实源文件测试、文档状态、安全检查、回滚说明以及截图或 Trace 证据。

- 当前任务台账：[`docs/execution/TASKS.md`](docs/execution/TASKS.md)
- 开发纪实：[`docs/execution/WORKLOG.md`](docs/execution/WORKLOG.md)
- v5.0 原始功能清单：[`docs/prd/v5.0/测评平台v5.0-待补充功能清单.md`](docs/prd/v5.0/测评平台v5.0-待补充功能清单.md)
- 最新需求基线及冲突裁定：[`docs/prd/2026-09/README.md`](docs/prd/2026-09/README.md)
- 新 PRD 逐项差距与下一阶段小 PR：[`docs/product/stage-gap-audit-2026-09-07.md`](docs/product/stage-gap-audit-2026-09-07.md)

## 安全约束

- 不提交 `.env.local`、真实 API Key、运行日志、构建目录或模型产物。
- 前端配置只保存环境变量引用名，不保存 Key 真值。
- 未经明确确认，不自动启动会产生费用的模型跑批或 AI 评价。
- 脚本与 Agent 输出统一经过服务端脱敏；IndexedDB、导出和 Trace 的泄漏测试仍按能力矩阵 `SEC-002` 继续补齐。

## License

[MIT](LICENSE)
