# F-OBS-004 验收证据

分支 `codex/feat-portable-observation`，基线 `main@106c3e5`。完整本地验证通过，[PR #53](https://github.com/boyuling-123/AI-API-workspace/pull/53) 已创建，最终 head CI 待验。功能提交 `c1d07f76142d2b86570fc005db024c0db15c84ec`，首次 [CI 34064254004](https://github.com/boyuling-123/AI-API-workspace/actions/runs/34064254004) 已触发；PR 信息回写为纯文档，仍须以最终提交的完整 CI 为准。

## 范围与源码

- [需求与验收](../../features/F-OBS-004/spec.md)、[实施计划](../../features/F-OBS-004/plan.md)。
- `src/lib/portableAgentExperiment.ts`：有界读取、重复键拒绝、Zod 严格字段、既有 LangGraph 校验器、Langfuse 适配图检查、强制未认证来源标记。
- `ObservationFileImport.tsx`：本机选择、预览、确认、取消、过期读取隔离；`AgentObservabilityLab.tsx`：共用结果/导出、来源声明与下载异常保留。
- 两个格式都来自真实已有生成器：浏览器手动 OTel 三场景和本机 LangGraph 固定节点两场景；没有复制一份实验实现作为测试真值。
- 无新依赖、API、存储后端或业务数据写入；不更改原目录草稿。不代表通用 OTLP、任意 Agent 接入、20GB 数据集迁移或真实模型质量验证。

## 本地验证

- `portableAgentExperiment.test.ts`：11 项新增真实源码单测通过；包括两个生成器往返、重复/转义 JSON 键、额外/缺失字段、大小/嵌套、错误时间/图结构、错误来源/版本、读取错误和再次导出。
- `portable-observation.spec.ts`：首次 5 条路径全部通过（26.6 秒）；浏览器实际下载再选择、预览/确认/取消、坏文件与迟到读取保留当前结果、失败下载重试、390px 和 axe。
- 首次 lint 发现解构出的未使用变量，已修复，不关闭规则。首张截图发现浏览器原生文件按钮英文，换为可键盘访问的中文按钮；复用同一原生文件选择器，不自行读文件系统。
- 修复后完整 `npm run quality` 通过：458 文件 Secret Scan、lint 零警告、typecheck、298 unit、2 stress、24 路由构建。`CI=1 npm run test:e2e` 全量 66 条通过（2.3 分钟，无重试）；最终中文入口 5 条专项路径再次通过（25.2 秒，无重试）。随后文档增量再执行扫描。
- 测试来源全部为合成节点与固定故障；回读不调用 API。唯一允许的框架 POST 是测试开始时用户显式运行 LangGraph，下载后回读阶段不再调用。

## 视觉与 Trace

[中文文件预览截图](file-preview.png) 已视觉复核，旧结果在预览下方保留、来源未认证提示清晰，按钮与三级标题未重叠；移动端横向宽度和 WCAG 全规则零违规。截图 SHA256：`daf84050e32539a44c4af6baeae60d85b01b716da1ca5be51b8f5aefaca4bddd`。

文档增量后最终 Secret Scan 再次通过（459 文件），Diff 检查通过。成功 Trace 仅保留在 Git 忽略的 `local-data/portable-observation-final-e2e`，不上传原始浏览器产物。摘要如下：

| 用户路径 | Trace SHA256 |
|---|---|
| 手动 OTel 下载/确认/再导出 | `bb8d4fd8ec76741a3e615d265168abc2de3149654dc0f11a14d5f1cd1d4f86be` |
| LangGraph 下载/确认/再导出 | `a20ff1f10e2db88815bdac4958f1bb10c0669497ffe3e35597f4305c4156ae3d` |
| 损坏/重复/过大文件与恢复 | `91aeeba116826d7bc4d64a0cc04f2313c1f6d19cc8e56c892913058f4576b0db` |
| 取消迟到读取/读取失败 | `d766f82fcacc8b7c5b86630c79ab2b15fee4bc71c452aa936834deccc9561e6b` |
| 下载失败/重试/明确重新运行 | `d6531a5982f350218eb7193138d13d2e71805ad964b79e80ae01bc69ba2d155d` |

## 复查与回滚

同一会话按 Planner / Developer / Tester 角色执行，不冒充独立第二人批准。检查完整 Diff、秘密扫描、最终 PR head/base 与 CI、Review/未解决线程后，才通过普通流程合并。

回滚为普通 revert 本主题。未发生项目 Schema 迁移、归档写入或删除；回读仅替换内存显示。外部文件的 provenance 是持续显示的来源标记，不是签名或内容真实性证明。
