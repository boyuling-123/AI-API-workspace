# 测评平台 v5.0 能力矩阵

> 审计日期：2026-08-26
> 需求来源：[`docs/prd/v5.0/测评平台v5.0-待补充功能清单.md`](../prd/v5.0/测评平台v5.0-待补充功能清单.md)
> 审计口径：前十章 75 条主能力逐项核对；实施顺序与验收标准不重复计数。

## 状态定义

| 状态 | 判定标准 |
|---|---|
| 未规划 | 尚无明确方案、排期或负责人。 |
| 设计中 | 已有需求或方案，但没有可运行实现。 |
| Demo | 可以演示，但依赖 Mock、内存存储、临时流程或仅覆盖 Happy Path。 |
| 部分实现 | 已有真实代码，但部分验收条件或异常路径未完成。 |
| 已实现 | 功能代码和主要异常路径已完成，自动化验证证据仍可能不完整。 |
| 已验证 | 代码证据、真实源文件测试、验收条件、CI 与截图或 Trace 全部通过。 |

## 使用规则

- 每条能力必须保留代码证据、测试证据和验收条件。
- 只有测试直接覆盖真实源文件和真实用户路径时，才算有效测试证据。
- 未提交的本地操作、口头说明和设计稿不能作为“已实现”证据。
- 状态变更必须在对应 Pull Request 中同步更新本矩阵。

## 逐项矩阵

