# Langfuse 受控源码复用

- 上游：[langfuse/langfuse](https://github.com/langfuse/langfuse)。
- 固定提交：`7637df1e1aadddbbfd0a45b960ecc97451381ce5`，不是会漂移的 main。
- 许可：所选文件位于 `web/src/features/traces/`，不在 `ee/`、`web/src/ee/`、`worker/src/ee/`；根 [LICENSE](LICENSE) 原样保留（MIT Expat 及目录/第三方例外说明）。
- 本地文件与上游 SHA-256、唯一类型导入替换见 [manifest.json](manifest.json)。不复制配置、凭证、服务代码或完整 TreeNode 的服务类型依赖。

| 原始文件 | 本地文件 | 运行用途与修改 |
|---|---|---|
| [timelineCalculations.ts](https://github.com/langfuse/langfuse/blob/7637df1e1aadddbbfd0a45b960ecc97451381ce5/web/src/features/traces/fns/timelineCalculations.ts) | `src/vendor/langfuse/timelineCalculations.ts` | 全树时间原点/范围、选中行滚动；只加来源头、替换 type-only import，函数体不改 |
| [flattenTreeOrder.ts](https://github.com/langfuse/langfuse/blob/7637df1e1aadddbbfd0a45b960ecc97451381ce5/web/src/features/traces/components/TraceLogView/fns/flattenTreeOrder.ts) | `src/vendor/langfuse/flattenTreeOrder.ts` | 按父子结构、同级开始时间展开步骤；只加来源头、替换两处 type-only import |

`src/vendor/langfuse/types.ts` 是本项目编写的最小结构类型，不宣称为上游原文件。`src/lib/agentTraceInspector.ts` 校验单 Trace 图及时间，把已有 OTel 结果转成该结构，再调用实际 vendor 函数。`TraceInspector.tsx` 是中文/Ant Design 外围 UI，不冒充上游页面源码。

## 二级导航适配（2026-09-07）

`src/vendor/langfuse/PageTabs.tsx` 基于同一固定提交的 `web/src/components/layouts/page-tabs.tsx` 适配，文件不在商业许可目录中，沿用本目录 MIT 许可。与上方两个未改变函数体的模块不同，该组件去掉 Pages Router、querySelector 和通用 className 入参，改为本地回调、语义链接、aria-current 与 44px 触控区域；不是字节一致的 vendoring，因此不加入上方“逆转导入即可匹配摘要”的 manifest.files。通过实际主页面导航 E2E 验收。主侧边栏为本项目编写，不能称为完整 Langfuse 前端 Fork。

## 未移植的容器

- [TraceTimelineCompact.tsx](https://github.com/langfuse/langfuse/blob/7637df1e1aadddbbfd0a45b960ecc97451381ce5/web/src/features/traces/components/TraceTimelineDense/TraceTimelineCompact.tsx) 直接依赖 TraceData、Selection、Playhead、ViewPreferences、预取与选择 Hooks；移植需要其应用上下文和数据接入，不能将整个容器当作无后端组件。
- [treeNode.ts](https://github.com/langfuse/langfuse/blob/7637df1e1aadddbbfd0a45b960ecc97451381ce5/web/src/features/traces/types/treeNode.ts) 含 `@langfuse/shared`、Decimal、成本和服务字段。本节点不提供这些能力，只在类型边界声明纯函数真实所需字段。
- `timeline/viewTransform.ts` 注释说明部分思路从 Sentry 移植；第三方来源与再分发边界未进一步核定，因此本节点不采用，不能只凭根 MIT 批量复制所有候选。

## 更新和验证

1. 更新时重新固定上游提交，核对每个原始文件及许可；不得只改 manifest 摘要让测试通过。
2. `tests/unit/langfuseTrace.test.ts` 直接调用 vendor 实现；还会逆转声明的来源头/导入替换后验证原文摘要。函数体的意外变更会令测试失败。
3. 当前范围包含 Date 毫秒坐标、根 latency 兜底、父子树展开和垂直选中定位；不包含整站 UI、缩放/播放、实时接收、数据持久化或框架兼容承诺。
4. 遇到需要改变上游函数体的修复，先记录本地 patch 与用例，再考虑真实上游贡献。本仓库 PR 不是上游贡献证据。
