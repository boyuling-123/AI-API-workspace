# 2026-09-07 夜间开发台账

## 执行窗口

- 时区：Asia/Shanghai。
- 硬截止：2026-09-07 09:00:00 +08:00（2026-09-07T01:00:00Z）。
- 收尾窗口：08:40 起不再领取新开发任务；仅保存检查点、整理证据和总结。
- 09:00 后不开发、不启动测试、不提交、不推送；暂停 `automation` 并汇报真实成果。
- 定时接续不等于保证无中断运行；网络、账号额度、应用退出、合盖、断电或系统重启可能中断。

## 唯一工作入口

- 原仓库：`../AI-API-workspace-v5`，本夜不得修改或清理其未提交草稿。
- 隔离工作树：`AI-API-workspace-overnight-20260907`，本文件所在仓库。
- 起始基线：`origin/main@caa2517`，已成功 fetch 后创建。
- 当前分支：`codex/refactor-project-repository`，从 PR #47 合并后的 `origin/main@3281918` 创建；首次推送显式指定该新分支，不向 main 直接推送。
- 自动任务：`automation`，已从旧线程迁入本次讨论线程，并替换旧 v6 存储开发指令。
- 每轮开始先读取本文件、`TASKS.md`、`WORKLOG.md`、最新用户消息和 `git status`。
- 每轮结束记录当前分支、提交、测试结果、PR、未完成步骤与下一项 Ready。

## 最新需求优先

1. 优先复用成熟框架的真实源码、组件或库，不按截图重新绘制一套平台。
2. 暂不新增或迁移后端存储；保留 IndexedDB，隔离可替换存储接口。
3. 暂不部署完整 Langfuse 及其数据库、队列、对象存储依赖。
4. 不新增 PostgreSQL、ClickHouse、Redis、MinIO 或 SQLite 后端。
5. UI、API、MCP 应复用业务 Action，而不是把每个视觉按钮做成独立工具。
6. 新评测流程按维度呈现，不新增加权总分；旧记录保持可读，不篡改历史。
7. 保留原目录四项资源性能草稿，不将其夹带提交，不重新按旧 POOL 顺序开发。
8. 不读取真实密钥，不跑真实或付费模型，不自动启动用户评价。
9. 最新用户定位是产品经理使用的中文本地小型评测工作台；参考 Developer Helper 的 SDD 流程，按 `DEVELOPER-HELPER-ADAPTATION.md` 适配，保留当前技术栈和工作树。
10. 先交付可解释的 Agent 观测实验，再做十万级既有结果的只读面试演示。真实业务数据、历史模拟数据和本次 Mock 分开；未知标准答案映射不得自动导入评分。
11. 提交、推送、创建 PR 及通过 CI 后合并已获授权，不再询问确认；不能伪造独立评审或绕过分支保护。

## 本夜任务队列

队列状态与产品能力状态分开；下列 Ready 不代表功能已实现。

| 节点 | 队列状态 | 范围 | 验收条件 | 当前证据 |
|---|---|---|---|---|
| N1 源码复用基线 | 已完成 | 记录候选、许可边界、旧代码复用与本夜限制 | 文档可追溯；Diff/Secret Scan 通过 | `../product/open-source-reuse.md`；PR #45 已合并 |
| N2 存储替换接口 | N2A 已完成，N2B 验收中 | N2A 停止兼容性检查隐式删旧数据；N2B 再提取 ProjectRepository 契约，保留当前 IndexedDB | 真实源码契约测试；旧数据不变、保存/刷新回归；不迁移、不新建后端 | PR #47 已合并；F-STORE-002 契约与默认适配器已实施，真实契约/依赖边界测试与全门禁验收中，未提交 |
| N3 最小上游复用样例 | 已完成 | 真实 OTel SDK 包围三种本地模拟执行场景 | 3 Trace/14 Span，根耗时，异常恢复，导出可回读 | `F-OBS-001`，PR #45 最终 CI 通过并合并，产品范围仍 Demo |
| N4 中文 UI 接入 | 已完成，与 N3 同 PR | Ant Design 中文组件、观测表/树、总览入口 | Mock Playwright/WCAG/视觉证据；不冒充 Langfuse Fork | 全量 E2E 40 通过，新页 axe 零违规，截图已复核，CI 通过 |
| N7 本地结果演示 | 已完成 | 只读核对数据索引、来源、字段、数量；分页/脱敏演示，不重跑 | 不改原文件，不自动映射标准答案，不提交真实数据；大数据不全量渲染 | F-DATA-001；220 unit/2 stress/43 E2E、真实本机联调与最终 CI 通过，PR #46 已合并 |
| N5 MCP/Assistant 契约 | 待 N2 | 复用已有 MCP 能力，定义缺失业务 Action、确认和预算边界 | 已有/待实现明确区分；无默认模型调用；禁止把只写类型标为已验证 | 未实现 |
| N6 收尾 | 等待窗口 | 停止领取，保留成果，汇总 PR/测试/遗留项 | 09:00 停止开发；暂停同一自动任务；不伪造预览链接 | 未开始 |

