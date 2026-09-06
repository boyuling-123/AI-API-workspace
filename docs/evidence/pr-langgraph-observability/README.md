# F-OBS-003 验收证据

状态：本地最终验收通过，[PR #51](https://github.com/boyuling-123/AI-API-workspace/pull/51) 已创建，最终 head 的远端 CI 通过前不标记已验证。功能提交 `2ca382fdcf9ce71be756ecb28b790fbf4f914c1d`；首次 CI [34061034711](https://github.com/boyuling-123/AI-API-workspace/actions/runs/34061034711) 已触发。PR/证据回写是纯文档提交，后续以最终 head 的完整 CI 为合并门禁，不要求旧 head 重复完成。

## 真实代码路径

- `src/langgraph/runLangGraphMock.ts`：实际 StateGraph / retryPolicy / callbacks，不是复制测试实现或手写调用序列伪装框架。
- `src/langgraph/stdio.ts`、`networkGuard.ts` 与 `src/server/langgraphExperiment.ts`：固定子进程、白名单环境、网络拒绝、单任务/取消/超时/限长。
- `src/lib/langgraphExperiment.ts`：来源/版本/属性白名单/图结构与统计校验。
- 既有 `/observability` 的独立按钮、本机 API、同一 TraceInspector 与导出链路。旧 Mock 模式保留，不改历史项目数据。

## 测试与发现

首次 277 unit、2 stress、lint/typecheck/build 通过（23 路由）。补充真实进程中止测试后最终门禁待复验。首次相关浏览器 5 通过、1 失败、1 未运行：错误提示与 Next route announcer 都是 alert，测试定位歧义；为生产提示补中文可访问名称，并按名称检查，未放宽断言。另修复测试 spawn 重载类型以及固定子进程 NODE_ENV 类型要求。

最终 `npm run quality` 通过：278 unit（新增14）/ 2 stress、lint 零警告、typecheck、23 路由 build、439 文件 Secret Scan。全量 55 E2E 通过，3 条本主题路径再次通过；含实际本机 API、来源/导出、故障/取消保留旧结果、键盘、390px、axe 零违规。原目录四项草稿未变。

截图 [langgraph-lab.png](langgraph-lab.png) 已视觉复核，SHA-256 `d8695e6f0cf58aeb52e8609ca5a3327bf60b47b5e2aa1f769dbd0a940ac93342`。只含固定合成节点，不含真实业务数据。成功 Trace 保留在 Git 忽略的 `local-data/langgraph-final-e2e/`：

| 路径 | Trace SHA-256 |
|---|---|
| 真实框架/检查器/下载 | b5a4cf5dc1a5dce9d10826bd1f376212b7082aa0ebf585de0475bc3e4abe0179 |
| 故障/停止/恢复/移动端 | 8311800157ad1a7a9759f5c366ee7215857d6ad8385243af21179d1e46b7c842 |
| 真实端点拒绝跨站/数据 | f2759999b88eb064b96ad9d64679224e816d344af1917844c87d96ee6cbabff2 |

所有实验是实际框架 + 固定 Mock 节点，模型调用 0、token/成本 null；不能当作模型精度或 20GB 性能数据。构建中首页 First Load JS 为 416 kB，观测页 301 kB；框架运行代码仅由独立 Node 入口导入，未新增框架浏览器执行包。云端 CI 待 PR 后回写，不能以本地通过替代。

回滚为正常 revert 本主题提交；没有 Schema 迁移、用户数据写入、系统持久配置变更或新监听服务。
