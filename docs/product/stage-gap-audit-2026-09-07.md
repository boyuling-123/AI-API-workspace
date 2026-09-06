# 阶段成果、逐项差距与下一阶段计划

审计节点：N12。代码基线：`5e25d1cb826894e0141628ad0533c839fa1d428b`（PR #53 合并）。需求来源：[最新 PRD 基线](../prd/2026-09/README.md)。本轮只修改文档，不把审计升级成新业务功能。

后续修复记录：N13/P0-A已按本审计发现完成[共享声明校准](../features/F-ACT-001/claims-correction.md)，完整本地门禁及[PR #55](https://github.com/boyuling-123/AI-API-workspace/pull/55)最终CI通过并正常合并；下表保留原审计时点事实，P0-A已解决，不将修复计作新能力。

## 一句话结论

已有可演示的中文本地工作台、历史结果分页、Judge 校准/复核、真实开源观测模块及两项只读 MCP；但新 PRD 的版本化 Run、双向基线回归和完整 Assistant 仍未打通。下一阶段应先统一评判口径和可复现实体，而不是增加更多平台外壳或数据库。

## 数量口径

| 集合 | 核对结果 | 不能据此声称 |
|---|---|---|
| v5.0 旧 75 项 | 42 已验证、6 已实现、8 部分实现、15 设计中、4 Demo；33 未达到已验证 | 不能说剩余 33 项全无代码，更不能作为新 PRD 完成率 |
| 本夜独立增量 9 项 | 8 项在各自限定范围已验证，F-OBS-001 保留 Demo | 不与旧 75 项相加作为新产品完成率 |
| 新 PRD 第 5 章 | 72 行：一期 46、二期 25、明确不做 1 | 有重复与复合条目，不等于 72 个独立能力 |
| 新 PRD 第 6 章 | 指定的 8 个 MCP 名称均未交付；另有 2 个不同名称的已验证只读工具 | 不能说“一期 MCP 已完成 2/8” |
| 新 PRD 第 7 章 | 4 类完整 Assistant 场景尚未端到端交付 | 未测试完整助手成功率，不报 90% 或自治完成率 |
| 本机历史演示 | 117,065 条索引，55,444 个原始 ID，391 个分片，索引字节数 146,806,954 | 原始 ID 数不是去重业务案例数；索引数不是本夜模型产出 |

归档清单声明值与实际索引存在 +1,018 条差异，页面以实际扫描为准并展示差异。这里只读既有索引，不重新评测或改源文件；正文仍需单独确认，未将历史原始数据推到 GitHub。既有检索限制和证据见 [本地历史说明](local-history-demo.md)。

## 可展示的本夜成果

| 能力 | 可用范围 | PR / 最终 head CI |
|---|---|---|
| F-OBS-001 中文 OTel 实验室 | 三组固定模拟策略，真实埋点；Demo | [#45](https://github.com/boyuling-123/AI-API-workspace/pull/45) / [34049163074](https://github.com/boyuling-123/AI-API-workspace/actions/runs/34049163074) |
| F-DATA-001 本地历史演示 | 只读受限归档，50 条分页，来源与差异声明 | [#46](https://github.com/boyuling-123/AI-API-workspace/pull/46) / [34051689031](https://github.com/boyuling-123/AI-API-workspace/actions/runs/34051689031) |
| F-STORE-001 旧项目保护 | 不兼容记录不隐式删除，同 ID 写保护 | [#47](https://github.com/boyuling-123/AI-API-workspace/pull/47) / [34053385100](https://github.com/boyuling-123/AI-API-workspace/actions/runs/34053385100) |
| F-STORE-002 存储边界 | ProjectRepository + 真实 IndexedDB 实现；无后端迁移 | [#48](https://github.com/boyuling-123/AI-API-workspace/pull/48) / [34054851224](https://github.com/boyuling-123/AI-API-workspace/actions/runs/34054851224) |
| F-ACT-001 共享 Action/MCP | 两个只读工具，正式 SDK/stdio；不是助手对话 | [#49](https://github.com/boyuling-123/AI-API-workspace/pull/49) / [34057547216](https://github.com/boyuling-123/AI-API-workspace/actions/runs/34057547216) |
| F-OBS-002 Langfuse 纯逻辑 | 固定上游两份函数 + 中文步骤检查器；未 Fork 整站 | [#50](https://github.com/boyuling-123/AI-API-workspace/pull/50) / [34059043421](https://github.com/boyuling-123/AI-API-workspace/actions/runs/34059043421) |
| F-OBS-003 LangGraph 适配 | 实际 StateGraph 调度/重试，固定 Mock 节点，2 Trace/7 Span | [#51](https://github.com/boyuling-123/AI-API-workspace/pull/51) / [34061117640](https://github.com/boyuling-123/AI-API-workspace/actions/runs/34061117640) |
| F-DEMO-001 中文演示导览 | 五章讲解现有页面与证据，无自动执行 | [#52](https://github.com/boyuling-123/AI-API-workspace/pull/52) / [34062846754](https://github.com/boyuling-123/AI-API-workspace/actions/runs/34062846754) |
| F-OBS-004 观测文件回读 | 仅两种合成观测 JSON，64 KiB/14 步上限，预览确认/取消，强制来源未认证 | [#53](https://github.com/boyuling-123/AI-API-workspace/pull/53) / [34064340036](https://github.com/boyuling-123/AI-API-workspace/actions/runs/34064340036) |

最近一个业务节点 PR #53 的本地记录为 298 unit、2 stress、66 E2E、5 条专项成功 Trace；这些是历史验证数字，不是本次文档审计新执行的结果。所有模型路径为 Mock，没有真实/付费模型质量实验，也没有独立评审者 Approve。PR 是检查最终 CI、远端状态和审查线程后正常合并。

## 证据索引

以下 E 编号用于逐行映射。一个模块有测试，只能证明该模块覆盖的范围，不能把缺失验收也算通过。`无` 表示本代码基线未找到对应实现及专项测试，不代表整个生态没有该功能。

| 编号 | 真实代码/页面 | 测试或验收入口 |
|---|---|---|
| E01 | [核心类型](../../src/types/index.ts)、[BatchInput](../../src/components/input/BatchInput.tsx)、[Excel/JSON 解析](../../src/services/excel.ts) | [旧矩阵](capability-matrix.md)；一般数据集版本、CSV 入口与内容哈希没有完整验收 |
| E02 | [黄金集](../../src/lib/goldenDataset.ts)、[文件映射](../../src/services/goldenDatasetFile.ts) | [真实单测](../../tests/unit/goldenDataset.test.ts)、[浏览器](../../tests/e2e/golden-dataset.spec.ts)、[PR06B证据](../evidence/pr-06b/README.md) |
| E03 | [文档解析](../../src/components/api/ApiDocParser.tsx)、[资源池](../../src/components/resources/ResourcePoolPanel.tsx)、[资源身份](../../src/lib/resourceIdentity.ts) | [资源身份/联通测试证据](../evidence/pr-08b/README.md)；不是全部厂商认证 |
| E04 | [候选维度](../../src/services/genDimensionsService.ts)、[结构化 Rubric](../../src/lib/evaluationRubric.ts) | [PR04D证据](../evidence/pr-04d/README.md)，全部以 Mock 验证流程 |
| E05 | [Evaluator版本](../../src/lib/evaluatorVersion.ts)、[版本Diff](../../src/lib/evaluatorVersionDiff.ts) | [版本源码测试](../../tests/unit/evaluatorVersion.test.ts)、[Diff测试](../../tests/unit/evaluatorVersionDiff.test.ts)、[版本浏览器路径](../../tests/e2e/evaluator-versioning.spec.ts) |
| E06 | [Judge指标](../../src/lib/judgeCalibration.ts)、[发布门禁](../../src/lib/evaluatorRelease.ts)、[多Judge](../../src/lib/multiJudgeCalibration.ts) | [校准证据](../evidence/pr-06d/README.md)、[门禁证据](../evidence/pr-06f/README.md)、[多Judge证据](../evidence/pr-06h/README.md) |
| E07 | [执行策略](../../src/lib/runPolicy.ts)、[检查点](../../src/lib/batchCheckpoint.ts)、[稀疏重跑](../../src/lib/rerunPlan.ts) | [执行策略单测](../../tests/unit/runPolicy.test.ts)、[检查点单测](../../tests/unit/batchCheckpoint.test.ts)、[重跑用户路径](../../tests/e2e/selective-rerun.spec.ts)、[PR03A证据](../evidence/pr-03a/README.md) |
| E08 | [旧加权榜](../../src/lib/evaluationLeaderboard.ts)、[风险筛选](../../src/lib/evaluationCaseFilter.ts) | [PR07B榜单](../evidence/pr-07b/README.md)、[PR07C筛选](../evidence/pr-07c/README.md) |
| E09 | [人工复核](../../src/lib/evaluationReview.ts)、[校准复核](../../src/lib/calibrationReview.ts) | [PR07D通用复核](../evidence/pr-07d/README.md)、[PR07A队列](../evidence/pr-07a/README.md) |
| E10 | [离线报告](../../src/services/evaluationHtmlReport.ts)、[证据显示](../../src/components/evaluation/EvaluationEvidenceList.tsx) | [PR07F离线报告](../evidence/pr-07f/README.md)、[PR07E引用证据](../evidence/pr-07e/README.md) |
| E11 | [固定LangGraph](../../src/langgraph)、[观测检查器](../../src/components/observability/TraceInspector.tsx) | [PR51证据](../evidence/pr-langgraph-observability/README.md)、[PR50源码许可](../evidence/pr-langfuse-trace/README.md) |
| E12 | [平台Action](../../src/lib/platformActions.ts)、[服务端实现](../../src/server/platformActions.ts)、[MCP](../../src/mcp) | [PR49协议与浏览器证据](../evidence/pr-platform-actions/README.md) |
| E13 | [项目契约](../../src/lib/projectRepository.ts)、[IndexedDB适配器](../../src/services/indexedDbProjectRepository.ts) | [PR48证据](../evidence/pr-project-repository/README.md)；草稿库不在此契约内 |
| E14 | [只读归档](../../src/server/localArchiveReader.ts)、[受限回读](../../src/lib/portableAgentExperiment.ts) | [PR46证据](../evidence/pr-local-history-demo/README.md)、[PR53证据](../evidence/pr-portable-observation/README.md) |
| E15 | [安全脱敏](../../src/lib/redactSensitive.ts)、[仓库扫描](../../scripts/scanSecrets.mjs) | [PR02C证据](../evidence/pr-02c/README.md)、[Secret测试](../../tests/unit/secretScan.test.ts)；不是完整加密或全链路审计 |
| E16 | [导入接口](../../src/app/api/import-evaluation-workspace/route.ts)、[前端载入](../../src/services/importWorkspaceClient.ts) | [PR02B深链证据](../evidence/pr-02b/README.md)；Skill 的交互确认不能被绕过 |

## 第 5 章逐行核对

状态继承统一六种定义。标为已验证的行仅限表内明确范围，不代表所属章节或一期里程碑完成；业务范围不同而仅有相关模块时标为部分实现。暂缓是排期决策，不新增第七种能力状态。

### 5.1 评测集

| ID | 原需求 / 阶段 | 状态 | 证据 | 缺口与完成条件 |
|---|---|---|---|---|
| R5.1-01 | 数据集 CRUD + 版本管理 / 一期 | 部分实现 | E01/E02 | 普通输入不是独立 DatasetVersion；黄金集版本不能代替全部数据集。需引用完整性及不可变发布验收 |
| R5.1-02 | Excel / CSV / JSONL 导入 / 一期 | 部分实现 | E01/E02/E16 | 一般入口 accept 无 CSV，黄金集另有映射；统一预览、CSV路径、缺失政策并实际回读 |
| R5.1-03 | 文件夹遍历导入图片 / 一期 | 设计中 | 无；E14仅归档 | 需目录授权、类型/数量/大小限制、取消；不得把现有归档目录当图片导入 |
| R5.1-04 | 本地图片路径引用 / 一期 | 设计中 | E01为URL/base64 | 需受限文件引用和迁移规则；不能将绝对私密路径放入导出 |
| R5.1-05 | row_id 内容哈希 / 一期 | 设计中 | E01 | 先定规范化字段/重复行语义，跨批次行序变化身份不变 |
| R5.1-06 | Run 结果一键存样本 / 一期 | 设计中 | 无；E07仅重跑 | 新样本保留来源；输出不自动成为标准答案，确认后才写入 |
| R5.1-07 | 期望工具序列标注 / 二期 | 设计中 | 无 | 真实轨迹字段、序列容错及版本化标注，暂缓 |
| R5.1-08 | Bad case 自动泛化 / 二期 | 设计中 | E09仅标记 | 与R5.8-07同一能力，不重复开发；候选需确认和预算 |
| R5.1-09 | 数据血缘 / 二期 | 部分实现 | E07重跑来源 | 执行复用来源不等于数据集衍生图；需样本级父引用 |
| R5.1-10 | dev/test 拆分 / 二期 | 设计中 | 无 | 固定随机种子、互斥和版本记录，暂缓 |

### 5.2 评测对象

| ID | 原需求 / 阶段 | 状态 | 证据 | 缺口与完成条件 |
|---|---|---|---|---|
| R5.2-01 | 各厂商模型 API / 一期 | 部分实现 | E03 | 已有适配器与资源池；按厂商/版本合同逐一 Mock 验证，不承诺全兼容 |
| R5.2-02 | 粘贴文档接入、试跑、自修正 / 一期 | 部分实现 | E03/E15 | 有文档/Agent接入链路；仍需将解析/执行/改脚本边界统一，不能自动花费 |
| R5.2-03 | Prompt 独立版本 / 一期 | 设计中 | E05仅JudgePrompt | 新增被测 PromptVersion、Target引用与回退，不冒用Evaluator版本 |
| R5.2-04 | Playground 单条试跑 / 一期 | 部分实现 | E03/E07 | 已有单条试运行；补独立Prompt版本载入、改动预览与回归用户路径 |
| R5.2-05 | Agent 工具清单与真实地址登记 / 一期 | 部分实现 | E03/E11 | 资源接入Agent不是被测Agent轨迹合同；固定LangGraph也不接受任意工具清单 |
| R5.2-06 | Workflow 接入 / 二期 | 设计中 | E03局部ComfyUI | 图像工作流不能代表通用Agent Workflow；按适配等级逐个验收 |
| R5.2-07 | 黑盒/可取轨迹/可拦截标识 / 二期 | 设计中 | E03仅模态能力 | 增加有实证的接入等级，不由资源名称自动推断 |
| R5.2-08 | 代理配置自动生成 / 二期 | 设计中 | 无 | 先明确代理范围与权限，不能让建议自动改系统配置 |

### 5.3 评估器

| ID | 原需求 / 阶段 | 状态 | 证据 | 缺口与完成条件 |
|---|---|---|---|---|
| R5.3-01 | 自定义Prompt、多维LLM Judge / 一期 | 部分实现 | E04/E05/E10 | Judge链路已有，但旧权重策略与新版独立维度冲突；需兼容新模式 |
| R5.3-02 | AI 候选维度 / 一期 | 已验证 | E04 | 限定现有Simple Rubrics/反馈一次生成，Mock流程验收；不含OpenJudge或多轮优化 |
| R5.3-03 | 精确/包含/正则/JSON Schema规则 / 一期 | 设计中 | 无；E04仅Rubric | 四类确定性Scorer、输入前提、错误与超时限制，零模型调用 |
| R5.3-04 | 评估器版本管理 / 一期 | 已验证 | E05 | 限定现有Evaluator不可变版本/校验/Diff；新规则Scorer类型扩展另验 |
| R5.3-05 | 一致性、位置/长度偏见、重测信度 / 一期 | 部分实现 | E06 | 已有准确率/κ/漏判/误杀和多Judge比较；未完成三类偏见/信度实验设计 |
| R5.3-06 | 未校准不可设基线 / 一期 | 部分实现 | E06 | 已有Evaluator发布门禁，不是Baseline Run指针；需新Run绑定与阻断测试 |
| R5.3-07 | DeepEval / RAGAS / 二期 | 设计中 | 无 | 固定版本、逐指标输入/费用/结果合同，暂缓实际模型评测 |
| R5.3-08 | 工具/参数/遗漏/死循环轨迹评分 / 二期 | 设计中 | E11仅显示 | Trace展示不等于轨迹正确性指标；需标准轨迹和期望字段 |
| R5.3-09 | 自定义函数Scorer / 二期 | 设计中 | 无 | 执行隔离及资源预算未建立，不把目标脚本执行器当安全评分沙箱 |

### 5.4 评测任务

| ID | 原需求 / 阶段 | 状态 | 证据 | 缺口与完成条件 |
|---|---|---|---|---|
| R5.4-01 | 对象×数据集版本×评估器建任务 / 一期 | 部分实现 | E01/E05/E07 | 当前Task是输入/目标与分开的评价；需统一版本化RunSpec |
| R5.4-02 | 并发/超时/重试 / 一期 | 已验证 | E07 | 限定既有浏览器跑批策略；不是服务端常驻队列或20GB容量保证 |
| R5.4-03 | 重复N次与方差 / 一期 | 设计中 | E07仅失败重试 | 重试不等于独立重复实验；需repeat索引、种子与方差口径 |
| R5.4-04 | 断点续跑 / 一期 | 已验证 | E07 | 限定浏览器Task检查点、刷新识别和未完成项继续；合盖/退出不继续执行 |
| R5.4-05 | 继承Run、只改一项重跑 / 一期 | 部分实现 | E07 | 已有失败/选行/新目标等稀疏计划，不是新版三步单变量回归 |
| R5.4-06 | RunSpec冻结 / 一期 | 部分实现 | E01/E05 | Task参数摘要和Evaluator快照不是全部引用+版本哈希；需漂移阻断 |
| R5.4-07 | live/record/replay / 二期 | 设计中 | 无 | 观测文件回读不是执行replay，需确定性环境合同 |
| R5.4-08 | Cassette绑定 / 二期 | 设计中 | 无 | 需工具请求规范化、命中/缺失政策，暂缓 |
| R5.4-09 | 定时任务 / 二期 | 设计中 | 无 | 本夜开发heartbeat不是平台跑批调度器，不借用其完成状态 |
| R5.4-10 | CLI/CI执行入口 / 二期 | 设计中 | E12仅只读 | 项目自身GitHub CI不等于用户评测CLI；RunSpec/预算先行 |
| R5.4-11 | 第N步前缀注入 / 二期 | 设计中 | 无 | 固定Mock步骤无通用注入；依赖可拦截等级与Cassette |

### 5.5 Benchmark

| ID | 原需求 / 阶段 | 状态 | 证据 | 缺口与完成条件 |
|---|---|---|---|---|
| R5.5-01 | 对象集合×数据集×指标榜单定义 / 一期 | 部分实现 | E08 | 当前从单次评价生成榜；需独立Benchmark版本与固定比较口径 |
| R5.5-02 | 排行榜与case下钻 / 一期 | 部分实现 | E08 | 旧加权榜已验收但冲突新PRD；独立维度展示且显式保留旧口径 |
| R5.5-03 | 来源×模型候选池 / 一期 | 部分实现 | E03 | 已有来源/模态/身份/健康；未有Benchmark候选组合管理 |
| R5.5-04 | 历史趋势 / 二期 | 设计中 | 无 | 需版本可比性和覆盖率，无样本时不补零 |
| R5.5-05 | 定期自动跑 / 二期 | 设计中 | 无 | 依赖受预算调度器，暂缓 |

### 5.6 运行监控

| ID | 原需求 / 阶段 | 状态 | 证据 | 缺口与完成条件 |
|---|---|---|---|---|
| R5.6-01 | 实时进度+日志流 / 一期 | 部分实现 | E07/E03 | 跑批进度和接入Agent SSE局部存在，不是统一Run事件流 |
| R5.6-02 | 失败列表+单条重跑 / 一期 | 部分实现 | E07 | 既有Task选择重跑已验收；还需映射新Run身份与执行记录 |
| R5.6-03 | token/耗时/成本 / 一期 | 部分实现 | E01/E11 | 有latencyMs；没有统一token、模型价格版本和成本字段，不补造成本 |
| R5.6-04 | 延迟p50/p95/p99 / 一期 | 设计中 | 无 | 需样本数、分位算法、失败/重试计入口径与空值策略 |
| R5.6-05 | Trace调用链树 / 二期 | 部分实现 | E11 | 固定实验树/检查器已验证；未绑定任意用户Run与框架 |
| R5.6-06 | 时间线+replay标记 / 二期 | 部分实现 | E11 | 已有固定时间/选中定位，无Cassette命中事实，不能虚标replay |
| R5.6-07 | Cassette miss告警 / 二期 | 设计中 | 无 | 依赖真实replay引擎，不能用Mock失败替代miss统计 |

### 5.7 评测报告

| ID | 原需求 / 阶段 | 状态 | 证据 | 缺口与完成条件 |
|---|---|---|---|---|
| R5.7-01 | 维度聚合与逐条明细 / 一期 | 部分实现 | E08/E10 | 已有维度分与证据，需消除新版对加权汇总的依赖 |
| R5.7-02 | 两次Run逐条并排Diff / 一期 | 设计中 | E05仅EvaluatorDiff | Evaluator定义Diff/校准重跑对比不能替代任意Run逐行Diff |
| R5.7-03 | 基线自动对比变好/变差 / 一期 | 设计中 | E06仅校准比较 | 需具体Baseline Run、可比性、双向计数与未配对行 |
| R5.7-04 | 指定本地目录导出、失败标红 / 一期 | 部分实现 | E10/E01 | 已有Excel/离线HTML下载，不等于可写任意目录；需明确授权及失败可读标记 |
| R5.7-05 | 单条历史曲线 / 一期 | 设计中 | 无 | 依赖内容row_id、评价版本与缺失数据处理 |
| R5.7-06 | 跨Evaluator版本强制不可比 / 一期 | 部分实现 | E05/E06 | 有版本Diff和发布验证，不是通用Run比较强制门禁 |
| R5.7-07 | 结果×过程二维矩阵 / 二期 | 设计中 | E11仅故障示例 | 需独立过程真值，结果成功不能推断过程正确 |
| R5.7-08 | 趋势曲线 / 二期 | 设计中 | 无 | 与Benchmark趋势复用聚合，不重复造数据源 |

### 5.8 Review 自进化

| ID | 原需求 / 阶段 | 状态 | 证据 | 缺口与完成条件 |
|---|---|---|---|---|
| R5.8-01 | 人工标注队列/快捷键/批量 / 一期 | 部分实现 | E09 | 有队列与只追加复核；通用批量/快捷键及新Run接线需专验 |
| R5.8-02 | 失败共因自动归因 / 一期 | 设计中 | E08仅规则筛选 | 筛选标签不等于模型因果诊断；先做证据聚类、再受控建议 |
| R5.8-03 | Prompt改动建议Diff / 一期 | 设计中 | E05仅Judge版本Diff | 依赖独立被测Prompt、引用失败证据，不自动修改 |
| R5.8-04 | 确认保存新版本并回归 / 一期 | 设计中 | 无 | 确认范围需包含模型调用数、费用和版本，取消保持零执行 |
| R5.8-05 | 修复数+新增退化数 / 一期 | 设计中 | 无 | 同行同维度同Evaluator对齐，不能只报修复数量 |
| R5.8-06 | Agent诊断建议、不自动改 / 一期 | 设计中 | E11仅检查器 | 需要证据可定位建议；不输出/执行无授权系统修改 |
| R5.8-07 | Badcase自动泛化 / 二期 | 设计中 | E09仅标记 | 与R5.1-08同一项；候选确认、不泄漏标准答案 |
| R5.8-08 | 同Cassette重跑 / 二期 | 设计中 | 无 | 需冻结环境，文件预览回读不能替代工具回放 |

### 5.9 管理中心

| ID | 原需求 / 阶段 | 状态 | 证据 | 缺口与完成条件 |
|---|---|---|---|---|
| R5.9-01 | 模型与密钥本地加密 / 一期 | 部分实现 | E03/E15 | 当前只存keyRef、服务端环境注入，不是本地加密密钥库 |
| R5.9-02 | 本地目录白名单 / 一期 | 部分实现 | E14 | 归档读取器有固定受限目录，未形成通用管理中心或写入权限 |
| R5.9-03 | MCP Server开关与工具清单 / 一期 | 部分实现 | E12 | 真实stdio进程和两工具清单已验收；无UI开停与一期八工具 |
| R5.9-04 | MCP调用日志 / 一期 | 设计中 | E12无持久审计 | 先定义脱敏事件、保留周期和存储边界，不把终端输出当审计体系 |
| R5.9-05 | 成本预算与告警 / 二期 | 设计中 | 无 | 需真实计量/价格版本/额度策略，不从次数假设费用 |
| R5.9-06 | 用户权限 / 明确不做 | 未规划 | 最新PRD非目标 | 单用户定位，不排多人角色开发；安全与工具范围照常强制 |

## MCP 与助手的完整性检查

| 指定工具 | 当前交付 | 缺口与依赖 |
|---|---|---|
| dataset.list | 无 | 一般DatasetVersion和浏览器数据受控桥接 |
| dataset.get | 无 | 数据范围、分页/引用、宿主外发确认；不能把全文塞URL |
| dataset.create_from_file | 无 | 文件授权、字段映射预览、缺失策略、确认式写入 |
| target.list | 无 | 当前Target在浏览器项目；stdio不可直接跨浏览器读取 |
| run.execute | 无 | 不可变RunSpec、幂等、预算/确认、取消和执行器 |
| run.status | 无 | 稳定Run身份与生命周期，不用浏览器内存标志冒充持久状态 |
| report.get | 无 | 冻结来源与对外脱敏报告合同 |
| report.diagnose | 无 | 可引用的失败证据、受限诊断与费用约束 |

现有 `get_platform_capabilities` 只列开放工具与限制，不返回完整75能力目录；`get_archive_summary` 只读已配置归档统计。它们提供协议/共享Action基础，不是上述工具的替代品。

| Assistant 场景 | 已有可复用模块 | 端到端缺口 |
|---|---|---|
| 文件建数据集 | 导入Skill/API、黄金集映射 | 平台内对话草案、统一DatasetVersion、确认与写入Action |
| 配置并运行 | 资源池、执行策略、费用确认 | 意图到RunSpec、Diff、预算执行和取消反馈 |
| 查询/导出 | 历史页、离线HTML、两只读工具 | 浏览器项目桥接、受控报告工具和对话展示 |
| 失败诊断 | Judge证据、风险筛选、人工复核 | 基于证据的诊断建议；不得把筛选规则伪装成AI因果解释 |

## 下一阶段小 PR

这张表是依赖规划，不是已经开始或已经承诺完成的排期。每个主题可继续拆分，先契约后最小用户路径，避免长分支。

| 顺序 / 优先级 | 小 PR 主题 | 最小验收 | 依赖与风险 |
|---|---|---|---|
| P0-A | 校准平台工具里的旧观测文案 | UI/API/MCP共用声明，准确说明固定LangGraph/Mock；零执行与异常路径回归 | `ACTION_LIMITS`仍写“不代表真实框架适配”，与PR51限定交付不一致；独立UI小PR，N12不改业务代码 |
| P0-B | 新版独立维度Scorer与报告模式 | 新流程不要求/生成总分；旧分和旧榜标“历史加权口径”；新旧导出回读 | 不能删除或重算历史；先定兼容Schema和比较规则 |
| P0-C | DatasetVersion/内容身份最小合同 | 字段规范、哈希、重复/缺失处理、版本不变；一份合成文件完整导入 | 不直接导入用户真实10万条；不新增后端 |
| P0-D | 被测Prompt独立版本 | 保存/引用/Diff/回退；JudgePrompt不混淆；取消不执行 | 与Target引用关系及旧项目兼容 |
| P0-E | 不可变RunSpec与三步单变量回归 | 版本+哈希冻结；继承配置只改一项；预览确认；漂移阻断 | 先本地Mock执行路径，绝不自动调用真实模型 |
| P1-A | Baseline Run与逐行双向Diff | 可比性阻断；变好/变差/缺失/未配对分别统计；未校准不能设基线 | P0-B/C/D/E；校准发布门禁复用但不能替代Run基线 |
| P1-B | 四种确定性规则Scorer | 精确/包含/有界正则/JSON Schema各自输入合同、失败证据、零模型 | 先审计promptfoo可复用入口及许可；不引入第二套服务 |
| P1-C | 数据/目标/报告只读MCP | 与UI共用Action；参数/分页/权限/脱敏/协议真测 | 先解决浏览器origin数据访问边界，不虚构后端可读取IndexedDB |
| P1-D | 写入/执行MCP及最小Assistant | 意图草案→预览→确认→执行→摘要；取消零调用、幂等、预算 | 先限定一场景；无预授权不做自动闭环 |
| P2-A | Langfuse具体页面模块/中文层级 | 固定上游许可及依赖审计、真实组件复用证据、旧用户路径回归 | 不部署整套后端、不把重新绘制称为Fork |
| P2-B | 偏见/信度、其他框架、Cassette | 各自小规格、真实输入/Mock边界、来源与不可比状态 | DeepEval/RAGAS/AgentScope等不因调研就算接入；真实费用和红队另行授权 |

Developer Helper 采用 [SDD/Harness方法适配](../execution/DEVELOPER-HELPER-ADAPTATION.md)：需求 → 设计 → 任务 → 实现 → 验证 → 证据 → PR → 最终CI → 普通合并 → 下一Ready。不是将该目录当生产SDK依赖；没有复制未知许可源码/配置，没有强行迁为Vue/Python，也不把串行角色检查称作多个独立Agent评审。

## 面试演示建议

1. 打开 [五章中文导览](http://127.0.0.1:3002/interview-demo)，先说明“给产品经理的本地工作台”，而不是宣称全能平台。
2. 进入历史演示，展示117,065索引、实际ID口径、分页与来源差异；默认不打开真实正文，不说成一夜生成十万条。
3. 进入观测页，手动运行无模型实验，对照顺序与失败恢复；展示中间失败、根任务结局、调用树和步骤详情。说明真实LangGraph调度与Mock业务节点的区别。
4. 下载观测JSON再选择文件，展示预览/取消/确认和“来源未认证”；说明这是受限可迁移观测结果，不是项目备份或可重放Agent。
5. 进入只读工具页，说明两个Action在UI/API/MCP复用；展示真实PR、最终CI、许可清单，再说明后续版本化回归与助手计划。

若时间只有5分钟，讲产品取舍、失败定位、数据来源、共享Action和工程证据即可；不现场发起付费跑批。下一阶段的业务数据导入仍需用户确认输入字段、标准答案字段、评价模式与缺失策略。

## 限制与风险

- 本地化：当前项目/草稿是浏览器origin数据，归档是本机只读文件；不同浏览器、主机名和端口不共享。没有新后端、跨设备同步、自动全项目迁移或20GB性能结论。
- 隐私：本机存储不代表第三方API本地推理；MCP宿主可能将返回信息交给其模型。安装/构建也可能联网，不能声称全生命周期零外网。
- 真实性：没有运行真实模型质量/成本实验。合成观测可以验证交互与逻辑，不能证明真实Agent准确率、延迟分位或模型效果。
- 复用：仅两份固定Langfuse纯逻辑受控vendoring；真实OTel、LangGraph、MCP及Ant Design依赖有使用证据。竞品优势和许可见[开源复用表](open-source-reuse.md)，不重复承诺商业/企业版能力。
- 安全：Secret Scan、脱敏与若干泄漏回归已经存在，完整密钥加密、目录管理、依赖治理和审计体系未完成；不能将CI通过等同无漏洞。
- 文档：此次修正README的Node18旧要求和旧PRD“唯一当前入口”误导；工具观测旧文案留给P0-A独立验收，不在文档PR夹带业务修改。

本审计不更改旧75项状态。后续完成一项，应补该行代码/测试/验收/PR并更新最新基线；不要只更新夜间任务的“已完成”标签。
