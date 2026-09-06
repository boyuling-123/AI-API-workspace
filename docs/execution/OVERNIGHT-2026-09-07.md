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
- 当前分支：`codex/docs-stage-gap-audit`，从 PR #53 合并后的 `origin/main@5e25d1c` 创建；首次推送显式指定该新分支，不向 main 直接推送。
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
| N2 存储替换接口 | 已完成 | N2A 停止兼容性检查隐式删旧数据；N2B 再提取 ProjectRepository 契约，保留当前 IndexedDB | 真实源码契约测试；旧数据不变、保存/刷新回归；不迁移、不新建后端 | PR #47 / #48 已合并；F-STORE-002 237 unit / 2 stress / 47 E2E、本轮截图/Trace 与最终 CI 通过；不包括 draftDb 或后端迁移 |
| N3 最小上游复用样例 | 已完成 | 真实 OTel SDK 包围三种本地模拟执行场景 | 3 Trace/14 Span，根耗时，异常恢复，导出可回读 | `F-OBS-001`，PR #45 最终 CI 通过并合并，产品范围仍 Demo |
| N4 中文 UI 接入 | 已完成，与 N3 同 PR | Ant Design 中文组件、观测表/树、总览入口 | Mock Playwright/WCAG/视觉证据；不冒充 Langfuse Fork | 全量 E2E 40 通过，新页 axe 零违规，截图已复核，CI 通过 |
| N7 本地结果演示 | 已完成 | 只读核对数据索引、来源、字段、数量；分页/脱敏演示，不重跑 | 不改原文件，不自动映射标准答案，不提交真实数据；大数据不全量渲染 | F-DATA-001；220 unit/2 stress/43 E2E、真实本机联调与最终 CI 通过，PR #46 已合并 |
| N5 MCP/Assistant 契约 | 已完成 | F-ACT-001：两项共享只读 Action、中文工具页、同源 API、真实 stdio MCP；写动作与完整 Assistant 暂缓 | 已有/待实现明确区分；无默认模型调用；正式客户端协议与用户路径测试 | 250 unit / 2 stress / 50 E2E、修复后 9 次工具路径、最终 CI 全通过；PR #49 已合并 |
| N8 Langfuse 具体源码复用 | 已完成 | 固定上游两份纯逻辑，接入中文时间/步骤检查器，原树可展开保留 | 必须有原始文件/版本/许可及真实代码证据；不能把重绘称为 Fork，不引入完整后端 | F-OBS-002：上游 7637df1 / 264 unit / 2 stress / 52 E2E；最终 CI 通过，PR #50 已合并 |
| N9 首个真实框架适配 | 已完成 | 真实 LangGraph 1.4.14 调度固定 Mock 节点，回调接现有 OTel/检查器 | 固定版本、隔离遥测与网络；不声称全框架兼容 | F-OBS-003：278 unit / 2 stress / 55 E2E，3 条再验/截图/Trace；PR #51 最终 CI 通过并合并 |
| N10 中文面试演示入口 | 已完成 | 串起现有历史/观测/助手/工程证据，复用已有页面 | 不自动读正文/跑模型，不夸大数据与兼容性，移动端/axe/路径验收 | F-DEMO-001：287 unit/2 stress/61 E2E、截图/6成功Trace、PR #52 最终CI通过并合并 |
| N11 观测结果本机回读 | 已完成 | 两种本平台 Mock JSON，严格有界校验、确认前保留结果、来源未认证标记 | 零回读 API/模型；异常/往返/手机/axe/证据/最终 CI | F-OBS-004；298 unit/2 stress/66 E2E、5成功Trace/截图与PR #53最终CI通过，已正常合并 |
| N12 阶段差距审计 | 已创建PR，待最终CI | 最新PRD基线、72行逐项表、8MCP/4Assistant场景、下一小PR依赖、README校准 | 链接/数字/来源/范围/SecretScan通过，最终headCI；不升级业务状态 | PR54；14份Markdown/138链接/72行ID、旧75行不变、464文件扫描通过；最终CI待验 |
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

