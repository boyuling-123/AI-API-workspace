# F-DEMO-001 验收证据

状态：已实现，本地完整门禁通过，[PR #52](https://github.com/boyuling-123/AI-API-workspace/pull/52) 已创建，最终 head CI 待验。功能提交 `3b2db7d9963feed7528effc4437305543fbc1d8f`，首次 [CI 34062722427](https://github.com/boyuling-123/AI-API-workspace/actions/runs/34062722427) 已触发；PR 证据回写为纯文档，后续以最终 head 的完整 CI 为准。分支 `codex/feat-interview-walkthrough`，基线 `main@93f46ca`。本主题只串起现有能力，不新增模型、存储、框架依赖或真实数据复制。

## 真实代码与用户路径

- `src/lib/interviewGuide.ts`：五章固定产品模型、白名单章节解析、同源路由与公开证据、确定性 Markdown 生成。
- `src/app/interview-demo/page.tsx` 和 `InterviewWalkthrough.tsx`：服务端规范化章节、中文交互、访问提示、下载失败/恢复。
- `WorkbenchNav.tsx` 与三个既有页面：共用导航、返回对应章节；总览仅添加一个次级入口。
- [规格与验收条件](../../features/F-DEMO-001/spec.md)、[面试讲解说明](../../product/interview-demo.md)。

## 验证记录

最终 `npm run quality` 再次通过 287 unit（新增9）、2 stress、lint 零警告、typecheck、24 路由 build，451 文件 Secret Scan。导览构建 First Load JS 168 kB，不加载归档表格或框架运行包；不是网络性能或设备容量基准。

6 条本主题浏览器路径已全通过，并保留成功 Trace：总览入口与刷新、明确点击归档后才读索引、观测/助手往返不启动、固定中文 MD 下载、未知/重复章节及键盘/390px/WCAG、下载失败与恢复。导航不自动调用 API，只有显式进入归档允许既有 summary/page GET；正文、其他 API 和外部请求一律失败。页面及下载不含真实数据。

首次4条路径为3通过/1文案断言错误，修正为真实初始提示并增加下载禁用断言。首次全量59条为58通过/1超时：把所有导航串成单条超过30秒，拆成可独立验收的三条路径而不扩大超时。之后首次6条路径为5通过/1冷启动归档响应超出7秒UI断言；改为等待此次显式点击产生的真实HTTP响应、校验200，再断言连接状态和50条分页，仍保持30秒单路径限制。修正后6条全通过。最终 `CI=1 npm run test:e2e` 全量61条全部通过（2.1分钟，无重试），不拿前一轮失败或旧55条记录代替。

截图 [interview-guide.png](interview-guide.png) 已视觉检查：五章侧栏、清晰 H1/H2/H3、操作/证据/边界与主按钮可见，无遮挡。SHA-256 `90a936d5f9bd881a363c80dd611d9cc7b1689108965f43da3b05c22ad78dd01b`。截图只有固定产品说明，没有业务数据。

本机预览3002已恢复，Computer Use 实际核对历史规模章节、访问提示和章节跳转，页面停在失败定位。预览未启动实验或读取归档正文；相关业务联通以合成E2E和前序PR的本机只读证据为准。

成功 Trace 仅保留在 Git 忽略的 `local-data/interview-final-e2e/`，便于本机复核：

| 路径 | SHA-256 |
|---|---|
| 总览、章节与刷新 | 8eec76f241eccbda8059764e6c8aecd2eb241acd24dee57bf13648a8384f1069 |
| 归档索引与返回 | d6f5deee3eaaf19a098e2445372d809d32c3d8668b4dc594ecb6bd980e5c5294 |
| 观测/助手/工程证据 | 8cc7b690a0e2cf07e92e3e2ab3ca2a325a0edfc9d7b21ac792bd5f388f51dd1b |
| Markdown 下载 | 617d1b06b200f7e9a7abbc8b963281003da96eb63aa4598b63896975c08633c5 |
| 非法章节/键盘/手机 | 2b2b1ea2cd7a328ecff521a10f5f4f9adddc0a7d747fa1d94a55d86b241efbb9 |
| 下载错误与恢复 | b970d4b0dda46af486bc679a11ac59d10c3f4eb442cbd0dc9ff9c71a74d402c3 |

## 限制与回滚

导览不是完成进度；建议时长不是实测成绩。历史页仍会在进入后读取摘要与首屏，正文必须另行确认。实际 LangGraph 仍只有固定 Mock 节点；官方 MCP 仍只有两个只读动作；完整 Assistant、任意框架、后台存储与20GB执行未在本PR实现。

正常 revert 本主题即可回退导览和共享导航，不迁移、不写入、不删除任何用户数据。原开发目录四项草稿未动。验证是同一会话按 SDD 角色阶段自检，不冒充独立 Approve；最终 head CI 成功并核对 head/base/审查/合并状态后，才正常合并。
