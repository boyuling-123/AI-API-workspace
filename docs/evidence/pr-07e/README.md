# PR 07E 验收证据

## 范围

- 每个 Judge 目标 × 维度必须保存可定位的文字引用或图片观察。
- 服务端校验证据来源、目标、精确原文与图片序号，并自行计算文字位置。
- 即时结果、历史详情与 Excel 共享同一份证据；旧记录不补造引用。
- 证据扩展原有 Judge 响应，不增加模型调用，也不修改原始图片和评分。

## 自动化证据

- `tests/unit/evaluationEvidence.test.ts`：精确位置、标准答案、输入/输出图片、客户端附件组包、非法引用、Excel 与旧记录降级。
- `tests/unit/rubricPromptServices.test.ts`：完整 Rubric 与结构化证据规则共同进入最终 Judge Prompt。
- `tests/e2e/evaluation-evidence.spec.ts`：完整 Mock 跑批和评价后验证即时展开、历史持久化、xlsx 回读、390px、WCAG 与零新增调用。

## 视觉证据

- `evaluation-evidence.png`：历史评价中展开的两条 Judge 引用，显示输入 prompt、目标输出、精确位置与原文。

人工检查确认输出、评分、证据来源、位置和策略结果可在同一明细中回查；表格使用受控横向滚动而非压缩成竖排，390px 无页面级溢出。

## 本地门禁

- Secret Scan：332 个仓库文件通过。
- Lint / Typecheck：零警告、零错误。
- Unit / Stress：182 + 2 项通过。
- Build：20 个路由通过生产构建。
- Playwright / WCAG：全量 35 项通过。

同一功能快照 `59ae36c` 已在独立 detached 工作树中按锁文件全新安装 434 个包，并重复通过完整 quality 与 `CI=1` 全量 35 项 Playwright；结束时 HEAD 未漂移且 Git 状态干净。

锁文件安装仍报告既有的 6 个 high 级依赖审计项；本 PR 未执行可能引入破坏性升级的 `npm audit fix --force`，继续留给依赖治理专题。

所有自动化使用 Mock，不读取真实密钥，不调用真实或付费模型，不自动启动额外 AI 评价。

## GitHub CI

- [PR #41](https://github.com/boyuling-123/AI-API-workspace/pull/41) 首轮 Head：`2ba6a541ade12091b6bb3bdcc967351296c7f7ec`。
- workflow run `33457148220` 的 `Lint, test, build, and secret scan` 成功。
- 同一 workflow run 的 `Playwright user paths and accessibility` 成功，全量 35 项用户路径与 WCAG 检查通过。
- REPORT-004 据此升级为“已验证”；最终合并仍以本次证据回写提交自身 CI 和合并前审计为准。