- 07:03：N12初稿 `b5561bb` 已提交推送，自主创建PR54，首轮CI `34065674746`运行中。仅文档回写后等待最终head质量/浏览器CI，不重复本轮审计；下一Ready `.sdd/next-feature-capability-claims.md` 尚未实施，独立小PR校准观测能力旧声明，再做收尾。3002预览52679保持运行，原四草稿不变，没有读正文或调用模型。

- 06:56：N12审计初稿完成。读取394行用户PRD并记录SHA；第5章72行（一期46/二期25/不做1），旧75为42已验证/33未达到已验证，本夜9增量单列。识别独立维度与旧加权策略、完整RunSpec、Baseline、Prompt版本、MCP与Assistant缺口；README更正Node18旧要求、无密钥演示和origin隔离。仅文档变更，前端本地重跑N/A，开始链接/行数/Diff/SecretScan与远端最终CI。下一ReadyP0-A单独改旧观测声明，不混入当前文档PR；预览52679未停且不自动跑任务。

- 06:40：PR53 最终 head `74e44c33d2af8ce44366c2f9c34a0fffca65e773` 的 CI `34064340036` 两道 Job success；复核head/base无漂移、Review/未解决线程为空、Ready to merge后正常合并为 `5e25d1cb826894e0141628ad0533c839fa1d428b`。最新main新建 `codex/docs-stage-gap-audit`，仅7份PR53收尾文档，N12尚未审计。预览3002/52679运行，CUA停在新观测入口且无任务运行；下次build/E2E前仅停它。06:34专属caffeinate2070仍运行、电量47%，原四项草稿未变。按 `.sdd/next-feature-stage-audit.md` 接续，不重复PR53。

- 06:32：功能提交 `c1d07f76142d2b86570fc005db024c0db15c84ec` 已推送，自主创建PR53，首次CI `34064254004` 运行中。当前仅PR/证据文档回写，最终head自身CI通过后再正常合并。3002预览52679已恢复，下次build/E2E前仅停它。下一Ready N12尚未审计，不重复当前节点。

- 06:29：N11完整quality298 unit/2 stress/build与全量66 E2E全部通过，最终中文入口5条专项路径再验通过（均无重试）、截图已复核/Trace摘要已入证据。接下来Diff/Secret Scan、提交PR及最终CI；尚未创建PR，不重复实现。预览35452仍停，测试完恢复3002。下一Ready N12仅阶段差距审计。

- 06:27：N11 已实施，首次5浏览器路径/11新单测通过；发现并修复1处lint未使用变量及原生按钮英文。完整quality298 unit/2 stress/build通过，完整66 E2E复验中；之后重拍中文入口截图/成功Trace。预览35452已停，原4项草稿未变，尚未提交/PR。下一Ready N12仅差距审计，不装新框架或后端。

- 06:09：PR52 最终 head `3cc092237a070628c6fb8d8056d9d3ebc4c8360b` 的 CI `34062846754` 两道 Job success，head/base无漂移、无Review/未解决线程，Ready to merge 后正常合并为 `106c3e52c3186798ba9e968aef39cc7e952bd7d6`。已从最新main开 `codex/feat-portable-observation`，仅7份PR52收尾文档待下轮；N11尚未审计/实施，先读 `.sdd/next-feature-portable-observation.md`。3002预览35452运行，Cua预览停在导览失败定位章节；下次build/E2E前仅停它。06:03专属caffeinatePID2070仍运行，电量51%，原4项草稿未变。

- 06:01：功能提交 `3b2db7d9963feed7528effc4437305543fbc1d8f` 已推送，自主创建PR52，首次CI `34062722427` 运行中。纯文档回写后只认最终headCI，不重复已完成代码。3002预览会话35452已恢复，实际章节点击检查通过并保留导览页；下次build/E2E前仅停它。下一Ready N11尚未审计/实施。

