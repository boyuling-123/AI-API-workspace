# F-UI-001 主工作台信息架构重构

状态：已实现，验收中。来源：2026-09-07 用户再次明确要求按照新 PRD 重构主页面，而不是只补观测与演示页面。

## 需求与边界

主界面采用 Langfuse 的项目上下文栏、分组侧边栏、单一一级标题、页内二级导航与右侧主操作模式。首次打开显示运行记录，创建任务是显式操作，不自动执行评价。已有本地项目、数据草稿、Task 和 EvaluationRecord 保持可读，不增加数据库。

| 一级页面 | 二级导航 | 真实内容 | 尚未实现 |
|---|---|---|---|
| 评测集 | 数据工作区 | 输入、批量导入、AI 生成、下载，复用任务草稿 | 通用 DatasetVersion、row_id 哈希、版本 Diff |
| 评测对象 | 对象与接口 | 资源目录、模型/算法接口配置、连接测试 | PromptVersion + ToolConfig 组合对象 |
| 评估器 | 黄金集与校准 | 现有黄金集版本、Judge 校准、发布门禁 | 独立通用 Scorer CRUD |
| 评测任务 | 运行记录 / 新建任务 / 执行评价 | 历史、精确重跑、暂停继续、显式评价 | 不可变 RunSpec、Baseline 指针 |
| 评测报告 | 评价记录 | Case 筛选、人工复核、下载 | 跨 Run Diff 新报告 |
| 管理中心 | 模型资源 / 外部接入 / 能力状态 | 资源角色、导入接口与规划状态 | 完整权限审计 |

运行监控、本地历史归档、助手工具保留真实独立入口；它们目前仍使用独立页面壳，不能称为整站 Langfuse 移植。Benchmark 与 Review 自进化明确显示设计中，不创建假功能。新建任务保留内嵌输入编辑以兼容现有执行路径；评测集独立入口与其共享草稿，不是已版本化资产。

## 源码适配

固定 Langfuse `7637df1e1aadddbbfd0a45b960ecc97451381ce5` 的 [page-tabs.tsx](https://github.com/langfuse/langfuse/blob/7637df1e1aadddbbfd0a45b960ecc97451381ce5/web/src/components/layouts/page-tabs.tsx) 为二级页签适配来源，保留 MIT 许可。移除上游 Pages Router/querySelector、使用本项目回调和样式令牌，增加 aria-current 与普通链接修饰键行为。侧边栏和本地项目上下文为本项目实现，不伪称完整上游源码或完整 Fork。

## 验收条件

- 每个主页面只有一个 h1；输入区、配置区用 h2，不再使用跨页面连续数字作为标题。
- 左侧业务对象导航与页内导航分离；默认进入运行记录。
- 旧 tab=run/access/result/evaluate/evalHistory/calibration/overview 深链可达，引用参数不丢失。
- 浏览器前进、后退、刷新恢复对应页面；跨页面输入草稿保留。
- 主导航与深链不发起模型请求；未选择批次的评价入口提示来源。
- 390px 与 1440px 可操作，有截图和自动可访问性检查；既有 Mock 用户路径回归。

代码：`src/lib/workspaceNavigation.ts`、`src/components/layout/WorkspaceFrame.tsx`、`src/vendor/langfuse/PageTabs.tsx`、`WorkspaceBody.tsx`。测试：`tests/unit/workspaceNavigation.test.ts`、`tests/e2e/workspace-navigation.spec.ts`。PR：待本地门禁完成后创建。回滚：普通 revert 本功能提交，未做数据格式迁移。
