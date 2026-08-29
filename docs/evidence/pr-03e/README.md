# PR 03E 验收证据

## 范围

- TASK-005 最后一种范围：复用一次历史评价的模型输出，只调用 Judge 评价新增维度。
- 调用前预览并确认，新增评价独立留档且可追溯来源评价。
- 不重新运行模型或算法，不覆盖来源 Task 或来源 Evaluation。

## 代码证据

- `src/lib/newDimensionEvaluation.ts`：维度归一化去重、根评价血缘汇总与精确 Judge 调用预览。
- `src/components/evaluation/EvalHistoryPanel.tsx`：历史记录旁的新增维度入口、来源评价标记与失效保护。
- `src/components/evaluation/EvaluationPanel.tsx`：继承评价配置、只读旧维度、锁定来源样本、调用预览和显式确认。
- `src/components/WorkspaceBody.tsx`：评价上下文切换、状态清理与独立 EvaluationRecord 落库。
- `src/types/index.ts`：`evaluationKind` 与 `sourceEvaluationId` 兼容字段。

## 自动化证据

- `tests/unit/newDimensionEvaluation.test.ts`：覆盖归一化重复维度、评价血缘和标准答案缺失跳过。
- `tests/e2e/new-dimension-evaluation.spec.ts`：Mock 完整用户路径；确认前请求数不变，确认后只新增一次 `/api/evaluate`，`/api/run-custom` 增量为零。
- 确认弹窗通过 WCAG 2A/2AA/2.1A/2.1AA 严重与致命问题扫描。
- 本地 `npm run quality` 通过：213 文件 Secret Scan、零 lint、typecheck、55 项单测、2 项压力测试和 19 路由生产构建。
- 本地 `npm run test:e2e` 通过：14 项 Playwright 用户路径与可访问性测试。
- 提交 `18bc0df` 的独立 `/tmp` 工作树执行全新 `npm ci`（434 个包），随后 quality 与 14 项 Playwright 再次全部通过，复验结束时零改动。
- [PR #17](https://github.com/boyuling-123/AI-API-workspace/pull/17) 已创建；最新提交的 GitHub CI 证据通过后回写。

## 视觉证据

- `new-dimension-confirmation.png`：1 次裁判调用、0 次被测模型或算法调用、1 条历史输出复用、1 个新增维度和费用提示。

## 安全边界

- 浏览器测试拦截并 Mock 全部 `/api/**`，不读取真实 Key，不调用付费模型。
- 用户点击历史入口只加载配置；打开预览仍不发请求，只有最终确认才调用 Judge。
- 新记录只包含新增维度结果和来源评价 ID，旧任务、旧输出与旧评价保持不变。
