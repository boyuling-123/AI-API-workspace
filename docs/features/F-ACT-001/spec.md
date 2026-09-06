# F-ACT-001 只读领域 Actions 与本机 MCP

## 需求与范围

为中文评测工作台建立可供外部 Assistant 调用的真实入口，而不是将按钮清单称为 MCP。只提供 `get_platform_capabilities` 与 `get_archive_summary` 两个无参数、无写入、无模型调用的领域 Action。页面、已有 Next API 和独立 stdio MCP 进程共享同一业务实现与归档读取器。

这是助手的工具底座，不是自主对话 Agent；没有新增数据库、队列、HTTP MCP 端口或浏览器 IndexedDB 桥接。摘要只返回数量、类型、来源声明与核对时间，不返回正文、原始 ID、模型名称、文件路径或标准答案。外部宿主仍可能把统计发送给其模型，配置说明必须提示这个边界，不能称为全链路离线。

## 验收条件

| 编号 | 条件 | 证据计划 |
| --- | --- | --- |
| AC1 | 两个 Action 有唯一类型/描述和严格输入约束；未知动作、附加字段、路径参数均拒绝 | 真实业务源码单测 |
| AC2 | 归档 Action 复用原读取器，保留 historical-unverified / synthetic 来源及计数口径，不重跑评价 | 合成归档单测、共享结果一致性 |
| AC3 | Next GET API 仅本机同源、无缓存；异常不回显路径/原始错误；不支持写操作 | API 单测和浏览器异常路径 |
| AC4 | 使用锁定官方 MCP SDK，stdio 可由正式客户端连接、列工具、调用工具；未知/非法输入安全拒绝 | 真实子进程协议测试，不复制协议实现 |
| AC5 | 中文工具页清楚区分可调用与暂不支持；点击后展示真实结果，归档不自动读取；移动端和 WCAG 可用 | Playwright / axe / 截图 / 成功 Trace |
| AC6 | 独立 MCP 构建不依赖 Next dev 服务；不读取 .env 或日志到 stdout；无秘密、全量门禁与最终 CI 通过 | 构建与协议测试、Secret Scan、PR |

## 开发计划

1. 锁定并检查官方 SDK v2 发布包及许可；用现有 TypeScript 编译单独入口，不增加数据库或长期常驻服务。
2. 提取只读 Actions、中文工具页和本机 GET API；保留原归档功能，引用而不重写逻辑。
3. 用官方客户端测试 stdio 子进程和错误路径；以合成夹具进行前端测试。
4. 按 Developer Helper 适配的 Planner / Developer / Tester 循环审查；门禁后创建短分支 PR，检查最终 head CI，正常合并。

## 当前状态

- 状态：已实现，验收中；分支 `codex/feat-platform-actions`，基线 PR #48 merge `0a26dbfb`。
- Issue/PR：[PR #49](https://github.com/boyuling-123/AI-API-workspace/pull/49)，功能提交 `856062f` 已推送；本地门禁通过，最终 head CI 未完成前不标记为已验证。
- 代码证据：`src/lib/platformActions.ts`、`src/server/platformActions.ts`、`src/mcp`、`src/app/api/platform-actions/route.ts`、`src/components/assistant/PlatformTools.tsx`。
- 本地证据：250 unit（新增 13）/ 2 stress / 50 E2E，独立 MCP/Next build、lint/typecheck/Secret Scan 通过；3 条成功 Trace、合成截图与本机真实摘要联调见 [验收报告](../../evidence/pr-platform-actions/README.md)。待最终 head CI 后才标为已验证。
- 回滚：正常 revert 本节点；删除的只是工具入口，原 IndexedDB 与归档文件不变，不执行数据回滚。
- 暂缓：写入/删除/评分工具、自然语言规划、费用审批、浏览器项目桥接、完整平台权限模型、任意格式数据导入。
