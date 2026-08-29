# PR 05A 验收证据：评价权重与一票否决策略

## 视觉证据

- `evaluator-policy.png`：用户为结构化 Rubric 设置权重和一票否决阈值、确认策略，并在显式启动 Mock 评价后查看平台计算的加权分与否决结果。

## 自动化路径

- `tests/e2e/evaluator-policy.spec.ts` 覆盖权重合计不为 100% 时阻断、平均分配、否决阈值、确认后修改自动失效、Prompt 与 Judge 精确请求、结果展示、自动保存稳定态和 WCAG 门禁。
- `tests/unit/evaluatorPolicy.test.ts` 直接覆盖真实策略模块的精确分配、字段边界、策略指纹、加权计算和否决原因。
- `tests/unit/rubricRouteBoundary.test.ts` 验证非法权重或阈值在 Prompt/Judge 模型调用前返回 400，模型调用次数为零。
- 功能提交 `270ae10` 已在独立干净工作树完成全新安装、完整 `quality` 和 19 项 Playwright，结束时 Git 零改动。
- [PR #22](https://github.com/boyuling-123/AI-API-workspace/pull/22) workflow run `33246361526` 的核心质量与 Playwright/可访问性两个 Job 全部通过。

## 安全边界

- 浏览器测试拦截全部 `/api/**`，只使用 Mock 响应。
- 未读取真实密钥、未调用真实或付费模型、未自动启动 AI 评价。
- OpenJudge、Iterative Rubrics Generator、Evaluator 版本化和 Judge 校准不属于本 PR。