每轮只领取 1 至 3 个相关节点。若 N3 没有合适的可独立复用模块，记录实证和暂缓理由，不为完成数量而重写替代品。N2 的契约拆分不得顺带提升 Schema 或清理不兼容记录；发现历史删除行为时必须有单独迁移保护方案。

## 提交门禁

- 小型 `codex/` 分支，明确完成范围与回滚方式。
- 提交前执行适用的 Secret Scan、lint、typecheck、真实源码 unit、build；涉及 UI 或数据读写必须有 Mock Playwright/WCAG 与截图/Trace。
- 新增外部源码须记录固定版本、文件清单、LICENSE/NOTICE 和本地改动，禁止引入企业许可代码。
- 文档或纯逻辑变更应明确哪些前端门禁不适用，不复制旧测试数字冒充本轮结果。
- 本地门禁通过后可以 commit/push/create PR；GitHub CI 只能在推送后运行，未通过不得合并或标为已验证。
- 认证失败仅记录一次，保留本地成果并继续可做任务；不可绕过审批、强推、改写历史或反复请求同一确认。

## 初始检查点

- 01:00：系统限时防睡眠已启动，专属 launchd 标签为 `com.lu.eval-platform.overnight-20260907`，09:00 自动释放；不改锁屏、合盖、更新策略。
- 01:03：Git fetch 成功；从干净远端基线创建隔离工作树；原工作树四项未提交改动保持不变。
- 已安排同一 heartbeat 在每小时 00/15/30/45 分接续，包含 09:00 收尾，截止后不再调度。
- `gh` 未安装，但已有 GitHub 连接器；其登录身份与仓库所有者不同，创建 PR 前检查实际仓库权限，不读取凭证文件。
- 初始文档变更的 Secret Scan 已通过（350 个仓库文件），`git diff --check` 通过。尚未提交/推送或创建本轮 PR；新功能没有开发或测试，不能计为完成。
- GitHub 已确认历史 PR #44 为 Merged，合并提交 `caa2517ce66df73e3b5c32b5ac673b139c000e6a`；不重复创建、测试或合并 PR 08B。
- 01:27：按最新要求优先推进 N3/4：已安装锁定 OTel/Ant Design 依赖，独立实验页面与真实源码测试就绪，5 条新增单测通过；首轮 E2E 1 通过/1 对比度失败，正在修复复验。尚未提交/推送/创建 PR。下一轮先查当前验收进程，不重复安装/实现。

## 最新检查点（优先于初始记录）

