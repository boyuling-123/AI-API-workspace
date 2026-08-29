# PR 03D 验收证据

## 范围

- TASK-005 第二阶段：在历史任务上选择新增模型或算法，只运行指定 Case 与新增目标。
- 复用源任务终态结果进行横向对比，但不重复调用旧目标。
- 新增评价维度继续拆分到后续小 PR，本 PR 不自动启动或修改 AI 评价。

## 代码证据

- `src/lib/rerunPlan.ts`：筛选兼容新目标、生成精确调用计划并构建带来源标记的历史结果种子。
- `src/lib/batchCheckpoint.ts` 与 `src/services/runService.ts`：历史结果只读保留，进度和执行严格限定于新增调用计划。
- `src/hooks/useTaskRunner.ts`：创建可暂停恢复的新 Task，区分执行结果与历史比较基线，并保存参数快照。
- `RerunDialog.tsx`、`HistoryPanel.tsx` 与结果组件：显式选择、调用预览、来源追溯和“历史复用”标记。
- `src/services/excel.ts`：每个目标新增结果来源列，区分本次调用与历史复用。

## 自动化证据

- `tests/unit/rerunPlan.test.ts`：覆盖候选兼容性、稳定计划顺序、终态复制与来源标记。
- `tests/unit/batchCheckpoint.test.ts`：覆盖历史结果保留且不计入新增调用进度。
- `tests/unit/runService.test.ts`：覆盖历史目标已删除时仍只调用新增目标。
- `tests/e2e/selective-rerun.spec.ts`：Mock 验证确认前零请求、Case 1/3 只调用 Qwen 两次、复用四条旧结果、来源追溯且不启动 AI 评价。
- 定向重跑弹窗通过 WCAG 2A/2AA/2.1A/2.1AA 严重与致命问题扫描。
- 本地 `npm run quality` 通过：210 文件 Secret Scan、零 lint、typecheck、52 项单测、2 项压力测试和 19 路由生产构建。
- 本地 `npm run test:e2e` 通过：13 项 Playwright 用户路径与可访问性测试。
- 提交 `d1c9231` 的独立 `/tmp` 工作树执行全新 `npm ci`（434 个包），随后 quality 与 13 项 Playwright 再次全部通过，复验后工作树零改动。

## 视觉证据

- `new-target-rerun-preview.png`：新增目标与 Case 选择、两次增量调用、四条历史复用和费用提示。

## 安全边界

- 全部浏览器路径拦截并 Mock `/api/**`，只允许 `/api/run-custom`，不读取真实 Key、不调用付费模型。
- 用户确认前不会发送请求，完成后不会自动启动 AI 评价。
- 源 Task 保持不变；新增任务独立保存来源、稀疏计划、调用进度和复用结果。
