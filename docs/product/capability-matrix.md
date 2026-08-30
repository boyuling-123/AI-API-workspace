# 测评平台 v5.0 能力矩阵

> 审计日期：2026-08-30
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
| DOC-003 | 准确说明维度生成上下文与 OpenJudge 状态 | 已验证 | `EvaluationPanel.tsx` 明示 Simple Rubrics、人工反馈一次生成、OpenJudge 与 Iterative Rubrics Generator 的真实状态；`dimensionGeneration.ts`、`dimensionHumanFeedback.ts` 与 `genDimensionsService.ts` 使用完整受控上下文 | `dimensionGeneration.test.ts` 覆盖真实请求、模式、Prompt、边界与脱敏；三条维度上下文 E2E 覆盖页面口径、Mock 精确请求与零自动评价；PR #18、#19、#20、#21 两道 CI 通过 | 文档、页面、Schema 与真实模型输入一致；准确区分当前 Simple/人工反馈一次生成、未接入的 OpenJudge 和未实现的 Iterative | PR 01 / 04A / 04B / 04C / 04D | [#9](https://github.com/boyuling-123/AI-API-workspace/pull/9)；[#18](https://github.com/boyuling-123/AI-API-workspace/pull/18)；[#19](https://github.com/boyuling-123/AI-API-workspace/pull/19)；[#20](https://github.com/boyuling-123/AI-API-workspace/pull/20)；[#21](https://github.com/boyuling-123/AI-API-workspace/pull/21) |
| DOC-004 | 七个 Skill、MCP、Judge 校准和排行榜使用真实状态 | 已实现 | 本矩阵相关条目 | 待补：文档口径检查 | 所有未落地能力均为设计中、Demo 或部分实现 | PR 01 | [#9](https://github.com/boyuling-123/AI-API-workspace/pull/9) |
| DOC-005 | 统一多人标注一致性口径 | 设计中 | 无 | 无 | 明确是否支持多人标注，并提供一致性指标与测试 | Judge 校准 | 待关联 |
| DOC-006 | 区分产品方案、Demo 与当前代码 | 已验证 | 本矩阵；`ExternalApiCapabilities.tsx` | `tests/e2e/workspace.spec.ts` 覆盖四个规划路由状态、无 API 调用与 WCAG；PR #11 两道 CI 通过 | 页面和当前 PRD 不再把规划路由显示为可调用接口 | PR 01 / 02B | [#9](https://github.com/boyuling-123/AI-API-workspace/pull/9)；[#11](https://github.com/boyuling-123/AI-API-workspace/pull/11) |
| DIM-001 | 建立 evaluation-dimension-generator Skill 并接入 OpenJudge | 设计中 | 无 | 无 | Skill 可独立运行并通过 OpenJudge 产出结构化候选维度 | 维度 Skill | 待关联 |
| DIM-002 | 输入评测目标、业务场景和任务类型 | 已验证 | `EvaluationPanel.tsx` 三类引导字段；`dimensionGeneration.ts` 结构化 Schema；`genDimensionsService.ts` 构造完整 Prompt | `dimensionGeneration.test.ts` 验证 Schema、边界与 Prompt；`genDimensionsRoute.test.ts` 验证调用前拒绝非法请求；`dimension-generation.spec.ts` 验证真实用户输入；独立干净环境与 PR #18 两道 CI 通过 | 三类字段均有 UI 引导、前后端校验、真实源码测试、Mock 用户路径、视觉证据与 CI | 维度 Skill | [#18](https://github.com/boyuling-123/AI-API-workspace/pull/18) |
| DIM-003 | 从测试集或跑批结果抽取代表性样本 | 已验证 | `dimensionGeneration.ts` 提供三种确定性策略、有界样本构造和数据最小化；`EvaluationPanel.tsx` 提供数量、策略与发送预览 | `dimensionGeneration.test.ts` 验证首中尾顺序、失败/答案优先、截断与脱敏；`dimension-generation.spec.ts` 验证 5 Case 预览、精确请求、零自动评价与 WCAG；独立干净环境与 PR #18 两道 CI 通过 | 抽样策略可配置、结果可复现、用户发送前可见，敏感原始内容不进入请求，并通过干净环境与 CI | 维度 Skill | [#18](https://github.com/boyuling-123/AI-API-workspace/pull/18) |
| DIM-004 | 维度生成支持标准答案、硬规则、Bad Case 和人工结果 | 已验证 | `dimensionGeneration.ts`、`dimensionHumanFeedback.ts`、`EvaluationPanel.tsx` 与 `genDimensionsService.ts` 已接入标准答案、最多 20 条硬规则、显式 Bad Case、`0–10` 人工评分和完整 `1..N` 偏好排序，并执行双层脱敏 | `dimensionHumanFeedback.test.ts`、`dimensionGeneration.test.ts` 与 `genDimensionsRoute.test.ts` 覆盖反馈 Schema、规范化、Prompt 和非法请求零模型调用；`dimension-rules.spec.ts` 与 `dimension-human-feedback.spec.ts` 以 Mock 覆盖阻断、精确目标绑定、零自动评价与 WCAG；本地、独立干净工作树与 PR #20 两道 CI 全部通过 | 标准答案、硬规则、Bad Case、人工评分和排序全部进入生成 Schema，并通过独立干净环境与 GitHub CI 证明边界和真实用户路径 | 维度 Skill | [#19](https://github.com/boyuling-123/AI-API-workspace/pull/19)；[#20](https://github.com/boyuling-123/AI-API-workspace/pull/20) |
| DIM-005 | 无人工标注时使用 Simple Rubrics Generator | 已验证 | `genDimensionsService.ts` 显式选择 Simple 模式并要求 4–8 条完整 Rubric；`EvaluationPanel.tsx` 展示模式、候选完整性和人工确认入口 | `genDimensionsService.test.ts`、`dimensionGeneration.test.ts` 与 `structured-rubrics.spec.ts` 覆盖完整生成、旧格式拒绝、页面模式、缺失锚点阻断、精确 Prompt 请求和零自动评价；本地、独立干净工作树与 PR #21 两道 CI 全部通过 | 无标注数据集可生成符合 Schema 的候选 Rubrics，且用户确认前不生成 Prompt 或启动 Judge | 维度 Skill | [#21](https://github.com/boyuling-123/AI-API-workspace/pull/21) |
| DIM-006 | 有人工评分或排序时使用 Iterative Rubrics Generator | 设计中 | 当前 `genDimensionsService.ts` 仅将人工反馈传给通用模型做一次候选生成，页面明确不等同于 Iterative Rubrics Generator | `dimension-human-feedback.spec.ts` 验证未接入口径、显式生成和零自动评价；尚无多轮迭代测试 | 人工信号可驱动多轮候选更新，并展示迭代前后差异和收敛条件 | 维度 Skill | 待关联 |
| DIM-007 | 维度字段标准化、同义合并、重复与冲突检测 | 部分实现 | `newDimensionEvaluation.ts` 按大小写与连续空白归一化并覆盖评价血缘去重；尚无同义和反向冲突检测 | `newDimensionEvaluation.test.ts` 覆盖归一化重复与血缘汇总；PR #17 CI 通过 | 同义、重复、反向冲突均能检测并给出处理建议 | 维度 Skill | [#17](https://github.com/boyuling-123/AI-API-workspace/pull/17) |
| DIM-008 | 校验维度定义、评分分级、证据和可执行条件 | 已验证 | `evaluationRubric.ts` 定义统一 Schema、规范化和边界；`EvaluationPanel.tsx` 提供逐字段编辑与门禁；Prompt 和 Judge API 在模型调用前复验 | `evaluationRubric.test.ts`、`rubricRouteBoundary.test.ts`、`rubricPromptServices.test.ts`、`newDimensionEvaluation.test.ts` 与 `structured-rubrics.spec.ts` 覆盖完整/缺失/重复/脱敏/旧记录/路由零调用/WCAG；本地、独立干净工作树与 PR #21 两道 CI 全部通过 | 缺任一 Rubric 字段时不能生成 Judge Prompt 或执行新评价；旧历史仍可读取 | Evaluator 生命周期 | [#21](https://github.com/boyuling-123/AI-API-workspace/pull/21) |
| DIM-009 | 用户增删改确认维度并设置权重和一票否决 | 已验证 | `evaluatorPolicy.ts` 统一校验百分比与阈值并确定性计算策略结果；`EvaluationPanel.tsx` 支持编辑、平均分配、策略指纹确认及修改后失效；结果、历史与 Excel 保存加权分和否决原因 | `evaluatorPolicy.test.ts` 覆盖精确分配、边界、指纹、加权和否决；`rubricRouteBoundary.test.ts` 覆盖非法策略零模型调用；`evaluator-policy.spec.ts` 覆盖真实用户确认、失效、精确请求、历史结果与 WCAG；本地、独立干净工作树与 PR #22 workflow run `33246361526` 两道 CI 全部通过 | 权重校验通过、否决规则可配置、最终需人工确认 | Evaluator 生命周期 | [#22](https://github.com/boyuling-123/AI-API-workspace/pull/22) |
| DIM-010 | 将维度保存为版本化 Evaluator 并生成 Judge Prompt | 已验证 | `EvaluatorVersion` 项目实体；`evaluatorVersion.ts` 负责追加版本、双指纹、深拷贝与完整性校验；`EvaluationPanel.tsx` 支持保存、查询和加载版本 | `evaluatorVersion.test.ts` 覆盖 v1/v2、旧版不变、草稿识别、非法家族、篡改与脱敏；`evaluator-versioning.spec.ts` 覆盖保存、切换、刷新持久化和版本绑定；本地、独立干净工作树与 PR #23 workflow run `33287622657` 两道 CI 全部通过 | 可保存、查询和复用不可变 Evaluator 版本 | Evaluator 生命周期 | [#23](https://github.com/boyuling-123/AI-API-workspace/pull/23) |
| PROMPT-001 | 按维度、评分标准、证据和权重生成 Judge Prompt | 已验证 | `evalPromptService.ts` 与 `evaluateService.ts` 将完整 Rubric、权重和否决阈值写入 Prompt；Judge 只给独立维度分，`evaluatorPolicy.ts` 负责确定性汇总 | `rubricPromptServices.test.ts` 验证 Prompt 字段和策略计算；`rubricRouteBoundary.test.ts` 验证服务端门禁；`evaluator-policy.spec.ts` 验证确认后精确 Prompt/Judge 请求；本地、独立干净工作树与 PR #22 workflow run `33246361526` 两道 CI 全部通过 | Prompt 完整包含 Rubric、证据要求、权重和输出 Schema | Evaluator 生命周期 | [#22](https://github.com/boyuling-123/AI-API-workspace/pull/22) |
| PROMPT-002 | 支持用户手动修改 Judge Prompt | 已验证 | `EvaluationPanel.tsx` 的 Prompt 编辑区与版本草稿状态；`evaluatorVersion.ts` 只追加新版本 | `evaluator-versioning.spec.ts` 手动修改 v1 Prompt、保存 v2、切回 v1 验证内容未覆盖，并在刷新后再次加载；本地、独立干净工作树与 PR #23 workflow run `33287622657` 两道 CI 全部通过 | 修改内容可保存且不会被意外覆盖 | Evaluator 生命周期 | [#23](https://github.com/boyuling-123/AI-API-workspace/pull/23) |
| PROMPT-003 | 使用少量样本试跑并预览评分 | 已验证 | `evaluationExecutionPlan.ts` 统一限制默认 3 条、最多 5 条的确定性试评范围；`EvaluationPanel.tsx` 提供调用预览、显式确认、当前页结果与不落历史边界；`useEvaluation.ts` 保留逐条解析错误 | `evaluationExecutionPlan.test.ts` 直接覆盖真实执行计划；`evaluation-trial-rerun.spec.ts` 以 Mock 验证 2 条试评、1 条解析失败、历史保持 0、被测模型零重跑和弹窗 WCAG；本地、独立干净工作树与 PR #25 workflow run `33292294441` 两道 CI 全部通过 | 专用试跑不写正式记录，展示评分与解析错误 | Evaluator 生命周期 | [#25](https://github.com/boyuling-123/AI-API-workspace/pull/25) |
| PROMPT-004 | 保存 Prompt 版本、修改人、时间和适用任务 | 已验证 | `EvaluatorVersion` 保存家族/版本、修改人、时间、变更说明、适用任务和完整 Prompt；`EvaluationRecord.evaluatorVersionId` 绑定实际版本；历史列表展示版本 | `evaluatorVersion.test.ts` 验证版本递增和元数据不可变；`evaluator-versioning.spec.ts` 验证 IndexedDB 刷新持久化及评价历史绑定 v2；本地、独立干净工作树与 PR #23 workflow run `33287622657` 两道 CI 全部通过 | 版本号、修改人、变更说明和适用范围全部持久化 | Evaluator 生命周期 | [#23](https://github.com/boyuling-123/AI-API-workspace/pull/23) |
| PROMPT-005 | 新旧 Prompt 版本 Diff | 已验证 | `evaluatorVersionDiff.ts` 确定性输出结构字段、Rubric、逐行 Prompt 与影响范围；`EvaluatorVersionDiffPanel.tsx` 提供基线选择、上下文 Diff 和大文本折叠 | `evaluatorVersionDiff.test.ts` 覆盖结构化/逐行/大 Prompt/跨家族/篡改；`evaluator-version-diff-restore.spec.ts` 覆盖真实页面 Diff 与 WCAG；本地、独立干净工作树与 PR #24 workflow run `33290243949` 两道 CI 全部通过 | 支持结构化与文本 Diff，并标识影响范围 | Evaluator 生命周期 | [#24](https://github.com/boyuling-123/AI-API-workspace/pull/24) |
| PROMPT-006 | 恢复历史 Prompt 版本 | 已验证 | `restoreEvaluatorVersion` 复用不可变创建入口追加 `vN+1`；页面只允许恢复非最新版并展示不会覆盖旧版本或调用 Judge | `evaluatorVersionDiff.test.ts` 验证 v1→v3、旧快照不变、最新版/缺失/篡改阻断；Mock E2E 验证刷新持久化、v1/v2 可回看和 Judge 零调用；本地、独立干净工作树与 PR #24 workflow run `33290243949` 两道 CI 全部通过 | 可从历史版本创建新版本且不篡改旧记录 | Evaluator 生命周期 | [#24](https://github.com/boyuling-123/AI-API-workspace/pull/24) |
| PROMPT-007 | Prompt 或维度变化后重新校准 Judge | 设计中 | 无校准流程 | 无 | 变更触发黄金集校准，失败时阻止发布 | Judge 校准 | 待关联 |
| PROMPT-008 | 复用模型输出，仅重新执行评价 | 已验证 | `HistoryPanel.tsx` 明示复用输出入口；`evaluationExecutionPlan.ts` 固定被测目标调用为 0；`WorkspaceBody.tsx` 与 `EvaluationPanel.tsx` 复用同一 Task 输出并为每轮正式评价追加独立记录 | `evaluation-trial-rerun.spec.ts` 验证首次跑批后两轮正式评价只调用 `/api/evaluate`、被测模型调用数不增加，并形成 2 条独立历史；本地、独立干净工作树与 PR #25 workflow run `33292294441` 两道 CI 全部通过 | 同一 Task 可生成多条独立评价记录且不再次调用被测模型 | Evaluator 生命周期 | [#25](https://github.com/boyuling-123/AI-API-workspace/pull/25) |
| JUDGE-001 | Judge 候选池记录厂商、模型、模态、上下文、成本和时延 | 部分实现 | `TargetConfig` 有名称、模态、状态，缺其余元数据 | 无 | 所有元数据可维护、筛选并进入评价快照 | Judge 校准 | 待关联 |
| JUDGE-002 | 按文本、图片、代码等任务筛选 Judge | 部分实现 | `WorkspaceBody.tsx` 按文本/多模态筛选 | 无 | 各任务类型只能选择兼容 Judge，并解释禁用原因 | Judge 校准 | 待关联 |
| JUDGE-003 | 建立人工标注黄金测试集 | 已验证 | PR #26 的 `goldenDataset.ts`、`goldenDatasetFile.ts` 与可选项目字段提供严格导入、不可变版本和完整性校验；PR #27 的 `GoldenDatasetPanel.tsx` 提供独立校准入口、字段映射、人工核对、锁定版本库与 IndexedDB 持久化 | `goldenDataset.test.ts` 8 项真实源码测试；`golden-dataset.spec.ts` 覆盖坏文件及旁路阻断、映射预览、v1/v2、旧标签不变、刷新持久化、零 API/Judge 调用和 WCAG；本地、独立干净工作树与 PR #27 workflow run `33293740909` 两道 CI 全部通过 | 黄金集可导入、版本化并锁定人工标签 | Judge 校准 | [#26](https://github.com/boyuling-123/AI-API-workspace/pull/26)，[#27](https://github.com/boyuling-123/AI-API-workspace/pull/27) |
| JUDGE-004 | 计算 Judge 与人工判断的一致性、准确率和漏判 | 已实现 | PR #28 的 `judgeCalibrationService.ts`、`/api/judge-calibration` 与 `judgeCalibration.ts` 提供真值隔离和确定性指标；PR 06D 的 `judgeCalibrationClient.ts` 与 `JudgeCalibrationPanel.tsx` 提供确认式受控运行、历史持久化、指标卡、混淆矩阵和分歧/失败下钻 | 13 项指标/服务/路由/客户端真实源码测试；`judge-calibration.spec.ts` 覆盖取消零调用、精确请求、部分失败、刷新持久化、WCAG 与 100 Case 数字确认；本地和独立干净工作树的 quality 与 25 项 Playwright 通过，待 PR 06D CI | 输出明确统计指标和样本下钻 | Judge 校准 | [#28](https://github.com/boyuling-123/AI-API-workspace/pull/28)，PR 06D 待创建 |
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
| TASK-005 | 仅重跑失败项、指定 Case、新模型或新维度 | 已验证 | `rerunPlan.ts`、`batchCheckpoint.ts`、`runService.ts`、`RerunDialog.tsx` 支持三类稀疏模型调用；`newDimensionEvaluation.ts`、`EvaluationPanel.tsx` 与 `EvalHistoryPanel.tsx` 支持评价血缘、旧维度去重、锁定来源样本、精确 Judge 预览和独立增量记录 | `rerunPlan.test.ts` 与 `newDimensionEvaluation.test.ts` 直接覆盖真实源码；`selective-rerun.spec.ts` 与 `new-dimension-evaluation.spec.ts` 以 Mock 验证四类精确请求、确认前零调用、历史复用、来源追溯与 WCAG；本地与干净工作树全门禁通过；PR #15、#16、#17 两道 CI 通过 | 四种重跑范围均可预览、确认和追溯 | 任务控制 | [#15](https://github.com/boyuling-123/AI-API-workspace/pull/15)；[#16](https://github.com/boyuling-123/AI-API-workspace/pull/16)；[#17](https://github.com/boyuling-123/AI-API-workspace/pull/17) |
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
- TASK-005 已通过 PR #15 完成失败项和指定 Case，PR #16 完成新增模型或算法，PR #17 完成新增评价维度；四类路径均具备代码、真实源码测试、Mock 精确请求、视觉证据、干净环境和 GitHub CI Trace，状态为“已验证”。
- DIM-002 与 DIM-003 已具备结构化代码、异常路径、真实源码测试、Mock 精确请求、视觉证据、独立干净环境和 PR #18 GitHub CI Trace，状态为“已验证”。DOC-003 已校准到当前人工反馈上下文，同时明确 OpenJudge 与 Iterative Rubrics Generator 未接入，并通过 PR #20 CI，状态为“已验证”。
- DIM-004 已通过 PR #19 补齐标准答案、硬规则和 Bad Case，并在 PR #20 补齐人工评分与偏好排序；双层脱敏、异常阻断、Mock 精确请求、视觉验收、本地、独立干净环境与 GitHub CI 全部门禁均通过，状态为“已验证”。
- DIM-005 与 DIM-008 已完成结构化 Simple Rubrics、严格 Schema、页面编辑和服务端零调用门禁；真实源码测试、Mock 用户路径、视觉证据、独立干净环境与 PR #21 两道 CI 全部通过，状态为“已验证”。
- DIM-009 与 PROMPT-001 已在 PR #22 完成权重、一票否决、策略确认、Prompt 透传与平台确定性汇总；真实源码测试、Mock 用户路径、视觉证据、独立干净环境与 workflow run `33246361526` 两道 CI 全部通过，状态为“已验证”。
- DIM-010、PROMPT-002 与 PROMPT-004 已在 PR #23 完成不可变 Evaluator/Prompt 版本、元数据、刷新持久化和评价历史绑定；本地、独立干净工作树、视觉证据与 workflow run `33287622657` 两道 CI 全部通过，状态为“已验证”。
- PROMPT-005 与 PROMPT-006 已在 PR #24 完成确定性结构/文本 Diff、影响范围和只追加恢复；代码、异常路径、真实源码测试、Mock 用户路径、视觉证据、独立干净环境与 workflow run `33290243949` 两道 CI 全部通过，状态为“已验证”。
- PROMPT-003 与 PROMPT-008 已在 PR #25 完成少量试评、逐条错误、零历史写入、调用确认和同一 Task 两轮独立重评；真实源码单测、Mock 用户路径、视觉证据、独立干净环境与 workflow run `33292294441` 两道 CI 全部通过，状态为“已验证”。
- JUDGE-003 已由 PR #26 建立黄金集领域基础，并由 PR #27 接入独立页面、人工确认、持久化用户路径与视觉证据；本地、独立干净环境和首轮 GitHub CI 全部门禁通过，状态为“已验证”。
- JUDGE-004 已在 PR #28（PR 06C）完成不泄漏人工标签的单 Case Judge 契约和确定性统计核心，并通过本地、独立干净环境与首轮 GitHub CI，状态为“部分实现”；PR 06D 再接入调用确认、历史持久化与样本下钻。
- JUDGE-004 已在 PR 06D 本地完成确认式运行、100 Case 高费用门禁、历史持久化、指标与分歧下钻，状态为“已实现”；待独立环境和 GitHub CI 后升级为“已验证”。
- DIM-006 仍为“设计中”：当前只把人工反馈作为一次通用候选生成的上下文，没有多轮迭代、差异展示或收敛证据。
- SEC-002/003/004 尚缺 IndexedDB、导出、Trace 和完整 UI 泄漏测试，继续保持“部分实现”。
- 已实现能力仍需补齐自动化测试、CI 与截图或 Trace，之后才能升级为“已验证”。
- 四个不存在的规划 API 必须持续显示为“设计中”或“Demo”，直至对应 route、契约测试和文档全部完成。
