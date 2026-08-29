# PR 03C 验收证据

## 范围

- TASK-005 第一阶段：只重跑失败的 Case × 目标组合。
- TASK-005 第一阶段：按 `1,3,8-12` 选择 Case，并重跑这些 Case 的原任务可用目标。
- 新模型与新评价维度继续拆分到后续小 PR，本 PR 不扩大范围。

## 代码证据

- `src/lib/rerunPlan.ts`：解析 Case 序号、生成失败项与指定 Case 的精确调用计划，并排除不可用目标。
- `src/lib/batchCheckpoint.ts` 与 `src/services/runService.ts`：执行并恢复稀疏 Case × 目标计划，不重新展开完整矩阵。
- `src/hooks/useTaskRunner.ts`：定向重跑创建新 Task，保存来源、范围和调用组合；暂停后沿用同一计划。
- `RerunDialog.tsx` 与 `HistoryPanel.tsx`：调用前预览、显式费用确认、不可用目标提示和来源任务追溯。

## 自动化证据

- `tests/unit/rerunPlan.test.ts`：覆盖序号解析、错误输入、失败组合和不可用目标。
- `tests/unit/batchCheckpoint.test.ts`：覆盖稀疏矩阵、终态保留和剩余调用计算。
- `tests/unit/runService.test.ts`：覆盖精确调用、稀疏检查点恢复和非法计划零请求。
- `tests/e2e/selective-rerun.spec.ts`：Mock 验证失败项只多发一次、指定 `2-3` 只发四次、非法范围零请求、新任务来源追溯且不启动 AI 评价。
- 定向重跑弹窗通过 WCAG 2A/2AA/2.1A/2.1AA 严重与致命问题扫描。
- 本地 `npm run quality` 通过：208 文件 Secret Scan、零 lint、typecheck、47 项单测、2 项压力测试和 19 路由生产构建。
- 本地 `npm run test:e2e` 通过：12 项 Playwright 用户路径与可访问性测试。

## 视觉证据

- `selective-rerun-preview.png`：指定 Case、精确调用数、样本预览、费用提示和确认入口。

## 安全边界

- 全部浏览器路径拦截并 Mock `/api/**`，只允许 `/api/run-custom`，不读取真实 Key、不调用付费模型。
- 用户确认前不会发起重跑，定向重跑完成后不会自动启动 AI 评价。
- 原 Task 与原结果保持不变；每次重跑都是带来源 ID 的新 Task，可独立删除和追溯。
