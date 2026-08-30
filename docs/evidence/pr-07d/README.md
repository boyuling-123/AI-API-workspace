# PR 07D 验收证据

## 范围

- 任意历史评价的目标结果可追加人工评分、Bad Case 与补充意见。
- AI 原始评分永久保留，详情使用最新完整人工版本，排行榜继续采用 AI 原分。
- 每次修改形成新版本并链接上一事件；损坏事件隔离，不覆盖历史。
- 人工复核全部为本地确定性操作，不新增模型或 API 调用。

## 自动化证据

- `tests/unit/evaluationReview.test.ts`：原分不变、连续版本、策略重算、脱敏、非法输入和篡改隔离。
- `tests/e2e/evaluation-human-review.spec.ts`：完整 Mock 跑批与评价后执行两轮复核，覆盖 Bad Case、必填拦截、刷新持久化、排行榜口径、移动端和 WCAG。

## 视觉证据

- `evaluation-human-review.png`：第二版人工复核编辑器与两条不可变审计历史。

人工检查确认人工有效分与 AI 原分并列可见、修改人和 Bad Case 状态明确、只追加边界清晰，并可回看两条审计历史；390px 页面级无横向溢出。

## 本地门禁

- Secret Scan：327 个仓库文件通过。
- Lint / Typecheck：零警告、零错误。
- Unit / Stress：170 + 2 项通过。
- Build：20 个路由通过生产构建。
- Playwright / WCAG：全量 34 项通过。

独立环境和 GitHub CI 数据将在对应阶段持续回写。

所有自动化使用 Mock，不读取真实密钥，不调用真实或付费模型，不自动启动额外 AI 评价。
