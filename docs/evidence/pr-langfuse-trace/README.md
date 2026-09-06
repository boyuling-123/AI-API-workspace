# F-OBS-002 验收证据

状态：本地完整验收通过，待提交/PR 与最终 CI，不标记已验证。

## 证据对应

| 验收条件 | 代码 / 测试证据 |
|---|---|
| AC1 固定源码与许可 | `third_party/langfuse/manifest.json` / LICENSE / README；`src/vendor/langfuse`；`tests/unit/langfuseTrace.test.ts` 逆转导入替换后核对原始 SHA-256 |
| AC2 时间/层级 | 实际 vendor 时间原点、尾部范围、latency 兜底、迭代遍历、树顺序及选中定位测试；OTel 真实 SDK Mock 结果接线 |
| AC3 有界适配 | `src/lib/agentTraceInspector.ts`：单 Trace / 1000 步 / 128 层；混合 Trace、重复 ID、未知父级、循环、反向/非法时间拒绝；不修改原数据 |
| AC4 中文检查 | `TraceInspector.tsx` 与 `AgentObservabilityLab.tsx`，步骤选择、父级/状态/时间、键盘、重跑复位，异常不覆写任务状态 |
| AC5 浏览器门禁 | `tests/e2e/trace-inspector.spec.ts` 及原实验页两条回归，下载 14 Span / 1 故障不变；移动端、axe、禁止外部/API 请求 |
| AC6 范围真实性 | 无新依赖、服务、存储或模型调用；官方源码来源与本地外围 UI 分开标明，仍为 Mock 实验 |

## 失败记录

- 首轮源码摘要测试发现复制时增加了末尾空行；原样删除多余空行，不修改期望 SHA，不弱化哈希测试。首轮 264 单测中 263 通过 / 1 失败。
- 新测试文件最初缺少 `beforeEach` 的闭合，在运行浏览器前静态核对修正；typecheck 已通过。

## 本地结果

- 04:35 完整 `npm run quality`：264 项单测（新增 14）、2 项压力测试、lint 零警告、typecheck、23 路由构建、422 文件扫描通过；原始源码摘要和 LICENSE 摘要严格匹配。
- 最终布局四条相关 E2E 再次通过（22.2s），包含折叠的原树、新步骤检查、异常恢复、导出不变、键盘、移动端和 WCAG；04:38 全量 52 / 52 E2E 通过（1.8m）。
- 最终 [步骤检查截图](step-inspector.png) 已目视核对，明确标注 Mock、源码复用边界和根任务/异常步骤差异；只包含生成的合成实验数据。截图测试额外断言重新选中第三步后“下一步”可用，关闭瞬时 CSS 动画再截图，2 条路径再次通过（13.8s），未改变业务逻辑。

成功 Trace 保留在忽略的 `local-data/langfuse-final-e2e/`，本机复盘使用，不公开上传轨迹包。

| 用户路径 | SHA-256 |
|---|---|
| 异常/恢复、键盘、导出和重跑复位 | `925ed5021a9f3ee893d80daa49c468082bdf7de587831fe7ba329f354f219301` |
| 并行父子关系与 375px | `4d95fc3115ab251e5113faeed45f05991fca22df6284746c2d16c3d4c1523a18` |
| 原树/下载回归 | `9e9c6da3a33a136a7c49668aa7567eabc378212c61c8b57ee2a795e39ad6a2be` |
| 原总览入口/窄屏回归 | `4afcadf1c3835b5f84feeadc1f3ed0fe0afd0cd2dc10b4f87e7c22de719fe362` |

最终截图复核对应 `local-data/langfuse-screenshot-e2e/`：检查路径 `d72f74562d4e6747589b9bdb4c92e0df0529d60403ffc6a539ece578170578a4`，移动端 `ed42bdc476101e135cafd3f10aea000d7e22bb24429099bc88c1b3856340db46`。最后提交前 423 文件 Secret Scan 与 Diff 检查通过。

## 回滚与待验

远端最终 head CI 待实际运行记录。没有新增 npm 依赖；既有依赖审计风险未因此解决，不宣称全仓库安全完备。原工作树四项性能草稿不属于本节点。普通 revert 移除本地检查器和 vendor 文件即可，不删除/迁移任何业务数据。