| ID | 能力项 | 当前状态 | 代码证据 | 测试证据 | 达成“已验证”的验收条件 | 计划主题 | Issue/PR |
|---|---|---|---|---|---|---|---|
| DOC-001 | 文档统一使用六种能力状态 | 已实现 | 本矩阵“状态定义” | 待补：文档状态枚举检查 | 所有当前 PRD 只使用六种状态且无自由文本状态 | PR 01 | [#9](https://github.com/boyuling-123/AI-API-workspace/pull/9) |
| DOC-002 | OpenJudge 维度生成不得标为已实现 | 已实现 | `src/services/genDimensionsService.ts`；本矩阵 DIM-001 | 待补：文档口径检查 | 页面和当前 PRD 均明确 OpenJudge 尚未接入 | PR 01 | [#9](https://github.com/boyuling-123/AI-API-workspace/pull/9) |
| DOC-003 | 明确当前维度生成只使用需求和内部预设 | 已实现 | `src/services/genDimensionsService.ts` | 待补：服务单测 | 文档与请求结构准确描述当前输入，不声称使用样本或人工标注 | PR 01 | [#9](https://github.com/boyuling-123/AI-API-workspace/pull/9) |
| DOC-004 | 七个 Skill、MCP、Judge 校准和排行榜使用真实状态 | 已实现 | 本矩阵相关条目 | 待补：文档口径检查 | 所有未落地能力均为设计中、Demo 或部分实现 | PR 01 | [#9](https://github.com/boyuling-123/AI-API-workspace/pull/9) |
| DOC-005 | 统一多人标注一致性口径 | 设计中 | 无 | 无 | 明确是否支持多人标注，并提供一致性指标与测试 | Judge 校准 | 待关联 |
| DOC-006 | 区分产品方案、Demo 与当前代码 | 已验证 | 本矩阵；`ExternalApiCapabilities.tsx` | `tests/e2e/workspace.spec.ts` 覆盖四个规划路由状态、无 API 调用与 WCAG；PR #11 两道 CI 通过 | 页面和当前 PRD 不再把规划路由显示为可调用接口 | PR 01 / 02B | [#9](https://github.com/boyuling-123/AI-API-workspace/pull/9)；[#11](https://github.com/boyuling-123/AI-API-workspace/pull/11) |
| DIM-001 | 建立 evaluation-dimension-generator Skill 并接入 OpenJudge | 设计中 | 无 | 无 | Skill 可独立运行并通过 OpenJudge 产出结构化候选维度 | 维度 Skill | 待关联 |
| DIM-002 | 输入评测目标、业务场景和任务类型 | Demo | `EvaluationPanel.tsx`；`genDimensionsService.ts` | 无直接源文件测试 | 三类输入字段均有明确 Schema、校验和 UI 引导 | 维度 Skill | 待关联 |
| DIM-003 | 从测试集或跑批结果抽取代表性样本 | 设计中 | 无 | 无 | 可配置抽样策略并预览被选样本，结果可复现 | 维度 Skill | 待关联 |
| DIM-004 | 维度生成支持标准答案、硬规则、Bad Case 和人工结果 | 部分实现 | `EvaluationPanel.tsx` 支持标准答案评价，但未传给维度生成 | 无 | 所有输入类型进入生成 Schema，并影响生成结果 | 维度 Skill | 待关联 |
| DIM-005 | 无人工标注时使用 Simple Rubrics Generator | 设计中 | 无 | 无 | 无标注数据集可生成符合 Schema 的候选 Rubrics | 维度 Skill | 待关联 |
| DIM-006 | 有人工评分或排序时使用 Iterative Rubrics Generator | 设计中 | 无 | 无 | 人工信号可驱动迭代并展示前后差异 | 维度 Skill | 待关联 |
| DIM-007 | 维度字段标准化、同义合并、重复与冲突检测 | 部分实现 | `EvaluationPanel.tsx` 仅按名称精确去重 | 无 | 同义、重复、反向冲突均能检测并给出处理建议 | 维度 Skill | 待关联 |
| DIM-008 | 校验维度定义、评分分级、证据和可执行条件 | 设计中 | 当前 `EvalDimension` 仅有 name/desc | 无 | 缺任一 Rubric 字段时不能发布 Evaluator | Evaluator 生命周期 | 待关联 |
| DIM-009 | 用户增删改确认维度并设置权重和一票否决 | 部分实现 | `EvaluationPanel.tsx` 支持勾选、增删改 | 无直接组件测试 | 权重校验通过、否决规则可配置、最终需人工确认 | Evaluator 生命周期 | 待关联 |
| DIM-010 | 将维度保存为版本化 Evaluator 并生成 Judge Prompt | 设计中 | 无 Evaluator 实体 | 无 | 可保存、查询和复用不可变 Evaluator 版本 | Evaluator 生命周期 | 待关联 |
| PROMPT-001 | 按维度、评分标准、证据和权重生成 Judge Prompt | 部分实现 | `evalPromptService.ts` 使用维度和说明 | 无 | Prompt 完整包含 Rubric、证据要求、权重和输出 Schema | Evaluator 生命周期 | 待关联 |
| PROMPT-002 | 支持用户手动修改 Judge Prompt | 已实现 | `EvaluationPanel.tsx` 的 Prompt 编辑区 | 待补：Playwright 编辑测试 | 修改内容可保存且不会被意外覆盖 | Evaluator 生命周期 | 待关联 |
| PROMPT-003 | 使用少量样本试跑并预览评分 | Demo | 可通过选中范围发起评价，无专用试跑版本 | 无 | 专用试跑不写正式记录，展示评分与解析错误 | Evaluator 生命周期 | 待关联 |
| PROMPT-004 | 保存 Prompt 版本、修改人、时间和适用任务 | 部分实现 | `EvaluationRecord` 保存 Prompt、时间和来源任务 | 无 | 版本号、修改人、变更说明和适用范围全部持久化 | Evaluator 生命周期 | 待关联 |
| PROMPT-005 | 新旧 Prompt 版本 Diff | 设计中 | 无 | 无 | 支持结构化与文本 Diff，并标识影响范围 | Evaluator 生命周期 | 待关联 |
| PROMPT-006 | 恢复历史 Prompt 版本 | 设计中 | 无 | 无 | 可从历史版本创建新版本且不篡改旧记录 | Evaluator 生命周期 | 待关联 |
| PROMPT-007 | Prompt 或维度变化后重新校准 Judge | 设计中 | 无校准流程 | 无 | 变更触发黄金集校准，失败时阻止发布 | Judge 校准 | 待关联 |
| PROMPT-008 | 复用模型输出，仅重新执行评价 | 已实现 | `HistoryPanel.tsx`；`WorkspaceBody.tsx`；`EvaluationPanel.tsx` | 待补：重评 E2E | 同一 Task 可生成多条独立评价记录且不再次调用被测模型 | Evaluator 生命周期 | 待关联 |
| JUDGE-001 | Judge 候选池记录厂商、模型、模态、上下文、成本和时延 | 部分实现 | `TargetConfig` 有名称、模态、状态，缺其余元数据 | 无 | 所有元数据可维护、筛选并进入评价快照 | Judge 校准 | 待关联 |
| JUDGE-002 | 按文本、图片、代码等任务筛选 Judge | 部分实现 | `WorkspaceBody.tsx` 按文本/多模态筛选 | 无 | 各任务类型只能选择兼容 Judge，并解释禁用原因 | Judge 校准 | 待关联 |
| JUDGE-003 | 建立人工标注黄金测试集 | 设计中 | 无 | 无 | 黄金集可导入、版本化并锁定人工标签 | Judge 校准 | 待关联 |
| JUDGE-004 | 计算 Judge 与人工判断的一致性、准确率和漏判 | 设计中 | 无 | 无 | 输出明确统计指标和样本下钻 | Judge 校准 | 待关联 |
| JUDGE-005 | 支持单 Judge、多 Judge 和分歧仲裁 | Demo | 当前仅支持单 Judge | 无 | 多 Judge 独立执行，分歧按可配置策略仲裁 | Judge 校准 | 待关联 |
| JUDGE-006 | 高风险与高频分歧 Case 可人工复核 | 设计中 | 无 | 无 | 风险规则可解释，Case 可领取、复核和留痕 | 报告复核 | 待关联 |
| JUDGE-007 | Judge、维度或 Prompt 变化后重跑黄金集 | 设计中 | 无 | 无 | 变更自动创建校准任务并保留前后结果 | Judge 校准 | 待关联 |
| JUDGE-008 | 校准失败时禁止发布 Evaluator | 设计中 | 无发布门禁 | 无 | 未达到阈值的版本无法成为 Active | Judge 校准 | 待关联 |
| POOL-001 | 建立模型、算法、Judge 统一资源池 | 部分实现 | `TargetConfig` 统一模型/算法，Judge 复用 Target | 无 | 资源角色、版本和能力均由统一实体表达 | 资源池 | 待关联 |
| POOL-002 | 记录文本、图片、文生图、编辑、视频和业务算法能力 | 部分实现 | `ContentKind` 仅 text/multimodal/image | 无 | 能力枚举覆盖需求并支持扩展 | 资源池 | 待关联 |
| POOL-003 | 记录输入输出模态和参数范围 | 部分实现 | `contentKind`；`inputParams` | 无 | 输入输出 Schema、范围和默认值均可校验 | 资源池 | 待关联 |
| POOL-004 | 记录接口来源、版本、别名和有效状态 | 部分实现 | `TargetConfig.source/status/apiKeyRef` | 无 | 来源、版本、别名、健康状态均可查询 | 资源池 | 待关联 |
| POOL-005 | 记录历史主题、维度表现、耗时、成本和失败率 | 部分实现 | Task/Evaluation 有结果与耗时，缺聚合成本指标 | 无 | 资源详情可展示全部历史指标与数据口径 | 资源池 | 待关联 |
| POOL-006 | Agent 按任务要求筛选候选资源 | 设计中 | 无 | 无 | Agent 只收到过滤后的候选集并说明筛选依据 | 资源池 | 待关联 |
| POOL-007 | 主榜、专项候选和别名分层管理 | 设计中 | 无 | 无 | 三层资源可配置、查询并用于报告 | 资源池 | 待关联 |
| TASK-001 | Case × 模型拆成独立子任务且失败隔离 | 已验证 | `runService.ts`；`taskRunner.ts` | `tests/unit/taskRunner.test.ts`；`tests/stress/taskRunner.stress.test.ts` 直接导入真实源码；PR #10 CI 通过 | 单项失败不阻塞其他项且结果状态准确 | 任务引擎 | [#10](https://github.com/boyuling-123/AI-API-workspace/pull/10) |
| TASK-002 | 配置并发数和 QPS | 已验证 | `RunPanel.tsx` 配置并发/QPS；`rateLimiter.ts` 平滑限制所有真实请求启动；`runService.ts` 让首次与重试共享限速器 | `rateLimiter.test.ts`；`runService.test.ts` 以假时钟验证 2 QPS 的启动时间为 0/500/1000ms；38 项单测、2 项压力测试、10 项 E2E 与 PR #14 两道 CI 通过 | 并发和 QPS 均可配置并被调度器严格执行 | 任务控制 | [#10](https://github.com/boyuling-123/AI-API-workspace/pull/10)；[#14](https://github.com/boyuling-123/AI-API-workspace/pull/14) |
| TASK-003 | 分批提交、执行并逐批落库 | 已验证 | `batchCheckpoint.ts`；`useTaskRunner.ts` 每 10 个完成项更新同一 Task；`useProject.ts` 有序立即写入 | `batchCheckpoint.test.ts`；`batch-resume.spec.ts` 验证中途落库和刷新可见；PR #13 两道 CI 通过 | 大任务按批持久化，刷新后可见已完成批次 | 任务引擎 | [#13](https://github.com/boyuling-123/AI-API-workspace/pull/13) |
| TASK-004 | 保存检查点并支持中断续跑 | 已验证 | `Task.checkpoint`；`runService.ts` 跳过终态单元；`RunPanel.tsx` 提供恢复入口 | `runService.test.ts` 直接覆盖真实服务；`batch-resume.spec.ts` 验证刷新后续跑且前三项不重复；PR #13 两道 CI 通过 | 刷新或进程中断后从最后一致检查点继续 | 任务引擎 | [#13](https://github.com/boyuling-123/AI-API-workspace/pull/13) |
| TASK-005 | 仅重跑失败项、指定 Case、新模型或新维度 | 已实现 | `rerunPlan.ts`、`batchCheckpoint.ts`、`runService.ts`、`RerunDialog.tsx` 支持三类稀疏模型调用；`newDimensionEvaluation.ts`、`EvaluationPanel.tsx` 与 `EvalHistoryPanel.tsx` 支持评价血缘、旧维度去重、锁定来源样本、精确 Judge 预览和独立增量记录 | `rerunPlan.test.ts` 与 `newDimensionEvaluation.test.ts` 直接覆盖真实源码；`selective-rerun.spec.ts` 与 `new-dimension-evaluation.spec.ts` 以 Mock 验证四类精确请求、确认前零调用、历史复用、来源追溯与 WCAG；本地 quality 和 14 项 E2E 通过，待 PR #17 CI | 四种重跑范围均可预览、确认和追溯 | 任务控制 | [#15](https://github.com/boyuling-123/AI-API-workspace/pull/15)；[#16](https://github.com/boyuling-123/AI-API-workspace/pull/16)；[#17](https://github.com/boyuling-123/AI-API-workspace/pull/17) |
| TASK-006 | 单任务超时和有限自动重试 | 已验证 | `Task.runPolicy` 固化超时/重试快照；`runService.ts` 每次尝试独立 Abort 并指数退避；`RunPanel.tsx` 上限配置；续跑沿用原策略 | `runService.test.ts` 覆盖真实 Abort、429 后成功、503 严格封顶和非重试错误；`run-controls.spec.ts` 覆盖策略持久化；PR #14 两道 CI 通过 | 超时与重试策略随任务固化，且次数上限被严格执行 | 任务控制 | [#14](https://github.com/boyuling-123/AI-API-workspace/pull/14) |
| TASK-007 | 超限后记录明确失败类型且不无限重试 | 已验证 | `runError.ts` 八类错误；`ResultItem` 保存类型/次数/HTTP；历史结果可筛选并导出；失败项定向重跑由 TASK-005 单独验收 | route/adapter/runService 真实源码单测；E2E 验证 401 配置重试 3 次仍只调用 1 次并可按鉴权失败筛选；PR #14 两道 CI 通过 | 超时、限流、鉴权、解析等错误可区分；达到上限后不再发起请求 | 任务控制 | [#14](https://github.com/boyuling-123/AI-API-workspace/pull/14) |
| TASK-008 | 任务暂停、继续和人工终止 | 已验证 | `useTaskRunner.ts` 分离 pause/cancel/resume；`RunPanel.tsx` 提供暂停、继续、终止和放弃入口 | `batch-resume.spec.ts` Mock 验证暂停、刷新继续、终止不留恢复任务；21 项单测、8 项 E2E 与 PR #13 两道 CI 通过 | 暂停不启动新子任务，继续不重复已完成项 | 任务控制 | [#13](https://github.com/boyuling-123/AI-API-workspace/pull/13) |
| TASK-009 | 预算预估、预算上限和超限暂停 | Demo | `CostConfirmDialog.tsx` 仅估算生图调用 | 无 | 所有计费目标可预估，达到上限自动暂停 | 任务控制 | 待关联 |
| TASK-010 | 完成、失败率和预算异常通知 | 设计中 | 无 | 无 | 可配置通知规则、渠道且具备去重机制 | 任务控制 | 待关联 |
| IMG-001 | 原始图片统一保存且不被 Judge 覆盖 | 已实现 | `imageCompress.ts` 返回副本；Task 保留原图 | 待补：图片不变性单测 | 评价前后原图哈希和展示地址不变 | 图片资产 | 待关联 |
| IMG-002 | 仅提交 Judge 时生成压缩副本 | 已实现 | `compressImagesForJudge`；`evaluateClient.ts` | 待补：压缩边界单测 | 仅 Judge 请求使用副本，失败时有明确策略 | 图片资产 | 待关联 |
| IMG-003 | 结果、历史和报告继续展示原图 | 部分实现 | 结果和历史展示原图，HTML 报告缺失 | 无 | 三个入口都展示原图并支持下载或放大 | 图片资产 | 待关联 |
| IMG-004 | 记录原图与压缩副本映射 | 设计中 | 无 | 无 | 每次评价可追溯原图、派生副本和使用场景 | 图片资产 | 待关联 |
| IMG-005 | 保存图片处理参数 | 设计中 | 参数仅硬编码于 `imageCompress.ts` | 无 | 尺寸、格式、质量和处理版本进入评价快照 | 图片资产 | 待关联 |
| REPORT-001 | 输出综合排行榜和单维度排行榜 | 设计中 | 无排行榜 | 无 | 排名口径可解释并可下钻原始分数 | 报告复核 | 待关联 |
| REPORT-002 | 勾选关注维度后动态重新排名 | 设计中 | 无 | 无 | 维度选择即时更新排名且不篡改原始结果 | 报告复核 | 待关联 |
| REPORT-003 | 查看模型、Case、维度评分和理由 | 已实现 | `EvalHistoryPanel.tsx` 详情表 | 待补：历史详情 E2E | 任一评分均能下钻到输入、输出、维度和理由 | 报告复核 | 待关联 |
| REPORT-004 | 查看 Judge 引用证据 | 设计中 | 评价结果 Schema 无 evidence | 无 | 每条结论包含可定位到输入或输出的证据 | 报告复核 | 待关联 |
| REPORT-005 | 筛选低分、分歧、高风险和失败 Case | 设计中 | 无 | 无 | 四类筛选可组合、清除并导出 | 报告复核 | 待关联 |
| REPORT-006 | 人工修改评分、标记 Bad Case 和补充意见 | 设计中 | 无 | 无 | 人工覆盖保留原 AI 分数、修改人和理由 | 报告复核 | 待关联 |
| REPORT-007 | 输出含原始结果、配置与版本的 HTML 报告 | 设计中 | 当前仅 Excel 导出 | 无 | 离线 HTML 可复现结果并包含完整版本快照 | 报告复核 | 待关联 |
| CLI-001 | 工作台内嵌终端或提供终端联动入口 | 设计中 | 无 | 无 | 用户可明确进入受控终端会话并退出 | CLI Agent | 待关联 |
| CLI-002 | 连接 Claude Code、Codex 等本地 CLI Agent | Demo | 外部导入 Skill 与 `/api/import-evaluation-workspace` 可联动，平台内未连接 CLI | 无 | 平台可建立、显示和结束本地 CLI 会话 | CLI Agent | 待关联 |
| CLI-003 | 选择并编辑 CLAUDE.md、AGENTS.md | 设计中 | 无 | 无 | 文件选择受工作区限制，修改前后有 Diff | CLI Agent | 待关联 |
| CLI-004 | 预览最终 System Prompt 和上下文来源 | 设计中 | 无 | 无 | 展示合并顺序、来源、截断和最终文本 | CLI Agent | 待关联 |
| CLI-005 | 向 CLI Agent 传递测试集、模型、规则和结果 | Demo | 导入 Skill 可把外部数据送入平台，反向交接未实现 | `tests/e2e/workspace.spec.ts` 验证仅含引用的深链进入批量模式且不自动评价；PR #11 CI 通过 | 四类上下文可按引用传递且不把大数据塞 URL | CLI Agent | [#11](https://github.com/boyuling-123/AI-API-workspace/pull/11) |
| CLI-006 | CLI Agent 修改文件前展示 Diff 并由用户确认 | 设计中 | 无 | 无 | 未确认时文件不变，确认记录进入审计日志 | CLI Agent | 待关联 |
| CLI-007 | 记录 Agent 日志、文件变更和运行结果 | Demo | `agentConnectService.ts` 有接入 Agent SSE 日志，非 CLI 文件日志 | 无 | 会话日志、工具调用、Diff 和结果可统一回看 | CLI Agent | 待关联 |
| CLI-008 | 明确终端权限、工作目录和文件范围 | 设计中 | 脚本执行器有局部边界，CLI 会话边界缺失 | 无 | 每次会话展示并强制执行权限与目录白名单 | CLI Agent | 待关联 |
| SEC-001 | API Key 仅由服务端读取和注入 | 已实现 | `getApiKey.ts`；服务端 adapters | 待补：客户端包密钥引用扫描 | 浏览器网络与状态中不存在 Key 真值 | 安全审计 | 待关联 |
| SEC-002 | Key 不进入前端、缓存、导出和日志 | 部分实现 | 前端只保存 apiKeyRef；`redactSensitive.ts` 与 `runScriptService.ts` 在服务边界脱敏脚本输出和错误 | `runScriptRedaction.test.ts` 真实执行成功、失败脚本并验证注入 Key 不返回；PR #12 两道 CI 通过 | 日志、IndexedDB、导出、Trace 和错误均通过泄漏测试 | 安全审计 | [#12](https://github.com/boyuling-123/AI-API-workspace/pull/12) |
| SEC-003 | Skill、Prompt 和报告不保存真实 Key | 部分实现 | Schema 使用 keyRef；`scanSecrets.mjs` 扫描仓库产物；Agent Prompt、参数摘要和工具反馈统一脱敏 | `secretScan.test.ts` 与 `redactSensitive.test.ts` 覆盖仓库扫描、已知 Secret、字段赋值和常见 Token；PR #10 与 #12 CI 通过 | 所有生成物通过 Secret Scan，且有回归用例 | 安全审计 | [#10](https://github.com/boyuling-123/AI-API-workspace/pull/10)；[#12](https://github.com/boyuling-123/AI-API-workspace/pull/12) |
| SEC-004 | 敏感参数脱敏展示 | 部分实现 | `redactSensitive.ts` 提供统一 masker，已接入服务端日志与 Agent 展示边界 | `redactSensitive.test.ts` 覆盖已知 Secret、敏感字段、Bearer、常见 Token 与普通文本保真；PR #12 两道 CI 通过 | UI、日志和导出按字段策略脱敏且可审计 | 安全审计 | [#12](https://github.com/boyuling-123/AI-API-workspace/pull/12) |
| SEC-005 | 区分查看、运行、配置修改和发布权限 | 设计中 | 当前本地单用户无权限模型 | 无 | 四类权限可配置并由服务端强制校验 | 安全审计 | 待关联 |
| SEC-006 | 记录配置、Prompt、Evaluator 和任务审计日志 | 设计中 | 无统一审计日志 | 无 | 关键操作含操作者、时间、前后值和关联对象 | 安全审计 | 待关联 |

## 当前审计结论

- TASK-001 已满足代码证据、真实源码测试、异常路径、压力测试、干净环境复验和 PR #10 CI Trace，状态为“已验证”。
- DOC-006 已满足真实页面状态断言、Mock 防误调用、WCAG 扫描、干净环境复验和 PR #11 CI Trace，状态为“已验证”。
- TASK-003、TASK-004 和 TASK-008 已具备代码、真实源码单测、Mock 浏览器恢复路径、视觉截图、干净环境与 PR #13 GitHub CI Trace，状态为“已验证”。
- TASK-002、TASK-006 和 TASK-007 已具备代码、异常路径、真实源码测试、Mock 浏览器路径、视觉截图、干净环境和 PR #14 GitHub CI Trace，状态为“已验证”。
- TASK-005 已通过 PR #15 完成失败项和指定 Case，PR #16 完成新增模型或算法，PR 03E 已在本地完成新增评价维度的预览、确认、零被测模型调用与来源追溯；GitHub CI 通过前保持“已实现”。
- SEC-002/003/004 尚缺 IndexedDB、导出、Trace 和完整 UI 泄漏测试，继续保持“部分实现”。
- 已实现能力仍需补齐自动化测试、CI 与截图或 Trace，之后才能升级为“已验证”。
- 四个不存在的规划 API 必须持续显示为“设计中”或“Demo”，直至对应 route、契约测试和文档全部完成。
