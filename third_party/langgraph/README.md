# LangGraph 依赖审计与本地适配

2026-09-07；F-OBS-003。通过 npm 安装锁定依赖，未复制/修改上游实现；完整性以 `package-lock.json` 为准。实际使用 StateGraph、StateSchema、START/END、retryPolicy 及 Core callbacks，未安装模型 Provider。

| 包 | 固定解析版本 | 许可与来源 | 用途 |
|---|---|---|---|
| @langchain/langgraph | 1.4.14 | [LangGraph JS](https://github.com/langchain-ai/langgraphjs)，发布包 LICENSE 为 MIT，Copyright 2024 LangChain | 真实图编译/调度/重试 |
| @langchain/core | 1.2.9 | [LangChain JS](https://github.com/langchain-ai/langchainjs)，发布包 LICENSE 为 MIT，Copyright LangChain, Inc. | 实际回调协议 |
| @langchain/langgraph-checkpoint | 1.1.5 | npm 锁定包 MIT | 传递依赖；未实例化持久化 checkpointer |
| @langchain/langgraph-sdk | 1.10.2 | npm 锁定包 MIT | 传递依赖；未实例化远程 Client 或 Graph 服务 |
| @langchain/protocol | 0.0.19 | npm 锁定包 MIT | 传递协议依赖 |
| langsmith | 0.10.2 | 发布元数据 MIT；对应 gitHead [4792a53 的 LICENSE](https://github.com/langchain-ai/langsmith-sdk/blob/4792a53f807e9129fd4f5c243056d1976e2cff80/LICENSE)，MIT，Copyright 2023 LangChain | 传递依赖；没有启用云端跟踪或读取模型密钥 |

本轮新增 20 个 npm 包，全部锁文件许可元数据为 MIT；不是只有一个无依赖的轻量函数。Langsmith 发布目录未包含独立 LICENSE 文件，已补查其 npm gitHead 对应的上游许可；若后续分发离线依赖包，需要一并包含该固定许可。本 PR 不分发 node_modules 或上游源码压缩包。

## 上游行为校准

官方 [Quickstart](https://docs.langchain.com/oss/javascript/langgraph/quickstart) 展示真实 Graph API；本工作台没有使用其中的外部模型例子。固定合成节点、OTel 白名单适配、本机执行 API、隔离策略及中文交互均为本项目编写。

Core 1.2.9 的 `handleChainStart` 实际传入 parentRunId 的位置是第四个、runName 是第八个，但 `base.d.cts` 声明顺序不同。适配锁定运行时而不是只相信声明，真实 StateGraph 子进程测试检查两条根链和全部 7 个步骤；升级依赖必须重跑。

| 审计对象（安装包内） | SHA-256 |
|---|---|
| core/dist/callbacks/manager.cjs | d0187ceb2de4a2116487e85fa7cac0124146325e762a97e4e23568b86f7b29d9 |
| core/dist/callbacks/base.d.cts | 1af03a9be29013c846d86d17c9b7cd73c35f085f5d2ffd6b97141bfadb429f0f |
| langgraph/dist/pregel/retry.cjs | 4edc1b26ad2f8c5da028d7c306eed4e7aed05818f8752ced4246b26f8a869885 |
| langgraph/LICENSE | dbeab89f4ab409184f943dd1b882c3ece706b365eabc3569844e095cea247cde |
| core/LICENSE | 4ec67e4ca6e6721dba849b2ca82261597c86a61ee214bbf21416006b7b2d0478 |

## 执行与部署边界

- Next API 只调用固定编译入口，不接受 prompt、原始数据、文件路径、命令或环境参数；不是 Agent 上传/插件执行器。
- 子进程只携带固定 NODE_ENV 和关闭遥测标志，不复制父进程环境。`LANGCHAIN_TRACING` 特意为空串，避免旧代码将字符串 `false` 当成真值。
- 导入框架前拒绝 fetch、HTTP、HTTPS、TCP、TLS、UDP；任何被拦截的网络尝试均使本次实验失败。不是恶意代码沙箱。
- 每个 Next Node 进程一次一个实验、10 秒超时、64 KiB 输出上限；取消终止本次子进程，不使用持久化队列、数据库或新监听端口。
- `npm run dev` / `npm run build` 自动编译 `.langgraph-dist`。本地部署保留完整项目、node_modules 与该目录；不承诺独立 `.next/standalone` 或 Edge 部署。浏览器只下载契约校验和 UI，不导入框架执行模块。
- npm audit 仍有基线中的 7 项（6 high/1 low），未 force upgrade；不将“无新增告警”写成全项目无漏洞。
