# 开源源码复用与暂缓后端存储方案

日期：2026-09-07。状态：设计中。本文件是最新讨论形成的增量约束，不把调研结果标为已经接入。

## 产品边界

目标是中文友好、可迁移、AI 友好的本地评测平台。优先复用上游真实代码，不按截图重建整个平台，不重新实现成熟指标库。当前不新增或迁移后端存储；IndexedDB 暂时保留，存储与业务动作通过明确契约隔离。

旧 PRD 中“文件系统作为唯一真相源、SQLite 作为索引”的实现暂缓。预留接口不等于已有大数据后端，更不构成 20GB 容量或稳定性承诺。

## 候选与边界

以下是平台候选的仓库与官方文档入口级审计，尚未将这些平台整体安装或集成。首个实际复用模块为下文锁定版本的 Ant Design 与 OpenTelemetry；二者以依赖安装，不做 vendoring。

| 项目 | 复用角色 | 来源 | 许可或部署边界 | 本轮处理 |
|---|---|---|---|---|
| Langfuse | 首选平台源码/UI 候选，实验、Trace、Prompt 和 MCP | [仓库](https://github.com/langfuse/langfuse)、[许可](https://github.com/langfuse/langfuse/blob/main/LICENSE) | 核心 MIT；`ee` 等目录独立许可；整站依赖真实后端 | 审计可抽离组件；不部署整站、不导入企业模块 |
| AgentOps | Agent 步骤回看、执行图和成本观测候选 | [仓库](https://github.com/AgentOps-AI/agentops) | 仓库说明应用 MIT，并包含 Dashboard/API；自托管并非无后端 | 与 Langfuse 对照；不部署第二套平台 |
| Opik | Agent 追踪、实验与评测平台候选 | [仓库](https://github.com/comet-ml/opik) | Apache-2.0 平台；仍需审计选定版本和依赖 | 对照能力，不引入另一套数据真相源 |
| DeepEval | Agent 指标和评测库 | [仓库](https://github.com/confident-ai/deepeval)、[Agent 指标](https://deepeval.com/guides/guides-ai-agent-evaluation-metrics) | 开源库与 Confident AI 托管平台不能混为一谈；不少指标要调用 Judge | 优先核对可无模型运行的入口与版本；不默认调用 Judge |
| promptfoo | 配置式评测、断言及红队执行引擎 | [仓库](https://github.com/promptfoo/promptfoo) | MIT 项目；CLI/服务、存储、远程生成及评分依赖需分别审计 | 评估库/CLI 适配，暂不运行红队或真实评测 |
| DeepTeam | 可选红队引擎 | [仓库](https://github.com/confident-ai/deepteam) | Apache-2.0 框架；不等同托管风险管理界面 | 记录接入契约，实际攻击测试暂缓 |
| Giskard | Agent 测试、漏洞扫描及质量测试 | [仓库](https://github.com/Giskard-AI/giskard-oss)、[OSS 说明](https://docs.giskard.ai/oss) | 开源库与商业 Hub 不同；扫描通常涉及生成及判分模型 | 记录可选引擎，不将商业能力算作可复用源码 |

Langfuse 官方已有 [DeepEval 集成路径](https://langfuse.com/resources/engineering/deepeval)：指标在外部 Python 评测进程计算，再以 Score 写入平台。应使用现成库及稳定 SDK/API，避免把各平台源代码和数据库直接拼成一套。

Langfuse 原生 [MCP](https://langfuse.com/docs/api-and-data-platform/features/mcp-server) 已支持多类读写动作，接入时先发现实际工具及 Schema，再补我们的缺失业务能力。[内置 Assistant](https://langfuse.com/docs/langfuse-assistant) 当前官方标注自托管不可用，不能宣称 Fork 后直接获得完整本地助手。

## 复用方法

1. 固定上游提交与许可，保留 LICENSE/NOTICE 和来源，不依赖会漂移的 `main` 作为交付版本。
2. 先列清目标组件的导入树、路由、鉴权、状态管理、服务和存储依赖，再判断能否独立复用。
3. 可独立复用的组件保留原结构和交互，增加中文文案与本项目适配；不能独立运行的先暂缓，禁止伪装成无依赖组件。
4. 优先以锁定版本的库或 CLI 调用评测引擎；确需复制源码时记录原文件、修改原因和回归测试。
5. UI、API、MCP 共用领域 Action。MCP 暴露有业务意义的动作，不暴露每个展开、切 Tab 等视觉事件。
6. 每项指标保留引擎、版本、配置、输入要求、分数范围、阈值和证据；不同口径不能简单平均成统一总分。

## 现有代码复用

| 已有模块 | 代码证据 | 建议 | 迁移验收 |
|---|---|---|---|
| 模型/算法/脚本/ComfyUI | `src/adapters/registry.ts` 及各 adapter | 复用统一执行入口 | 请求/输出兼容，密钥仍只在服务端处理 |
| Excel/JSON、标准答案 | `src/services/excel.ts`、`expectedAnswer.ts` | 复用解析和字段校验，UI 重新接线 | 导入预览、缺失策略、导出回读 |
| Rubric 与版本 | `src/lib/evaluationRubric.ts`、`evaluatorVersion.ts` | 提取领域模块而不是重写 | 旧版本不变，缺字段阻断，纯函数测试 |
| Judge 校准 | `src/lib/judgeCalibration.ts` 及相关服务 | 保留计算、黄金集和发布验证 | 人工真值隔离、指标复算、Mock 请求 |
| 检查点与重跑 | `src/lib/batchCheckpoint.ts`、`rerunPlan.ts`、`src/hooks/useTaskRunner.ts` | 复用规则；浏览器执行状态暂保留 | 暂停/刷新/续跑与稀疏请求无退化 |
| 复核与报告 | `src/lib/evaluationReview.ts`、`src/services/evaluationHtmlReport.ts` | 保留证据、只追加复核和安全导出 | 原分不改写；无外网报告；新流程无新增总分 |
| 当前项目存储 | `src/services/projectRepository.ts`、`indexedDbProjectRepository.ts`、`db.ts` | 已隔离 ProjectRepository，仍复用 Dexie；draftDb 未抽离 | PR #47/#48 最终 CI 通过，旧记录保护与项目契约已验证；不新建后端、不升 Schema |

现有单测和 E2E 可以作为接线验收资产，但旧通过记录不能替代新接线后的测试。旧 `listCompatibleProjects` 的隐式删除已在 PR #47 修复；PR #48 在新的项目存储契约下重新通过 237 unit / 2 stress / 47 E2E。本次没有读取用户真实浏览器 IndexedDB，保留不等于迁移或备份。

## 预留接口，不实现新后端

- ProjectRepository：项目读取、列举、保存、显式删除及能力声明，由当前 IndexedDB 实现。
- ArtifactStore：未来大文件和报告产物的引用读写契约，暂不提供声称可用的服务端实现。
- EvaluationEngine：声明所需输入、预算、版本和结果结构；缺少轨迹或标准答案时拒绝不适用指标。
- PlatformAction：统一校验、确认和调用入口，UI 与未来 MCP 共用，不允许工具绕过费用确认。

接口缺少真实实现时，UI 必须标为设计中或不可用；不得让用户点击后才发现是不存在的路由。

## 当前验收状态

- 已完成：入口级资料核对、现有代码证据梳理、夜间任务范围校准。
- 首个代码节点：`F-OBS-001`，真实 OTel SDK 与 Ant Design 中文观测实验室；测试与 CI 状态见 `../evidence/pr-agent-observability/README.md`。
- 已完成：F-DATA-001 只读历史归档/分页演示（PR #46），F-STORE-001 非破坏性旧项目保护（PR #47）及 F-STORE-002 真实项目存储契约（PR #48）；各自最终 CI 已通过并合并。
- 已完成：F-ACT-001 两项共享只读 Action、中文工具页、同源 API 与官方 SDK stdio MCP（PR #49 最终 CI 通过并合并）；没有对话自治或浏览器项目桥接，写入/评分工具未开放。
- 已完成：F-OBS-002 实际复用固定 Langfuse 提交的时间范围/选中定位、调用树展开两份纯逻辑，中文检查器最终 CI 通过，PR #50 已合并；文件/许可/差异见 [受控复用清单](../../third_party/langfuse/README.md)。
- 未完成：Langfuse 整站 UI 容器移植、任意用户框架回调兼容性、真实模型评测、观测轨迹持久化及大数据性能验证。固定 LangGraph 适配不等于任意框架兼容。
- PR：[F-OBS-001 / #45](https://github.com/boyuling-123/AI-API-workspace/pull/45)，本地与最终远端 CI 通过，已正常合并。

## 提取优势，而非拼装整个平台

以下“优势”是针对本工作台场景的选型判断，不是对竞品的绝对排名。

| 来源 | 借鉴的优势 | 本工作台里的用途 | 当前状态与差异化 |
|---|---|---|---|
| Langfuse | Trace/Span 层级、实验与数据集、SDK/MCP 互通 | 中文“调用链/步骤/实验”信息层级，以 OTel 作为未来连接边界 | 两份纯逻辑已受控复用并接入中文检查器，PR #50 最终 CI 通过并合并；未 Fork 整站、不引入其整套服务依赖 |
| AgentOps / Opik | Agent 工具链、执行过程回放与调试 | 区分最终任务失败、中间失败后恢复、并行分支 | 本地 Mock 已编码；不是这两个框架已接入，不把阶段耗时当模型质量 |
| DeepEval | 指标即代码、任务/工具等细分评测 | EvaluationEngine 适配输出独立维度、要求所需轨迹字段 | 设计中；保留人工黄金集与 Judge 校准优势，不强行平均总分 |
| promptfoo | 声明式用例/断言、回归与红队工作流 | 可迁移评测配置、确定性断言优先、受控批量执行 | 设计中；不复制整个服务，不默认生成攻击或调用 Judge |
| DeepTeam / Giskard | 安全场景与测试集合 | 可选的经授权安全测试适配器 | 暂缓实际运行；安全报告不代表保证模型安全 |
| AgentScope | Agent 工程与 OTel 追踪，具有中文文档生态 | 后续优先验收的 Agent 框架之一，沿用其已提供的埋点能力 | 设计中；不另造一个 Agent 框架，不宣称已运行兼容测试 |
| LangGraph | 显式状态图、节点调度与失败重试 | 编译顺序与失败恢复两张图，将真实回调转换为既有 OTel/中文检查器 | F-OBS-003 本地与最终 CI 通过，PR #51 已合并；真实框架、固定 Mock 节点，非真实模型或任意 Agent 兼容 |
| Ant Design | 企业工具组件、表格/树及中文语言包 | 实际复用观测表格、步骤树、按钮，中文文案与错误提示 | 观测、归档与只读工具页均已验收合并；不用翻译皮肤掩盖缺失业务能力 |

AgentScope 官方 [Tracing 文档](https://doc.agentscope.io/tutorial/task_tracing.html) 给出 OpenTelemetry 与 Langfuse 的接法；[仓库](https://github.com/agentscope-ai/agentscope) 标示 Apache-2.0。框架已有 SDK/回调时优先复用；不同版本的字段和父子关系必须各自测试，不能从 OTel 兼容推出“所有框架均已接入”。

## 首个实际复用清单

| 固定依赖 | 实际使用模块 | 上游来源及许可 | 本地改动 |
|---|---|---|---|
| antd 6.6.2 | Table、Tree、Button、Tag、ConfigProvider、locale/zh_CN | [Ant Design](https://github.com/ant-design/ant-design)，MIT | 不修改依赖源码；中文界面、对比度 Token、业务数据适配 |
| @opentelemetry/api 1.9.1 | trace、ROOT_CONTEXT、SpanStatusCode | [OpenTelemetry JS](https://github.com/open-telemetry/opentelemetry-js)，Apache-2.0 | 显式上下文传递，不注册全局 Provider |
| @opentelemetry/sdk-trace-base 2.11.0 | BasicTracerProvider、SimpleSpanProcessor、InMemorySpanExporter | 同上，Apache-2.0 | 固定模拟实验、统一单调时钟、白名单属性导出 |
| @modelcontextprotocol/server / core 2.0.0 | McpServer、registerTool、serveStdio | [官方 TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)，发布包 LICENSE 为 MIT/Apache-2.0 过渡，不能仅看 package 元数据 MIT | 独立 Node 进程、两项中文只读工具、64 KiB 消息上限；不新增 HTTP MCP 端口 |
| @modelcontextprotocol/client 2.0.0（dev-only） | Client、StdioClientTransport | 同上，保留发布包完整许可 | 官方客户端子进程验证两个协议年代，不把自写协议模拟当接入成功 |
| zod 4.5.4 | strictObject、enum | [Zod](https://github.com/colinhacks/zod)，MIT | 空参数 Schema、未知字段拒绝，UI/API/MCP 共享业务校验 |
| langfuse/langfuse `7637df1e1aadddbbfd0a45b960ecc97451381ce5` | timelineCalculations / flattenTreeOrder | [固定源文件、许可及摘要](../../third_party/langfuse/README.md)，所选文件为 MIT Expat | 两份纯函数受控 vendoring，仅换类型导入；外围中文 UI 和有界 OTel 适配是本项目代码，不冒充上游组件 |
| @langchain/langgraph 1.4.14 / core 1.2.9 | StateGraph、StateSchema、retryPolicy、callbacks | [固定依赖、传递许可与行为审计](../../third_party/langgraph/README.md)，MIT | 框架不进浏览器包；空凭据环境的短时进程、固定 Mock 节点、真实回调埋点，不启用 LangSmith |

`package-lock.json` 保留依赖精确版本与完整性摘要；原 LICENSE 随 npm 包分发。服务不使用网络 Exporter。新路由不依赖现有项目数据库，观测 OTel SDK 在主动点击后动态加载，MCP SDK 只在独立 Node 进程使用；Ant Design 的依赖位于相关页面块而非强塞旧首页。

## 面试演示的真实口径

- 中文友好是业务术语、字段确认、异常恢复提示和引导，不只是翻译菜单。
- 可迁移先落在带 schemaVersion/source/版本信息的 JSON 与原始证据引用；未完成导入回读/存储适配前，不称整个平台一键迁移已完成。
- 本地工作台负责组织、查看、比较、复核，重任务由用户本机执行器完成。数据放本机不等于浏览器可以无上限加载；先做索引、分页和有界查询。
- 新增 Mock 只证明工程链路，真实历史数据用于解释产品判断；不把既有模拟 CSV 标为真实模型结果，也不把检索记录数当作唯一测试用例数。
- 此仓库里的 PR 是个人产品工程贡献；要称上游贡献必须另有真实上游 PR 和接受证据。
