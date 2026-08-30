# PR 06E 验收证据：Evaluator 变化后重跑黄金集

## 视觉证据

- `evaluator-rerun-comparison.png`：展示 Evaluator v2 重跑结果、Prompt 变更来源、基线与本次指标差异，以及两次不可覆盖的校准历史。

## 自动化路径

- `judgeCalibrationRerun.test.ts` 覆盖首次任务、Judge/维度/Prompt 变更、相同执行定义复用和黄金集隔离。
- `judgeCalibrationClient.test.ts` 验证任务 id、Evaluator 快照、触发类型和请求白名单。
- `judge-calibration-rerun.spec.ts` 使用 Mock 完成 Evaluator v1→v2、确认前零新增调用、确认后精确重跑、前后指标对比和刷新持久化。
- 本地 quality 通过 286 文件密钥扫描、零 lint、typecheck、131 项真实源码单测、2 项压力测试和 20 路由生产构建；全量 26 项 Playwright 通过。
- 功能提交 `515aeb8` 在独立 detached 工作树全新安装 434 个包后，再次通过 quality 与 26 项 Playwright，结束时 Git 零改动。
- [PR #30](https://github.com/boyuling-123/AI-API-workspace/pull/30) workflow run `33296085052` 的核心质量与 Playwright/WCAG 两个 Job 全部通过。

## 安全与费用边界

- 版本切换只创建本地重跑计划，不自动调用 Judge。
- 相同执行定义优先提示复用已有结果，只有用户再次确认才重复付费运行。
- 人工标签和复核备注不进入 Judge 请求；旧校准结果只读保留。
