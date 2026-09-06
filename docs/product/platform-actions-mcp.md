# 平台助手只读工具接入

## 目前能做什么

本节点为真实 MCP 服务，不是工具清单 Mock。网页 `/assistant-tools`、`GET /api/platform-actions` 和 stdio MCP 共用 `executePlatformAction`，归档直接复用已验证的本机读取器。它不是完整自主 Agent，没有内置对话模型，也不能直接访问浏览器 origin 内的 IndexedDB 项目。

观测能力声明与网页同源：真实LangGraph仅验证固定Mock节点调度，非任意用户Agent兼容；观测JSON回读来自外部文件时来源未认证，只用于查看，不证明现场执行或重放。声明修复见[P0-A规格](../features/F-ACT-001/claims-correction.md)。

| 工具名 | 输入 | 返回 | 不做什么 |
| --- | --- | --- | --- |
| `get_platform_capabilities` | `{}` | 当前两个工具、传输方式和明确边界 | 不读取归档、不调用模型 |
| `get_archive_summary` | `{}` | 已配置归档的数量、类型、核对时间与来源声明 | 不返回正文/原始 ID/模型名/文件路径，不产生新评分 |

索引条数不等于测试用例数，也不等于模型调用次数。Judge 任务与结果不能相加为评测次数；`historical-unverified` 是未认证历史来源，`synthetic` 是合成测试夹具。首次统计顺序核对索引分片；进程内缓存是核对快照，不是实时监控，源文件变化需重新连接。

## 构建与配置

需要 Node.js 20 或以上；CI 使用 Node 22。在项目目录先安装锁文件依赖，再构建独立入口：

```sh
npm ci
npm run mcp:build
```

产物 `.mcp-dist/` 被 Git 忽略。开发源文件位于 `src/mcp`；不需要先启动 Next，也不加载 `.env`。可在支持 stdio MCP 的宿主中使用下列通用配置结构，具体配置位置按宿主说明操作：

```json
{
  "mcpServers": {
    "lu-eval-workbench": {
      "command": "node",
      "args": ["/ABSOLUTE/PROJECT/PATH/.mcp-dist/mcp/stdio.js"]
    }
  }
}
```

路径是占位符，应换成此项目实际绝对路径；如 GUI 无法找到 Node，command 换成本机 Node 可执行文件的绝对路径。不要把 `npm run` 的日志放入 MCP stdout，也不要把模型密钥或原始数据写进配置。

默认归档配置为此项目根目录的 `local-data/archive-source.json`，不取宿主当前目录。该文件被 Git 忽略；配置格式和读取上限见 [历史归档说明](local-history-demo.md)。可通过显式环境变量 `EVAL_ARCHIVE_CONFIG` 指向另一个本机配置文件，但工具参数不允许传路径。迁移后需要重新配置本机路径，当前不是自动打包原始数据方案。

本次没有替用户修改任何 MCP 宿主配置或连接云端模型。外部宿主能拿到统计，且可能再将统计送给其模型供应商；只授权可信宿主，禁止把“数据源在本机”等同于“宿主全链路离线”。同一用户运行的恶意本机进程不在此只读 API 的隔离边界内。

## 网页与普通 API

打开平台的 `/assistant-tools`，点击工具才执行；页面初始不读取归档。示例只读请求：

```sh
curl -H 'x-eval-archive: local-read' 'http://127.0.0.1:3002/api/platform-actions?action=get_platform_capabilities'
```

端口替换为实际预览端口。仅 GET、仅两个动作、不接受额外/重复/超长参数；校验本机 Host、Origin、Fetch Metadata 与显式读取头，不开放 CORS。该 API 不是 HTTP MCP endpoint；MCP 走独立 stdio，不新增监听端口。

成功为 `{ "ok": true, "data": ... }`；错误为 `{ "ok": false, "code": ..., "error": "固定中文提示" }`。缺配置 503，可重试；无效参数 400；非本机同源或缺少读取头 403；非 GET 405。文件系统错误不回显私有路径。stdio 单条消息读取缓冲上限 64 KiB，仅 stdout 传协议，无业务日志。

## 测试与后续

`npm run test:unit` 先执行独立 MCP 构建，使用官方客户端启动真实子进程；覆盖 2025 legacy handshake 与 2026 pinned 协议、列工具/调用、非法参数和缺配置。所有输入为隔离合成夹具，没有真实模型或付费调用。Playwright 通过真实 Next API 验证页面及异常路径。

写入/删除/评价工具仍未开放。后续必须先设计预览、输入字段/标准答案/评价模式确认、幂等与费用审批，并解决浏览器存储桥接。不能直接将现有脚本执行接口和项目删除方法暴露给模型。

## 上游复用

实际安装 `@modelcontextprotocol/server` / `client` / `core` 2.0.0 和 Zod 4.5.4；server 为运行依赖，client 仅用于测试。使用官方 `McpServer.registerTool`、`serveStdio`、`StdioClientTransport`，没有自行重写 MCP 协议。包元数据标 MIT，但发布包 LICENSE 明确处于 MIT / Apache-2.0 迁移期，应保留原包完整许可证而不简化为全部 MIT；Zod 为 MIT。

核验于 2026-09-07：[SDK v2 官方文档](https://ts.sdk.modelcontextprotocol.io/v2/)、[stdio](https://ts.sdk.modelcontextprotocol.io/v2/serving/stdio.html)、[官方源仓库许可](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/LICENSE)。没有把此仓库的功能 PR 宣称为上游贡献。
