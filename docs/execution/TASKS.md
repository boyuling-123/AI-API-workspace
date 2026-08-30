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

## 已完成：PR 04B 硬规则与 Bad Case 上下文

分支：`codex/feat-dimension-rules-bad-cases`

- [x] 增加有界任务级硬规则 Schema，每行一条、去重、最多 20 条且单条最多 500 字。
- [x] 支持用户显式标记代表性样本为 Bad Case 并填写原因；识别严格的数据集列名但不猜测任意字段。
- [x] 将规则与 Bad Case 原因写入受控模型请求和 Prompt，不发送原图、base64 或完整失败文本。
- [x] 未填写 Bad Case 原因、规则超限或非法外部请求不得调用维度生成模型。
- [x] 新增真实源码测试、Mock Playwright、WCAG 门禁和视觉证据。
- [x] 功能提交 `a054594` 在独立干净工作树全新安装 434 个包，quality 与 16 项 Playwright 复验通过，结束时零改动。
- [x] 推送分支并创建 [PR #19](https://github.com/boyuling-123/AI-API-workspace/pull/19)；workflow run `33239133343` 的核心质量与 Playwright 两个 Job 全部通过。
- [x] 最终文档提交对应 workflow run `33239314190` 的两道 CI 通过；以非强推 fast-forward 安全合并，GitHub 已确认 PR #19 为 Merged，合并 SHA 为 `fb140fb`。

## 已完成：PR 04C 人工评分与偏好排序上下文

分支：`codex/feat-dimension-human-feedback`

- [x] 在每条代表性 Case 内提供显式、可移除的人工反馈入口，评分与排序两种模式互斥。
- [x] 人工评分严格限制为 `0–10` 且最多 1 位小数；偏好排序要求至少 2 个目标，并完整、唯一覆盖 `1..N`。
- [x] 人工反馈必须精确覆盖当前样本全部目标输出；缺失、重复、未知目标或非法数值在模型调用前阻断。
- [x] 可选备注最多 1000 字，客户端组包与服务端解析统一脱敏；切换模式会清空旧数值，避免语义混用。
- [x] 当前通用维度模型仅将人工信号作为受控上下文；页面明确 OpenJudge 与 Iterative Rubrics Generator 均未接入。
- [x] 真实源码单测覆盖 Schema、规范化、Prompt 和服务端零调用阻断；Mock Playwright 覆盖完整评分、非法排序修正、精确请求、零自动评价与 WCAG。
- [x] 视觉证据已人工检查；本地 quality 通过 72 项单测、2 项压力测试与 19 路由构建，全量 17 项 Playwright 通过。
- [x] 功能提交 `c5266d6` 在独立干净工作树全新安装 434 个包，quality 与 17 项 Playwright 复验通过，结束时零改动。
- [x] 推送分支并创建 [PR #20](https://github.com/boyuling-123/AI-API-workspace/pull/20)；workflow run `33240897489` 的核心质量与 Playwright 两个 Job 全部通过。
- [x] 最终文档提交对应 workflow run `33241134290` 的两道 CI 通过；以非强推 fast-forward 安全合并，GitHub 已确认 PR #20 为 Merged，合并 SHA 为 `2077b3b`。

## 已完成：PR 04D 结构化 Simple Rubrics 与发布前校验

分支：`codex/feat-structured-simple-rubrics`

- [x] 扩展 `EvalDimension`，新评价支持定义、固定 `0/5/10` 评分锚点、证据要求和可执行判断规则；字段保持可选以兼容旧历史记录。
- [x] 无人工评分或排序时明确使用 Simple Rubrics 一次生成模式；有人工反馈时仍明确为一次上下文生成，不冒充 Iterative Rubrics Generator。
- [x] AI 维度输出必须完整包含结构化 Rubric；拒绝旧式 `name/desc` 输出，不在服务端暗自编造缺失标准。
- [x] 页面支持逐项检查和编辑 Rubric，并提供可审阅的按定义补齐模板；缺任一字段、重复名称或非法锚点时，Prompt 与 Judge 调用均被阻断。
- [x] `/api/gen-eval-prompt` 与 `/api/evaluate` 在模型调用前执行同一严格 Schema 校验，Judge Prompt 原样携带定义、锚点、证据和判断规则。
- [x] 旧评价记录仍可展示和参与维度血缘去重；新结构化记录保留全部 Rubric 字段。
- [x] 真实源码单测覆盖规范化、长度、重复、脱敏、畸形模型输出、路由零调用阻断、Prompt 与旧记录兼容；Mock Playwright 覆盖 Simple 模式、缺失锚点、恢复提交、零自动评价和 WCAG。
- [x] 保存并人工检查视觉证据；本地 quality 通过 238 文件密钥扫描、84 项单测、2 项压力测试和 19 路由构建，全量 18 项 Playwright 通过。
- [x] 功能提交 `a697f43` 在独立干净工作树全新安装 434 个包，quality 与 18 项 Playwright 复验通过，结束时零改动。
- [x] 推送分支并创建 [PR #21](https://github.com/boyuling-123/AI-API-workspace/pull/21)；workflow run `33243678962` 的核心质量与 Playwright 两个 Job 全部通过。
- [x] 最终文档提交对应 workflow run `33243860373` 两道 CI 通过；以非强推 fast-forward 安全合并，GitHub 已确认 PR #21 为 Merged，合并 SHA 为 `6da447b`。

## 已完成：PR 05A 评价权重与一票否决策略

分支：`codex/feat-evaluator-policy`

- [x] 权重只接受 `0.01–100`、最多两位小数，全部已选维度必须精确合计 `100%`。
- [x] 支持平均分配权重；勾选、新增或删除已选维度时重新安全分配，用户仍可手动调整。
- [x] 每个维度可独立启用一票否决并设置 `0–10`、最多一位小数的阈值。
- [x] 用户必须显式确认最终评价策略；任何 Rubric、权重或阈值修改都会使确认自动失效。
- [x] Prompt 与 Judge 路由在模型调用前执行同一策略校验，并携带完整权重与否决规则。
- [x] Judge 只返回独立维度分；平台确定性计算加权分、否决状态和原因，不依赖模型算术。
- [x] 即时结果、AI 历史记录与 Excel 导出保留权重、加权分、否决状态和原因，旧历史继续可读。
- [x] 新增真实源码单测、Mock Playwright、WCAG 门禁和视觉证据；未调用真实或付费模型。
- [x] 本地 `quality` 通过 243 文件密钥扫描、零 lint、typecheck、89 项单测、2 项压力测试和 19 路由构建；全量 19 项 Playwright 通过。
- [x] 功能提交 `270ae10` 在独立干净工作树全新安装 434 个包，quality 与 19 项 Playwright 全部通过，结束时 Git 零改动。
- [x] 推送分支并创建 [PR #22](https://github.com/boyuling-123/AI-API-workspace/pull/22)；workflow run `33246361526` 的核心质量与 Playwright 两个 Job 全部通过。
- [x] 最终文档提交对应 workflow run `33246545137` 两道 GitHub CI 通过；确认远端 `main` 未漂移后，以非强推 fast-forward 安全合并，GitHub 已确认 PR #22 为 Merged，合并 SHA 为 `f0fedce`。

## 已完成：PR 05B 不可变 Evaluator 与 Prompt 版本

分支：`codex/feat-evaluator-versions`

- [x] 新增项目级不可变 Evaluator 版本实体，保存稳定家族 id、递增版本号、裁判、完整策略、Prompt 与标准答案模式。
- [x] 保存修改人、创建时间、变更说明和适用跑批任务；评价历史可追溯实际绑定版本。
- [x] 页面支持保存 v1、手动修改 Prompt 后追加 v2、加载任意历史版本，旧版本不覆盖。
- [x] 定义指纹识别未保存草稿；完整性指纹覆盖版本身份、元数据和执行定义，篡改版本禁止加载。
- [x] 新版本字段保持向后兼容，不提升项目 Schema 版本，不删除旧 IndexedDB 项目。
- [x] 版本入库前统一脱敏，并修复脱敏占位符重复处理不幂等的问题。
- [x] 真实源码单测覆盖追加、深拷贝、修改识别、非法家族、篡改和脱敏；Mock Playwright 覆盖 v1/v2、刷新持久化、显式评价和 WCAG。
- [x] 保存并人工检查 `docs/evidence/pr-05b/evaluator-versions.png`；当前 95 项单测与全量 20 项 Playwright 通过。
- [x] 本地 quality 通过 248 文件密钥扫描、零 lint、typecheck、95 项单测、2 项压力测试和 19 路由构建；全量 20 项 Playwright 通过。
- [x] 功能提交 `34347aa` 在独立干净工作树全新安装 434 个包，quality 与最终全量 20 项 Playwright 通过，结束时 Git 零改动。
- [x] 推送分支并创建 [PR #23](https://github.com/boyuling-123/AI-API-workspace/pull/23)；workflow run `33287622657` 的核心质量与 Playwright 两个 Job 全部通过。
- [x] 最终文档提交对应 workflow run `33287776223` 两道 GitHub CI 通过；确认远端 `main` 未漂移后，以非强推 fast-forward 安全合并，GitHub 已确认 PR #23 为 Merged，合并 SHA 为 `64b891b`。

## 已完成：PR 05C Evaluator 版本 Diff 与安全恢复

分支：`codex/feat-evaluator-version-diff`

- [x] 同一 Evaluator 家族支持选择基线版本，展示裁判、目标、评价模式、标准答案、适用任务与 Rubric/策略的结构化差异。
- [x] Prompt 提供逐行新增、删除与上下文 Diff；大文本超过计算阈值时使用有界前后缀算法，避免浏览器卡死。
- [x] Diff 输出影响范围，明确提示裁判指令、评分口径、裁判模型、标准答案覆盖和适用任务是否变化。
- [x] 非最新版历史快照可恢复为 `vN+1`；来源与中间版本保持不变，新版本记录作者、当前任务和恢复说明。
- [x] 损坏版本、跨家族比较、最新版重复恢复和伪造来源均在领域层阻断。
- [x] 真实源码单测覆盖结构化/文本 Diff、大 Prompt、异常边界和 v1→v3；Mock Playwright 覆盖 Diff、恢复、刷新持久化、旧版本不变、零 Judge 调用与 WCAG。
- [x] 保存并人工检查 `docs/evidence/pr-05c/version-diff-restore.png`；本地 quality 通过 254 文件密钥扫描、零 lint、typecheck、101 项单测、2 项压力测试和 19 路由构建，全量 21 项 Playwright 通过。
- [x] 功能快照 `41197b2` 在独立干净工作树全新安装 434 个包，quality 与 21 项 Playwright 全部通过，结束时 Git 零改动。
- [x] 分支已推送并创建 [PR #24](https://github.com/boyuling-123/AI-API-workspace/pull/24)；首轮 workflow run `33290243949` 的核心质量与 Playwright/WCAG 两个 Job 全部通过。
- [x] 最终文档提交对应 workflow run `33290477614` 两道 GitHub CI 通过；确认远端无漂移和未解决审查后，以非强推 fast-forward 安全合并，GitHub 已确认 PR #24 为 Merged，合并 SHA 为 `8623da4`。

## 已完成：PR 05D 少量试评与复用输出重新评价

分支：`codex/feat-evaluator-trial-rerun`

- [x] 新增统一评价执行计划，少量试评默认 3 条、最多 5 条，并与正式评价共用准确调用预览。
- [x] 试评与正式评价均需显式确认；确认前零 Judge 请求，且被测模型/算法调用始终为 0。
- [x] 试评展示成功评分与逐条解析错误，只保留在当前页面，不创建正式评价历史。
- [x] 跑批历史入口明确标记“复用输出去AI评测”；同一 Task 每次正式评价追加独立记录，不覆盖既有结果。
- [x] 真实源码单测覆盖默认值、上限、确定性范围、去重和写历史边界。
- [x] Mock Playwright 覆盖 3 条跑批、2 条试评含解析失败、历史 0 条和两轮正式重评形成 2 条独立记录。
- [x] 保存并人工检查 `docs/evidence/pr-05d/evaluation-trial-confirm.png`；确认弹窗通过 WCAG 严重与致命问题扫描。
- [x] 本地 quality 通过 259 文件密钥扫描、零 lint、typecheck、104 项单测、2 项压力测试和 19 路由构建；全量 22 项 Playwright 通过。
- [x] 功能快照 `a9ffa6e` 在独立干净工作树全新安装 434 个包，quality 与 22 项 Playwright 全部通过，结束时 Git 零改动。
- [x] 分支已推送并创建 [PR #25](https://github.com/boyuling-123/AI-API-workspace/pull/25)；首轮 workflow run `33292294441` 的核心质量与 Playwright/WCAG 两个 Job 全部通过。
- [x] 最终文档提交对应 workflow run `33292408679` 两道 GitHub CI 通过；确认远端无漂移和未解决审查后，以非强推 fast-forward 安全合并，GitHub 已确认 PR #25 为 Merged，合并 SHA 为 `ad430a3`。

## 已完成：PR 06A 黄金集领域模型与严格导入边界

分支：`codex/feat-judge-golden-dataset`

- [x] 定义黄金 Case 与不可变 `GoldenDatasetVersion`，保持项目字段可选，不破坏当前 schema 的既有本地项目。
- [x] 支持 Excel、CSV、JSON、JSONL 严格解析，返回字段映射、未使用列与逐行阻断问题，不猜测缺失字段。
- [x] 黄金 Case 明确保存输入、候选输出、可选标准答案、人工 pass/fail 标签、可选分数和复核说明。
- [x] v1 发布后快照不可变；追加 vN+1 时要求变更说明，旧版本保持不变并执行内容与元数据完整性校验。
- [x] 8 项真实源码单测覆盖双语映射、真实 Excel、非法标签、重复 ID、越界分数、JSON 边界、版本追加、篡改和脱敏。
- [x] 功能快照 `3e0582a` 在独立干净工作树全新安装 434 个包，quality 与既有 22 项 Playwright 全部通过，结束时 Git 零改动。
- [x] 分支已推送并创建 [PR #26](https://github.com/boyuling-123/AI-API-workspace/pull/26)；首轮 workflow run `33293157412` 的核心质量与 Playwright/WCAG 两个 Job 全部通过。
- [x] 最终文档提交对应 workflow run `33293293787` 两道 GitHub CI 通过；确认远端无漂移和未解决审查后，以非强推 fast-forward 安全合并，GitHub 已确认 PR #26 为 Merged，合并 SHA 为 `50cdc17`。

## 已完成：PR 06B 人工黄金集管理页与用户路径

分支：`codex/feat-judge-golden-dataset-ui`

- [x] 新增独立 Judge 校准页与第六个工作区导航入口；小屏导航支持横向滚动。
- [x] 显示 Excel/CSV/JSON/JSONL 字段映射、未使用列和逐行问题；阻断问题不能通过“手工新增 Case”旁路绕过。
- [x] 支持人工核对、发布锁定 v1、基于历史版本创建 vN+1，并在项目 IndexedDB 中刷新持久化。
- [x] 页面明确显示本流程 0 次 Judge 调用，Mock E2E 拦截并断言全部 `/api/**` 调用为空。
- [x] 保存并人工检查 `docs/evidence/pr-06b/golden-dataset-versions.png`；页面通过 WCAG 严重与致命问题扫描。
- [x] 本地 quality 通过 267 文件密钥扫描、零 lint、typecheck、112 项单测、2 项压力测试和 19 路由构建；全量 23 项 Playwright 通过。
- [x] 功能快照 `23fdb21` 在独立干净工作树全新安装 434 个包，quality 与 23 项 Playwright 全部通过，结束时 Git 零改动。
- [x] 分支已推送并创建 [PR #27](https://github.com/boyuling-123/AI-API-workspace/pull/27)；首轮 workflow run `33293740909` 的核心质量与 Playwright/WCAG 两个 Job 全部通过。
- [x] 最终文档提交对应 workflow run `33293861344` 两道 GitHub CI 通过；确认远端无漂移和未解决审查后，以非强推 fast-forward 安全合并，GitHub 已确认 PR #27 为 Merged，合并 SHA 为 `58aae60`。

## 已完成：PR 06C Judge 校准契约与确定性指标

分支：`codex/feat-judge-calibration-metrics`

- [x] 新增单 Case `/api/judge-calibration`，严格校验 Case、Judge 和判定标准，模型坏 JSON/标签/置信度按服务端错误返回。
- [x] API 白名单重建 Judge 输入，调用方多传的人工标签和复核说明不会进入 Prompt；发送前继续执行敏感值脱敏。
- [x] Judge 严格返回 pass/fail、0-1 置信度与理由；本 PR 不新增自动批量触发或真实模型测试。
- [x] 以人工标签为真值确定性计算准确率、Cohen’s κ、Bad Case 漏判率、误杀率和 2x2 混淆矩阵；无分母时返回 null，不伪造 0%。
- [x] 11 项新增真实源码测试覆盖完美/分歧/错误样本、空分母、入参门禁、人工真值隔离、脱敏、坏 Judge 输出和路由状态码。
- [x] 本地 quality 通过 275 文件密钥扫描、零 lint、typecheck、123 项单测、2 项压力测试和 20 路由构建；全量 23 项 Playwright 通过。
- [x] 功能快照 `c1f60cd` 在独立干净工作树全新安装 434 个包，quality 与 23 项 Playwright 全部通过，结束时 Git 零改动。
- [x] 分支已推送并创建 [PR #28](https://github.com/boyuling-123/AI-API-workspace/pull/28)；首轮 workflow run `33294370480` 的核心质量与 Playwright/WCAG 两个 Job 全部通过。
- [x] 最终文档提交对应 workflow run `33294485493` 两道 GitHub CI 通过；确认远端无漂移和未解决审查后，以非强推 fast-forward 安全合并，GitHub 已确认 PR #28 为 Merged，合并 SHA 为 `eba0264`。

## 已完成：PR 06D 确认式校准运行与分歧下钻

分支：`codex/feat-judge-calibration-workspace`

- [x] 黄金集页面新增独立校准运行区，展示精确 Judge 调用数和 0 次被测模型调用；浏览、切换或取消确认均不发请求。
- [x] 支持 1-5 受控并发和二次确认；调用数不少于 100 时，必须输入精确数字才允许启动。
- [x] 客户端只发送 Case ID、输入、候选输出和可选标准答案，人工标签与复核说明只留在本地确定性对比。
- [x] 每个失败 Case 独立保留；校准历史随项目持久化，刷新后可回看准确率、Cohen’s κ、漏判率、混淆矩阵和分歧/失败样本。
- [x] 2 项客户端真实源码单测覆盖白名单请求、部分失败和坏响应；2 项 Mock E2E 覆盖 3 Case 完整路径与 100 Case 高费用门禁。
- [x] 保存并人工检查 `docs/evidence/pr-06d/judge-calibration-results.png`；确认弹窗与结果区 WCAG 严重/致命问题扫描通过。
- [x] 本地 quality 通过 281 文件密钥扫描、零 lint、typecheck、125 项单测、2 项压力测试和 20 路由构建；全量 25 项 Playwright 通过。
- [x] 功能快照 `fa2fd3a` 在独立干净工作树全新安装 434 个包，quality 与 25 项 Playwright 全部通过，结束时 Git 零改动。
- [x] 分支已推送并创建 [PR #29](https://github.com/boyuling-123/AI-API-workspace/pull/29)；首轮 workflow run `33295087238` 的核心质量与 Playwright/WCAG 两个 Job 全部通过。
- [x] 最终文档提交对应 workflow run `33295201533` 两道 GitHub CI 通过；确认远端无漂移和未解决审查后，以非强推 fast-forward 安全合并，GitHub 已确认 PR #29 为 Merged，合并 SHA 为 `1af2a69`。

## 已完成：PR 06E Evaluator 变化后重跑黄金集

分支：`codex/feat-judge-calibration-rerun`

- [x] 每次校准保存独立任务 id、触发类型、基线运行、变更类别和不可变 Evaluator 执行快照，旧项目字段可缺省且无需 IndexedDB 迁移。
- [x] 自动识别 Judge、评价维度、Prompt、Evaluator 与自定义判定标准变化；同执行定义已有结果时优先提示复用，不自动付费重跑。
- [x] 版本切换只生成本地重跑计划；二次确认后才精确逐 Case 调用，结果追加保存并关联基线，旧结果不覆盖。
- [x] 结果区展示触发来源、Evaluator 版本和准确率、Cohen’s κ、Bad Case 漏判率的前后差异。
- [x] 校准标准可承载最多 100,000 字符的完整 Evaluator 定义，超限在模型调用前拒绝。
- [x] 6 项重跑规划与服务边界单测覆盖首次任务、Judge/维度/Prompt 变化、定义复用、黄金集隔离和长度上限；客户端测试覆盖快照持久化。
- [x] Mock E2E 覆盖 Evaluator v1→v2、确认前零新增调用、确认后精确重跑、两次历史、刷新持久化和 WCAG。
- [x] 保存并人工检查 `docs/evidence/pr-06e/evaluator-rerun-comparison.png`；本地 quality 通过 286 文件密钥扫描、零 lint、typecheck、131 项单测、2 项压力测试和 20 路由构建；全量 26 项 Playwright 通过。
- [x] 功能快照 `515aeb8` 在独立干净工作树全新安装 434 个包，quality 与 26 项 Playwright 全部通过，结束时 Git 零改动。
- [x] 分支已推送并创建 [PR #30](https://github.com/boyuling-123/AI-API-workspace/pull/30)；首轮 workflow run `33296085052` 的核心质量与 Playwright/WCAG 两个 Job 全部通过。
- [x] 最终文档提交对应 workflow run `33296208642` 两道 GitHub CI 通过；确认远端无漂移和未解决审查后，以非强推 fast-forward 安全合并，GitHub 已确认 PR #30 为 Merged，合并 SHA 为 `1b6d01e`。

## 已完成：PR 06F Evaluator Active 发布门禁

分支：`codex/feat-evaluator-calibration-gate`

- [x] 新增项目级只追加 `EvaluatorRelease`，保存发布人、Evaluator/黄金集/Judge 引用、固定阈值、复算指标、前一发布记录与完整性指纹。
- [x] 固定门禁要求同一 Evaluator 家族、完整执行定义和逐字同步的判定标准；跨家族或自定义/改写标准不能旁路发布。
- [x] 逐 Case 结果必须 Case ID 唯一且成功/失败结构完整；已存指标必须与逐 Case 结果确定性复算一致。
- [x] 正式阈值固定为至少 20 个成功 Case、准确率不低于 90%、Cohen's κ 不低于 0.8、Bad Case 漏判率不高于 5% 且零调用错误。
- [x] 失败时禁用 Active 发布；全部通过后仍要求发布人和二次确认，发布本身明确为 0 次模型调用且不会自动评价。
- [x] 页面展示逐项实际值与要求、当前 Active 和只追加发布历史；完整记录随项目刷新持久化，损坏记录不参与 Active 选择。
- [x] 6 项真实源码单测覆盖通过、阈值失败、跨家族、标准改写、指标篡改、重复 Case、历史、脱敏与重复 id。
- [x] Mock E2E 以 20 Case 验证 v1 漏判率 10% 被阻断，v2 达标后确认发布、刷新持久化、Judge 调用严格为 40 且发布新增 0 次；Axe 严重/致命问题为 0。
- [x] 保存并人工检查 `docs/evidence/pr-06f/evaluator-release-gate.png`；本地 Secret Scan、零警告 lint、typecheck、137 项单测、2 项压力测试、20 路由构建和全量 27 项 Playwright 已通过。
- [x] 功能快照 `7e81ea6` 在独立 detached 工作树全新安装 434 个包，quality 与 27 项 Playwright 全部通过，结束时 Git 零改动。
- [x] 分支已推送并创建 [PR #31](https://github.com/boyuling-123/AI-API-workspace/pull/31)；首轮 workflow run `33297002754` 的核心质量与 Playwright/WCAG 两个 Job 全部通过。
- [x] 最终文档提交对应 workflow run `33297159622` 两道 GitHub CI 通过；远端无漂移、无 Review 或未解决线程且 PR 可合并后，以非强推 fast-forward 安全合并，GitHub 已确认 PR #31 为 Merged，合并 SHA 为 `a2d5f0f`。

## 已完成：PR 06G 多 Judge 校准与确定性仲裁核心

分支：`codex/feat-multi-judge-calibration`

- [x] 定义 `2-5` 个唯一 Judge 的运行快照，Judge 集合与仲裁策略共同形成稳定运行身份，旧单 Judge 历史保持兼容。
- [x] 按 `Case 数 × Judge 数` 建立精确调用矩阵并共用 `1-5` 全局并发池；人工标签和复核说明不进入任何 Judge 请求。
- [x] 完整保留每个 Judge 的标签、置信度、理由或错误，并确定性计算逐 Judge 指标、最终指标和分歧 Case 数。
- [x] 支持多数票且平票保守 `fail`、全票通过两种策略；任一投票缺失或失败时整条 Case 记错，不使用部分票数静默仲裁。
- [x] Active 发布前复算投票、仲裁、逐 Judge 指标、最终指标和分歧数，并把 Judge 集合与仲裁策略冻结到发布快照。
- [x] 真实源码测试覆盖精确请求数、全局并发、非法策略、重复 Judge、失败隔离、真值隔离、旧单 Judge 兼容和多类证据篡改。
- [x] 本地 quality 通过 297 文件密钥扫描、零警告 lint、typecheck、146 项单测、2 项压力测试和 20 路由构建；既有 27 项 Playwright 全部通过。
- [x] 功能快照 `7d7ba98` 在独立 detached 工作树全新安装 434 个包，quality 与 27 项 Playwright 全部通过，结束时 Git 零改动。
- [x] 分支已推送并自主创建 [PR #32](https://github.com/boyuling-123/AI-API-workspace/pull/32)；首轮 workflow run `33297825582` 的核心质量与 Playwright/WCAG 两个 Job 全部通过。
- [x] 最终文档提交对应 workflow run `33297951993` 两道 CI 通过；远端无漂移、无 Review 或未解决线程，以普通 fast-forward 合并 [PR #32](https://github.com/boyuling-123/AI-API-workspace/pull/32)，合并 SHA 为 `1720250`。
- [x] 页面多 Judge 选择、精确费用确认、逐 Judge 指标与分歧下钻按计划拆到 PR 06H，PR 06G 不扩大业务范围。

## 已完成：PR 06H 多 Judge 校准工作台

分支：`codex/feat-multi-judge-calibration-ui`

- [x] 保留默认单 Judge 路径，新增显式单/多 Judge 模式；多 Judge 必须手动选择 `2-5` 个模型，未满足时禁止启动。
- [x] 实时展示 `Case × Judge` 精确调用矩阵，确认弹窗再次列出 Judge 集合、仲裁策略、精确调用公式和零次被测模型调用。
- [x] 页面接入 PR 06G 的全局并发运行核心，支持多数票平票保守 `fail` 与全票通过策略，失败票不参与残缺仲裁。
- [x] 结果区展示最终指标、逐 Judge 独立指标、内部分歧数，并可按 Case 展开每个 Judge 的原始标签、理由、置信度或错误。
- [x] 新增 Mock Playwright 覆盖 `2 Case × 3 Judge = 6`、取消零调用、精确请求矩阵、真值隔离、持久化和刷新零新增请求；既有单 Judge 3 项回归通过。
- [x] 视觉证据已生成并人工检查；本地 300 文件 Secret Scan、零警告 lint、typecheck、146 单测、2 压测、20 路由构建和全量 28 项 Playwright 通过，JUDGE-005 升级为“已实现”。
- [x] 功能快照 `3247632` 在独立 detached 工作树全新安装 434 个包，quality 与 28 项 Playwright 全部通过，结束时 HEAD 未漂移且 Git 零改动。
- [x] 分支已推送并自主创建 [PR #33](https://github.com/boyuling-123/AI-API-workspace/pull/33)；首轮 workflow run `33298736070` 的核心质量与 Playwright/WCAG 两个 Job 全部通过，JUDGE-005 升级为“已验证”。
- [x] 最终文档提交对应 workflow run `33298865195` 两道 GitHub CI 通过；远端无 Review 或未解决线程后，GitHub 已确认 [PR #33](https://github.com/boyuling-123/AI-API-workspace/pull/33) 为 Merged，合并 SHA 为 `ff14ab5`。

## 进行中：平台内容规整与总览页短 PR

分支：`codex/feat-platform-overview`

- [x] 新增独立“平台总览”标签和 `?tab=overview` 深链；“跑批”继续作为默认首页、导航第一项和首要操作入口。
- [x] 按数据与跑批、模型接入、结果重跑、AI 评价、Judge 校准、Agent 外部召唤六条链路规整现有能力，并使用正式状态词展示真实边界。
- [x] 项目资产与最近任务直接读取当前 `Project`，不新增状态副本，不请求 API，不自动调用模型或启动 AI 评价。
- [x] 明确 Agent 外部召唤为 Demo、多 Judge 页面闭环为已验证、20GB 级数据后端化为设计中。
- [x] 修复既有顶部工具栏在 390px 宽度下的页面级横向溢出，保留全部新建、导入、导出和主题操作。
- [x] 定向 Playwright 通过总览深链、七标签、真实状态、入口跳转、零 API 调用、390px 无溢出和 Axe WCAG，共 8 项。
- [x] 保存并人工检查 `docs/evidence/pr-platform-overview/platform-overview.png`。
- [x] 本地 quality 通过 300 文件 Secret Scan、零警告 lint、typecheck、146 项单测、2 项压力测试和 20 路由构建；全量 29 项 Playwright 全部通过。
- [x] 功能快照 `04743ab` 在独立 detached 工作树全新安装 434 个包，quality 与 `CI=1` 的 29 项 Playwright 全部通过，结束时 Git 零改动。
- [x] 分支已推送并自主创建 [PR #34](https://github.com/boyuling-123/AI-API-workspace/pull/34)；首轮 workflow run `33298811346` 的核心质量与 Playwright/WCAG 两个 Job 全部通过。
- [x] 最终证据提交 workflow run `33298951938` 两道 CI 通过；审计时发现 `main` 已前进到 PR 06H 合并提交 `ff14ab5`，未覆盖远端并改为安全同步复验。
- [x] 同步 PR 06H 后本地 quality 通过 303 文件密钥扫描、零警告 lint、typecheck、146 单测、2 压测和 20 路由构建；`CI=1` 全量 30 项 Playwright 通过。
- [ ] 同步提交自身两道 GitHub CI 通过后，再完成远端漂移、Review/线程和可合并状态审计并安全合并。

## 已完成：PR 07A 校准风险队列与人工复核留痕

分支：`codex/feat-calibration-review-queue`

- [x] 固定风险规则覆盖 Judge 错误、Bad Case 漏判、人工与 Judge 分歧、多 Judge 内部分歧、低于 `75%` 的置信度和跨运行重复风险；每项展示具体依据与分数。
- [x] 基于黄金集家族与 Case ID 统计重复触发次数，按严重度、分数、频次和运行时间确定性排序，不调用模型做风险判断。
- [x] 新增项目级只追加复核事件，领取与完成均保存操作者、时间、原始标签、风险快照和完整性指纹；人工结论不覆盖原始 Judge 结果或黄金标签。
- [x] 页面支持待处理/待领取/复核中/已完成状态筛选，以及高风险、分歧、失败、低置信度和文本搜索；损坏事件明确告警并从状态计算排除。
- [x] 复核必须先领取，再选择确认原结论、人工改判 pass/fail 或待后续处理，并填写说明；跨复核人提交、重复领取、空说明和失败 Case 确认 Judge 均被阻断。
- [x] 6 项真实源码单测覆盖风险解释、重复频次、事件只追加、脱敏、异常路径和篡改；Mock E2E 覆盖 `2 Case × 3 Judge = 6`、领取、改判、审计、刷新持久化、零新增调用和 WCAG。
- [x] 视觉证据已生成并人工检查；初始基线本地 305 文件 Secret Scan、零警告 lint、typecheck、152 项单测、2 项压力测试、20 路由构建和全量 29 项 Playwright 通过。
- [x] 审计发现远端 `main` 新增平台总览后，保留原提交并安全重放到最新基线；功能快照 `4c03e5e` 在独立 detached 工作树全新安装 434 个包，quality 与 `CI=1` 的全量 31 项 Playwright 通过，结束时 HEAD 未漂移且 Git 零改动。
- [x] 分支已推送并自主创建 [PR #35](https://github.com/boyuling-123/AI-API-workspace/pull/35)；首轮 workflow run `33299671151` 的核心质量与 Playwright/WCAG 两个 Job 全部通过。
- [x] 最终证据提交 workflow run `33299834504` 两道 CI 通过；远端无漂移、Head 一致、无 Review 或未解决线程，以普通 fast-forward 合并 [PR #35](https://github.com/boyuling-123/AI-API-workspace/pull/35)，合并 SHA 为 `2d6d6f8`。

## 进行中：PR 07B 评价综合榜与动态维度重排

分支：`codex/feat-evaluation-leaderboard`

- [x] 新增纯计算层，按历史评价保存的原始维度分数生成综合榜与单维度榜；所选维度按原权重重新归一，不调用模型、不修改评价记录。
- [x] 缺失、越界或非法维度分数不补零；覆盖不完整的目标继续展示分数、覆盖率与否决次数，但不授予正式名次。
- [x] 正式名次按覆盖完整、综合分、覆盖率和稳定目标 ID 确定；同分使用竞赛排名，保证刷新与不同运行环境结果一致。
- [x] “AI 历史评价 → 查看”新增维度勾选、仅看单维度、全选恢复、即时排名卡片和原始 Case 明细锚点；旧无维度记录显示明确降级说明。
- [x] 5 项真实源码单测覆盖权重、单维度反转、缺失值、并列名次、旧记录等权兼容与输入不变；Mock E2E 覆盖 `2 Case × 2 模型`、动态重排、零新增调用、明细下钻、刷新持久化、390px 无溢出和 WCAG。
- [x] 视觉证据 `docs/evidence/pr-07b/evaluation-leaderboard.png` 已人工检查；本地 quality 通过 315 文件 Secret Scan、零警告 lint、typecheck、157 项单测、2 项压力测试和 20 路由构建，全量 32 项 Playwright 通过。
- [x] 功能快照 `95335f4` 在独立 detached 工作树全新安装 434 个依赖；quality 与 `CI=1` 全量 32 项 Playwright 通过，结束时 HEAD 未漂移且 Git 零改动。
- [ ] 推送、创建 PR，等待 GitHub 两道 CI 后完成审查与安全合并。

## 硬门禁

- 未通过适用测试不得 Push 或合并。
- 不得提交真实 Key、`.env.local`、日志、缓存或构建产物。
- 不得自动调用付费模型或启动 AI 评价。
- 每个 PR 必须更新能力矩阵和本台账。
- 远端 `main` 变化或门禁失败时禁止强推和自动合并。
