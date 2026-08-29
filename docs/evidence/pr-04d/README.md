# PR 04D 验收证据

## 视觉证据

- `structured-simple-rubric.png` 展示无人工反馈时的 Simple Rubrics 模式、完整 Rubric 数量、定义及展开后的 `0/5/10` 评分锚点、证据要求和可执行判断规则。
- 截图由 Playwright 在 `1280 × 1200` 视口生成，使用本地 Mock 数据，不调用真实或付费模型。

## 自动化证据

- `tests/e2e/structured-rubrics.spec.ts` 先删除 5 分锚点，验证生成 Judge Prompt 与开始 AI 评价均被禁用，两个模型接口调用数保持为零；恢复后只允许一次 Prompt 请求，不自动启动评价。
- E2E 精确断言 Prompt 请求携带名称、定义、三个锚点、证据要求和判断规则，并执行 Axe WCAG 2.0/2.1 A/AA 严重与致命问题扫描。
- 路由单测验证不完整 Rubric 在 `/api/gen-eval-prompt` 和 `/api/evaluate` 边界返回 400，底层模型服务调用数为零。
- 服务单测验证完整 Rubric 进入 Prompt 生成模型和最终 Judge Prompt；AI 维度生成拒绝旧式 `name/desc`，畸形响应错误片段先脱敏。
- 旧历史兼容单测证明只有 `name/desc` 的记录仍可读取，新的结构化记录在评价血缘中不会丢失字段。

## 本地验收

- `npm run quality`：238 文件密钥扫描、84 项单测、2 项压力测试、19 个生产路由构建通过，lint 与 typecheck 零错误。
- `npm run test:e2e`：18 项 Playwright 全量通过。
- 截图已人工检查，固定页头位于页面顶部，关键内容无遮挡、截断或重叠。
- 提交 `a697f43` 在独立 `/tmp` 工作树全新 `npm ci` 安装 434 个包后重复执行以上门禁，结果一致且复验结束时工作树零改动。
- [PR #21](https://github.com/boyuling-123/AI-API-workspace/pull/21) workflow run `33243678962` 的核心质量与 Playwright 两个 Job 全部通过。
- OpenJudge、Iterative Rubrics Generator、权重、一票否决和 Evaluator 版本化不属于本 PR，状态未被抬高。
