# PR 07C 验收证据

## 范围

- 历史评价按低分、模型分歧、高风险和失败 Case 筛选。
- 多条件支持任一命中与全部命中，清除后恢复完整记录。
- “导出当前筛选”只导出当前可见的完整 Case，并附带可解释筛选依据。
- 所有筛选、清除与导出均为本地确定性操作，不新增模型或 API 调用。

## 自动化证据

- `tests/unit/evaluationCaseFilter.test.ts`：四类信号、组合语义、阈值、旧记录、缺失值与精确导出。
- `tests/e2e/evaluation-case-filters.spec.ts`：5 条 Mock Case、xlsx 下载回读、空态、清除、刷新、移动端与 WCAG。

## 视觉证据

- `evaluation-case-filters.png`：低分与模型分歧采用“匹配任一条件”后的 Case 风险筛选工作区。

人工检查确认筛选状态、计数、阈值、组合方式、导出入口和命中 Case 的完整模型对照均清晰可读；页面级移动端无横向溢出。

## 本地门禁

- Secret Scan：321 个仓库文件通过。
- Lint / Typecheck：零警告、零错误。
- Unit / Stress：162 + 2 项通过。
- Build：20 个路由通过生产构建。
- Playwright / WCAG：全量 33 项通过。

同一功能快照 `175885c` 已在独立 detached 工作树中通过全新 `npm ci`、完整 quality 和全量 33 项 Playwright；结束时 HEAD 未漂移且 Git 状态干净。

GitHub workflow run `33302603833` 的核心质量与 Playwright/WCAG 两个 Job 全部通过，证据关联 [PR #38](https://github.com/boyuling-123/AI-API-workspace/pull/38)。

所有自动化使用 Mock，不读取真实密钥，不调用真实或付费模型，不自动启动 AI 评价。
