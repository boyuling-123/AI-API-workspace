# F-OBS-002：Langfuse 源码复用的中文步骤检查器

状态：已实现，验收中。分支 `codex/feat-langfuse-trace-module`，基线 PR49 merge `4f6279e`。Issue/PR：[PR #50](https://github.com/boyuling-123/AI-API-workspace/pull/50)，功能提交 `7f10fee`；最终 head CI 待验。

## 需求与范围

复用固定 Langfuse 提交 `7637df1e1aadddbbfd0a45b960ecc97451381ce5` 中两段纯逻辑，而不是照截图重绘并声称 Fork。保留原许可、源码路径、原文摘要与本地差异；接入已有中文 OpenTelemetry 本地 Mock 实验页面，按调用层级查看步骤、相对时间和异常。

上游 `TraceTimelineCompact.tsx` 依赖 TraceData、Selection、Playhead、ViewPreferences、预取及选择 Hook，不能作为独立组件直接装入本项目。当前选择 `timelineCalculations.ts` 与 `flattenTreeOrder.ts`，只替换类型导入，函数体保持原样。本地适配器和 Ant Design 外围界面是本项目代码，不把这些 UI 声称为原 Langfuse 页面。

## 验收条件

| 条件 | 必须验证 |
|---|---|
| AC1 可追溯真实复用 | 原始文件 SHA-256、固定 commit、完整 LICENSE、明确导入替换；测试直接导入实际 vendor 文件，并验证规范化后与原摘要一致 |
| AC2 时间范围与层级 | 上游计算覆盖比根更早的子步骤及更晚结束的子步骤；树顺序按父子与开始时间展开；原数据不变、不累加并行耗时 |
| AC3 有界适配 | 只支持单条调用链、最多 1000 步/128 层；拒绝重复 ID、未知父级、循环和非法时间，给固定中文错误；不猜测修复数据 |
| AC4 中文检查路径 | 现有步骤树保留；新时间视图可选择步骤/查看类型、状态、相对时间和父级，键盘可操作，中文标题层级清楚 |
| AC5 真实前端回归 | Playwright 覆盖重试异常与恢复、并行任务、详情切换、重新运行、375px、WCAG 与截图/Trace；禁止外部网络和模型调用 |
| AC6 诚实边界 | 本次仍为 Mock 实验，不是 Langfuse 整站或真实框架兼容性；不新增存储、不改已有统计口径、不上传真实数据 |

时间坐标按上游 Date 口径为毫秒精度，原始步骤耗时保留原数据精度；清楚区分“全链时间范围”与“根任务耗时”。选中行滚动复用上游计算，不把一个步骤的失败改写成整个任务失败。

## 实施与回滚

按 Developer Helper 适配顺序：规格 -> 固定源码/许可 -> 适配器/中文组件 -> 源码单测与浏览器测试 -> PR/最终 CI -> 正常合并。禁止调用上游运行时服务或引入其 ee/数据库依赖。

普通 revert 本节点恢复已有树视图，不更改归档文件、项目 IndexedDB 或任何历史分数。证据路径 `docs/evidence/pr-langfuse-trace/README.md`，通过实际门禁前不标记已验证。

## 本地证据

264 unit（新增 14）/ 2 stress、lint/typecheck/build/源码摘要扫描通过；相关 4 E2E 与全量 52 E2E/WCAG 再次通过。合成截图、成功 Trace、首轮失败与修复在 [验收报告](../../evidence/pr-langfuse-trace/README.md)。最终 head CI 与正常合并状态仍待实际确认。