- 05:58：F-DEMO-001 修正后的6条专用路径、完整 `CI=1` 61 E2E 全通过（无重试），287 unit/2 stress与build通过，截图已复核、Trace保留本机。准备最后文档/扫描与提交PR，不再索取授权；预览6410停着，门禁完成后恢复。下一Ready仅为本机观测JSON回读的审计，暂未实施。

- 05:50：N10 五章导览、固定中文 MD 下载、三页共享返回导航已实现。9 新单测通过；首轮4 E2E为3通过/1文案断言错误，已按真实初始提示修正且补导出禁用断言。quality287 unit/2 stress通过，build进行中，随后全量 E2E。预览6410已停，下一轮先接验收，不重复实现；未提交/PR。

- 05:33：PR51 最终 head `ab42c56f1ecc6be2ea341eaa71ea02becbb1da9b` 的 CI `34061117640` 两道 Job success，head/base 无漂移、无 Review/未解决线程、Ready to merge 后正常合并，SHA `93f46ca1d32beb8e743404f8d7b2c7fda5dac3db`。已从最新 main 开 `codex/feat-interview-walkthrough`，仅 7 份 PR51 收尾文档，N10 尚未实施。读 `.sdd/next-feature-interview.md` 接续，不重复 N9。预览 3002 / 会话 6410 运行，真实页面 2 Trace/7 Span 已验证并停在失败步骤；下次 build/E2E 前仅停此服务。

