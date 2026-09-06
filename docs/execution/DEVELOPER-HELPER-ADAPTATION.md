# Developer Helper 项目适配

## 来源与定位

本机已核对 Developer_Helper 的 `README.md`、`HARNESS.md`、`harness-core/router.md`、开发规则、开发循环及 Codex 三角色协议。它是 SDD V7_2 开发管理 Harness，附带 PyCore 底座，不是平台必须加载的运行时 SDK。

本项目采用其规格驱动、任务依赖、Developer/Tester 分离、失败修复与经验沉淀方法。不复制其私有配置，不改其他活动项目，不将 Harness 源码放入本项目或声称由本项目原创。未核定其源码再分发许可，所以仅记录本项目独立编写的适配规则。

## 明确适配项

| 默认规则 | 本项目执行方式 | 原因 |
|---|---|---|
| Vue / Python / PyCore 固定技术栈 | 保留 Next.js / React / TypeScript；不启动 PyCore | 用户要求复用现有能力、轻量化且暂不新增后端存储 |
| 必须迁入 Projects_Repo | 保留本夜独立 Git 工作树；不迁移原目录，不切换 Harness 的其他项目 | 避免覆盖已有改动和正在运行的开发状态；不宣称原生 Router 已接管本仓库 |
| 每节点人工门禁 | 用户已明确授权自动提交、PR 和通过门禁后的合并 | 不重复询问；付费、真实模型和破坏性动作不包含在授权中 |
| 调用配置的多个子 Agent | 当前会话按 Planner / Developer / Tester 顺序切换，记录结果 | 未实际启动独立子 Agent，不冒充独立人类评审 |
| Mock 阶段不跑 Playwright | 仍按本项目要求运行隔离的 Mock Playwright/WCAG | 用户已明确要求每个 PR 前端自动测试，不能退回仅静态检查 |
| .sdd 保存本机状态 | `.sdd/` 为本机忽略目录；可公开的规格、进度、测试报告在 docs | 保留追踪链而不上传本机数据和配置 |

这些是针对现有项目的显式适配，不是完整原样执行 Harness，也不是平台已经集成 Codex SDK。

## 本项目循环

1. Planner：读取最新 PRD 增量、夜间台账和 Feature Spec；只领取可验收的小任务。
2. Developer：按 Spec 修改真实业务模块，记录依赖及许可；不得用 Mock 结果证明真实模型能力。
3. Tester：重新运行源码测试、异常路径、浏览器流程、可访问性与视觉验收；失败回到修复。
4. 发布：安全扫描、Diff 与本地门禁通过后提交、推送、创建 PR；远端 CI 通过并复查 Diff 后合并。
5. 复盘：更新测试报告、台账、下一条 Ready；跨项目经验暂不写回 Harness 本体。

自建仓库合并记录不是上游社区贡献。只有真实提交到上游并被接受的改动才记为上游贡献。GitHub 不允许作者批准自己的 PR；不得换身份伪造独立批准或绕过必要审查。

## 本轮追踪

- Feature：`docs/features/F-OBS-001/spec.md` 与 `plan.md`。
- 全局任务：`OVERNIGHT-2026-09-07.md` 与 `TASKS.md`。
- 测试报告：`docs/evidence/pr-agent-observability/README.md`。
- 外部服务：无运行时模型、数据库或观测平台服务；仅安装锁定的公开依赖、正常 GitHub 工作流。
- 数据候选：仅做只读盘点，未知输入/标准答案映射不自动判定；真实业务内容不放入公开报告或测试夹具。
