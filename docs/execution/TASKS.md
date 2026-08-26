# 测评平台开发任务台账

## 已完成：PR 01 基线迁移与状态校准

分支：`codex/chore-baseline-sync`

- [x] 从 GitHub 重新克隆远端仓库，保留历史。
- [x] 保留原开发目录，不在原目录初始化 Git。
- [x] 镜像迁移当前源码，排除密钥、依赖、缓存、构建产物和本地 Agent 状态。
- [x] 强化 `.gitignore`。
- [x] 将四个不存在的 API 降级为“设计中”或“Demo”。
- [x] 建立 75 条能力矩阵及六种严格状态。
- [x] 校准 README 和 v5.0 文档入口。
- [x] 执行敏感信息扫描和迁移 Diff 复核。
- [x] 安装干净依赖并完成 typecheck、build 和基础 UI 验收。
- [x] 提交并推送 `codex/chore-baseline-sync` 分支。
- [x] 创建并合并 [PR #9](https://github.com/boyuling-123/AI-API-workspace/pull/9)。

## 已完成：PR 02A 真实源码测试与基础 CI

分支：`codex/test-real-source-ci`

- [x] 让任务池测试直接导入真实源文件，删除两份复制实现测试。
- [x] 覆盖并发上限、非法并发、失败隔离、进度、取消、空列表和 2,000 任务压力路径。
- [x] 修复 `NaN` 并发导致任务池不启动的问题。
- [x] 建立 lint、typecheck、unit、stress、build 和 quality 脚本。
- [x] 建立不输出敏感值的 Secret Scan 及正反例回归测试。
- [x] 增加 GitHub Actions 基础质量门禁。
- [x] 为 75 项能力矩阵增加 Issue/PR 列并关联 PR 01/02A。
- [x] 完成生产构建、干净环境复验和验收证据。
- [x] 提交、推送并创建 [PR #10](https://github.com/boyuling-123/AI-API-workspace/pull/10)。
- [x] GitHub Actions 质量门禁通过，并将 TASK-001 升级为“已验证”。
- [x] 非强推 fast-forward 合并 PR #10，GitHub 已确认 Merged。

## 已完成：PR 02B 浏览器用户路径门禁

分支：`codex/test-playwright-a11y`

- [x] 接入 Playwright Chromium、HTML 报告和失败 Trace/截图。
- [x] 覆盖首页布局、目标选择提示、外部接口状态、导入深链和 AI 评价安全入口。
- [x] 所有 E2E 页面统一拦截 `/api/**`，发现任何请求即失败，禁止误调用付费模型。
- [x] 增加 WCAG 2A/2AA/2.1A/2.1AA 严重与致命问题门禁。
- [x] 修复目标卡片嵌套交互控件、Tab 语义和已覆盖页面的颜色对比问题。
- [x] 本地 6 项 Playwright 用户路径与可访问性测试通过。
- [x] 独立干净工作树执行全新 `npm ci`、完整 quality 和 6 项 Playwright 测试。
- [x] 推送分支并创建 [PR #11](https://github.com/boyuling-123/AI-API-workspace/pull/11)。
- [x] 核心质量与 Playwright 两道 GitHub CI 通过，DOC-006 升级为“已验证”。
- [x] 非强推 fast-forward 合并 PR #11，GitHub 已确认 Merged。

## 已完成：PR 02C 质量债务与日志脱敏

分支：`codex/chore-quality-debt`

- [x] 清理 9 条 React Hook 与动态 `<img>` lint 警告，lint 达到零警告。
- [x] 使用非破坏性 `npm audit fix` 更新 4 个传递依赖，高危项由 8 个降为 6 个。
- [x] 不使用 `--force`；将 Next/ESLint 大版本迁移和无修复版的 `xlsx` 风险登记为后续专题。
- [x] 增加统一服务端脱敏器并接入脚本输出、安装输出、Agent Prompt 与反馈边界。
- [x] 增加脱敏单测和真实 Node 子进程成功、失败泄漏测试。
- [x] 本地完整 quality 与 6 项 Playwright 回归通过。
- [x] 独立干净工作树执行全新 `npm ci`、完整 quality 和 Playwright。
- [x] 提交、推送并创建 [PR #12](https://github.com/boyuling-123/AI-API-workspace/pull/12)。
- [x] GitHub 核心质量与 Playwright 两道 CI 通过并回写证据。
- [x] 最终文档提交 CI 通过后，以非强推 fast-forward 合并 PR #12。

## 进行中：PR 03A 批量检查点与中断续跑

分支：`codex/feat-batch-checkpoints`

- [x] 为 Case × Target 建立稳定结果矩阵和检查点进度模型。
- [x] 批量任务启动、每 10 个完成项、暂停和结束时更新同一 Task 并立即落库。
- [x] 刷新或关闭页面后识别 `running` / `paused` 任务，并从未完成项继续。
- [x] 已成功或明确失败的单元不会被自动重复调用；中断与待执行单元恢复为待运行。
- [x] 区分暂停、继续、终止和放弃已保存任务，存在待续任务时阻止误开新批次。
- [x] 历史任务展示检查点进度，运行中或暂停中的任务禁止启动 AI 评价。
- [x] 新增真实源码单测和 Mock Playwright 暂停、刷新、续跑、终止路径。
- [x] 本地 lint、typecheck、21 项单测、8 项 Playwright 和生产构建通过。
- [x] 保存刷新后恢复界面截图，不读取真实 Key、不调用付费模型。
- [x] 完整 quality、独立干净工作树复验与敏感信息扫描。
- [ ] 提交、推送并创建 PR 03A。
- [ ] GitHub CI 通过后回写证据并非强推合并。

## 硬门禁

- 未通过适用测试不得 Push 或合并。
- 不得提交真实 Key、`.env.local`、日志、缓存或构建产物。
- 不得自动调用付费模型或启动 AI 评价。
- 每个 PR 必须更新能力矩阵和本台账。
- 远端 `main` 变化或门禁失败时禁止强推和自动合并。
