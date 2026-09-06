# F-OBS-001 验收记录

日期：2026-09-07。结论：本地门禁通过，远端 CI / PR 待执行。产品状态仍为 Demo；真实模型和框架回调未验收。

## 本地结果

| 验收 | 结果 | 证据 |
|---|---|---|
| Secret Scan | 通过，360 文件 | `npm run security:secrets`；后续新增文档提交前再次扫描 |
| lint / typecheck | 全通过，lint 零警告 | `npm run quality` |
| 真实源码单测 | 41 文件、209 测试通过（新增 5 条） | `tests/unit/agentObservability.test.ts` 使用真实 OTel SDK |
| 压力回归 | 2 测试通过 | 现有 task pool 测试；不代表已验证十万条或 20GB |
| 构建 | 21 路由成功 | `/observability` 页面 199kB / 首次 JS 296kB；旧首页首次 JS 415kB，后续继续关注包体 |
| 新路径 E2E | 2 测试通过 | 运行/失败恢复/详情/导出回读/刷新/首页入口/390px |
| 全量 E2E | 40 测试通过，零重试 | `CI=1 npx playwright test`，1.5 分钟 |
| WCAG | 新实验完成态 axe 违规为 0；旧页面门禁亦通过 | 不是仅跳过严重级别；新页对所有所选规则断言无违规 |
| 视觉复核 | 1440px 截图已检查，标题、表格、失败恢复树完整；390px 无页面级横向溢出 | [截图](agent-lab.png) |

## 可复现业务结果

| 场景 | Trace | Span | 工具步骤 | 异常步骤 | 重试 | 最终状态 |
|---|---|---|---|---|---|---|
| 顺序工作流 | 1 | 3 | 1 | 0 | 0 | 成功 |
| 失败重试 | 1 | 5 | 2 | 1 | 1 | 成功 |
| 并行协作 | 1 | 6 | 2 | 0 | 0 | 成功 |

模拟任务由真实 SDK 采集，耗时和 ID 每次不同。工具步骤是本地桩，非外部工具调用；真实模型调用 0，Token/Cost 为 null。无真实业务数据进入测试或截图。

## Tester 发现与修复

1. 首轮新增单测发现父子步骤时间边界可能有亚毫秒漂移。接线改为共享单调 epoch 时钟提供显式 start/end，保留父子时间范围断言，未放宽测试。
2. 首轮浏览器测试发现 Ant Design 默认链接色 #1677ff 不满足小文字 4.5:1。显式设置 colorLink/hover/active，复测 axe 为零违规，未关闭规则。

已检查新模块、现有接线 Diff 与 lockfile：旧依赖版本零变更，新增 71 个传递包；依赖不修改、无新的后端或网络 Exporter。原工作树四项草稿原样保留。

## 复现与回滚

`npm ci` 后运行 `npm run quality` 和 `CI=1 npx playwright test`。生成截图用 `CI=1 CAPTURE_EVIDENCE=1 npx playwright test tests/e2e/agent-observability.spec.ts`。

回滚该 PR 提交即可移除入口/路由/依赖，不涉及 Schema、用户记录或存储迁移。自动检查和同一会话角色切换不是独立第三方代码审查。
