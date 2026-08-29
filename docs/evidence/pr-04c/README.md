# PR 04C 验收证据

- `human-score-ranking.png`：展示同一批次中一条 Case 的完整人工评分和另一条 Case 的完整偏好排序。
- 人工评分必须覆盖每个当前目标，范围为 `0–10` 且最多 1 位小数；偏好排序至少包含两个目标，并完整、唯一覆盖 `1..N`。
- Playwright 全程使用 Mock，先验证缺失评分与重复名次会阻断维度请求，再验证修正后恰好一次维度请求且零 AI 评价调用。
- 请求精确断言覆盖 2 Case × 2 Target 的目标 ID、分数、名次和备注；页面同时通过 WCAG 2A/2AA/2.1A/2.1AA 严重与致命问题扫描。
- 客户端和服务端使用同一有界语义，备注最多 1000 字并脱敏；请求不包含原图、base64 或完整失败文本。
- 页面明确 OpenJudge 与 Iterative Rubrics Generator 尚未接入，当前人工信号只供通用模型生成候选维度，不自动启动正式评价。

本地验收：

- `npm run quality`：72 项单测、2 项压力测试、19 个生产路由构建通过，lint 零警告。
- `npm run test:e2e`：17 项 Playwright 全量通过。
- 提交 `c5266d6` 在独立 `/tmp` 工作树全新 `npm ci` 安装 434 个包后重复执行以上门禁，结果一致且复验后工作树零改动。
- [PR #20](https://github.com/boyuling-123/AI-API-workspace/pull/20) workflow run `33240897489` 的核心质量与 Playwright 两个 Job 全部通过。