- 03:23：PR #48 首轮 CI `34054586655` 两道 Job 全部 success；仅文档的最终证据回写准备提交，仍需最终 head 的 CI 通过后再合并。尚无 N5 业务代码变更，下一 Ready 不变。
- 03:21：功能提交 `1025f8e` 已推送并自主创建 [PR #48](https://github.com/boyuling-123/AI-API-workspace/pull/48)，base `main@3281918`、19 文件。首轮 CI `34054586655` 运行中，正在回写 PR 证据文档；最终文档 head 仍须 CI 通过后再合并。3002 预览已恢复，会话 `36021`；下一 Ready `.sdd/next-feature-actions.md`，不重复 N2B。
- 03:18：F-STORE-002 完整 quality（237 unit、2 stress、lint/typecheck/22 路由构建）与 47 E2E 通过；4 条存储路径成功 Trace 与本轮合成截图已采集、复核，后续只需完成最终 Diff/Secret Scan 后提交创建 PR。下一 Ready 写入 `.sdd/next-feature-actions.md`，先审计现有 Skill/MCP，别把接入 Agent 当作整个平台 Assistant。3002 暂停状态待恢复；未提交/推送/创建本节点 PR。
- 03:13：F-STORE-002 已实现最小契约/组合入口/默认 IndexedDB 适配器，纯兼容与错误策略从 db.ts 提出并保留旧导出，useProject 不再直接依赖 db。8 项新增测试首轮 7 通过/1 因 Dexie 包装异常而与测试的引用相等假设冲突，已改为验证失败/类型/数据不变/安全文案，正在复验；未改存储错误行为。3002 会话 9147 已停，完整构建/E2E 完成后恢复。尚未提交/推送/创建本节点 PR。
- 03:04：PR #47 最终 head `89d21c9` 的 CI `34053385100` 两道 Job success，复核 head/base 未漂移、无 Review 或未解决线程、正常可合并后完成合并，SHA `328191879d0bc4117a608f386041c796c37f6a1a`。当前进入 `codex/refactor-project-repository`，仅本次 PR47 收尾文档待提交；N2B 业务代码尚未开始。下一步按 `.sdd/next-feature-repository.md` 生成 F-STORE-002 规格，禁止重复 N2A 或扩大为后端迁移。
- 02:56：PR #47 功能提交首轮 CI `34053067332` 两道 Job 全部 success；准备仅文档的最终证据提交，最终 head 自身 CI 通过再合并。代码和测试未变，不重复运行或虚报新测试。预览仍是 3002 / 会话 9147；原目录草稿未动。
- 02:52：功能提交 `037c527` 已推送并自主创建 [PR #47](https://github.com/boyuling-123/AI-API-workspace/pull/47)，base `main@fe29d91`、17 文件。首轮 CI `34053067332` 运行中；仅本次 PR 证据文档在回写，最终文档提交也须 CI 通过后才合并。3002 预览已恢复，会话 `9147`。下一 Ready 仍为 `.sdd/next-feature-repository.md`。
- 02:50：完整 quality 与 47 项 Playwright 回归通过，新提示 WCAG 零违规、390px 无溢出、合成截图已复核。接下来提交 F-STORE-001 并创建 PR；最终 head CI 必须通过。下一 Ready 已写入 `.sdd/next-feature-repository.md`，本轮不得夹带 N2B 实施。
- 02:47：F-STORE-001 已实施：全表只读分类（不遗漏无 updateTime 索引记录）、同 ID 写保护事务、保留数量提示及固定异常文案。新增 dev-only fake-indexeddb 6.2.5，真实 Dexie 测试 9 项通过，全量 unit 229/压力 2 通过，完整 quality/build 与 4 条新增 E2E 正在验收。未提交/推送/创建本节点 PR。预览会话 65336 已停止，完成本轮门禁后恢复 3002。
- 02:31：PR #46 最终 head `53f9586764c68bb286d1f7ba4df9d62459f2b3da` 的 CI `34051689031` 两道 Job 全部 success。复查 head/base 无漂移、无 Review 或未解决线程、GitHub Ready to merge 后，通过正常浏览器流程合并；GitHub 确认 merged=true，合并 SHA `fe29d9131c0ad1eae5648f8e895c152d10ca9276`。
- 当前已进入 `codex/fix-preserve-legacy-projects`。仅有 PR46 收尾文档待提交，属于本次自主改动；没有开始 N2A 业务代码。下一步读 `.sdd/next-feature-store.md`，生成 F-STORE-001 公开规格后实施。先停止兼容性检查的隐式 bulkDelete，再做 N2B 契约，禁止旧数据被静默清理。
- 本机 `/history-demo` 已加载真实历史索引摘要与分页，中文历史状态通过实际页面核对，默认正文仍隐藏；`/observability` 仍可运行明确标注 Mock 的三组实验。3002 预览会话 `65336`（启动时间 02:18）仍是本工作树，开始 build/E2E 前仅停此服务并在结束后恢复。
- 自动任务已更新为从最新台账取任务，不再硬编码“先重做观测实验室”；09:00 截止与 08:40 收尾窗口未变。下一轮不要重复创建或合并 PR45/46。

- 02:24：PR #46 功能提交 `2f94428` 的 CI run `34051378800` 两个 Job 全部 success；Review 与未解决线程均为空。正在提交仅文档的 PR/CI 信息回写，最终 head 自身 CI 通过后再核对分支并合并。下一 Ready 为 N2A：禁止兼容性检查自动删旧项目，保持既有 IndexedDB；N2B 契约提取后做。

- 02:20：功能提交 `2f9442836a234c505329a722a22468bc90932480` 已推送，已自主创建 [PR #46](https://github.com/boyuling-123/AI-API-workspace/pull/46)，base `main@f4a4422`。首轮 [CI run 34051378800](https://github.com/boyuling-123/AI-API-workspace/actions/runs/34051378800) 运行中。当前未提交的文档是本次 PR 信息回写，需扫描提交；最终 head 的 CI 全通过再合并，不能只验旧 head。
- 3002 独立预览已恢复，`/history-demo` 已连接本机归档；进程为本工作树的 dev server。后续构建/E2E 前停此预览，结束后恢复，不动其他服务。

- 02:18：F-DATA-001 最终代码完整 quality 与全量 43 E2E/WCAG 再次通过，单测增加至 220。真实归档通过 API 与浏览器核对，默认不读正文；补上中文历史失败标签。原目录四项草稿未变。接下来提交本节点并创建 PR，远端 CI 通过才合并；不重复开发或误认为 PR 已创建。

- 02:09：F-DATA-001 契约、受限本机读取器/API、中文历史演示页、源码单测与合成夹具 E2E 已实现。首轮 quality 通过 219 unit、2 stress、22 路由构建；E2E 发现并修复 Next 内部 URL 与浏览器 Host 别名差异造成的 403，未放宽跨站保护；正在复验。本节点仍未提交、推送或创建 PR。
- 真实路径配置只保存在 Git 忽略的 `local-data/archive-source.json`；测试通过独立 `EVAL_ARCHIVE_CONFIG` 使用合成夹具。3002 预览暂停以避免与 build/E2E 争用 .next，测试完成后需恢复。

- 01:43：PR #45 最终 head `51d2c62` 的 [CI run 34049163074](https://github.com/boyuling-123/AI-API-workspace/actions/runs/34049163074) 两个 Job 全部 success；复查 head/base 未漂移，Review/未解决线程均为空，GitHub 显示 Ready to merge。已按授权正常合并，合并 SHA `f4a4422bfb3659c026a299d2786213f760129d8d`。
- 当前已切到下一短分支 `codex/feat-local-history-demo`。仅有本次收尾文档待提交，不重复开发/创建/合并 PR #45。下一节点先读 `.sdd/next-feature.md` 与 `local-data/INVENTORY.md`，补 F-DATA-001 规格后实施。

- 01:34：功能提交 `7b284f3` 已推送；[PR #45](https://github.com/boyuling-123/AI-API-workspace/pull/45) 自主创建，远端 Quality Gate 开始运行。检查 PR 当前 head 的最新 CI，不要只检查旧功能提交。
- 本地 `quality` 完整通过：361 文件最终 Secret Scan，lint/typecheck、209 unit、2 stress、21 路由 build；全量 40 E2E 通过。截图与验收报告见 `../evidence/pr-agent-observability/README.md`。
- 预览为 `http://127.0.0.1:3002/observability`，01:35 已得到 HTTP 200；由本工作树的 dev server 提供，恢复前先检查端口/进程，不覆盖原平台进程。
- GitHub 连接器只有读权限，浏览器已以仓库所有者登录；Git CLI SSH 推送可用，PR 创建已通过浏览器完成。无需再次问用户授权。
- 数据已逐片只读核对，详细清单位于 Git 忽略的 `local-data/INVENTORY.md`；`.sdd/tasks.json` 记录 Developer Helper 适配状态。这些本机记录禁止上传。
- 不得用最终任务成功掩盖中间失败，不把检索行数冒充独立实验数。N7 仍未完成，不可将本地数据盘点标为已经导入/加载。

## 收尾规则

进入收尾窗口先保存状态。09:00 唤醒时先暂停 `automation`，再汇总，不再开开发工具链。若错过截止，下一次恢复也只能收尾。仅在核实标签确为本夜任务时移除已到期的 launchd 任务，不影响用户其他进程，不关机。总结须区分已实现、已验证、待 CI、待开发，并给出真实 PR 链接与测试证据。
