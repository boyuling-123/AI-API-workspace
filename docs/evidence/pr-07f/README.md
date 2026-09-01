# PR 07F 验收证据

## 范围

- 从历史评价下载单文件 HTML，不新增 API，不调用模型或自动启动评价。
- 报告冻结原始 Task、评价结果、Rubric、Prompt、Judge 证据、有效人工复核和 Evaluator 版本。
- 报告内嵌脱敏 JSON 与可复算指纹，离线打开自动校验；CSP 禁止外部资源。
- data 图片可离线展示，远程图片明确标记“未嵌入”，不虚报 IMG-003 已完成。

## 自动化证据

- `tests/unit/evaluationHtmlReport.test.ts`：完整快照、指纹、凭证脱敏、HTML 注入、损坏隔离、边界阻断与变更检测。
- `tests/e2e/evaluation-html-report.spec.ts`：完整 Mock 跑批与评价、Evaluator v1、真实下载、离线打开、零外部请求、零新增调用、WCAG 与 390px。
- `evaluation-html-report.png`：从真实下载产物离线打开后截取的 1440px 全页证据，已人工检查概览、排行榜、Rubric、版本、Case 证据、脱敏值和机器快照层级。

## 当前门禁

- Secret Scan：337 个仓库文件通过。
- Lint / Typecheck：零警告、零错误。
- Unit / Stress：38 个测试文件共 189 项单测，加 2 项压力测试通过。
- Build：20 个路由通过生产构建。
- Playwright / WCAG：全量 36 项通过；其中 1 项覆盖完整 HTML 报告用户路径。
- 响应式与离线边界：390px 无页面横向溢出，报告打开后零 HTTP 请求。

## 独立环境复验

- 功能快照：`019256325f05aadc873b767dc302443336aba508`。
- 在独立 detached 工作树全新 `npm ci` 安装 434 个包，再次通过完整 quality 与全量 36 项 Playwright/WCAG。
- 复验结束时 HEAD 仍精确指向功能快照，Git 工作树零改动；未依赖原工作区缓存或未提交文件。
- `npm audit` 报告仓库既有 6 个高危传递依赖，未使用 `--force` 破坏性升级；留给依赖安全专项 PR 评估与升级。

## GitHub CI

- 已自主创建 [PR #42](https://github.com/boyuling-123/AI-API-workspace/pull/42)，非 Draft 且无基线冲突。
- 首轮 Quality Gate workflow run `33472850294` 完成；“Lint, test, build, and secret scan”与“Playwright user paths and accessibility”两个 Job 均为 `success`。
- 本次 CI 证据回写提交自身仍须通过第二轮相同门禁，之后才执行 Review、线程、远端漂移和可合并状态审计。

所有自动化使用 Mock，不读取真实密钥，不调用真实或付费模型，不自动启动额外 AI 评价。