- 05:27：功能提交 `2ca382fdcf9ce71be756ecb28b790fbf4f914c1d` 已推送，自主创建 [PR #51](https://github.com/boyuling-123/AI-API-workspace/pull/51)。首次 CI `34061034711` 已触发；正在提交纯文档 PR/证据回写，以最终 head 的 CI 为准，旧 head 如被并发策略取消不算功能失败。3002 预览已恢复 / 会话 6410，下一 build/E2E 前仅停它。下一 Ready 不变，不提前实施。

- 05:25：F-OBS-003 最终完整 quality（278 unit / 2 stress）与全量 55 E2E 全通过；3 条本主题路径再次通过并留成功 Trace，合成截图已核对。439 文件扫描通过、原四项草稿未变。接下来提交/PR/最终 CI；预览暂未恢复。下一 Ready `.sdd/next-feature-interview.md`，只串现有能力，不新加模型/框架/存储。

- 05:20：F-OBS-003 已实现并进入最终验收，独立子进程实际运行 StateGraph 与框架自动重试，真实回调产出 2 Trace/7 Span；模型调用 0。首轮 277 unit/2 stress/build 通过，补充真实取消测试待复验；全量 55 E2E 运行中。首次相关路径 5 通过/1 alert 定位歧义/1 未运行，已补固定中文可访问名称。预览 14899 已停，未提交/推送/创建 PR。

- 04:52：PR50 最终 head `e605f5b` 的 CI `34059043421` 两道 Job 全成功，head/base 无漂移、无 Review/未解决线程、Ready to merge 后正常合并，SHA `50164b7c1824211144552e25c2514094ac63d53b`。已从最新 main 建 `codex/feat-langgraph-observability`，仅本轮 PR50 收尾文档待提交，N9 尚未实施。下一步读 `.sdd/next-feature-framework.md` 和相关源码；预览 3002 / 会话 14899 正常运行，后续 build/E2E 前仅停此服务。
- 同一 automation 已更新为读最新台账，接续真实框架的无模型验证及后续中文面试演示；09:00 截止、08:40 收尾窗口不变，不重复已完成节点。系统专属 caffeinate 仍在运行，未改用户永久系统设置。
- 04:45：PR50 功能 head `7f10fee` 的 CI `34058791578` 两道 Job 成功。正在提交纯文档的 PR/证据回写，最终文档 head 仍须 CI 通过后正常合并。未启动 N9，3002 预览已通过实际页面检查，并停留在异常步骤详情。
- 04:42：功能提交 `7f10fee399bea6a5f71b20664eb28033ec6923f9` 已推送，自主创建 [PR #50](https://github.com/boyuling-123/AI-API-workspace/pull/50)，首轮 CI `34058791578` 运行中；仅 PR/证据文档回写，最终文档 head 也需 CI 通过。3002 已恢复 / 会话 14899，Next/E2E 共用 .next，下次构建前仅停此服务。下一 Ready 不变，不重复当前节点。
- 04:38：F-OBS-002 完整 quality（264 unit / 2 stress）与全量 52 E2E 全通过；原始源码/许可摘要严格匹配，4 条成功 Trace 和合成截图已复核。接下来提交/PR，最终 head CI 后正常合并。下一 Ready `.sdd/next-feature-framework.md`，不提前装框架；3002 暂停，截图复核结束后恢复。
- 04:35：F-OBS-002 已接入两份固定上游纯逻辑及有界适配器、中文步骤检查器。首轮 264 单测中 1 项发现多余末尾空行，已按上游原文修正；4 条相关 E2E 通过，原树收进可展开区域后启动完整 quality，完成后全量浏览器/截图/Trace。未提交/推送/创建 PR，3002 会话 15346 已停。
- 04:22：PR49 最终 head `ee5a168` 的 CI `34057547216` 两道 Job 成功，head/base 未漂移、无 Review/未解决线程、GitHub Ready to merge 后正常合并，SHA `4f6279e34f1f6eb339dd8b6760e0b5ed2246cbe2`。当前 `codex/feat-langfuse-trace-module` 仅 PR49 收尾文档，开始 N8 源码审计；3002 / 会话 15346 已恢复，下一 build/E2E 前仅停它。
- 04:17：名称修复后 9 次重复工具路径、250 unit / 2 stress、全量 50 E2E、构建及基础门禁再次通过；将修复和首轮 CI 证据一并提交到 PR49，再等待该 head 的 CI。未开始 N8，不用首次失败运行冒充成功。
- 04:15：PR49 首轮 CI `34056733123` Quality 通过 / 浏览器 49/50，下载失败证据后修复加载图标污染按钮名称的问题，补忙碌/禁用/恢复断言。正在跑 3 次重复路径与全量门禁，最终 head 通过前不合并、不进入 N8；预览 99950 已停。
- 04:02：功能提交 `856062fcb7c72852a56e16b26f7841a75a4644c1` 已推送并自主创建 [PR #49](https://github.com/boyuling-123/AI-API-workspace/pull/49)，首轮 CI `34056733123` 运行中；仅证据文档在回写，最终文档 head 仍需 CI 通过。3002 预览已恢复 / 会话 99950，下一轮 build/E2E 前仅停此服务。下一 Ready `.sdd/next-feature-langfuse.md`，当前不提前实施。
- 03:58：F-ACT-001 修复后完整 quality 与 50 E2E 全通过，3 条成功 Trace/合成截图已复核；真实本机 MCP 摘要联调成功，原工作树四项草稿不变。接下来只需最后 Diff/Secret Scan、commit/push/PR，最终 head CI 后合并。下一 Ready 为 Langfuse 具体源码复用审计，不开启新后端或真实模型；3002 尚未恢复。
- 03:50：F-ACT-001 已完成实现，13 项新增源码/API/正式 MCP 子进程测试通过，覆盖 2025 handshake 和 2026 pinned；全量 250 unit / 2 stress、lint/typecheck/build 通过。首轮 typecheck 发现测试用例 Header 联合类型推断问题，已明确类型后复验。3002 / 会话 36021 已停；完整 50 E2E 正在执行，结束后恢复预览。未提交/推送/创建本节点 PR，不重复实现。
- 03:30：PR #48 最终 head `cc340ab` 的 CI `34054851224` 两道 Job 全部 success；head/base 无漂移、无阻塞 Review、GitHub Ready to merge 后正常合并，SHA `0a26dbfbed36378e9b8c93ce5972d9fe67e41dfd`。当前已进入 `codex/feat-platform-actions`，只有本次 PR48 收尾文档待提交；N5 尚未编写业务代码。下一步读 `.sdd/next-feature-actions.md`、importer Skill 和相关源码，先厘清真实能力。预览 3002 / 会话 36021 仍在运行，下一轮 build/E2E 前仅停此会话。
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
