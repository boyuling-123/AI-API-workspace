# PR 03B 验收证据

## 范围

- TASK-002：批量调用同时支持并发与全局 QPS 配置。
- TASK-006：任务级超时和有限自动重试。
- TASK-007：统一失败分类、历史筛选、展示与 Excel 导出；失败项定向重跑继续由 TASK-005 承接。

## 代码证据

- `src/lib/rateLimiter.ts`：所有并发 Worker 和重试尝试共享同一平滑 QPS 队列，等待可被取消。
- `src/services/runService.ts`：每次真实请求均经过限速、独立超时、有限重试和结构化结果记录。
- `src/lib/runError.ts`：统一超时、限流、鉴权、网络、解析、服务端、请求和未知错误。
- `src/app/api/run-custom/route.ts` 与 adapters：服务端保留错误类型、重试属性和上游 HTTP 状态，错误文本统一脱敏。
- `RunPanel.tsx`：配置 QPS、单次超时和失败重试次数；续跑沿用任务原策略。
- `HistoryPanel.tsx`、结果组件与 `excel.ts`：展示、筛选并导出策略、错误类型、尝试次数和 HTTP 状态。

## 自动化证据

- `tests/unit/rateLimiter.test.ts`：验证严格 QPS 间隔、不限速模式和取消等待。
- `tests/unit/runService.test.ts`：验证全局 QPS、429 后成功、401/解析错误不重试、503 有限重试和真实 Abort 超时。
- `tests/unit/runCustomRoute.test.ts` 与 `customAdapterErrors.test.ts`：验证服务端错误契约和 adapter 分类。
- `tests/e2e/run-controls.spec.ts`：Mock 验证策略持久化、429 只重试一次、401 配置 3 次仍只调用一次，以及错误筛选。
- 本地 `npm run quality` 通过：202 文件 Secret Scan、零 lint、typecheck、38 项单测、2 项压力测试和生产构建。
- 本地 `npm run test:e2e` 通过：10 项 Playwright 用户路径与可访问性测试。
- 提交 `3c6c1ec` 的独立 `/tmp` 工作树完成全新 `npm ci`，随后 `quality` 与 10 项 Playwright 再次全部通过，复验后工作树零改动。
- PR #14 GitHub Actions run `33228823145` 通过；核心质量与 Playwright/可访问性两个 Job 均为 success。

## 视觉证据

- `run-policy-controls.png`：首页顶部高级运行策略展开状态。
- `error-classification-history.png`：历史任务策略与鉴权失败分类展示。

## 安全边界

- 单元测试和 E2E 均使用本地 Mock，不读取真实 Key，不调用付费模型，不自动启动 AI 评价。
- 视觉失败样例由本地缺失环境变量直接返回 401；服务日志只出现本地 `/api/run-custom 401`，没有上游请求。
- 重试仅适用于超时、限流、网络和服务端错误，鉴权、请求配置和解析错误不会自动重试。
