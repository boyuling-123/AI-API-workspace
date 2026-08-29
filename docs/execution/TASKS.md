# 测评平台开发任务台账

## 已完成：PR 01 基线迁移与状态校准

分支：`codex/chore-baseline-sync`

- [x] 从 GitHub 重新克隆远端仓库，保留历史。
- [x] 保留原开发目录，不在原目录初始化 Git。
- [x] 镜像迁移当前源码，排除密钥、依赖、缓存、构建产物和本地 Agent 状态。
- [x] 强化 `.gitignore`。
- [x] 将四个不存在的 API 降级为“设计中”或“Demo”。
- [x] 建立 75 条能力矩阵及六种严格状态。
- [x] 校准 README 和 v5.0 文档入口。
- [x] 执行敏感信息扫描和迁移 Diff 复核。
- [x] 安装干净依赖并完成 typecheck、build 和基础 UI 验收。
- [x] 提交并推送 `codex/chore-baseline-sync` 分支。
- [x] 创建并合并 [PR #9](https://github.com/boyuling-123/AI-API-workspace/pull/9)。

## 已完成：PR 02A 真实源码测试与基础 CI

分支：`codex/test-real-source-ci`

- [x] 让任务池测试直接导入真实源文件，删除两份复制实现测试。
- [x] 覆盖并发上限、非法并发、失败隔离、进度、取消、空列表和 2,000 任务压力路径。
- [x] 修复 `NaN` 并发导致任务池不启动的问题。
- [x] 建立 lint、typecheck、unit、stress、build 和 quality 脚本。
- [x] 建立不输出敏感值的 Secret Scan 及正反例回归测试。
- [x] 增加 GitHub Actions 基础质量门禁。
- [x] 为 75 项能力矩阵增加 Issue/PR 列并关联 PR 01/02A。
- [x] 完成生产构建、干净环境复验和验收证据。
- [x] 提交、推送并创建 [PR #10](https://github.com/boyuling-123/AI-API-workspace/pull/10)。
- [x] GitHub Actions 质量门禁通过，并将 TASK-001 升级为“已验证”。
- [x] 非强推 fast-forward 合并 PR #10，GitHub 已确认 Merged。

## 已完成：PR 02B 浏览器用户路径门禁

分支：`codex/test-playwright-a11y`

- [x] 接入 Playwright Chromium、HTML 报告和失败 Trace/截图。
- [x] 覆盖首页布局、目标选择提示、外部接口状态、导入深链和 AI 评价安全入口。
- [x] 所有 E2E 页面统一拦截 `/api/**`，发现任何请求即失败，禁止误调用付费模型。
- [x] 增加 WCAG 2A/2AA/2.1A/2.1AA 严重与致命问题门禁。
- [x] 修复目标卡片嵌套交互控件、Tab 语义和已覆盖页面的颜色对比问题。
- [x] 本地 6 项 Playwright 用户路径与可访问性测试通过。
- [x] 独立干净工作树执行全新 `npm ci`、完整 quality 和 6 项 Playwright 测试。
- [x] 推送分支并创建 [PR #11](https://github.com/boyuling-123/AI-API-workspace/pull/11)。
- [x] 核心质量与 Playwright 两道 GitHub CI 通过，DOC-006 升级为“已验证”。
- [x] 非强推 fast-forward 合并 PR #11，GitHub 已确认 Merged。

## 已完成：PR 02C 质量债务与日志脱敏

分支：`codex/chore-quality-debt`

- [x] 清理 9 条 React Hook 与动态 `<img>` lint 警告，lint 达到零警告。
- [x] 使用非破坏性 `npm audit fix` 更新 4 个传递依赖，高危项由 8 个降为 6 个。
- [x] 不使用 `--force`；将 Next/ESLint 大版本迁移和无修复版的 `xlsx` 风险登记为后续专题。
- [x] 增加统一服务端脱敏器并接入脚本输出、安装输出、Agent Prompt 与反馈边界。
- [x] 增加脱敏单测和真实 Node 子进程成功、失败泄漏测试。
- [x] 本地完整 quality 与 6 项 Playwright 回归通过。
- [x] 独立干净工作树执行全新 `npm ci`、完整 quality 和 Playwright。
- [x] 提交、推送并创建 [PR #12](https://github.com/boyuling-123/AI-API-workspace/pull/12)。
- [x] GitHub 核心质量与 Playwright 两道 CI 通过并回写证据。
- [x] 最终文档提交 CI 通过后，以非强推 fast-forward 合并 PR #12。

## 已完成：PR 03A 批量检查点与中断续跑

分支：`codex/feat-batch-checkpoints`

- [x] 为 Case × Target 建立稳定结果矩阵和检查点进度模型。
- [x] 批量任务启动、每 10 个完成项、暂停和结束时更新同一 Task 并立即落库。
- [x] 刷新或关闭页面后识别 `running` / `paused` 任务，并从未完成项继续。
- [x] 已成功或明确失败的单元不会被自动重复调用；中断与待执行单元恢复为待运行。
- [x] 区分暂停、继续、终止和放弃已保存任务，存在待续任务时阻止误开新批次。
- [x] 历史任务展示检查点进度，运行中或暂停中的任务禁止启动 AI 评价。
- [x] 新增真实源码单测和 Mock Playwright 暂停、刷新、续跑、终止路径。
- [x] 本地 lint、typecheck、21 项单测、8 项 Playwright 和生产构建通过。
- [x] 保存刷新后恢复界面截图，不读取真实 Key、不调用付费模型。
- [x] 完整 quality、独立干净工作树复验与敏感信息扫描。
- [x] 提交、推送并创建 [PR #13](https://github.com/boyuling-123/AI-API-workspace/pull/13)。
- [x] GitHub 核心质量与 Playwright 两道 CI 通过并回写证据。
- [x] 最终文档提交 CI 通过后，以非强推 fast-forward 合并 PR #13，GitHub 已确认 Merged。

## 已完成：PR 03B 跑批限速、超时与错误分类

分支：`codex/feat-run-controls`

- [x] 在首页顶部高级策略区配置全局 QPS、单次超时和失败重试次数。
- [x] 全部并发 Worker 与自动重试共享同一平滑 QPS 队列，取消时立即停止等待。
- [x] 任务快照持久化运行策略，暂停后继续严格沿用原批次配置。
- [x] 每次尝试独立超时；仅超时、限流、网络和服务端错误允许自动重试，最多 3 次。
- [x] 服务端 route 和 adapter 保留失败类型、是否可重试与上游 HTTP 状态，并对错误文本脱敏。
- [x] 历史结果展示并筛选失败类型、尝试次数和 HTTP 状态，Excel 导出同步增加这些列。
- [x] 38 项单测、2 项压力测试、10 项 Playwright 与生产构建在本地通过。
- [x] 保存首页策略区与历史错误分类两张视觉证据；未读取真实 Key、未调用付费模型或 AI 评价。
- [x] 独立干净工作树完成全新 `npm ci`、quality 和 Playwright 复验，结束后零改动。
- [x] 提交、推送并创建 [PR #14](https://github.com/boyuling-123/AI-API-workspace/pull/14)。
- [x] GitHub 核心质量与 Playwright 两道 CI 通过并回写证据。
- [x] 最终 CI 通过后，以非强推 fast-forward 合并 PR #14，GitHub 已确认 Merged。

## 已完成：PR 03C 失败项与指定 Case 定向重跑

分支：`codex/feat-selective-reruns`

- [x] 为定向重跑建立可持久化的稀疏 Case × Target 调用计划。
- [x] 失败项模式只收集原任务中状态为 `error` 且目标当前可用的精确组合。
- [x] 指定 Case 模式支持 `1,3,8-12` 表达式，非法、倒序和越界输入禁止确认。
- [x] 调用前预览 Case、目标、调用次数和不可用目标，明确提示费用且不自动启动 AI 评价。
- [x] 每次重跑创建新 Task，保存来源任务、范围和组合；原任务与原结果不覆盖。
- [x] 稀疏任务暂停后沿用相同计划，只恢复未完成组合。
- [x] 新增真实源码单测、Mock Playwright 精确请求断言和弹窗 WCAG 门禁。
- [x] 保存指定 Case 重跑预览视觉证据。
- [x] 本地完整 quality 和 12 项 Playwright 全量回归通过。
- [x] 提交 `3ef828f` 的独立干净工作树完成全新安装、quality 和 Playwright 复验，结束后零改动。
- [x] 提交、推送并创建 [PR #15](https://github.com/boyuling-123/AI-API-workspace/pull/15)，GitHub 核心质量与 Playwright 两道 CI 通过。
- [x] 最终 CI 通过后，以非强推 fast-forward 合并，GitHub 已确认 PR 为 Merged。

## 已完成：PR 03D 新增目标定向重跑

分支：`codex/feat-new-target-reruns`

- [x] 新增目标模式只列出已测试可用、内容模式兼容、源任务未运行过的模型或算法。
- [x] 用户显式勾选新增目标和 Case，确认前预览新增调用数与历史复用数。
- [x] 新任务只执行新增 `Case × Target` 稀疏计划，复用源任务终态结果用于同屏比较。
- [x] 进度与最终状态只统计新增调用；已删除的历史目标仍可只读展示，不阻塞新目标执行。
- [x] 历史列表保存“新增目标”范围与来源任务；结果页和 Excel 明确标记“历史复用”。
- [x] 真实源码单测覆盖候选过滤、计划顺序、复用标记、精确进度与已删除历史目标。
- [x] Mock Playwright 验证确认前零请求、确认后只调用 Qwen 两次、复用四条旧结果且不启动 AI 评价。
- [x] 保存完整视觉证据，本地全量 quality 与 13 项 Playwright 通过。
- [x] 提交 `d1c9231` 后在独立干净工作树完成全新安装、quality 与 Playwright 复验，结束时零改动。
- [x] 提交、推送并创建 [PR #16](https://github.com/boyuling-123/AI-API-workspace/pull/16)。
- [x] PR #16 workflow run `33231921078` 的核心质量与 Playwright 两个 Job 全部通过。
- [x] 最终文档提交对应 workflow run `33232064639` 通过后，以非强推 fast-forward 合并；GitHub 已确认 PR #16 为 Merged。

## 已完成：PR 03E 新增评价维度

分支：`codex/feat-new-dimension-evaluation`

- [x] 在每条评价历史记录旁提供“新增维度评价”入口；来源批次不存在时禁用。
- [x] 继承来源裁判、需求、Prompt、模式与标准答案字段，并把范围锁定为来源评价已完成的样本。
- [x] 汇总同一评价血缘的历史维度，按大小写与连续空白归一化去重，禁止重复评价已有维度。
- [x] 调用前预览裁判调用数、被测模型调用数、历史复用输出数和新增维度数；未经确认不发请求。
- [x] 确认后只调用 `/api/evaluate`，不调用 `/api/run-custom`，不覆盖来源 Task 或来源 Evaluation。
- [x] 新记录保存 `evaluationKind=new_dimensions` 与根 `sourceEvaluationId`，历史列表可追溯来源评价。
- [x] 新增真实源码单测与 Mock Playwright；确认弹窗通过 WCAG 严重与致命问题扫描。
- [x] 保存视觉证据，本地 quality 与 14 项 Playwright 全量回归通过。
- [x] 提交 `18bc0df` 在独立干净工作树全新安装 434 个包，quality 与 14 项 Playwright 复验通过，结束时零改动。
- [x] 提交、推送并创建 [PR #17](https://github.com/boyuling-123/AI-API-workspace/pull/17)。
- [x] PR #17 workflow run `33236290462` 的核心质量与 Playwright 两个 Job 全部通过。
- [x] 最终文档提交对应 workflow run `33236428567` 通过后，以非强推 fast-forward 合并；GitHub 已确认 PR #17 为 Merged。

## 已完成：PR 04A 结构化维度生成上下文

分支：`codex/feat-dimension-generation-context`

- [x] 维度生成显式收集评测目标、业务场景和任务类型，并在前端与服务端执行长度、枚举和必填校验。
- [x] 从当前跑批结果按覆盖首中尾、失败优先或标准答案优先三种策略确定性抽样，数量可配置且最多 8 条。
- [x] 调用前预览发送样本并允许排除；仅传截断文字、标准答案、状态、图片数量和错误类型，不传原图、base64 或完整错误。
- [x] 页面明确 OpenJudge 尚未接入；只有用户点击“AI 生成评价维度”才请求通用模型，不自动启动 AI 评价。
- [x] API 只接受结构化契约，拒绝畸形对象、过长字段、无输出、重复或超量样本。
- [x] 真实源码单测覆盖确定性抽样、契约校验、Prompt 与数据最小化；Mock Playwright 覆盖完整用户路径和精确请求。
- [x] 修复 AI 评价页四处低对比度文字，完整页面通过 WCAG 严重与致命问题扫描。
- [x] 保存视觉证据；本地 quality 与 15 项 Playwright 全量回归通过。
- [x] 提交 `383aef7` 并在独立干净工作树全新安装 434 个包，quality 与 15 项 Playwright 复验通过，结束时零改动。
- [x] 推送分支并创建 [PR #18](https://github.com/boyuling-123/AI-API-workspace/pull/18)；workflow run `33237473012` 的核心质量与 Playwright 两个 Job 全部通过。
- [x] 最终文档提交对应 workflow run `33237610485` 通过后，以非强推 fast-forward 合并；GitHub 已确认 PR #18 为 Merged。

## 进行中：PR 04B 硬规则与 Bad Case 上下文

分支：`codex/feat-dimension-rules-bad-cases`

- [x] 增加有界任务级硬规则 Schema，每行一条、去重、最多 20 条且单条最多 500 字。
- [x] 支持用户显式标记代表性样本为 Bad Case 并填写原因；识别严格的数据集列名但不猜测任意字段。
- [x] 将规则与 Bad Case 原因写入受控模型请求和 Prompt，不发送原图、base64 或完整失败文本。
- [x] 未填写 Bad Case 原因、规则超限或非法外部请求不得调用维度生成模型。
- [x] 新增真实源码测试、Mock Playwright、WCAG 门禁和视觉证据。
- [ ] 独立干净工作树复验、创建 PR、两轮 CI 与非强推安全合并。

## 硬门禁

- 未通过适用测试不得 Push 或合并。
- 不得提交真实 Key、`.env.local`、日志、缓存或构建产物。
- 不得自动调用付费模型或启动 AI 评价。
- 每个 PR 必须更新能力矩阵和本台账。
- 远端 `main` 变化或门禁失败时禁止强推和自动合并。
