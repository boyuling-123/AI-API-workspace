# 中文评测工作台：2026-09-07 早间交付

本报告汇总本夜已合并能力与07:38重新采集的合成工程实验。产品定位是产品经理的中文、本地优先工作台，不是完整 Langfuse Fork，也不是已经交付全部新 PRD。交付材料本身不增加业务能力数量。

## 先打开哪里

打开 [五章中文演示导览](http://127.0.0.1:3002/interview-demo)。建议沿“产品定位 → 历史数据 → Agent观测 → 助手工具 → 工程证据”讲解。页面打开不会自动跑批或调用模型。

| 入口 | 可以演示什么 | 不应宣称什么 |
|---|---|---|
| [数据与跑批](http://127.0.0.1:3002/) | 复用已有模型/算法接入、数据编辑、跑批、Judge校准与报告 | 新PRD全部完成；旧加权评价已全部迁移 |
| [历史归档](http://127.0.0.1:3002/history-demo) | 本机既有索引、50行分页、筛选、脱敏及正文确认 | 117065次新模型调用；全量导入数据库；20GB稳定执行 |
| [Agent观测](http://127.0.0.1:3002/observability) | 手工OTel三场景、真实LangGraph两场景、失败恢复和步骤检查 | 5个框架；任意Agent兼容；模型能力排行榜 |
| [助手工具](http://127.0.0.1:3002/assistant-tools) | UI/API/MCP共享的两个只读动作，显示真实能力边界 | 完整自治Assistant；每项业务都已开放MCP |

若服务未运行，在本仓库按 [README](../../README.md) 启动3002。保留同一浏览器和地址：`localhost`、`127.0.0.1`、不同端口是不同origin，不会自动显示另一origin的IndexedDB项目，并不代表原数据被删除。新克隆不携带本机归档配置或真实数据。

## 可以直接使用的实验文件

合成文件、截图与独立说明在 [实验交付目录](../evidence/pr-morning-handoff/README.md)。本机ZIP由这些明确列出的文件组成，不包含原归档、模型配置或整个项目。

1. 打开观测页，点击“选择本机 JSON 文件”，选择包中的`manual-observations.json`或`langgraph-observations.json`。
2. 预览来源与条数，确认后加载。它只显示文件，不上传、不重新执行、不写入项目数据库。
3. 点击“失败重试”查看红色失败步骤及后续成功步骤；最终成功并不抹掉中间错误。
4. 下载当前实验JSON，再导出时仍保留“外部文件回读，来源未认证”。没有签名的JSON不能证明真实框架曾在现场执行。
5. 若要现场重新采集，可主动点击对应实验按钮。这些固定Mock实验不需要模型密钥，但LangGraph流程会访问本机受限执行接口。

这是本平台的两种合成观测格式，不是通用OTLP、业务Excel或未知Agent轨迹导入器。文件上限64KiB、步骤上限14；不要拿它打开十万条历史结果。

## 本次实际实验结果

采集时间：2026-09-07 07:38:55至07:39:03（Asia/Shanghai）。运行代码基线为PR55合并`3c625c729a30793c203aaeaab4fae7219c8d578a`；采集脚本和文档在工作树中，未改运行代码。Node24.14.1、OTel SDK2.11.0；LangGraph1.4.14/Core1.2.9。完整时间、原文件SHA和实际网页表格见 [Manifest](../evidence/pr-morning-handoff/capture-manifest.json)。

| 采集方式 | 场景 | 最终状态 | 页面耗时/ms | 工具调用 | 异常步骤 | 重试 |
|---|---|---|---:|---:|---:|---:|
| 手工OTel/本地模拟流程 | 顺序工作流 | 成功 | 31.0 | 1 | 0 | 0 |
| 手工OTel/本地模拟流程 | 失败重试 | 成功 | 39.5 | 2 | 1 | 1 |
| 手工OTel/本地模拟流程 | 并行协作 | 成功 | 18.1 | 2 | 0 | 0 |
| 真实LangGraph/固定Mock节点 | 顺序工作流 | 成功 | 33.8 | 1 | 0 | 0 |
| 真实LangGraph/固定Mock节点 | 失败重试 | 成功 | 33.1 | 2 | 1 | 1 |

合计5条调用链、21步骤，其中两个故障注入步骤后恢复；不是5份独立业务测试集。模型调用0，Token与模型成本为`null`（未测量，不能写成零Token实测）。结果是单次固定工程实验，含人为8ms等待、浏览器/框架/系统时钟开销，不能据此排名框架性能或声称模型准确率100%。

两种路径都实际通过“下载 → 原生选择文件 → 预览 → 取消 → 重选 → 确认 → 再导出”，除未认证来源标记外，往返JSON深比较相同。请求记录为手工流程0API、LangGraph恰好1次本机POST；没有读取历史归档，没有外部请求，390px无页面横向溢出，WCAG扫描零违规。

## 十万条数据的真实口径

本夜先前只读联调确认：**117065条索引记录、55444个原始ID、391个分片、146806954字节索引**；索引与旧Manifest条数差值为**+1018**。详见 [本地历史说明](local-history-demo.md) 和 [验收证据](../evidence/pr-local-history-demo/README.md)。这些是既有结果，不是本夜重新跑出的数据；原始ID去重也不等于语义去重后的业务Case。

展示采用后端本机有界读取和前端分页，不把全部正文塞入浏览器。未知标准答案字段未自动映射；本轮早间合成采集没有再次读取归档或正文，原目录四项草稿未修改。当前实现不构成20GB执行、流式落盘、全项目跨机迁移或数据库备份承诺。

## 开源复用与自己的产品判断

完整候选优势、官方来源、许可及“已接入/设计中”区分见 [开源复用清单](open-source-reuse.md)。本夜实际落地的是：

| 实际复用 | 自己补充的产品/工程工作 |
|---|---|
| Langfuse固定提交的时间范围与调用树展开两份MIT纯逻辑 | 有界OTel适配、中文步骤检查、故障解释、来源标识；不是复制其整站UI |
| OTel真实SDK与LangGraph真实StateGraph调度/重试/回调 | 显式父子关系、隔离环境的固定Mock执行、无隐式模型调用、安全回读 |
| Ant Design中文组件 | 中文业务术语、状态提示、表格/树、键盘/窄屏/对比度验收 |
| 官方MCP SDK | 两项共享只读Action，同一业务校验供UI/API/MCP使用，不重复造协议 |
| 已有平台的数据、执行、Rubric、校准与报告 | 保留存量能力和用户数据；通过ProjectRepository隔离未来存储替换，不强装另一套数据库 |

AgentOps/Opik的过程调试、DeepEval的细分指标、promptfoo的声明式断言/红队、DeepTeam/Giskard安全测试及AgentScope适配仍是候选，不写成已经融合。仓库里的个人PR是真实产品工程贡献；没有上游PR证据就不声称已经贡献给Langfuse。

## 工程交付与下一步

本夜业务相关PR45至53，以及审计PR54、声明修正PR55均已普通合并，最终head CI证据逐项保存在对应目录。本交付PR的状态另见 [N14证据](../evidence/pr-morning-handoff/README.md)，不能拿前一个head的CI替代它。

| 主题 | 已合并PR |
|---|---|
| 中文观测与历史归档 | [45](https://github.com/boyuling-123/AI-API-workspace/pull/45)、[46](https://github.com/boyuling-123/AI-API-workspace/pull/46) |
| 旧项目保护与存储契约 | [47](https://github.com/boyuling-123/AI-API-workspace/pull/47)、[48](https://github.com/boyuling-123/AI-API-workspace/pull/48) |
| 共享Action/MCP与Langfuse源码 | [49](https://github.com/boyuling-123/AI-API-workspace/pull/49)、[50](https://github.com/boyuling-123/AI-API-workspace/pull/50) |
| 真实LangGraph、演示导览与观测回读 | [51](https://github.com/boyuling-123/AI-API-workspace/pull/51)、[52](https://github.com/boyuling-123/AI-API-workspace/pull/52)、[53](https://github.com/boyuling-123/AI-API-workspace/pull/53) |
| 新PRD逐行审计与声明校准 | [54](https://github.com/boyuling-123/AI-API-workspace/pull/54)、[55](https://github.com/boyuling-123/AI-API-workspace/pull/55) |

遵循Developer Helper的SDD方法适配：Planner规格、Developer实现、Tester验收与失败重试、证据、短分支、PR、最终CI、普通合并。不同阶段由当前会话执行，不冒充独立评审者；详细取舍见 [适配说明](../execution/DEVELOPER-HELPER-ADAPTATION.md)。不复制私人配置，不把该方法工具当平台运行时SDK。

旧75项矩阵仍为42已验证/6已实现/8部分实现/15设计中/4Demo；新夜间9项增量中8项限定已验证、1项Demo，不与旧表或PR数量相加算完成率。新PRD第5章72行是逐行审计口径（46一期/25二期/1非目标，含重复与复合项），不是72个互斥功能。

下一阶段应按 [差距审计](stage-gap-audit-2026-09-07.md) 拆短PR：先落一般数据集版本/稳定row_id与内容hash，再做被测Prompt版本、冻结RunSpec/明确Baseline、逐行RunDiff；随后接确定性评分和分维度报告，最后在确认/预算/数据可达性具备后开放写入MCP与Assistant。不先上数据库，不继续照旧加权总分堆功能。

09:00停止本夜开发、测试和推送并暂停自动任务，预览可留给本机演示。开屏不等于系统不会睡眠；本夜只用了限时防睡眠，未改永久电源、锁屏或合盖策略。具体停止状态以任务台账的最新检查点为准。
