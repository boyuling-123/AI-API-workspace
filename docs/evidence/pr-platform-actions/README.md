# F-ACT-001 验收证据

状态：本地完整验收通过，准备提交/推送/创建 PR；最终 CI 待验，不标记已验证。

## 需求与代码

范围见 [Feature Spec](../../features/F-ACT-001/spec.md)。`src/lib/platformActions.ts` 是两项工具与返回契约，`src/server/platformActions.ts` 是共享业务入口；网页 `/assistant-tools` 经 `api/platform-actions` 调用，stdio 服务 `src/mcp/stdio.ts` 经官方 SDK 直接调用同一入口。归档继续复用 `localArchiveAccess` / `localArchiveReader`，没有第二份扫描实现或存储副本。

| 条件 | 本轮真实证据 |
| --- | --- |
| AC1 唯一工具与严格输入 | `tests/unit/platformActions.test.ts` 验证空参数、未知/附加字段拒绝，拒绝路径与写操作 |
| AC2 只读归档与来源 | 真实合成归档 audit、显式安全字段投影、原分片字节不变；不返回正文、模型名、原始 ID、路径 |
| AC3 同源 API 与安全错误 | 真实 route 单测及 Playwright，验证 GET / 403 / 400 / 405、缺配置 503、no-store、固定中文错误 |
| AC4 真实 MCP 协议 | `tests/unit/platformMcp.test.ts` 官方 Client 启动编译后的真实 Node 子进程，2025 legacy handshake 与 2026 pinned 各自列工具/调用；包含未知工具、非法参数和缺配置 |
| AC5 中文界面与异常恢复 | `tests/e2e/platform-tools.spec.ts` 三条用户路径；点击才调用、清除旧结果、错误重试、键盘、375px、WCAG、截图 |
| AC6 轻量独立入口 | `npm run mcp:build` 成功；子进程从非项目 cwd 启动仍能运行，不依赖 Next 服务；MCP 产物约 48 KiB（不含 npm 依赖），无新增监听端口/数据库 |

## 执行结果

- 修复后 `npm run quality`：250 项单测（新增 13 项，包含 4 项真实 MCP 子进程测试）、2 项压力测试、lint 零警告、typecheck、Next build 全通过。
- `npm run test:e2e -- tests/e2e/platform-tools.spec.ts --workers=2 --trace=on --output=local-data/actions-e2e`：3 项通过；成功 Trace 已保留。
- 全量 Playwright：修复后 50 / 50 通过（1.9m）。第一轮 48 通过 / 2 失败，不把失败轮计为验收通过。
- 03:55 截图 [platform-tools.png](platform-tools.png) 已目视检查，中文标题/工具/统计/边界区层级清晰，没有真实业务正文；截图明确使用 63 条合成夹具。
- 原工作树四项资源性能草稿未变；未读取真实密钥、未调用真实模型、未改任何宿主 MCP 配置。
- 03:57 用官方客户端从非项目 cwd 启动 stdio，默认配置成功返回真实本机归档摘要，与既有只读核对一致。实际统计记录在忽略的 `local-data/F-ACT-001-LOCAL-CHECK.md`，公开截图与 CI 仍全部使用合成夹具。
- 安装后仍有既有 npm audit 7 项风险（6 high / 1 low），未新增；本 PR 不宣称已解决整个依赖安全债务。

## 失败与修复

1. TypeScript 对测试用例中空 Header 对象推断出包含 undefined 的联合类型；将夹具显式声明为 `Record<string, string>[]`，不放宽生产校验。
2. axe 发现可滚动 JSON `pre` 缺键盘焦点；补 `tabIndex`、命名 region、可见焦点样式，保留严格 axe 门禁。
3. 错误路径测试同时匹配到 Next 隐藏 route announcer；为业务错误加中文可访问名称并精确定位，不删除框架播报节点、不弱化错误内容断言。

## 可追踪产物

成功 Trace 在 Git 忽略的 `local-data/actions-e2e/`，只含合成测试，本仓库公开 SHA-256 而不上传轨迹包。失败轮保留于 `local-data/actions-first-failure/`，便于本机复盘。

| 用户路径 | 成功 Trace SHA-256 |
| --- | --- |
| 真实工具查询与归档摘要 | `a773995796ff9655bd29b7c97ce54a4214c061940bf6ea80961448afbe7a1efa` |
| 缺配置、安全错误与重试 | `dd5d69def2ffdb599c4dcd7627000ae92f4ac7af851db42bbbd456f1ee28da95` |
| 首页入口、移动端、键盘与 API 只读限制 | `f16f99e0ae1f1c64540d6299de15174843a36623d8f4d13852444ddd2e4457d0` |

## 限制与回滚

仅两项只读工具，不是对话/自治 Assistant；没有浏览器项目桥接、写入/删除/评分工具、模型调用、后端存储或 20GB 能力。未核实任意 MCP 宿主的配置流程兼容性，只声明官方客户端的真实协议测试。外部宿主可能将统计发给模型，接入说明已提示。

普通 revert 本节点可移除工具入口和依赖，恢复旧导航；原 IndexedDB 和归档文件不变，不需要也不执行数据回滚。当前会话按 Planner / Developer / Tester 顺序自检，不冒充独立人类或子 Agent 批准；最终 head CI 和正常可合并状态仍是合并前提。
