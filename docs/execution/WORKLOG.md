# 测评平台开发纪实

## 2026-08-25：PR 01 启动

- 确认远端仓库为 `boyuling-123/AI-API-workspace`，远端基线只有 `main` 和一个初始提交。
- GitHub SSH 身份验证成功，具备后续推送分支的条件。
- 新建规范工作目录 `/Users/lu/Desktop/评测平台/AI-API-workspace-v5`。
- 创建分支 `codex/chore-baseline-sync`。
- 从原目录镜像迁移当前源码；原目录保持不变。
- 排除 `.env.local`、`node_modules`、`.next`、日志、缓存、输出目录、TypeScript 构建缓存、ZIP 包和本地 Agent 状态。
- 将四个尚不存在的规划 API 明确降级为“设计中”或“Demo”。
- 建立 75 条 v5.0 能力矩阵；当前没有能力被标为“已验证”。

- 敏感信息扫描通过：未发现真实 `.env`、私钥文件或常见 Token 前缀；示例环境变量为占位值。
- `npm ci` 完成，`npm audit` 报告 9 个高危依赖问题，已登记到 PR 02，未执行破坏性强制升级。
- 修复 ESLint 配置向父目录级联的问题，`npm run lint` 通过并保留 9 条既有警告。
- `npm run build` 与 `npx tsc --noEmit` 通过。
- 遗留任务池冒烟脚本 4 项通过；因脚本复制实现逻辑，不作为“已验证”证据，真实源文件测试列入 PR 02。
- Playwright 验收首页和“接口创建&管理”用户路径通过；四个规划路由状态准确，控制台无错误，未触发模型调用。
- 验收截图：`docs/evidence/pr-01/api-capability-status.png`。

- 暂存区 Diff 和二次敏感信息扫描通过，提交 `792c857` 已推送至远端分支 `codex/chore-baseline-sync`。

## 2026-08-25：PR 01 合并

- 创建 [PR #9](https://github.com/boyuling-123/AI-API-workspace/pull/9)，目标为 `main`，来源为 `codex/chore-baseline-sync`。
- PR 内容、2 个提交、101 个文件、回滚方案和测试证据核对无误。
- 远端 `main` 未发生并行更新，以非强推 fast-forward 方式推进，GitHub 已确认状态为 Merged。

## 2026-08-25：PR 02A 启动

- 从最新 `main` 创建短生命周期分支 `codex/test-real-source-ci`。
- 删除 `testTaskRunner.mjs` 和 `stressTaskRunner.mjs` 中的复制实现，Vitest 直接导入 `src/lib/taskRunner.ts`。
- 新增 11 项真实单元测试和 2 项压力测试，覆盖失败隔离、取消、进度、非法并发和 2,000 任务场景。
- 真实测试发现并修复 `NaN` 并发不会启动 worker 的缺陷。
- 新增 Secret Scan，覆盖仓库新文件、环境文件、常见 Token 和私钥，并保证失败日志不回显 Token。
- 新增 GitHub Actions，按 secret scan、lint、typecheck、unit、stress、build 顺序执行，不调用模型。
- `npm audit` 当前报告 8 个高危依赖问题，继续作为后续独立修复项，不执行 `--force`。
- 本地 `npm run quality` 完整通过：179 个仓库文件扫描、11 项单测、2 项压力测试、lint、typecheck 和 19 路由生产构建均成功。
- 在提交 `275aea2` 的独立 `/tmp` 工作树执行全新 `npm ci` 与 `npm run quality`，结果再次通过，确认不依赖本机缓存或旧构建产物。

下一步：完整质量门禁、干净环境复验、证据归档和 PR 02A。

## 2026-08-26：PR 02A 验收

- 创建 [PR #10](https://github.com/boyuling-123/AI-API-workspace/pull/10)，目标为 `main`，来源为 `codex/test-real-source-ci`。
- GitHub Actions `Quality Gate / Lint, test, build, and secret scan` 首轮通过，形成远端 CI Trace。
- TASK-001 同时具备真实源码代码证据、异常路径测试、压力测试、干净环境复验和 CI Trace，升级为“已验证”。
- TASK-002 因 QPS 调度尚未实现继续保持“部分实现”；SEC-003 因完整日志与外部生成物泄漏测试尚未补齐继续保持“部分实现”，不因单次 CI 过度升级状态。

下一步：提交本次验收回写，等待最终 CI 通过后合并 PR #10，再创建 PR 02B。

## 2026-08-26：PR 02B 启动

- PR #10 最终 CI 通过后，以非强推 fast-forward 推进 `main`；GitHub 已确认 PR 状态为 Merged。
- 从最新 `main` 创建短生命周期分支 `codex/test-playwright-a11y`。
- 接入 Playwright Chromium 与 axe-core，新增首页、接口状态、导入深链、AI 评价安全入口和两页 WCAG 扫描，共 6 项真实浏览器测试。
- 测试 fixture 拦截所有 `/api/**` 请求；安全导航一旦触发 API 即失败，常规 E2E 不调用模型。
- 首轮失败 Trace 真实发现 Tab 名称歧义、深链等待条件不通用、目标卡片嵌套 checkbox 和多处颜色对比不足。
- 修复目标卡片为标准 `aria-pressed` 切换按钮，增加工作区 Tab 语义和模式按钮状态，并校准已覆盖页面文字颜色。
- 复测 6 项全部通过；失败时自动保留 HTML 报告、Trace 和截图，CI 上传证据保留 7 天。
- 提交 `b9e203c` 后建立独立 `/tmp` 工作树，执行全新 `npm ci`、完整 `npm run quality` 和 `npm run test:e2e`，结果全部通过。

下一步：回写干净环境证据、推送分支并创建 PR 02B，等待 GitHub CI。

## 2026-08-26：PR 02B 验收

- 创建 [PR #11](https://github.com/boyuling-123/AI-API-workspace/pull/11)，目标为 `main`，来源为 `codex/test-playwright-a11y`。
- GitHub Actions 的核心质量门禁与 `Playwright user paths and accessibility` 两个 Job 均通过。
- DOC-006 同时具备页面代码、四个规划路由状态断言、真实浏览器路径、无 API 调用约束、无障碍扫描、干净环境复验和 GitHub CI Trace，升级为“已验证”。
- CLI-005 只验证了引用式导入深链，反向交接仍未实现，因此继续保持 Demo。

下一步：提交验收回写，等待最终 CI 通过后合并 PR #11，再开始 PR 02C。

## 2026-08-26：PR 02C 启动

- PR #11 两道 CI 通过后，以非强推 fast-forward 推进 `main`；GitHub 已确认 PR 状态为 Merged。
- 从最新 `main` 创建短生命周期分支 `codex/chore-quality-debt`。
- 修复 Hook 依赖不完整、不稳定数组依赖和动态用户图片 lint 说明，`npm run lint` 从 9 条警告降为零警告。
- 新增统一 `redactSensitiveText`，在脚本成功输出、失败 stderr、安装输出、Agent Prompt、参数摘要与模型错误边界脱敏。
- 新增 5 项脱敏测试，其中 2 项直接运行真实 Node 子进程，验证注入 Key 不会从成功结果、原始输出或失败 stderr 返回。
- 首轮 Secret Scan 拦截到测试中的 AWS 形态假 Token；样例改为运行时拼接后通过，扫描规则未被放宽或绕过。
- Vitest 增加 `@/` 别名解析并保留原有 Node 环境、测试范围和 30 秒超时约束，使服务级测试可直接导入真实源码。
- 执行非破坏性 `npm audit fix`，升级 `js-yaml` 与三处 `brace-expansion`，高危依赖由 8 个降为 6 个。
- 剩余风险中，Next/PostCSS 与 ESLint/Glob 只能通过框架大版本迁移处理，`xlsx@0.18.5` 无 npm 官方修复版；本 PR 不使用 `--force` 制造破坏性升级。
- 本地 `npm run quality` 通过：185 个仓库文件扫描、零 lint 警告、类型检查、16 项单测、2 项压力测试和 19 路由生产构建全部成功。
- 本地 6 项 Playwright 用户路径与可访问性回归通过，未触发任何 `/api/**` 或付费模型调用。
- 提交 `3a19d9f` 后建立独立 `/tmp` 工作树，执行全新 `npm ci`、完整 `npm run quality` 和 `npm run test:e2e`，所有门禁再次通过；安装结果稳定为 434 个包、6 个已登记高危项。

下一步：提交验收回写、推送分支并创建 PR 02C，等待 GitHub CI。

## 2026-08-26：PR 02C 验收

- 创建 [PR #12](https://github.com/boyuling-123/AI-API-workspace/pull/12)，目标为 `main`，来源为 `codex/chore-quality-debt`。
- GitHub Actions `Quality Gate` 工作流 run `32917205809` 完成且结论为 success。
- `Lint, test, build, and secret scan` Job 全部步骤通过，覆盖 Secret Scan、lint、typecheck、真实源码单测、压力测试和生产构建。
- `Playwright user paths and accessibility` Job 通过；失败 Trace 上传步骤因没有失败而按设计跳过。
- SEC-002、SEC-003 和 SEC-004 已获得服务边界脱敏、真实子进程测试、干净环境与 CI Trace，但端到端覆盖仍不完整，因此保持“部分实现”。

下一步：提交本次验收回写，等待最终 CI 通过后以非强推 fast-forward 合并 PR #12。

## 2026-08-26：PR 02C 合并

- PR #12 的最终文档提交再次通过核心质量与 Playwright 两道 GitHub CI。
- 确认远端 `main` 未发生冲突后，以非强推 fast-forward 方式合并；GitHub 已确认 PR 状态为 Merged。
- 本地 `main` 同步到合并提交 `3521c4d`，随后创建短生命周期分支 `codex/feat-batch-checkpoints`。

## 2026-08-26：PR 03A 启动

- 本轮领取 TASK-003、TASK-004 和 TASK-008，范围只包含批量任务增量持久化、检查点恢复与暂停/继续/终止，不混入 QPS、失败项定向重跑或服务端队列。
- 新增稳定的 Case × Target 结果矩阵。`success` 和 `error` 是已完成状态，`pending`、`running`、`interrupted` 在恢复时重新排队。
- `useTaskRunner` 在开始、每 10 个完成项、暂停和最终结束时更新同一 Task；`useProject` 使用有序立即写队列，防止较旧检查点覆盖较新结果。
- 页面刷新后会识别本地 IndexedDB 中的 `running` 或 `paused` Task，展示已保存调用数，并提供“继续剩余任务”或“放弃并结束”。待续任务处理前不能误开第二个批次。
- 暂停只中止已发请求并保留任务；继续沿用原 Task ID 且跳过已完成单元；终止则写入 `cancelled`，不再显示恢复入口。
- 历史列表展示检查点调用数，运行中与暂停中的批次禁止启动 AI 评价，避免对不完整结果产生付费 Judge 调用。
- 新增 5 项检查点/续跑单元测试；当前全部单元测试为 6 个文件、21 项。新增 2 条 Mock Playwright 路径，验证暂停到第 3/12 条、自动保存、刷新恢复、前三条不重复调用，以及终止后不遗留恢复任务。
- 本地 `npm run lint`、`npm run typecheck`、`npm run test:unit`、`npm run test:e2e` 和 `npm run build` 通过；Playwright 共 8 项，所有 API 调用均为本地 Mock，未读取 Key、未调用模型或启动 AI 评价。
- 视觉验收截图：`docs/evidence/pr-03a/batch-resume-after-reload.png`。
- 当前检查点保存在浏览器本地项目中；突然关闭页面时最多会从最近一次 10 项一致检查点重放未落库单元，服务端持久队列与跨设备恢复不属于本 PR。
- 提交 `a3ee987` 后创建独立 `/tmp` 工作树，全新 `npm ci` 安装 434 个包；191 文件 Secret Scan、零 lint、typecheck、21 项单测、2 项压力测试、19 路由构建和 8 项 Playwright 再次全部通过，复验后工作树保持零改动。

下一步：提交干净环境证据，推送分支并创建 PR 03A，等待 GitHub CI。

## 2026-08-27：PR 03A 验收

- 创建 [PR #13](https://github.com/boyuling-123/AI-API-workspace/pull/13)，目标为 `main`，来源为 `codex/feat-batch-checkpoints`。
- GitHub Actions `Quality Gate` workflow run `33084615817` 完成且结论为 success。
- `Lint, test, build, and secret scan` Job 全部通过：Secret Scan、lint、typecheck、21 项真实源码单测、2 项压力测试和 19 路由生产构建均成功。
- `Playwright user paths and accessibility` Job 通过 8 项浏览器路径；失败 Trace 上传步骤因没有失败而按设计跳过。
- TASK-003、TASK-004、TASK-008 同时具备代码、异常路径、真实源码测试、Mock 浏览器路径、视觉截图、干净环境和 GitHub CI Trace，升级为“已验证”。

下一步：提交本次验收回写，等待最终 CI 通过后以非强推 fast-forward 合并 PR #13。

## 2026-08-27：PR 03A 合并

- PR #13 的最终文档提交通过核心质量与 Playwright 两道 GitHub CI。
- 确认远端 `main` 未发生冲突后，以非强推 fast-forward 方式合并；GitHub 已确认 PR 状态为 Merged。
- 本地 `main` 同步到合并提交 `a715fa2`，随后创建短生命周期分支 `codex/feat-run-controls`。

## 2026-08-29：PR 03B 启动

- 本轮领取 TASK-002、TASK-006 和 TASK-007，范围只包含 QPS、任务级超时、有限重试、失败分类与结果筛选，不混入 TASK-005 的失败项定向重跑。
- 新增共享平滑限速器：并发 Worker、首次调用和重试调用都在同一队列预约启动时间；QPS 设为 0 时保持不限速，暂停或终止会立即取消等待。
- `Task.runPolicy` 固化 QPS、超时和重试上限。旧项目缺少策略时使用安全默认值，恢复任务始终沿用原快照而不是当前页面输入。
- 每次真实请求都有独立 Abort 超时；仅 timeout、rate_limit、network、server 四类瞬时错误允许有限重试，auth、client、parse 和 unknown 不盲目重跑。
- `/api/run-custom`、通用 HTTP adapter 和 Anthropic adapter 保留结构化错误、重试属性与上游 HTTP 状态，错误文本在离开服务端前脱敏。
- 首页高级策略区可配置 QPS、超时和重试次数；历史任务展示策略，结果区展示并筛选失败类型、尝试次数和 HTTP 状态，Excel 导出同步保留这些诊断字段。
- 新增 17 项单元测试后总计 38 项，覆盖严格 QPS、取消等待、429/503 有限重试、401/解析错误不重试、真实 Abort 超时、route 契约和 adapter 错误归一化。
- 新增 2 条 Mock Playwright 路径后总计 10 项，验证 429 后成功、401 配置重试 3 次仍只调用一次、策略持久化与错误筛选；全量 E2E 和可访问性回归通过。
- `npm run quality` 完整通过：199 文件 Secret Scan、零 lint、typecheck、38 项单测、2 项压力测试和 19 路由生产构建。
- 视觉证据：`docs/evidence/pr-03b/run-policy-controls.png` 与 `error-classification-history.png`。视觉失败样例由本地缺失环境变量直接返回 401，服务日志确认没有上游调用。
- 提交 `3c6c1ec` 后创建独立 `/tmp` 工作树，全新 `npm ci` 安装 434 个包；202 文件 Secret Scan、零 lint、typecheck、38 项单测、2 项压力测试、19 路由构建和 10 项 Playwright 再次全部通过，复验后工作树保持零改动。

下一步：独立干净工作树复验、提交、推送并创建 PR 03B，等待 GitHub CI。

## 2026-08-29：PR 03B 验收

- 创建 [PR #14](https://github.com/boyuling-123/AI-API-workspace/pull/14)，目标为 `main`，来源为 `codex/feat-run-controls`；GitHub 确认可自动合并。
- GitHub Actions `Quality Gate` workflow run `33228823145` 完成且结论为 success。
- `Lint, test, build, and secret scan` Job 全部步骤通过，覆盖 202 文件 Secret Scan、lint、typecheck、38 项真实源码单测、2 项压力测试和生产构建。
- `Playwright user paths and accessibility` Job 通过 10 项浏览器路径；失败 Trace 上传步骤因没有失败而按设计跳过。
- TASK-002、TASK-006、TASK-007 同时具备代码、异常路径、真实源码测试、Mock 浏览器路径、视觉截图、干净环境和 GitHub CI Trace，升级为“已验证”。TASK-005 的定向重跑仍保持独立范围。

下一步：提交本次验收回写，等待最终 CI 通过后以非强推 fast-forward 合并 PR #14。

## 2026-08-29：PR 03B 合并

- PR #14 的最终文档提交通过核心质量与 Playwright 两道 GitHub CI。
- 确认远端 `main` 未发生冲突后，以非强推 fast-forward 方式合并；GitHub 已确认 PR 状态为 Merged。
- 本地 `main` 同步到合并提交 `b495ec2`，随后创建短生命周期分支 `codex/feat-selective-reruns`。

## 2026-08-29：PR 03C 启动

- 本轮只领取 TASK-005 的失败项与指定 Case 两种模型跑批重跑；新模型和新评价维度分别涉及资源与评价数据流，继续拆分小 PR。
- 新增可持久化的稀疏调用计划。普通跑批仍运行完整 Case × Target 矩阵，定向重跑只执行明确的 `inputId + targetId` 组合。
- 失败项模式只选原结果中状态为 `error` 的组合；指定 Case 支持 `1,3,8-12` 表达式。非法、倒序或越界输入不能确认，也不会发请求。
- 已删除或未测试通过的目标在预览中明确提示并排除；目标调用使用当前配置，运行策略沿用源任务快照。
- 每次重跑创建带来源 ID、范围和精确组合的新 Task，原任务和原结果保持不变；稀疏任务暂停后仍按原计划恢复。
- 历史页增加“定向重跑”入口，确认前展示调用次数与样本，并明确提示可能产生费用且不会自动启动 AI 评价。
- 新增计划解析、稀疏检查点、精确执行、恢复和非法计划单测；两条 Mock Playwright 路径证明失败项只补发一次、指定 `2-3` 只发四次、非法序号零请求。
- 弹窗已通过 WCAG 严重与致命问题扫描；视觉证据保存在 `docs/evidence/pr-03c/selective-rerun-preview.png`。
- 本地 `npm run quality` 通过：208 文件 Secret Scan、零 lint、typecheck、47 项单测、2 项压力测试和 19 路由生产构建；全量 12 项 Playwright 通过。
- 提交 `3ef828f` 后创建独立 `/tmp` 工作树，全新 `npm ci` 安装 434 个包；quality 与 12 项 Playwright 再次全部通过，复验后工作树保持零改动。

下一步：提交干净环境证据，推送分支并创建 PR 03C，等待 GitHub CI。

## 2026-08-29：PR 03C 验收

- 创建 [PR #15](https://github.com/boyuling-123/AI-API-workspace/pull/15)，目标为 `main`，来源为 `codex/feat-selective-reruns`；GitHub 确认可自动合并。
- GitHub Actions `Quality Gate` workflow run `33230069823` 完成且结论为 success。
- `Lint, test, build, and secret scan` Job 全部步骤通过，覆盖 208 文件 Secret Scan、零 lint、typecheck、47 项真实源码单测、2 项压力测试和生产构建。
- `Playwright user paths and accessibility` Job 通过 12 项浏览器路径；失败 Trace 上传步骤因没有失败而按设计跳过。
- TASK-005 已具备失败项和指定 Case 的代码、异常路径、真实源码测试、Mock 浏览器精确请求、视觉截图、干净环境和 CI Trace；由于新增模型重跑尚未实现，严格保持“部分实现”。

下一步：提交本次验收回写，等待最终 CI 通过后以非强推 fast-forward 合并 PR #15。

## 2026-08-29：PR 03C 合并

- PR #15 的最终文档提交通过核心质量与 Playwright 两道 GitHub CI。
- 确认远端 `main` 未发生冲突后，以非强推 fast-forward 方式合并；GitHub 已确认 PR 状态为 Merged。
- 本地 `main` 同步到合并提交 `d07e1c2`，随后创建短生命周期分支 `codex/feat-new-target-reruns`。

## 2026-08-29：PR 03D 启动

- 本轮只领取 TASK-005 的“新增模型或算法”重跑；新增评价维度继续留在独立小 PR，避免混合模型调用与 Judge 数据流。
- 定向重跑弹窗新增“新增目标”范围，只展示已测试可用、内容模式与图片输入兼容、且源任务尚未运行过的目标；用户必须显式选择目标和 Case。
- 调用预览同时展示新增调用数与历史复用数。确认后创建新 Task，只执行新增目标的稀疏组合，不覆盖源 Task，也不重复请求旧目标。
- 所选 Case 的源任务终态结果被复制为只读比较基线，并记录 `reusedFromTaskId`；结果页与 Excel 均明确显示历史复用来源。
- 检查点、暂停恢复、进度和任务最终状态只统计新增调用计划。历史目标即使已从当前配置删除，仍可展示旧结果而不阻塞新增目标。
- 单元测试增至 52 项，覆盖候选过滤、计划顺序、复用标记、精确进度和已删除历史目标；定向重跑 Playwright 3 项通过。
- 新浏览器路径以 Mock 证明：确认前零请求，选择 Case 1/3 与 Qwen 后恰好新增两次调用，结果页复用四条旧结果，且弹窗无严重或致命 WCAG 问题。
- 视觉证据 `docs/evidence/pr-03d/new-target-rerun-preview.png` 已人工检查，完整覆盖新增目标、Case、调用数、复用数、费用提示和确认入口，无截断。
- 本地 `npm run quality` 通过：210 文件 Secret Scan、零 lint、typecheck、52 项单测、2 项压力测试和 19 路由生产构建；全量 13 项 Playwright 通过。
- 提交 `d1c9231` 后创建独立 `/tmp` 工作树，全新 `npm ci` 安装 434 个包；quality 与 13 项 Playwright 再次全部通过，复验后工作树保持零改动。

下一步：提交干净环境证据，推送分支并创建 PR 03D，等待 GitHub 两道 CI。

## 2026-08-29：PR 03D 创建

- 创建 [PR #16](https://github.com/boyuling-123/AI-API-workspace/pull/16)，目标为 `main`，来源为 `codex/feat-new-target-reruns`；GitHub 确认可自动合并。
- PR 描述记录范围、异常路径、真实源码测试、Mock 边界、干净环境、视觉证据和普通 revert 回滚方案。
- TASK-005 已补齐失败项、指定 Case 和新增目标三类模型跑批重跑；新增评价维度尚未完成独立验收，因此继续保持“部分实现”。

下一步：等待最新提交对应的核心质量与 Playwright 两道 GitHub CI；全部通过后以非强推 fast-forward 安全合并。

## 2026-08-29：PR 03D 验收

- GitHub Actions `Quality Gate` workflow run `33231921078` 完成且结论为 success。
- `Lint, test, build, and secret scan` Job 全部步骤通过，覆盖 210 文件 Secret Scan、lint、typecheck、52 项真实源码单测、2 项压力测试和生产构建。
- `Playwright user paths and accessibility` Job 通过 13 项浏览器路径；失败 Trace 上传因没有失败而按设计跳过。
- TASK-005 已具备三类模型跑批重跑的代码、异常路径、真实源码测试、Mock 浏览器精确请求、视觉截图、干净环境和 CI Trace；新增评价维度尚未独立验收，继续保持“部分实现”。

下一步：提交本次 CI 验收回写，等待最终文档提交自身门禁通过后以非强推 fast-forward 安全合并 PR #16。

## 2026-08-29：PR 03D 合并

- PR #16 的最终文档提交对应 workflow run `33232064639` 通过核心质量与 Playwright 两道 GitHub CI。
- 确认远端 `main` 仍为预期祖先后，以非强推 fast-forward 方式合并；GitHub 已确认 PR #16 状态为 Merged。
- 本地 `main` 同步到 `6636dcf`，临时干净工作树已移除，随后从最新 `main` 创建 `codex/feat-new-dimension-evaluation`。

## 2026-08-29：PR 03E 启动与本地验收

- 本轮只领取 TASK-005 的最后一种范围“新增评价维度”，不混入 Evaluator 生命周期、Judge 校准或报告聚合。
- “AI历史评价”每条记录新增独立入口。进入后继承来源评价配置，样本范围锁定为来源评价已完成结果，旧维度只读展示。
- 同一根评价及其增量子记录组成评价血缘；新维度按大小写与连续空白归一化去重，重复维度会明确阻止确认。
- 确认弹窗精确展示 Judge 调用、被测模型调用、历史复用输出与新增维度数量。用户确认前零请求，确认后只调用 `/api/evaluate`，`/api/run-custom` 调用增量严格为零。
- 新增评价独立写入 `Project.evaluations`，保存 `evaluationKind=new_dimensions` 和根 `sourceEvaluationId`；来源 Task、来源评价和历史输出均不覆盖。
- `newDimensionEvaluation.test.ts` 覆盖维度归一化、血缘汇总和标准答案缺失跳过；单测总数增至 55 项。
- `new-dimension-evaluation.spec.ts` 通过 Mock 验证普通评价到增量评价的完整路径、确认边界、精确请求、独立留档与来源追溯；弹窗无严重或致命 WCAG 问题。
- 视觉证据 `docs/evidence/pr-03e/new-dimension-confirmation.png` 已人工检查，完整显示 1 次 Judge、0 次被测模型、1 条历史复用和 1 个新维度，无遮挡或截断。
- 本地 `npm run quality` 通过：213 文件 Secret Scan、零 lint、typecheck、55 项单测、2 项压力测试和 19 路由生产构建；全量 14 项 Playwright 通过。
- 提交 `18bc0df` 在独立 `/tmp` 工作树通过全新 `npm ci`（434 个包）、quality 和 14 项 Playwright；全部测试使用 Mock，复验结束后工作树零改动。
- TASK-005 四种范围均已完成代码与本地验收；在 PR 03E GitHub CI 通过前严格保持“已实现”，不提前标记“已验证”。

下一步：提交实现，在独立干净工作树全新安装复验，再推送并创建 PR 03E。

## 2026-08-29：PR 03E 创建

- 创建 [PR #17](https://github.com/boyuling-123/AI-API-workspace/pull/17)，目标为 `main`，来源为 `codex/feat-new-dimension-evaluation`。
- PR 描述明确增量 Judge 调用、零被测模型调用、异常路径、Mock 边界、干净环境、视觉证据与普通 revert 回滚方案。
- TASK-005 已完成四种范围的本地代码与验收；PR #17 最新提交通过两道 GitHub CI 前继续保持“已实现”。

下一步：等待 PR #17 最新提交的核心质量与 Playwright 两道 CI，全部通过后回写 Trace 并安全合并。

## 2026-08-29：PR 03E 验收

- GitHub Actions `Quality Gate` workflow run `33236290462` 完成且结论为 success。
- `Lint, test, build, and secret scan` Job 全部步骤通过，覆盖 215 文件 Secret Scan、lint、typecheck、55 项真实源码单测、2 项压力测试和生产构建。
- `Playwright user paths and accessibility` Job 通过 14 项浏览器路径；失败 Trace 上传因没有失败而按设计跳过。
- TASK-005 的失败项、指定 Case、新目标和新评价维度四种范围均具备预览、确认、来源追溯、真实源码测试、Mock 精确请求、视觉证据、干净环境与 GitHub CI Trace，升级为“已验证”。

下一步：提交本次 CI 验收回写，等待最终文档提交自身门禁通过后，以非强推 fast-forward 安全合并 PR #17。

## 2026-08-29：PR 03E 合并

- PR #17 的最终文档提交对应 workflow run `33236428567` 通过核心质量与 Playwright 两道 GitHub CI。
- 确认远端 `main` 仍为预期祖先后，以非强推 fast-forward 方式合并；GitHub 已确认 PR #17 状态为 Merged，合并提交为 `8c70139`。
- 本地 `main` 同步到 `8c70139`，随后从最新 `main` 创建短生命周期分支 `codex/feat-dimension-generation-context`。

## 2026-08-29：PR 04A 启动与本地验收

- 本轮只领取 DIM-002 与 DIM-003：结构化维度生成上下文和代表性样本抽取；OpenJudge、Simple/Iterative Rubrics、硬规则、Bad Case 与人工标注继续保持后续独立范围。
- AI 评价页新增评测目标、业务场景和任务类型。`/api/gen-dimensions` 只接受结构化对象，并在模型调用前校验必填、长度、枚举、样本上限、重复 ID 与输出结构。
- 从当前 Task 的输入和跑批结果确定性选择最多 8 条代表性样本，支持覆盖首中尾、失败优先和标准答案优先三种策略；用户可预览并排除样本。
- 请求只包含截断后的 prompt、标准答案、成功输出文字、输入/输出图片数量、失败状态和错误类型；原图、base64、完整错误文本与额外未声明字段都不会进入模型请求。
- Prompt 同时使用目标、场景、任务类型、内部预设和代表性样本，并明确样本文字是待分析数据而不是可执行指令。页面明确标注 OpenJudge 尚未接入。
- 只有用户显式点击“AI 生成评价维度”才调用接口；候选维度仍需用户勾选，生成过程不会调用 `/api/evaluate` 或自动启动付费评价。
- `dimensionGeneration.test.ts` 与 `genDimensionsRoute.test.ts` 直接覆盖真实源码；新增 9 项聚焦断言后，全量单测增至 64 项。
- `dimension-generation.spec.ts` 使用 5 条 Mock Case 验证确定性抽样、失败优先、点击前零调用、点击后恰好一次维度请求、零评价请求和敏感图片/错误不出现在请求中。
- 新 E2E 首次发现 AI 评价页四处低对比度文字，修复后完整页面无严重或致命 WCAG 问题；视觉证据 `docs/evidence/pr-04a/dimension-sample-preview.png` 已人工检查，无截断。
- 本地 `npm run quality` 通过：221 文件 Secret Scan、零 lint、typecheck、64 项单测、2 项压力测试和 19 路由生产构建；全量 15 项 Playwright 通过。
- 提交 `383aef7` 后创建独立 `/tmp` 工作树，全新 `npm ci` 安装 434 个包；quality 与 15 项 Playwright 再次全部通过，复验结束后工作树零改动。
- DIM-002 与 DIM-003 已具备代码、异常路径、真实源码测试、Mock 浏览器路径、视觉证据和独立干净环境复验；在 GitHub CI 通过前严格保持“已实现”。

下一步：提交干净环境证据，推送分支并创建 PR 04A，等待 GitHub 两道 CI。

## 2026-08-29：PR 04A 创建与验收

- 创建 [PR #18](https://github.com/boyuling-123/AI-API-workspace/pull/18)，目标为 `main`，来源为 `codex/feat-dimension-generation-context`；GitHub 确认可自动合并。
- PR 描述记录结构化上下文、代表性抽样、数据最小化、提示注入边界、零自动评价、真实源码测试、Mock 用户路径、视觉证据和普通 revert 回滚方案。
- GitHub Actions `Quality Gate` workflow run `33237473012` 完成且结论为 success。
- `Lint, test, build, and secret scan` Job 全部步骤通过，覆盖 221 文件 Secret Scan、lint、typecheck、64 项真实源码单测、2 项压力测试和生产构建。
- `Playwright user paths and accessibility` Job 通过 15 项浏览器路径；失败 Trace 上传因没有失败而按设计跳过。
- DOC-003、DIM-002 与 DIM-003 已同时具备准确产品口径、代码、异常路径、真实源码测试、Mock 精确请求、视觉证据、独立干净环境和 GitHub CI Trace，升级为“已验证”。DIM-004 因仍缺硬规则、Bad Case 与人工结果输入，保持“部分实现”。

下一步：提交本次 PR 与 CI 验收回写，等待最终文档提交自身门禁通过后，以非强推 fast-forward 安全合并 PR #18。

## 2026-08-29：PR 04A 合并与 PR 04B 启动

- PR #18 的最终文档提交对应 workflow run `33237610485` 通过核心质量与 Playwright 两道 GitHub CI。
- 确认远端 `main` 未变化且仍为当前 head 祖先后，以非强推 fast-forward 方式合并；GitHub 已确认 PR #18 状态为 Merged，合并 SHA 为 `ef643b2`。
- 本地 `main` 同步到 `ef643b2`，随后创建短生命周期分支 `codex/feat-dimension-rules-bad-cases`。
- PR 04B 只补 DIM-004 的硬规则与 Bad Case 两类受控输入；人工评分/排序及 Iterative Rubrics Generator 保留给连续小 PR，避免一个分支混合多套反馈数据流。

下一步：定义硬规则和 Bad Case 的有界 Schema、受控 UI、Prompt 语义与异常路径。

## 2026-08-29：PR 04B 本地验收

- AI 评价页新增任务级硬规则输入，每行一条，按大小写和连续空白去重，最多 20 条且单条最多 500 字；超限时页面阻断，外部 API 仍会执行同一份服务端校验。
- 代表性样本支持显式标记或取消 Bad Case，原因必填且最多 1000 字。导入数据只识别有限白名单列名及明确真值，不从普通 prompt 或任意备注猜测。
- 规则和 Bad Case 原因进入结构化请求与维度 Prompt；客户端组包与服务端解析均调用统一脱敏函数，原图、base64、完整失败文本和敏感值不会进入模型上下文。
- Mock E2E 验证原因为空时维度请求为零，补齐后恰好一次 `/api/gen-dimensions`，`/api/evaluate` 始终为零；页面通过 WCAG 严重与致命问题扫描。
- 视觉证据 `docs/evidence/pr-04b/hard-rules-bad-case.png` 已人工检查，完整展示规则计数、两条样本、一条 Bad Case 及必填原因，无粘滞页头重叠或内容截断。
- 本地 `npm run quality` 通过：224 文件 Secret Scan、零 lint、typecheck、67 项真实源码单测、2 项压力测试和 19 路由生产构建；全量 16 项 Playwright 通过。
- 功能提交 `a054594` 在独立 `/tmp` 工作树全新 `npm ci` 安装 434 个包后再次通过完整 quality 与 16 项 Playwright，复验结束时 Git 零改动；未使用 `npm audit fix --force` 改写既有锁文件。
- DIM-004 的标准答案、硬规则和 Bad Case 已有本地完整证据；人工评分/排序及 Iterative Rubrics Generator 尚未实现，继续保持“部分实现”。

下一步：推送短生命周期分支并创建 PR 04B，等待 GitHub 核心质量与 Playwright 两道 CI。

## 2026-08-29：PR 04B 创建与首轮验收

- 创建 [PR #19](https://github.com/boyuling-123/AI-API-workspace/pull/19)，目标为 `main`，来源为 `codex/feat-dimension-rules-bad-cases`；GitHub 确认可自动合并。
- PR 描述明确硬规则、Bad Case、严格字段白名单、双层脱敏、零自动评价、Mock 测试、干净环境、视觉证据和普通 revert 回滚方案。
- GitHub Actions `Quality Gate` workflow run `33239133343` 完成且结论为 success。
- `Lint, test, build, and secret scan` Job 全部步骤通过，覆盖密钥扫描、lint、typecheck、67 项真实源码单测、2 项压力测试和 19 路由生产构建。
- `Playwright user paths and accessibility` Job 通过 16 项浏览器路径；失败 Trace 上传因没有失败而按设计跳过。
- DIM-004 的标准答案、硬规则和 Bad Case 已具备代码、异常路径、真实源码测试、Mock 精确请求、视觉证据、干净环境与 GitHub CI Trace；因人工评分/排序未实现，继续保持“部分实现”。

下一步：提交本次 CI 验收回写，等待最终文档提交自身门禁通过后，以非强推 fast-forward 安全合并 PR #19。

## 2026-08-29：PR 04B 合并与 PR 04C 启动

- PR #19 的最终文档提交对应 workflow run `33239314190` 通过核心质量与 Playwright 两道 GitHub CI。
- 确认远端 `main` 仍为预期祖先后，以普通 `git push origin HEAD:main` 完成非强推 fast-forward 合并；GitHub 已确认 PR #19 状态为 Merged，合并 SHA 为 `fb140fb`。
- 本地 `main` 同步到 `fb140fb`，随后从最新 `main` 创建短生命周期分支 `codex/feat-dimension-human-feedback`。
- PR 04C 只补 DIM-004 尚缺的人工评分与偏好排序输入；OpenJudge 和真正的 Iterative Rubrics Generator 继续保持“设计中”，不在本轮借用通用模型冒充。

## 2026-08-29：PR 04C 本地验收

- 每条已选代表性 Case 可独立添加或移除人工反馈。人工评分与偏好排序模式互斥，切换模式会清空旧数值，备注保留以便用户继续编辑。
- 评分必须精确覆盖当前全部目标，范围为 `0–10` 且最多 1 位小数；排序至少需要 2 个目标，名次必须是完整且不重复的 `1..N`。
- 公共 `/api/gen-dimensions` 使用同一 Schema 再校验反馈对象、目标 ID、数值、覆盖关系和备注长度；非法反馈返回 400，维度模型调用严格为零。
- 合法反馈按当前输出顺序规范化后写入结构化请求。Prompt 只把分数、名次和最多 1000 字的脱敏备注作为解释人工质量差异的上下文，不把分数或名次本身生成成评价维度。
- 页面明确显示 OpenJudge 与 Iterative Rubrics Generator 尚未接入；维度生成仍需用户显式点击，生成后仍需人工勾选，且不会调用 `/api/evaluate`。
- `dimensionHumanFeedback.test.ts`、`dimensionGeneration.test.ts` 与 `genDimensionsRoute.test.ts` 直接覆盖真实源码；全量单测增至 72 项，压力测试保持 2 项。
- `dimension-human-feedback.spec.ts` 以 2 Case × 2 Target 的 Mock 路径验证缺失评分和重复名次阻断、修正后恰好一次请求、两个反馈对象精确绑定、零自动评价和 WCAG 门禁。
- 视觉证据 `docs/evidence/pr-04c/human-score-ranking.png` 已人工检查，评分、排序、备注、模式提示与未接入能力说明均完整可见，无截断或重叠。
- 本地 `npm run quality` 通过密钥扫描、零 lint、typecheck、72 项单测、2 项压力测试和 19 路由生产构建；全量 17 项 Playwright 通过。
- DIM-004 已在本地补齐标准答案、硬规则、Bad Case、人工评分和偏好排序，状态升级为“已实现”；GitHub CI 与最终 Trace 完成前不标记“已验证”。DIM-006 仍为“设计中”。
- 功能提交 `c5266d6` 在独立 `/tmp` 工作树全新 `npm ci` 安装 434 个包后，再次通过 229 文件 Secret Scan、零 lint、typecheck、72 项单测、2 项压力测试、19 路由构建与 17 项 Playwright；复验结束时 Git 零改动。

下一步：提交干净环境证据，推送分支并创建 PR 04C，等待 GitHub 核心质量与 Playwright 两道 CI。

## 2026-08-29：PR 04C 创建与首轮验收

- 创建 [PR #20](https://github.com/boyuling-123/AI-API-workspace/pull/20)，目标为 `main`，来源为 `codex/feat-dimension-human-feedback`；GitHub 确认可自动合并。
- PR 描述记录人工评分与排序契约、异常阻断、双层脱敏、未接入能力口径、零自动评价、Mock 边界、干净环境、视觉证据与普通 revert 回滚方案。
- GitHub Actions `Quality Gate` workflow run `33240897489` 完成且结论为 success。
- `Lint, test, build, and secret scan` Job 全部步骤通过，覆盖密钥扫描、lint、typecheck、72 项真实源码单测、2 项压力测试和 19 路由生产构建。
- `Playwright user paths and accessibility` Job 通过 17 项浏览器路径；失败 Trace 上传因没有失败而按设计跳过。
- DOC-003 与 DIM-004 已同时具备准确产品口径、代码、异常路径、真实源码测试、Mock 精确请求、视觉证据、独立干净环境与 GitHub CI Trace，升级为“已验证”。DIM-006 仍保持“设计中”。

下一步：提交本次 PR 与 CI 验收回写，等待最终文档提交自身门禁通过后，以非强推 fast-forward 安全合并 PR #20。

## 2026-08-29：PR 04C 合并与 PR 04D 启动

- PR #20 的最终文档提交对应 workflow run `33241134290` 通过核心质量与 Playwright 两道 GitHub CI。
- 确认远端 `main` 仍为预期祖先后，以普通 `git push origin HEAD:main` 完成非强推 fast-forward 合并；GitHub 已确认 PR #20 状态为 Merged，合并 SHA 为 `2077b3b`。
- 本地 `main` 同步到 `2077b3b`，随后从最新 `main` 创建短生命周期分支 `codex/feat-structured-simple-rubrics`。
- PR 04D 只领取 DIM-005 与 DIM-008：无人工反馈的 Simple Rubrics 和完整 Rubric 发布前校验。OpenJudge、Iterative、权重/一票否决和 Evaluator 版本化继续保留给后续 PR。

## 2026-08-29：PR 04D 本地实现

- `EvalDimension` 增加可选的 `scoreLevels`、`evidenceRequirements` 与 `judgeInstruction`，新 Schema 固定要求 `0/5/10` 三个锚点并限制名称、定义、标准、证据和判断规则长度。
- `genDimensionsService.ts` 在无人工反馈时标记 Simple Rubrics 模式，要求模型一次返回 4–8 条完整结构；旧式 `name/desc`、重复名称、错误锚点和畸形 JSON 均失败，诊断片段先脱敏。
- 页面展示“Rubric 完整/待补”，支持展开编辑每个字段和显式生成通用模板；不完整或重名候选无法调用 `/api/gen-eval-prompt` 或 `/api/evaluate`。
- Prompt 生成与正式 Judge 服务都重新解析完整 Schema，并把定义、锚点、证据和可执行规则写入模型上下文；路由边界在模型调用前返回 400。
- 旧历史 `name/desc` 记录保持可读，结构化记录在评价血缘中保留全部字段；新增维度重复名提示与严格完整性校验并行工作。
- 新增真实源码单测与 `structured-rubrics.spec.ts` Mock 用户路径；专项测试验证缺失 5 分锚点时 Prompt 和 Judge 均为零调用，恢复后只生成 Prompt，不自动启动评价。

下一步：生成视觉证据，重复全量本地门禁，再提交功能并进入独立干净工作树验收。

## 2026-08-29：PR 04D 本地验收

- `evaluationRubric.test.ts`、`genDimensionsService.test.ts`、`rubricRouteBoundary.test.ts`、`rubricPromptServices.test.ts` 和既有回归直接覆盖真实源码；全量单测增至 84 项，压力测试保持 2 项。
- `structured-rubrics.spec.ts` 精确验证 Simple 模式、完整 Rubric 请求、缺失 5 分锚点时 Prompt/Judge 零调用、恢复后只生成 Prompt，以及 WCAG 严重与致命问题为零。
- `new-dimension-evaluation.spec.ts` 同步为完整 Rubric 请求，并验证不完整候选仍即时报告历史维度重名；旧评价记录可读性另有单测锁定。
- 视觉证据 `docs/evidence/pr-04d/structured-simple-rubric.png` 已在页面回顶后重拍并人工检查，模式、完整计数、定义、三个锚点、证据、判断规则和操作按钮均可见，无粘滞页头遮挡。
- 本地 `npm run quality` 通过 238 文件 Secret Scan、零 lint、typecheck、84 项单测、2 项压力测试和 19 路由生产构建；全量 18 项 Playwright 通过。
- DIM-005 与 DIM-008 已达到本地“已实现”；独立干净工作树、GitHub 两道 CI 和最终 Trace 完成前不标记“已验证”。

下一步：提交当前功能与本地证据，在独立 `/tmp` 工作树全新安装依赖并重复执行全部门禁。

## 2026-08-29：PR 04D 独立干净环境复验

- 功能与本地证据提交为 `a697f43`，父提交为已合并的 `2077b3b`；远端 `main` 在提交前没有漂移。
- 在 `/tmp/eval-platform-pr04d-a697f43` 以 detached HEAD 检出精确提交，并使用锁文件全新 `npm ci` 安装 434 个包。
- 干净环境 `npm run quality` 再次通过 238 文件 Secret Scan、零 lint、typecheck、84 项单测、2 项压力测试和 19 路由生产构建。
- 干净环境 `npm run test:e2e` 再次通过全部 18 项 Playwright；所有 API 路径均为 Mock，未读取真实密钥、未调用真实或付费模型、未启动 AI 评价。
- 全部门禁结束后 `git status --short` 无输出，证明构建、测试和证据校验没有污染提交工作树。
- `npm ci` 仍报告锁文件既有的 6 个 high 级依赖审计项；未执行可能引入破坏性升级的 `npm audit fix --force`，该风险留给专门依赖治理 PR。

下一步：提交干净环境证据，推送分支并创建 PR 04D，等待 GitHub 核心质量与 Playwright 两道 CI。

## 2026-08-29：PR 04D 创建与首轮验收

- 创建 [PR #21](https://github.com/boyuling-123/AI-API-workspace/pull/21)，目标为 `main`，来源为 `codex/feat-structured-simple-rubrics`；GitHub 确认可自动合并。
- PR 描述明确完整 Rubric Schema、Simple/人工反馈模式边界、旧历史兼容、零模型调用阻断、Mock 测试、干净环境、视觉证据、不包含能力和普通 revert 回滚方案。
- GitHub Actions `Quality Gate` workflow run `33243678962` 完成且结论为 success。
- `Lint, test, build, and secret scan` Job 全部步骤通过，覆盖密钥扫描、lint、typecheck、84 项真实源码单测、2 项压力测试和 19 路由生产构建。
- `Playwright user paths and accessibility` Job 通过 18 项浏览器路径；失败 Trace 上传因没有失败而按设计跳过。
- DIM-005 与 DIM-008 已同时具备准确产品口径、代码、异常路径、真实源码测试、Mock 精确请求、视觉证据、独立干净环境与 GitHub CI Trace，升级为“已验证”。DIM-006、权重/一票否决和 Evaluator 版本化状态保持不变。

下一步：提交本次 PR 与 CI 验收回写，等待最终文档提交自身门禁通过后，以非强推 fast-forward 安全合并 PR #21。

## 2026-08-29：PR 04D 合并与 PR 05A 启动

- PR #21 的最终文档提交对应 workflow run `33243860373` 通过核心质量与 Playwright 两道 GitHub CI。
- 确认远端 `main` 未漂移后，以普通 `git push origin HEAD:main` 完成非强推 fast-forward 合并；GitHub 已确认 PR #21 为 Merged，合并 SHA 为 `6da447b`。
- 本地 `main` 与 `origin/main` 同步到 `6da447b`，从该提交创建短生命周期分支 `codex/feat-evaluator-policy`。
- PR 05A 只领取 DIM-009 与 PROMPT-001 的剩余范围：权重、一票否决、人工策略确认和 Prompt 透传；Evaluator 版本化、Judge 校准、OpenJudge 与 Iterative 继续保持原状态。

## 2026-08-29：PR 05A 本地实现

- 新增 `evaluatorPolicy.ts` 作为唯一策略真相源：以基点精确平均分配权重，校验单项范围、小数精度、总和与否决阈值，并生成确认指纹。
- 页面为每条已选 Rubric 提供权重与否决阈值控件；策略必须显式确认，修改任一结构或策略字段后旧确认自动失效，Prompt 与评价按钮同步阻断。
- `/api/gen-eval-prompt` 与 `/api/evaluate` 在模型调用前复验同一策略；Judge Prompt 包含完整 Rubric、权重和否决规则，但 Judge 只输出独立维度分。
- 服务端在规范化 Judge 分数后确定性计算加权分、否决状态与原因；即时结果、AI 历史和 Excel 导出均保留这些字段，旧记录字段可缺省。
- 新增 `evaluatorPolicy.test.ts` 与 `evaluator-policy.spec.ts`，并升级路由、Prompt、结构化 Rubric 和新增维度测试契约。非法策略在模型调用前失败，浏览器请求全部使用 Mock。
- 修复自动保存瞬态文字和维度生成按钮的对比度问题；不等待动画消失即可通过 WCAG 严重与致命问题门禁。
- 视觉证据 `docs/evidence/pr-05a/evaluator-policy.png` 已人工检查，权重、阈值、确认状态与策略结果同屏清晰，无粘性栏遮挡。
- 本地 `npm run quality` 通过 243 文件 Secret Scan、零 lint、typecheck、89 项单测、2 项压力测试和 19 路由生产构建；全量 19 项 Playwright 通过。

下一步：提交功能快照，并在独立干净工作树全新安装依赖后重复执行全部门禁。

## 2026-08-29：PR 05A 独立干净环境复验

- 功能与本地证据提交为 `270ae10`，父提交为已合并的 `6da447b`；提交前远端 `main` 未发生漂移。
- 在 `/tmp/eval-platform-pr05a-YGuqxj` 以 detached HEAD 检出精确提交，并使用锁文件全新 `npm ci` 安装 434 个包。
- 干净环境 `npm run quality` 再次通过 243 文件 Secret Scan、零 lint、typecheck、89 项单测、2 项压力测试和 19 路由生产构建。
- 干净环境 `npm run test:e2e` 再次通过全部 19 项 Playwright；所有模型相关 API 均使用 Mock，未读取真实密钥、未调用真实或付费模型。
- 全部门禁结束后 `git status --short` 无输出，证明构建与测试没有污染提交工作树。
- `npm ci` 仍报告锁文件既有的 6 个 high 级依赖审计项；未执行可能引入破坏性升级的 `npm audit fix --force`，继续留给依赖治理专题。

下一步：提交干净环境证据，推送分支并创建 PR 05A，等待 GitHub 核心质量与 Playwright 两道 CI。

## 2026-08-29：PR 05A 创建与首轮 GitHub CI

- 干净环境证据提交为 `7eac1c0`，分支 `codex/feat-evaluator-policy` 已推送并创建 [PR #22](https://github.com/boyuling-123/AI-API-workspace/pull/22)。
- 创建 PR 前后均确认远端 `main` 保持在 `6da447b`，PR 含 2 个提交、28 个文件，GitHub 判定可自动合并。
- workflow run `33246361526` 的 `Lint, test, build, and secret scan` Job 全部通过，覆盖 243 文件密钥扫描、lint、typecheck、89 项真实源码单测、2 项压力测试与 19 路由生产构建。
- 同一 run 的 `Playwright user paths and accessibility` Job 通过全部 19 项浏览器与 WCAG 路径；失败 Trace 上传因没有失败而按设计跳过。
- DIM-009 与 PROMPT-001 已具备代码、异常路径、真实源码测试、Mock 用户路径、视觉证据、独立干净环境与 GitHub CI Trace，升级为“已验证”。

下一步：提交 PR 与首轮 CI 验收回写，等待该最终文档提交自身两道 CI 通过后确认远端无漂移并安全合并 PR #22。

## 2026-08-29：PR 05A 合并与 PR 05B 本地实现

- PR #22 最终文档提交对应 workflow run `33246545137` 的核心质量与 Playwright 两个 Job 全部通过。
- 确认 PR 头提交、审查线程、Review、工作树和远端 `main` 均无漂移后，以普通 `git push origin HEAD:main` 完成非强推 fast-forward；GitHub 已确认 Merged，合并 SHA 为 `f0fedce`。
- 本地 `main` 同步到 `f0fedce`，创建短生命周期分支 `codex/feat-evaluator-versions`，只领取 DIM-010、PROMPT-002 与 PROMPT-004。
- 新增项目级 `EvaluatorVersion` 和纯函数版本域：同一家族递增版本、完整定义深拷贝、定义指纹与完整性指纹、损坏版本拒绝加载。
- AI 评价页可保存 v1、手动修改 Prompt 后追加 v2、加载任意版本；保存与加载均不调用 Judge，评价历史通过 `evaluatorVersionId` 显示实际绑定版本。
- 版本记录修改人、时间、变更说明与适用跑批任务；新字段保持可选，不升级 Schema，不清理现有 IndexedDB 项目。
- 版本入库前复用统一脱敏器；回归测试发现并修复 `[REDACTED]` 二次脱敏多出括号的幂等问题。
- `evaluatorVersion.test.ts` 和脱敏回归使单测增至 95 项；新增 `evaluator-versioning.spec.ts` 覆盖 v1/v2、旧版不变、刷新持久化、显式 Mock 评价、历史绑定和 WCAG，全量 Playwright 增至 20 项并全部通过。
- 视觉证据 `docs/evidence/pr-05b/evaluator-versions.png` 已人工检查，版本、修改人、时间、适用任务和变更说明同屏清晰，无布局遮挡。
- 本地 `npm run quality` 通过 248 文件 Secret Scan、零 lint、typecheck、95 项单测、2 项压力测试和 19 路由生产构建；修改后的全量 20 项 Playwright 再次通过。

下一步：提交功能快照，并在独立干净工作树全新安装依赖后复验全部门禁。

## 2026-08-30：PR 05B 独立干净环境复验

- 功能、本地测试与视觉证据提交为 `34347aa`，父提交为已合并的 `f0fedce`；提交前后远端 `main` 未发生漂移。
- 在 `/tmp/eval-platform-pr05b-TknArX` 以 detached HEAD 检出精确提交，并使用锁文件全新 `npm ci` 安装 434 个包。
- 干净环境 `npm run quality` 再次通过 248 文件 Secret Scan、零 lint、typecheck、95 项单测、2 项压力测试和 19 路由生产构建。
- 第一次并行 E2E 中，既有 `batch-resume` 在冷编译负载下用尽 30 秒总预算；失败上下文显示任务仍为 `3 / 12` 运行中，而非断言或模型请求错误。
- 该路径随后以单 worker 精确复跑 9.2 秒通过；同一干净环境再次执行全量套件，20 项 Playwright 全部通过。
- 所有模型相关 API 均为 Mock，未读取真实密钥、未调用真实或付费模型、未自动启动 AI 评价；最终 `git status --short` 无输出。
- `npm ci` 仍报告锁文件既有的 6 个 high 级依赖审计项；未执行可能引入破坏性升级的 `npm audit fix --force`，继续留给依赖治理专题。

下一步：提交独立环境证据，推送分支并创建 PR 05B，等待 GitHub 核心质量与 Playwright 两道 CI。

## 2026-08-30：PR 05B 创建与首轮 GitHub CI

- 干净环境证据提交为 `451035e`，分支 `codex/feat-evaluator-versions` 已推送并创建 [PR #23](https://github.com/boyuling-123/AI-API-workspace/pull/23)。
- 创建 PR 前后均确认远端 `main` 保持在 `f0fedce`，PR 含 2 个提交、16 个文件，GitHub 判定可自动合并。
- workflow run `33287622657` 的 `Lint, test, build, and secret scan` Job 全部通过，覆盖 248 文件密钥扫描、lint、typecheck、95 项真实源码单测、2 项压力测试与 19 路由生产构建。
- 同一 run 的 `Playwright user paths and accessibility` Job 通过全部 20 项浏览器与 WCAG 路径；失败 Trace 上传因没有失败而按设计跳过。
- DIM-010、PROMPT-002 与 PROMPT-004 已具备代码、异常路径、真实源码测试、Mock 用户路径、视觉证据、独立干净环境与 GitHub CI Trace，升级为“已验证”。

下一步：提交 PR 与首轮 CI 验收回写，等待该最终文档提交自身两道 CI 通过后确认远端无漂移并安全合并 PR #23。

## 2026-08-30：PR 05B 合并与 PR 05C 本地实现

- PR #23 最终文档提交对应 workflow run `33287776223` 的核心质量与 Playwright 两个 Job 全部通过；确认无远端漂移、Review 或审查线程后，以普通 fast-forward 合并，GitHub 确认 Merged SHA 为 `64b891b`。
- 本地 `main` 与 `origin/main` 同步到 `64b891b`，创建短生命周期分支 `codex/feat-evaluator-version-diff`，只领取 PROMPT-005 与 PROMPT-006。
- 新增 `evaluatorVersionDiff.ts`，同家族完整版本可确定性比较裁判、目标、模式、标准答案、任务、Rubric/策略和逐行 Prompt，并输出五类影响范围。
- 逐行 Diff 在矩阵规模超过阈值时降级为共同前后缀替换，仍保留精确新增/删除行计数，避免大 Prompt 二次复杂度卡死页面。
- 新增深色差异面板，支持选择基线版本、查看结构字段和 Prompt 上下文；变化行之外内容按上下文折叠，不把 5 万字 Prompt 全量铺开。
- 恢复入口只对非最新版历史快照开放，复用不可变创建函数追加 `vN+1`；记录作者、当前任务和恢复来源，既有版本与评价历史不修改。
- 单测首次发现伪造来源对象可携带旧完整性指纹，恢复入口已补充来源对象自身校验；专项 6 项 Diff/恢复单测与既有 5 项版本单测全部通过。
- 新增 Mock Playwright 路径，完成 v1/v2 Diff、v1→v3、旧版回看、刷新持久化和 WCAG，并验证 `/api/evaluate` 零调用。
- 组件级视觉证据 `docs/evidence/pr-05c/version-diff-restore.png` 已人工检查，恢复元数据、v1→v3、执行定义一致、结构/Prompt Diff 和最新版边界完整可见，无裁切或遮挡。
- 本地 `npm run quality` 通过 254 文件 Secret Scan、零 lint、typecheck、101 项单测、2 项压力测试和 19 路由生产构建；全量 21 项 Playwright 再次通过。

下一步：提交功能与本地证据，在独立干净工作树全新安装依赖后复验全部门禁。

## 2026-08-30：PR 05C 独立干净环境复验

- 功能、本地测试与视觉证据提交为 `41197b2`，父提交为已合并的 `64b891b`；提交前后远端 `main` 未发生漂移。
- 在 detached `/tmp` 工作树执行全新 `npm ci`，安装 434 个包；既有 6 个 high 级依赖审计项继续登记，未执行破坏性 `npm audit fix --force`。
- 独立环境 `npm run quality` 通过 254 文件 Secret Scan、零 lint、typecheck、101 项单测、2 项压力测试和 19 路由生产构建；全量 21 项 Playwright 全部通过。
- 复验结束时 HEAD 为 `41197b2`，Git 状态零改动，确认本 PR 不依赖原工作树的未跟踪文件、旧构建产物或依赖缓存。

下一步：提交独立环境证据，推送分支并创建 PR 05C，等待 GitHub 核心质量与 Playwright 两道 CI。

## 2026-08-30：PR 05C 创建与首轮 GitHub CI

- 独立环境证据提交为 `b88d4b2`，分支 `codex/feat-evaluator-version-diff` 已推送并创建 [PR #24](https://github.com/boyuling-123/AI-API-workspace/pull/24)。
- 创建 PR 前后确认远端 `main` 保持在 `64b891b`，PR 含 2 个提交、11 个文件，GitHub 判定可自动合并。
- workflow run `33290243949` 的 `Lint, test, build, and secret scan` Job 全部通过，覆盖 254 文件密钥扫描、lint、typecheck、101 项真实源码单测、2 项压力测试与 19 路由生产构建。
- 同一 run 的 `Playwright user paths and accessibility` Job 通过全部 21 项浏览器与 WCAG 路径；失败 Trace 上传因没有失败而按设计跳过。
- PROMPT-005 与 PROMPT-006 已同时具备代码、异常路径、真实源码测试、Mock 用户路径、视觉证据、独立干净环境与 GitHub CI Trace，升级为“已验证”。

下一步：提交 PR 与首轮 CI 验收回写，等待该最终文档提交自身两道 CI 通过后确认远端无漂移并安全合并 PR #24。

## 2026-08-30：PR 05C 合并与 PR 05D 启动

- PR #24 最终文档提交对应 workflow run `33290477614` 的核心质量与 Playwright 两道 GitHub CI 全部通过。
- 确认远端 `main` 无漂移、无未解决 Review 或审查线程后，以普通 fast-forward 安全合并；GitHub 确认 Merged，合并 SHA 为 `8623da4`。
- 本地 `main` 与 `origin/main` 同步到 `8623da4`，随后创建短生命周期分支 `codex/feat-evaluator-trial-rerun`，只领取 PROMPT-003 与 PROMPT-008。

## 2026-08-30：PR 05D 本地实现与验收

- 新增 `evaluationExecutionPlan.ts` 作为试评与正式评价范围、调用数和历史写入策略的单一真相源；试评默认 3 条、最多 5 条，确定性复用已有成功输出。
- AI 评价页拆成“少量样本试评”和“正式 AI 评价”两个动作；两者都先展示裁判调用、被测模型零调用、复用输出和历史写入状态，确认前不发请求。
- 试评成功评分继续使用现有结果表，失败项以输入序号展示裁判解析或接口错误；试评结束不调用 `onEvaluationComplete`，因此不创建 `EvaluationRecord`。
- 跑批历史入口改为“复用输出去AI评测”；正式评价仍从既有 Task 的 `inputs/results` 读取，每轮成功结果都追加独立评价历史，不覆盖原任务或旧评价。
- 新增真实源码单测和 `evaluation-trial-rerun.spec.ts`；浏览器路径模拟 3 次首次跑批、2 次试评调用和两轮各 3 次正式 Judge 调用，精确证明首次跑批后被测模型调用数不再增加。
- 试评中模拟第 2 条裁判 JSON 解析失败，页面显示成功 1、失败 1，切换到 AI 历史仍为 0；之后两轮正式评价形成 2 条独立历史。
- 视觉证据 `docs/evidence/pr-05d/evaluation-trial-confirm.png` 已人工检查，费用边界和操作区清晰；确认弹窗通过 WCAG 严重与致命问题门禁。
- 本地 `npm run quality` 通过 259 文件 Secret Scan、零 lint、typecheck、104 项真实源码单测、2 项压力测试和 19 路由生产构建；全量 22 项 Playwright 全部通过。

下一步：提交功能快照，在独立干净工作树全新安装依赖并重复全部门禁，再自主推送并创建 PR 05D。

## 2026-08-30：PR 05D 独立干净环境复验

- 功能、本地测试与视觉证据提交为 `a9ffa6e`，父提交为已合并的 `8623da4`；提交前工作树无未提交改动。
- 在 `/tmp/eval-platform-pr05d-a9ffa6e` 以 detached HEAD 检出精确提交，并使用锁文件全新 `npm ci` 安装 434 个包。
- 干净环境 `npm run quality` 再次通过 259 文件 Secret Scan、零 lint、typecheck、104 项真实源码单测、2 项压力测试和 19 路由生产构建。
- 干净环境 `npm run test:e2e` 再次通过全部 22 项 Playwright；试评、两轮重新评价和既有用户路径均使用 Mock，未读取真实密钥或调用真实/付费模型。
- 全部门禁结束后 detached HEAD 仍为 `a9ffa6e` 且 `git status --short` 无输出，证明本 PR 不依赖原工作树缓存、构建产物或未跟踪文件。
- `npm ci` 仍报告锁文件既有的 6 个 high 级依赖审计项；未执行可能引入破坏性升级的 `npm audit fix --force`，继续留给依赖治理专题。

下一步：提交独立环境证据，推送分支并创建 PR 05D，等待 GitHub 核心质量与 Playwright 两道 CI。

## 2026-08-30：PR 05D 创建与首轮 GitHub CI

- 独立环境证据提交为 `aaece60`，分支 `codex/feat-evaluator-trial-rerun` 已推送并创建 [PR #25](https://github.com/boyuling-123/AI-API-workspace/pull/25)。
- 创建 PR 后确认基线为 `main@8623da4`、Head 为 `aaece60`，GitHub 判定可自动合并，且没有 Review 或未解决审查线程。
- workflow run `33292294441` 的 `Lint, test, build, and secret scan` Job 全部通过，覆盖 259 文件密钥扫描、lint、typecheck、104 项真实源码单测、2 项压力测试与 19 路由生产构建。
- 同一 run 的 `Playwright user paths and accessibility` Job 通过全部 22 项浏览器与 WCAG 路径；失败 Trace 上传因没有失败而按设计跳过。
- PROMPT-003 与 PROMPT-008 已具备代码、异常路径、真实源码测试、Mock 用户路径、视觉证据、独立干净环境与 GitHub CI Trace，升级为“已验证”。

下一步：提交 PR 与首轮 CI 验收回写，等待该最终文档提交自身两道 CI 通过后确认远端无漂移并安全合并 PR #25。

## 2026-08-30：PR 05D 合并与 PR 06A 启动

- PR #25 最终文档提交对应 workflow run `33292408679` 的核心质量与 Playwright/WCAG 两道 GitHub CI 全部通过。
- 确认远端 `main` 保持在预期基线 `8623da4`、PR 可合并且无 Review 或未解决线程后，以普通 fast-forward 安全合并；GitHub 确认 Merged，合并 SHA 为 `ad430a3`。
- 本地 `main` 与 `origin/main` 同步到 `ad430a3`，随后创建短生命周期分支 `codex/feat-judge-golden-dataset`，本轮只领取 JUDGE-003。

## 2026-08-30：PR 06A 黄金集领域模型与导入边界

- 提交前审计发现完整黄金集切片达到约 1800 行，因此按短生命周期原则拆成两个连续 PR；本 PR 只保留可独立验收的领域、解析与真实源码测试。
- 新增人工真值 Case，明确保存 Case ID、输入、候选输出、可选标准答案、pass/fail 标签、可选 0–10 分和复核说明。
- 严格导入支持 Excel、CSV、JSON 与 JSONL，只接受明确数组或 `items/data` 容器；缺必填列、非法标签、重复 ID 和越界分数均进入结构化问题列表，不静默跳过或猜测。
- 新增不可变 `GoldenDatasetVersion`：v1 发布后只能读取，追加 vN+1 必须存在完整家族并填写变更说明；旧快照不变，内容与元数据分别校验指纹。
- `Project.goldenDatasetVersions` 保持可选并在新项目初始化为空数组，因此不提升 schema 版本、不清理用户当前 IndexedDB 项目。
- `goldenDataset.test.ts` 共 8 项，直接覆盖双语字段、真实 Excel 工作簿、严格 JSON、非法数据、版本追加、深拷贝、篡改和敏感值脱敏。

下一步：提交 PR 06A 精确功能快照，在独立干净工作树复验 quality 与既有 22 项 Playwright；管理页、E2E 与视觉证据保留给 PR 06B。

## 2026-08-30：PR 06A 独立干净环境复验

- 领域、解析、项目兼容字段、8 项单测与台账提交为 `3e0582a`，父提交为已合并的 `ad430a3`。
- 在 `/tmp/eval-platform-pr06a-3e0582a` 以 detached HEAD 检出精确提交，并使用锁文件全新 `npm ci` 安装 434 个包。
- 干净环境 `npm run quality` 通过 262 文件 Secret Scan、零 lint、typecheck、112 项真实源码单测、2 项压力测试和 19 路由生产构建。
- 干净环境既有 22 项 Playwright 全部通过，`.last-run.json` 状态为 `passed` 且无失败测试；本 PR 没有新增页面或 API 调用。
- 全部门禁结束后 detached HEAD 仍为 `3e0582a` 且 `git status --short` 无输出，证明领域层不依赖当前工作区尚未提交的 PR 06B UI。
- `npm ci` 仍报告锁文件既有的 6 个 high 级依赖审计项；未执行可能引入破坏性升级的 `npm audit fix --force`，继续留给依赖治理专题。

下一步：提交独立环境证据，推送 PR 06A 分支并等待 GitHub 两道质量门禁。

## 2026-08-30：PR 06A 创建与首轮 GitHub CI

- 独立环境证据提交为 `ea92f87`，分支 `codex/feat-judge-golden-dataset` 已推送并创建 [PR #26](https://github.com/boyuling-123/AI-API-workspace/pull/26)。
- 创建 PR 后确认基线为 `main@ad430a3`、Head 为 `ea92f87`，GitHub 判定可自动合并，且没有 Review 或未解决审查线程。
- workflow run `33293157412` 的 `Lint, test, build, and secret scan` Job 全部通过，覆盖 262 文件密钥扫描、lint、typecheck、112 项真实源码单测、2 项压力测试与 19 路由生产构建。
- 同一 run 的 `Playwright user paths and accessibility` Job 通过全部既有 22 项浏览器与 WCAG 路径；失败 Trace 上传因没有失败而按设计跳过。
- JUDGE-003 继续保持“部分实现”：PR 06A 已验证领域和严格导入边界，独立管理页面与完整用户路径由连续小 PR 06B 提交。

下一步：提交 PR 与首轮 CI 验收回写，等待该最终文档提交自身两道 CI 通过后确认远端无漂移并安全合并 PR #26。

## 2026-08-30：PR 06A 合并与 PR 06B 本地实现

- PR #26 最终文档提交对应 workflow run `33293293787` 的核心质量与 Playwright/WCAG 两道 GitHub CI 全部通过。
- 确认远端 `main` 保持在预期基线 `ad430a3`、PR 可合并且无 Review 或未解决线程后，以普通 fast-forward 安全合并；GitHub 确认 Merged，合并 SHA 为 `50cdc17`。
- 在不丢弃已保留 UI 草稿的前提下创建短生命周期分支 `codex/feat-judge-golden-dataset-ui`；PR 06B 只承接 JUDGE-003 的管理页面与用户验收层。
- 新增独立“Judge 校准”工作区入口、严格字段映射预览、逐行阻断问题、人工真值草稿、不可变版本库，以及基于 vN 创建 vN+1 的显式操作。
- 复核时发现坏文件导入后可能通过“手工新增 Case”清除阻断状态；已封闭该旁路并增加 E2E 断言，要求修复后重新导入或显式清空草稿。
- `golden-dataset.spec.ts` 使用 Mock 覆盖坏文件、合法映射、v1/v2、旧标签不变、刷新持久化、WCAG 和零 API/Judge 调用；首轮全量 E2E 同时发现旧导航测试硬编码 5 个标签，已改为验证 6 个真实入口而非降低断言。
- 本地 `npm run quality` 通过 267 文件 Secret Scan、零 lint、typecheck、112 项真实源码单测、2 项压力测试和 19 路由生产构建；修正基线后全量 23 项 Playwright 通过。
- 视觉证据 `docs/evidence/pr-06b/golden-dataset-versions.png` 已按当前代码重新生成并人工检查，独立页面、版本状态与费用边界清晰。

下一步：提交 PR 06B 功能快照，在独立干净工作树全新安装依赖并重复全部门禁，再自主推送、创建 PR 和完成 GitHub CI。

## 2026-08-30：PR 06B 独立干净环境复验

- 页面、用户路径、视觉证据和台账功能快照提交为 `23fdb21`，父提交为已合并的 `50cdc17`；原工作树提交后零改动。
- 在 `/tmp/eval-platform-pr06b-23fdb21` 以 detached HEAD 检出精确提交，并使用锁文件全新 `npm ci` 安装 434 个包。
- 干净环境 `npm run quality` 通过 267 文件 Secret Scan、零 lint、typecheck、112 项真实源码单测、2 项压力测试和 19 路由生产构建。
- 干净环境 `npm run test:e2e` 通过全部 23 项 Playwright；黄金集路径使用 Mock 并精确断言没有 `/api/**` 请求，未调用真实或付费模型。
- 全部门禁结束后 detached HEAD 仍为 `23fdb21` 且 `git status --short` 无输出，证明本 PR 不依赖原工作树缓存、构建产物或未跟踪文件。
- `npm ci` 仍报告锁文件既有的 6 个 high 级依赖审计项；未执行可能引入破坏性升级的 `npm audit fix --force`，继续留给依赖治理专题。

下一步：提交独立环境证据，推送分支并自主创建 PR 06B，等待 GitHub 核心质量与 Playwright 两道 CI。

## 2026-08-30：PR 06B 创建与首轮 GitHub CI

- 独立环境证据提交为 `f735000`，分支 `codex/feat-judge-golden-dataset-ui` 已推送并自主创建 [PR #27](https://github.com/boyuling-123/AI-API-workspace/pull/27)。
- 创建 PR 后确认基线为 `main@50cdc17`、Head 为 `f735000`，GitHub 判定可自动合并。
- workflow run `33293740909` 的 `Lint, test, build, and secret scan` Job 全部通过，覆盖 267 文件密钥扫描、lint、typecheck、112 项真实源码单测、2 项压力测试与 19 路由生产构建。
- 同一 run 的 `Playwright user paths and accessibility` Job 通过全部 23 项浏览器与 WCAG 路径；失败 Trace 上传因没有失败而按设计跳过。
- JUDGE-003 已同时具备代码、异常路径、真实源码测试、Mock 用户路径、视觉证据、独立干净环境与 GitHub CI Trace，升级为“已验证”。

下一步：提交 PR 与首轮 CI 验收回写，等待该最终文档提交自身两道 CI 通过后确认远端无漂移并安全合并 PR #27。

## 2026-08-30：PR 06B 合并与 PR 06C 启动

- PR #27 最终文档提交对应 workflow run `33293861344` 的核心质量与 Playwright/WCAG 两道 GitHub CI 全部通过。
- 确认远端 `main` 保持在预期基线 `50cdc17`、PR 可合并且无 Review 或未解决线程后，以普通 fast-forward 安全合并；GitHub 确认 Merged，合并 SHA 为 `58aae60`。
- 本地从同一提交创建短生命周期分支 `codex/feat-judge-calibration-metrics`，JUDGE-004 按服务核心与页面用户路径拆成 PR 06C/06D。

## 2026-08-30：PR 06C 校准契约与指标核心

- 新增单 Case `/api/judge-calibration` 与严格二分类 Judge Prompt，只接收 Case ID、输入、候选输出、可选标准答案、Judge ID 和判定标准。
- 路由在调用模型前白名单重建输入；额外传入的 `humanLabel`、`reviewerNote` 或其他人工真值字段会被丢弃，避免标签泄漏造成虚假高一致性。
- Judge 输出严格校验 pass/fail、0-1 置信度与非空理由；用户请求错误返回 400，Judge 坏 JSON、坏标签或越界置信度返回 500。
- 新增确定性指标模块：准确率、Cohen’s κ、Bad Case 漏判率、误杀率和混淆矩阵；失败 Case 不进入指标分母，无有效分母时返回 null。
- 3 个新增测试文件共 11 项测试，直接覆盖指标、服务和 route；Prompt 隔离测试证明人工标签与复核说明不会发送给 Judge，敏感值发送前会脱敏。
- 本地最终 `npm run quality` 通过 275 文件 Secret Scan、零 lint、typecheck、123 项真实源码单测、2 项压力测试和 20 路由生产构建；全量既有 23 项 Playwright 全部通过。

下一步：提交 PR 06C 功能快照并在独立干净工作树全新安装依赖，重复全部门禁。

## 2026-08-30：PR 06C 独立干净环境复验

- 校准契约、指标、类型、API 文档、11 项新增单测与台账功能快照提交为 `c1f60cd`，父提交为已合并的 `58aae60`。
- 在 `/tmp/eval-platform-pr06c-c1f60cd` 以 detached HEAD 检出精确提交，并使用锁文件全新 `npm ci` 安装 434 个包。
- 干净环境 `npm run quality` 通过 275 文件 Secret Scan、零 lint、typecheck、123 项真实源码单测、2 项压力测试和 20 路由生产构建。
- 干净环境 `npm run test:e2e` 通过全部既有 23 项 Playwright；新增校准测试全部 Mock，未读取真实密钥或调用真实/付费模型。
- 全部门禁结束后 detached HEAD 仍为 `c1f60cd` 且 `git status --short` 无输出，证明本 PR 不依赖原工作树缓存、构建产物或未跟踪文件。
- `npm ci` 仍报告锁文件既有的 6 个 high 级依赖审计项；未执行可能引入破坏性升级的 `npm audit fix --force`，继续留给依赖治理专题。

下一步：提交独立环境证据，推送分支并自主创建 PR 06C，等待 GitHub 核心质量与 Playwright 两道 CI。

## 2026-08-30：PR 06C 创建与首轮 GitHub CI

- 独立环境证据提交为 `11c5fa1`，分支 `codex/feat-judge-calibration-metrics` 已推送并自主创建 [PR #28](https://github.com/boyuling-123/AI-API-workspace/pull/28)。
- 创建 PR 后确认基线为 `main@58aae60`、Head 为 `11c5fa1`，GitHub 判定可自动合并。
- workflow run `33294370480` 的 `Lint, test, build, and secret scan` Job 全部通过，覆盖 275 文件密钥扫描、lint、typecheck、123 项真实源码单测、2 项压力测试与 20 路由生产构建。
- 同一 run 的 `Playwright user paths and accessibility` Job 通过全部既有 23 项浏览器与 WCAG 路径；失败 Trace 上传因没有失败而按设计跳过。
- JUDGE-004 服务核心已具备代码、异常路径、真实源码测试、独立干净环境与 GitHub CI Trace；因确认式运行和样本下钻尚在 PR 06D，状态继续保持“部分实现”。

下一步：提交 PR 与首轮 CI 验收回写，等待该最终文档提交自身两道 CI 通过后确认远端无漂移并安全合并 PR #28。

## 2026-08-30：PR 06C 合并与 PR 06D 本地实现

- PR #28 最终文档提交对应 workflow run `33294485493` 的核心质量与 Playwright/WCAG 两道 GitHub CI 全部通过。
- 确认远端 `main` 保持在预期基线 `58aae60`、PR 可合并且无 Review 或未解决线程后，以普通 fast-forward 安全合并；GitHub 确认 Merged，合并 SHA 为 `eba0264`。
- 从同一提交创建短生命周期分支 `codex/feat-judge-calibration-workspace`，只承接 JUDGE-004 的确认式运行、持久化与结果下钻。
- 新增校准客户端编排和独立运行区：精确显示 Judge/被测模型调用数，二次确认后才按 1-5 并发逐 Case 请求；不少于 100 次时必须输入精确调用数。
- 客户端请求继续执行字段白名单，不发送人工标签与复核说明；成功、失败和取消 Case 均按原黄金集顺序形成一次不可变运行记录。
- 结果区展示准确率、Cohen’s κ、Bad Case 漏判率、成功/失败数、2x2 混淆矩阵，以及分歧与失败样本理由；历史随项目 IndexedDB 刷新持久化。
- 定向 E2E 首轮发现确认弹窗两处对比度 3.68:1，第二轮发现历史徽标 4.34:1；均提升为满足 WCAG AA 的颜色后通过，门禁未被关闭或降级。
- 2 项客户端单测和 2 项 Mock E2E 证明打开/取消确认 0 调用、确认后精确 3 调用、2 成功 1 失败、50% 准确率、100% 漏判率，以及 100 Case 数字确认边界。
- 视觉证据 `docs/evidence/pr-06d/judge-calibration-results.png` 已人工检查，配置、指标、混淆矩阵和分歧样本层级清晰。
- 本地 `npm run quality` 通过 281 文件 Secret Scan、零 lint、typecheck、125 项真实源码单测、2 项压力测试和 20 路由生产构建；全量 25 项 Playwright 全部通过。

下一步：提交 PR 06D 功能快照，在独立干净工作树全新安装依赖并重复全部门禁。

## 2026-08-30：PR 06D 独立干净环境复验

- 确认式运行、持久化、结果下钻、客户端测试、Mock E2E、视觉证据与台账功能快照提交为 `fa2fd3a`，父提交为已合并的 `eba0264`。
- 在 `/tmp/eval-platform-pr06d-fa2fd3a` 以 detached HEAD 检出精确提交，并使用锁文件全新 `npm ci` 安装 434 个包。
- 干净环境 `npm run quality` 通过 281 文件 Secret Scan、零 lint、typecheck、125 项真实源码单测、2 项压力测试和 20 路由生产构建。
- 干净环境 `npm run test:e2e` 通过全部 25 项 Playwright；校准路径使用 Mock，未读取真实密钥或调用真实/付费模型。
- 全部门禁结束后 detached HEAD 仍为 `fa2fd3a` 且 `git status --short` 无输出，证明本 PR 不依赖原工作树缓存、构建产物或未跟踪文件。
- `npm ci` 仍报告锁文件既有的 6 个 high 级依赖审计项；未执行可能引入破坏性升级的 `npm audit fix --force`，继续留给依赖治理专题。

下一步：提交独立环境证据，推送分支并自主创建 PR 06D，等待 GitHub 核心质量与 Playwright 两道 CI。

## 2026-08-30：PR 06D 创建与首轮 GitHub CI

- 独立环境证据提交为 `114c76d`，分支已推送并自主创建 [PR #29](https://github.com/boyuling-123/AI-API-workspace/pull/29)。
- PR 只包含确认式 Judge 校准工作区、客户端编排、Mock 用户路径和对应验收文档，共 11 个文件；GitHub 确认可自动合并。
- workflow run `33295087238` 的 `Lint, test, build, and secret scan` 与 `Playwright user paths and accessibility` 两个 Job 全部成功。
- JUDGE-004 已同时具备真实源码、异常路径、Mock 用户路径、独立干净环境、视觉证据和 GitHub CI Trace，状态升级为“已验证”。

下一步：提交首轮 CI 验收回写，等待该提交自身两道 CI 通过后，执行远端漂移、Review/线程与可合并状态审计，再安全合并 PR #29。

## 2026-08-30：PR 06D 合并与 PR 06E 本地实现

- PR #29 最终文档提交对应 workflow run `33295201533` 的核心质量与 Playwright/WCAG 两道 GitHub CI 全部通过。
- 确认远端 `main` 保持在预期基线 `eba0264`、PR 可合并且无 Review 或未解决线程后，以普通 fast-forward 安全合并；GitHub 确认 Merged，合并 SHA 为 `1af2a69`。
- 从同一提交创建短生命周期分支 `codex/feat-judge-calibration-rerun`，只承接 JUDGE-007 的版本绑定、变更规划和前后对比；发布阻断继续留给 JUDGE-008。
- 校准运行新增向后兼容的任务 id、触发类型、基线 id、变更类别和 Evaluator 执行快照；旧项目无需 schema 迁移。
- 纯函数规划器优先查找同黄金集、同 Judge、同执行定义的已有结果；只有 Judge、维度、Prompt、Evaluator 或自定义标准真实变化时才生成配置变化重跑计划。
- Evaluator 版本会确定性转换为实际 Judge 判定标准；非执行元数据不会触发重跑，完整标准最长 100,000 字符且超限在模型调用前拒绝。
- 页面在确认前只显示重跑来源、精确调用数和变化类别，不发请求；确认后追加独立历史并用基线 id 展示准确率、κ 和漏判率差异。
- 新增 Mock E2E 真实创建 Evaluator v1/v2，以 v1 建立 0% 基线、切换 Prompt 后保持零新增调用，再确认精确 1 次重跑得到 100% 并在刷新后保留两次历史。
- 视觉证据 `docs/evidence/pr-06e/evaluator-rerun-comparison.png` 已人工检查，版本、触发来源、指标变化和历史选择层级清晰。
- 本地 `npm run quality` 通过 286 文件 Secret Scan、零 lint、typecheck、131 项真实源码单测、2 项压力测试和 20 路由生产构建；全量 26 项 Playwright 全部通过。

下一步：提交 PR 06E 功能快照，在独立干净工作树全新安装依赖并重复全部门禁。

## 2026-08-30：PR 06E 独立干净环境复验

- Evaluator 绑定、变更规划、重跑确认、前后对比、API 边界、单测、Mock E2E、视觉证据与台账功能快照提交为 `515aeb8`，父提交为已合并的 `1af2a69`。
- 在 `/tmp/eval-platform-pr06e-515aeb8` 以 detached HEAD 检出精确提交，并使用锁文件全新 `npm ci` 安装 434 个包。
- 干净环境 `npm run quality` 通过 286 文件 Secret Scan、零 lint、typecheck、131 项真实源码单测、2 项压力测试和 20 路由生产构建。
- 干净环境 `npm run test:e2e` 通过全部 26 项 Playwright；新增重跑路径使用 Mock，未读取真实密钥或调用真实/付费模型。
- 全部门禁结束后 detached HEAD 仍为 `515aeb8` 且 `git status --short` 无输出，证明本 PR 不依赖原工作树缓存、构建产物或未跟踪文件。
- `npm ci` 仍报告锁文件既有的 6 个 high 级依赖审计项；未执行可能引入破坏性升级的 `npm audit fix --force`，继续留给依赖治理专题。

下一步：提交独立环境证据，推送分支并自主创建 PR 06E，等待 GitHub 核心质量与 Playwright 两道 CI。

## 2026-08-30：PR 06E 创建与首轮 GitHub CI

- 独立环境证据提交为 `9195a67`，分支已推送并自主创建 [PR #30](https://github.com/boyuling-123/AI-API-workspace/pull/30)。
- PR 只包含 JUDGE-007 的版本绑定、变更规划、确认式重跑、前后对比和对应测试文档，共 17 个文件；GitHub 确认可自动合并。
- workflow run `33296085052` 的 `Lint, test, build, and secret scan` 与 `Playwright user paths and accessibility` 两个 Job 全部成功。
- JUDGE-007 已同时具备真实源码、异常路径、Mock 用户路径、独立干净环境、视觉证据和 GitHub CI Trace，状态升级为“已验证”。
- PROMPT-007 只完成 Prompt/维度变化后的黄金集重跑；因校准失败阻止发布尚未实现，继续保持“部分实现”。

下一步：提交首轮 CI 验收回写，等待该提交自身两道 CI 通过后，执行远端漂移、Review/线程与可合并状态审计，再安全合并 PR #30。

## 2026-08-30：PR 06E 合并与 PR 06F 本地实现

- PR #30 最终文档提交对应 workflow run `33296208642` 的核心质量与 Playwright/WCAG 两道 GitHub CI 全部通过。
- 确认远端 `main`、可合并状态和审查线程后，以普通 fast-forward 安全合并；GitHub 确认 Merged，合并 SHA 为 `1b6d01e`。
- 从合并提交创建短生命周期分支 `codex/feat-evaluator-calibration-gate`，只承接 JUDGE-008 和 PROMPT-007 剩余的 Active 发布阻断，不引入权限模型或自动评价。
- 新增只追加 Evaluator 发布记录，固定保存发布人、Evaluator/黄金集/Judge 引用、门禁阈值、复算指标、前一发布 id 与完整性指纹；损坏记录不参与 Active 选择。
- 领域门禁要求校准绑定同一 Evaluator 家族和完整执行定义，判定标准必须逐字同步版本定义；跨家族、改写标准和自定义标准均不能旁路。
- 每条校准结果要求唯一 Case ID 和完整成功/失败结构，发布前从逐 Case 结果重新计算所有指标并与已存快照核对，拒绝重复 Case 或指标篡改。
- 固定阈值为有效样本不少于 20、准确率不低于 90%、Cohen's κ 不低于 0.8、Bad Case 漏判率不高于 5% 且零错误；阈值不开放调用方覆盖。
- 页面将门禁实际值和要求同屏展示；失败时禁用发布，通过后仍要求发布人和第二次确认。发布只写本地记录，模型调用为 0 次，旧 Active 保留在历史中。
- 新 Mock E2E 用 v1 制造 10% 漏判并验证阻断，再用 v2 达到 100%/1.0/0%，确认前后 Judge 调用严格为两轮各 20 次，发布与刷新不新增调用。
- 首轮 Axe 发现装饰圆点使用非法 `aria-label` 和 11px 表头对比度 4.34:1；改为隐藏装饰点、增加屏幕阅读器状态文本并提高对比度，未关闭规则。
- 视觉证据 `docs/evidence/pr-06f/evaluator-release-gate.png` 已人工检查；本地 137 项单测、2 项压力测试、20 路由构建和全量 27 项 Playwright 通过，lint 为零警告。

下一步：提交 PR 06F 功能快照，在独立干净工作树全新安装依赖并重复全部门禁。

## 2026-08-30：PR 06F 独立干净环境复验

- Active 发布记录、固定门禁、指标复算、确认页面、单测、Mock E2E、视觉证据与台账功能快照提交为 `7e81ea6`，父提交为已合并的 `1b6d01e`。
- 在 `/tmp/eval-platform-pr06f-7e81ea6` 以 detached HEAD 检出精确提交，并使用锁文件全新 `npm ci` 安装 434 个包。
- 干净环境 `npm run quality` 通过 292 文件 Secret Scan、零 lint、typecheck、137 项真实源码单测、2 项压力测试和 20 路由生产构建。
- 干净环境 `npm run test:e2e` 通过全部 27 项 Playwright；新增发布路径使用 Mock，未读取真实密钥或调用真实/付费模型。
- 全部门禁结束后 detached HEAD 仍为 `7e81ea6` 且 `git status --short` 无输出，证明本 PR 不依赖原工作树缓存、构建产物或未跟踪文件。
- `npm ci` 仍报告锁文件既有的 6 个 high 级依赖审计项；未执行可能引入破坏性升级的 `npm audit fix --force`，继续留给依赖治理专题。

下一步：提交独立环境证据，推送分支并自主创建 PR 06F，等待 GitHub 核心质量与 Playwright 两道 CI。

## 2026-08-30：PR 06F 创建与首轮 GitHub CI

- 独立环境证据提交为 `bb33448`，分支已推送并自主创建 [PR #31](https://github.com/boyuling-123/AI-API-workspace/pull/31)。
- PR 基线为 `main@1b6d01e`、Head 为 `bb33448`，包含 2 个提交与 15 个文件；GitHub 确认可自动合并。
- workflow run `33297002754` 的 `Lint, test, build, and secret scan` 与 `Playwright user paths and accessibility` 两个 Job 全部成功。
- JUDGE-008 与 PROMPT-007 已同时具备代码、异常路径、真实源码测试、Mock 用户路径、独立干净环境、视觉证据和 GitHub CI Trace，状态升级为“已验证”。

下一步：提交首轮 CI 验收回写，等待该最终文档提交自身两道 CI 通过后，执行远端漂移、Review/线程与可合并状态审计，再安全合并 PR #31。

## 2026-08-30：PR 06F 最终合并

- 最终文档提交 `a2d5f0f` 对应 workflow run `33297159622` 的核心质量与 Playwright/WCAG 两道 GitHub CI 全部通过。
- 再次获取远端后确认 `main` 保持在预期基线 `1b6d01e`，PR Head 与远端分支均为 `a2d5f0f`，工作区干净。
- PR #31 非草稿、GitHub `mergeable=true`，无 Review 和未解决线程；以普通 fast-forward 推送到 `main`，未强推或改写历史。
- GitHub 已确认 PR #31 为 Merged，合并 SHA 为 `a2d5f0f`；JUDGE-008 与 PROMPT-007 保持“已验证”。

下一步：在短分支 `codex/feat-multi-judge-calibration` 领取 JUDGE-005 的多 Judge 独立投票与确定性分歧仲裁核心，页面接入继续拆分为后续小 PR。

## 2026-08-30：PR 06G 多 Judge 校准核心本地实现

- 从已合并的 `main@a2d5f0f` 创建短生命周期分支 `codex/feat-multi-judge-calibration`，本轮只交付 JUDGE-005 的可复用核心，页面接入继续拆分，避免扩大单个 PR。
- 多 Judge 运行要求选择 `2-5` 个唯一模型，精确调用数为 Case 数乘 Judge 数；全部请求共用 `1-5` 全局并发池，单 Case API 契约保持不变。
- 每个 Judge 独立收到 Case 与相同标准，人工标签、复核说明和其他 Judge 投票不会进入请求；原始票与逐 Judge 指标均完整保留。
- 多数票策略在平票时固定为 `fail`，全票通过策略仅在全体 `pass` 时通过；任何投票缺失或失败都会把该 Case 标记为错误，禁止部分票数静默仲裁。
- 运行身份由排序后的 Judge ID 集合与策略共同确定；发布前从原始票复算仲裁、逐 Judge 指标、最终指标、运行状态和分歧数，残缺或篡改证据无法通过 Active 门禁。
- 发布快照新增 Judge 集合与仲裁策略，并继续受完整性指纹保护；旧单 Judge 运行和发布记录无需迁移。
- 本地 `npm run quality` 通过 297 文件 Secret Scan、零 lint、typecheck、146 项真实源码单测、2 项压力测试和 20 路由生产构建；全量 27 项 Playwright 回归通过。

下一步：提交 PR 06G 功能快照，在独立干净工作树全新安装依赖并重复全部门禁。

## 2026-08-30：PR 06G 独立干净环境复验

- 多 Judge 核心、发布集成、真实源码测试、API/决策文档与能力矩阵功能快照提交为 `7d7ba98`，父提交为已合并的 `a2d5f0f`。
- 在 `/tmp/eval-platform-pr06g-7d7ba98` 以 detached HEAD 检出精确提交，并使用锁文件全新 `npm ci` 安装 434 个包。
- 干净环境 `npm run quality` 通过 297 文件 Secret Scan、零 lint、typecheck、146 项真实源码单测、2 项压力测试和 20 路由生产构建。
- 干净环境 `npm run test:e2e` 通过全部 27 项 Playwright；本 PR 无新 UI，测试用于回归既有用户路径与 WCAG，未读取真实密钥或调用真实/付费模型。
- 全部门禁结束后 detached HEAD 仍为 `7d7ba98` 且 `git status --short` 无输出，证明本 PR 不依赖原工作树缓存、构建产物或未跟踪文件。
- `npm ci` 仍报告锁文件既有的 6 个 high 级依赖审计项；未执行可能引入破坏性升级的 `npm audit fix --force`，继续留给依赖治理专题。

下一步：提交独立环境证据，推送分支并自主创建 PR 06G，等待 GitHub 核心质量与 Playwright 两道 CI。

## 2026-08-30：PR 06G 创建与首轮 GitHub CI

- 独立环境证据提交为 `f3db823`，分支已推送并自主创建 [PR #32](https://github.com/boyuling-123/AI-API-workspace/pull/32)。
- PR 基线为 `main@a2d5f0f`，Head 为 `f3db823`，只包含 JUDGE-005 多 Judge 核心、发布集成、真实源码测试和对应文档，共 15 个文件。
- workflow run `33297825582` 的 `Lint, test, build, and secret scan` 与 `Playwright user paths and accessibility` 两个 Job 全部成功。
- JUDGE-005 核心已具备代码、异常路径、真实源码测试、独立干净环境和 GitHub CI Trace；因页面选择、费用确认和分歧下钻尚未接入，继续保持“部分实现”，不提前升级。

下一步：提交首轮 CI 验收回写，等待该最终文档提交自身两道 CI 通过后，执行远端漂移、Review/线程与可合并状态审计，再安全合并 PR #32。

## 2026-08-30：PR 06G 最终合并与平台总览短 PR 本地实现

- PR #32 最终文档提交 `1720250` 对应 workflow run `33297951993` 的核心质量与 Playwright/WCAG 两道 GitHub CI 全部通过。
- 再次确认远端无漂移、PR 可合并且不存在 Review 或未解决线程后，以普通 fast-forward 安全合并；GitHub 确认 Merged，合并 SHA 为 `1720250`。
- 为避免把用户新增的平台内容规整需求混入正在开发的多 Judge 页面分支，从 `main@1720250` 建立独立工作树和短分支 `codex/feat-platform-overview`。
- 新增独立平台总览，把数据与跑批、模型接入、结果重跑、AI 评价、Judge 校准、Agent 外部召唤规整为六条产品链路；“跑批”继续保持默认首页和导航第一项。
- 总览的可用目标、批次、评价、Evaluator、黄金集、校准和发布数字全部直接读取当前项目；最近任务同样读取真实历史，不建立第二套状态。
- 页面明确 Agent 外部召唤为 Demo、多 Judge 页面闭环为部分实现、大数据后端化为设计中；任何总览访问和跳转均不调用 API 或模型。
- 定向 Playwright 首轮 8 项全部通过。新增 390px 检查后发现既有顶部工具栏宽度为 458px，随后以弹性项目名和固定图标按钮修复为无页面级横向溢出，未隐藏任何操作。
- 视觉证据 `docs/evidence/pr-platform-overview/platform-overview.png` 已人工检查；TypeScript、零警告 lint、总览桌面/移动端、零 API 调用与 WCAG 定向门禁通过。
- 本地 `npm run quality` 通过 300 文件密钥扫描、零警告 lint、typecheck、146 项真实源码单测、2 项压力测试和 20 路由生产构建；全量 29 项 Playwright 用户路径全部通过。

下一步：提交功能快照，在独立干净环境全新安装依赖并重复全部门禁，再自主创建平台总览短 PR。

## 2026-08-30：平台总览短 PR 独立干净环境复验

- 平台总览、真实项目统计、导航、移动端工具栏、Mock E2E、视觉证据与文档功能快照提交为 `04743ab`，父提交为已合并的 `main@1720250`。
- 在 `/tmp/eval-platform-overview-clean-04743ab` 以 detached HEAD 检出精确提交，并使用锁文件全新 `npm ci` 安装 434 个包。
- 干净环境 `npm run quality` 通过 300 文件 Secret Scan、零警告 lint、typecheck、146 项单测、2 项压力测试和 20 路由生产构建。
- 第一次非 CI Playwright 误复用端口 3100 上另一工作树的旧开发服务，先读到旧版 6 标签，随后出现连接拒绝；该次运行明确记为失败，不计入门禁。
- 改用 `CI=1` 禁止复用服务并由 Playwright 启动本提交专属开发服务后，全量 29 项用户路径与 WCAG 检查全部通过。
- 测试结束后 detached HEAD 仍为 `04743ab` 且 `git status --short` 无输出；本 PR 不依赖原工作树缓存、构建产物或未跟踪文件。
- `npm ci` 仍报告锁文件既有的 6 个 high 级依赖审计项；未执行可能引入破坏性升级的 `npm audit fix --force`，继续留给依赖治理专题。

下一步：提交干净环境证据，推送分支并自主创建平台总览短 PR，等待 GitHub 核心质量与 Playwright/WCAG 两道 CI。

## 2026-08-30：平台总览 PR 34 首轮 GitHub CI 验收

- 分支 `codex/feat-platform-overview` 以 `main@1720250` 为基线推送，并自主创建 [PR #34](https://github.com/boyuling-123/AI-API-workspace/pull/34)；PR 仅包含平台总览、移动端工具栏修复、真实源码测试、视觉证据和对应文档。
- 首轮 head `51f3fd9` 对应 workflow run `33298811346`。
- `Lint, test, build, and secret scan` Job 全部成功：锁文件安装、密钥扫描、零警告 lint、类型检查、真实源码单测、任务池压力测试和生产构建均通过。
- `Playwright user paths and accessibility` Job 全部成功：Chromium 安装、29 项用户路径与 WCAG 检查通过；因无失败，失败 Trace/截图上传步骤按预期跳过。
- 首轮远端门禁没有调用真实或付费模型，也没有自动启动 AI 评价。

下一步：让本次 CI 证据回写提交自身通过两道 GitHub CI，再执行远端漂移、Review/线程和可合并状态审计后安全合并 PR #34。
## 2026-08-30：PR 06G 最终合并与 PR 06H 页面接入

- PR #32 最终文档提交对应 workflow run `33297951993` 的核心质量与 Playwright/WCAG 两道 GitHub CI 全部通过。
- 再次获取远端后确认 `main` 保持预期基线，PR Head 与远端分支一致，PR 非草稿且可合并，无 Review 或未解决线程。
- 以普通 fast-forward 推送到 `main`，未强推或改写历史；GitHub 确认 PR #32 为 Merged，合并 SHA 为 `1720250`。
- 从合并提交创建短生命周期分支 `codex/feat-multi-judge-calibration-ui`，只补齐 JUDGE-005 页面闭环，不混入后端存储或其他业务专题。
- 默认单 Judge 路径和既有文案保持兼容；多 Judge 模式要求显式选择 `2-5` 个模型，实时展示 `Case × Judge` 精确调用矩阵，选择不足时禁止启动。
- 费用确认弹窗列出 Judge 集合、仲裁策略、精确调用公式和零次被测模型调用；取消不会请求，确认后才复用 PR 06G 核心执行。
- 结果区新增逐 Judge 独立指标、Judge 内部分歧数和按 Case 展开的完整原始票，最终仲裁与单 Judge 历史继续使用同一持久化通道。
- 新 Mock Playwright 以 `2 Case × 3 Judge = 6` 验证精确请求、真值隔离、取消零调用、持久化与刷新零新增请求；首次 Axe 验收发现宽表滚动区缺少键盘入口，最终改为无需横向滚动的紧凑指标卡后通过，未关闭规则。

下一步：生成并人工检查 PR 06H 视觉证据，再执行完整本地门禁与独立干净环境复验。

## 2026-08-30：PR 06H 本地完整验收

- 视觉证据 `docs/evidence/pr-06h/multi-judge-calibration.png` 已人工检查；多 Judge 选择、策略、精确调用矩阵、最终指标、逐 Judge 指标与原始票在同一双栏工作台内可读。
- 本地 `npm run quality` 通过 300 文件 Secret Scan、零警告 lint、typecheck、146 项真实源码单测、2 项压力测试和 20 路由生产构建。
- 全量 `npm run test:e2e` 通过 28 项 Playwright，新增场景同时覆盖配置区、费用确认弹窗和结果区 WCAG；既有批量、评价、版本、发布和重跑路径无回归。
- 测试全部使用 Mock；确认前请求为零，确认后精确请求 6 次，刷新后不新增请求，未读取真实密钥或调用真实/付费模型。
- JUDGE-005 当前具备完整代码、异常路径、真实源码测试、Mock 用户路径和视觉证据，状态升级为“已实现”；待独立干净环境与 GitHub CI 后才升级“已验证”。

下一步：提交 PR 06H 功能快照，并在独立 detached 工作树全新安装依赖、重复 quality 与全量 Playwright。

## 2026-08-30：PR 06H 独立干净环境复验

- 多 Judge 工作台、Mock E2E、视觉证据与台账功能快照提交为 `3247632`，父提交为已合并的 `1720250`。
- 在 `/tmp/eval-platform-pr06h-3247632` 以 detached HEAD 检出精确提交，并使用锁文件全新 `npm ci` 安装 434 个包。
- 干净环境 `npm run quality` 通过 300 文件 Secret Scan、零警告 lint、typecheck、146 项真实源码单测、2 项压力测试和 20 路由生产构建。
- 干净环境 `npm run test:e2e` 通过全部 28 项 Playwright；新增多 Judge 路径严格使用 Mock，未读取真实密钥或调用真实/付费模型。
- 全部门禁结束后 detached HEAD 仍为 `3247632` 且 `git status --short` 无输出，证明本 PR 不依赖原工作树缓存、构建产物或未跟踪文件。
- `npm ci` 仍报告锁文件既有的 6 个 high 级依赖审计项；未执行可能引入破坏性升级的 `npm audit fix --force`，继续留给依赖治理专题。

下一步：提交独立环境证据，推送分支并自主创建 PR 06H，等待 GitHub 核心质量与 Playwright 两道 CI。

## 2026-08-30：PR 06H 创建与首轮 GitHub CI

- 独立环境证据提交为 `2833080`，分支已推送并自主创建 [PR #33](https://github.com/boyuling-123/AI-API-workspace/pull/33)。
- PR 基线为 `main@1720250`、Head 为 `2833080`，包含 2 个提交与 9 个文件；GitHub 确认可自动合并。
- workflow run `33298736070` 的 `Lint, test, build, and secret scan` 与 `Playwright user paths and accessibility` 两个 Job 全部成功。
- JUDGE-005 已同时具备核心与页面代码、异常路径、真实源码测试、Mock 用户路径、独立干净环境、视觉证据和 GitHub CI Trace，状态升级为“已验证”。

下一步：提交首轮 CI 验收回写，等待该最终文档提交自身两道 CI 通过后，执行远端漂移、Review/线程与可合并状态审计，再安全合并 PR #33。

## 2026-08-30：平台总览合并前发现并同步 PR 06H

- PR #34 最终证据提交 `34ccc0c` 对应 workflow run `33298951938` 的核心质量与 Playwright/WCAG 两个 Job 全部通过。
- 合并前审计发现远端 `main` 已从 `1720250` 前进到 `ff14ab5`；未覆盖远端、未强推，也未在 GitHub 标记不可合并时继续合并。
- 漂移来源确认为已合并的 [PR #33](https://github.com/boyuling-123/AI-API-workspace/pull/33)：最终 workflow run `33298865195` 两道 CI 通过，JUDGE-005 已完成多 Judge 页面闭环并升级为“已验证”。
- 使用普通 merge 将 `origin/main@ff14ab5` 合入平台总览分支；代码自动合并，4 份并行追加的台账文档人工保留双方事实。
- 平台总览的 Judge 校准状态随真实代码升级为“已验证”，能力点更新为多 Judge 投票与分歧下钻；Agent 和 20GB 级后端化边界不变。
- 同步后 `npm run quality` 通过 303 文件密钥扫描、零警告 lint、typecheck、146 项真实源码单测、2 项压力测试和 20 路由生产构建。
- 使用 `CI=1` 启动本工作树专属服务后，全量 30 项 Playwright 与 WCAG 检查全部通过；PR 06H 新增路径和平台总览路径共同通过，无 API 或付费模型调用。

下一步：提交同步结果并等待 PR #34 新 head 的两道 GitHub CI，再执行最终审计并安全合并。

## 2026-08-30：PR 06H 最终合并与 PR 07A 人工复核闭环

- PR #33 最终文档提交对应 workflow run `33298865195` 的核心质量与 Playwright/WCAG 两道 GitHub CI 全部通过。
- 再次确认远端 `main` 无漂移、PR Head 与远端分支一致、无 Review 或未解决线程后，以普通 fast-forward 安全合并；GitHub 确认合并 SHA 为 `ff14ab5`。
- 从该基线创建短生命周期分支 `codex/feat-calibration-review-queue`，领取 JUDGE-006，并让 REPORT-005/006 先获得校准场景下的部分闭环，不扩大为完整报告系统。
- 新增确定性风险领域层：错误、漏判、人工/Judge 分歧、多 Judge 分歧、低置信度与跨运行重复均有固定分数、解释文本和稳定排序；风险计算与人工复核均为零模型调用。
- 新增项目级只追加领取/完成事件，保存操作者、时间、原始标签、风险快照、结论、说明、领取引用和完整性指纹；损坏事件不参与状态推导，原始校准结果永不覆盖。
- 页面支持状态、风险类型和关键词筛选；完成复核后同时展示人工覆盖层与原始 Judge 标签，并可展开领取、完成两步审计时间线。
- 首轮全量 Playwright 捕获“领取复核”按钮对白对比度仅 `3.18:1`；改为更深的 `amber-700/800` 后，相关 4 项回归和全量 29 项 Playwright 全部通过，未关闭 Axe 规则。
- 本地 `quality` 通过 305 文件 Secret Scan、零警告 lint、typecheck、152 项真实源码单测、2 项压力测试和 20 路由生产构建；视觉证据 `docs/evidence/pr-07a/calibration-review-queue.png` 已人工检查。

下一步：提交 PR 07A 功能快照，在独立 detached 工作树全新安装依赖并重复 quality 与全量 Playwright。

## 2026-08-30：PR 07A 同步平台总览基线并独立复验

- 首次功能提交 `088f839` 完成独立环境复验后，合并前审计发现远端 `main` 已由平台总览工作前进 4 个提交至 `9798b53`；未覆盖远端、未强推，也未继续使用过期基线创建 PR。
- 原提交完整保留在本地 `codex/feat-calibration-review-queue-pre-sync`，从最新 `origin/main` 新建同名交付分支并重放功能；业务代码自动合并，三份并行追加的台账文档人工保留双方事实，ADR 编号顺延为 018。
- 最新功能快照为 `4c03e5e`，其父提交是 `origin/main@9798b53`；平台总览、移动端工具栏和 PR 07A 人工复核能力同时存在。
- 在 `/tmp/eval-platform-pr07a-4c03e5e` 以 detached HEAD 检出精确提交并全新 `npm ci` 安装 434 个包。
- 干净环境 `npm run quality` 通过 309 文件 Secret Scan、零警告 lint、typecheck、152 项真实源码单测、2 项压力测试和 20 路由生产构建。
- 使用 `CI=1` 禁止复用其他工作树服务后，全量 31 项 Playwright 与 WCAG 全部通过；平台总览、单/多 Judge、校准复核和原有跑批/评价路径共同通过。
- 全部门禁结束后 detached HEAD 仍为 `4c03e5e` 且 `git status --short` 无输出；锁文件仍有既有 6 个 high 级审计项，未执行破坏性 `npm audit fix --force`。

下一步：提交同步与独立环境证据，推送分支并自主创建 PR 07A，等待 GitHub 两道 CI。

## 2026-08-30：PR 07A 创建与首轮 GitHub CI

- 同步与独立环境证据提交为 `d227452`，分支已推送并自主创建 [PR #35](https://github.com/boyuling-123/AI-API-workspace/pull/35)。
- PR 基线为 `main@9798b53`、Head 为 `d227452`，包含 2 个提交与 16 个文件；GitHub 确认非草稿且可合并。
- workflow run `33299671151` 的 `Lint, test, build, and secret scan` 全部成功，覆盖锁文件安装、309 文件密钥扫描、零警告 lint、类型检查、152 项真实源码单测、2 项压力测试和 20 路由生产构建。
- 同一 workflow run 的 `Playwright user paths and accessibility` 全部成功，31 项用户路径与 WCAG 检查通过；因没有失败，Trace/截图上传步骤按预期跳过。
- JUDGE-006 已具备代码、异常路径、真实源码测试、Mock 用户路径、独立干净环境、视觉证据和 GitHub CI Trace，状态升级为“已验证”；REPORT-005/006 仍保持“部分实现”。
- 全部自动化继续使用 Mock，未读取真实密钥、调用真实或付费模型，或自动启动 AI 评价。

下一步：提交首轮 CI 验收回写，等待该文档提交自身两道 GitHub CI 通过，再执行远端漂移、Review/线程和可合并状态审计并安全合并 PR #35。

## 2026-08-30：PR 07A 最终合并与 PR 07B 评价排行榜

- PR #35 最终证据提交 `2d6d6f8` 对应 workflow run `33299834504`，核心质量与 Playwright/WCAG 两个 Job 全部成功。
- 合并前重新获取远端，确认 `main@9798b53` 无漂移、PR Head 与远端分支均为 `2d6d6f8`、PR 非草稿且可合并，并且无 Review 或未解决线程。
- 以普通 fast-forward 将 PR #35 合入 `main`，未强推或改写历史；GitHub 确认 [PR #35](https://github.com/boyuling-123/AI-API-workspace/pull/35) 为 Merged，合并 SHA 为 `2d6d6f8`。
- 从该基线创建 `codex/feat-evaluation-leaderboard`，领取 REPORT-001/002，并为 REPORT-003 补真实用户下钻证据，不混入筛选、人工改分或 HTML 导出。
- 新增确定性排行榜计算层：所选维度按原权重归一、逐 Case 计算后跨 Case 求平均；缺失或非法分数不补零，覆盖不足模型不授予正式名次，同分使用竞赛排名。
- 历史详情新增综合榜、单维度榜、任意维度勾选、覆盖率、否决次数和原始 Case 锚点；切换维度与刷新均不增加 API 请求，也不修改历史记录。
- 5 项真实源码单测全部通过；Mock Playwright 以 2 Case、2 模型验证综合榜与准确性单维度名次反转、原始理由下钻、刷新持久化、390px 无溢出和 WCAG。
- 首轮 WCAG 发现“原权重”辅助文本对比度约 `2.5:1`；加深同类文本后 Axe 通过，未关闭规则。视觉证据 `docs/evidence/pr-07b/evaluation-leaderboard.png` 已人工检查。
- 本地 `npm run quality` 通过 315 文件 Secret Scan、零警告 lint、typecheck、157 项真实源码单测、2 项压力测试和 20 路由生产构建；`CI=1` 全量 32 项 Playwright 全部通过。

下一步：提交 PR 07B 功能快照，在独立 detached 工作树全新安装依赖并重复 quality 与全量 Playwright。

## 2026-08-30：PR 07B 独立干净环境复验

- 排行榜计算层、历史页面、真实源码测试、Mock E2E、视觉证据和台账功能快照提交为 `95335f4`，父提交为已合并 PR #35 的 `main@2d6d6f8`。
- 在 `/tmp/eval-platform-pr07b-95335f4` 以 detached HEAD 检出精确提交，并使用锁文件全新 `npm ci` 安装 434 个依赖。
- 干净环境 `npm run quality` 通过 315 文件 Secret Scan、零警告 lint、typecheck、157 项真实源码单测、2 项压力测试和 20 路由生产构建。
- 使用 `CI=1` 启动该工作树专属服务，全量 32 项 Playwright 与 WCAG 全部通过；排行榜、人工复核、多 Judge、Evaluator 和原跑批路径共同通过。
- 全部门禁结束后 detached HEAD 仍为 `95335f4` 且 `git status --short` 无输出，证明实现不依赖原工作树缓存、构建产物或未跟踪文件。
- `npm ci` 仍报告锁文件既有的 6 个 high 级审计项；未执行破坏性 `npm audit fix --force`，继续留给依赖治理专题。

下一步：提交独立环境证据，推送分支并自主创建 PR 07B，等待 GitHub 核心质量与 Playwright/WCAG 两道 CI。

## 2026-08-30：PR 07B 创建与首轮 GitHub CI

- 独立环境证据提交为 `49be063`，分支已推送并自主创建 [PR #37](https://github.com/boyuling-123/AI-API-workspace/pull/37)。
- PR 基线为 `main@2d6d6f8`、Head 为 `49be063`，包含 2 个提交与 12 个文件；GitHub 确认非草稿且可合并。
- workflow run `33300809061` 的 `Lint, test, build, and secret scan` 全部成功，覆盖锁文件安装、315 文件密钥扫描、零警告 lint、类型检查、157 项真实源码单测、2 项压力测试和 20 路由生产构建。
- 同一 workflow run 的 `Playwright user paths and accessibility` 全部成功，32 项用户路径与 WCAG 检查通过；因没有失败，Trace/截图上传步骤按预期跳过。
- REPORT-001/002 已具备代码、异常边界、真实源码测试、Mock 用户路径、独立干净环境、视觉证据与 GitHub CI Trace，状态升级为“已验证”；REPORT-003 的历史明细下钻也补齐同级证据并升级为“已验证”。
- 全部自动化继续使用 Mock，未读取真实密钥、调用真实或付费模型，或自动启动 AI 评价。

下一步：提交首轮 CI 验收回写，等待该文档提交自身两道 GitHub CI 通过，再执行远端漂移、Review/线程和可合并状态审计并安全合并 PR #37。

## 2026-08-30：PR 07B 最终合并与 PR 07C Case 筛选

- PR #37 最终文档提交 `f7f59b0` 对应 workflow run `33300962942`，核心质量与 Playwright/WCAG 两个 Job 全部成功。
- 合并前确认 `main@2d6d6f8` 无漂移、PR Head 与远端分支均为 `f7f59b0`、PR 非草稿且可合并，并且无 Review 或未解决线程；以普通 fast-forward 合入 `main`，GitHub 确认 [PR #37](https://github.com/boyuling-123/AI-API-workspace/pull/37) 为 Merged。
- 从该基线创建短生命周期分支 `codex/feat-evaluation-case-filters`，只领取 REPORT-005，不混入人工改分、Judge 引用证据或 HTML 报告。
- 新增确定性 Case 洞察层：低分默认 `< 6`、模型最高/最低加权分差默认 `>= 2`、高风险为否决或加权分 `<= 3`，失败覆盖运行失败/中断/缺结果和评价分缺失。
- 历史详情新增四类计数、可调阈值、任一/全部组合、清除、命中依据和空态；全部派生操作为本地只读计算，不调用 Judge 或被测模型，也不修改 `EvaluationRecord`。
- 筛选导出复用原 Excel 服务，按命中的完整 Case 生成精确子集，并追加筛选类型、最低加权分、模型分差和具体依据；Playwright 已下载并回读 xlsx，确认联合命中时只有目标 Case。
- 5 项真实源码单测和定向 Mock Playwright 已通过，覆盖四类信号隔离、阈值、旧记录补算、缺失值不补零、任一/全部、空态、清除、刷新零新增请求、390px 与 WCAG。

下一步：生成并人工检查 PR 07C 视觉证据，再执行完整本地门禁与独立干净环境复验。

## 2026-08-30：PR 07C 本地完整验收

- 视觉证据 `docs/evidence/pr-07c/evaluation-case-filters.png` 已人工检查；四类卡片、实时计数、阈值、组合语义、清除、导出和命中 Case 原始明细在同一工作区内可读。
- 本地 `npm run quality` 通过 321 个仓库文件密钥扫描、零警告 lint、类型检查、35 个测试文件共 162 项真实源码单测、2 项压力测试和 20 个生产路由构建。
- 使用 `CI=1` 启动本工作树专属服务，全量 33 项 Playwright 与 WCAG 全部通过；新增用例实际下载并通过 `xlsx` 回读 1 条联合命中记录，确认原始 prompt、最低分、模型分差和筛选依据准确。
- 刷新、筛选、清除与导出后的模型/API 请求计数保持不变；全部运行使用 Mock，未读取真实密钥、调用真实或付费模型，或自动启动 AI 评价。
- REPORT-005 已具备代码、异常边界、真实源码测试、Mock 用户路径与视觉证据，状态为“已实现”；待独立干净环境和 GitHub CI 后再升级“已验证”。

下一步：提交 PR 07C 功能快照，在独立 detached 工作树全新安装依赖并重复 quality 与全量 Playwright。

## 2026-08-30：PR 07C 独立干净环境复验

- Case 洞察层、筛选 UI、精确 Excel、真实源码测试、Mock E2E、视觉证据与台账功能快照提交为 `175885c`，父提交为已合并 PR #37 的 `main@f7f59b0`。
- 在 `/tmp/eval-platform-pr07c-175885c` 以 detached HEAD 检出精确提交，并使用锁文件全新 `npm ci` 安装 434 个包。
- 干净环境 `npm run quality` 通过 321 文件 Secret Scan、零警告 lint、typecheck、162 项真实源码单测、2 项压力测试和 20 路由生产构建。
- 使用 `CI=1` 启动该工作树专属服务，全量 33 项 Playwright 与 WCAG 全部通过；新增 Case 筛选及既有排行榜、复核、多 Judge、Evaluator 和跑批路径共同通过。
- 全部门禁结束后 detached HEAD 仍为 `175885c` 且 `git status --short` 无输出；临时工作树随后安全移除。
- `npm ci` 仍报告锁文件既有的 6 个 high 级审计项；未执行破坏性 `npm audit fix --force`，继续留给依赖治理专题。

下一步：提交独立环境证据，推送分支并自主创建 PR 07C，等待 GitHub 核心质量与 Playwright/WCAG 两道 CI。

## 2026-08-30：PR 07C 创建与首轮 GitHub CI

- 独立环境证据提交为 `a27f8c0`，分支已推送并自主创建 [PR #38](https://github.com/boyuling-123/AI-API-workspace/pull/38)。
- PR 基线为 `main@f7f59b0`、Head 为 `a27f8c0`，包含 2 个提交与 12 个文件；GitHub 确认非草稿且可自动合并。
- workflow run `33302603833` 的 `Lint, test, build, and secret scan` 全部成功，覆盖锁文件安装、321 文件密钥扫描、零警告 lint、类型检查、162 项真实源码单测、2 项压力测试和 20 路由生产构建。
- 同一 workflow run 的 `Playwright user paths and accessibility` 全部成功，全量 33 项用户路径与 WCAG 检查通过；因没有失败，Trace/截图上传步骤按预期跳过。
- REPORT-005 已具备代码、异常边界、真实源码测试、Mock 用户路径、独立干净环境、视觉证据和 GitHub CI Trace，状态升级为“已验证”。
- 全部自动化继续使用 Mock，未读取真实密钥、调用真实或付费模型，或自动启动 AI 评价。

下一步：提交首轮 CI 验收回写，等待该最终文档提交自身两道 CI 通过后，执行远端漂移、Review/线程与可合并状态审计，再安全合并 PR #38。

## 2026-08-30：PR 07C 最终合并与 PR 07D 通用人工复核实现

- PR #38 最终证据提交对应 workflow run `33302748095`，核心质量与 Playwright/WCAG 两个 Job 全部成功；合并前确认远端无漂移、PR 可合并且无 Review 或未解决线程，以普通 fast-forward 合并，SHA 为 `b881eaf`。
- 从最新 `main@b881eaf` 创建短生命周期分支 `codex/feat-evaluation-human-review`，只领取 REPORT-006，不混入 Judge 引用证据、排行榜人工口径或 HTML 报告。
- 新增通用评价只追加复核事件：快照 AI 原分、人工维度分、按原策略重算结果、Bad Case、修改人、时间、理由、上一版本和完整性指纹；任何复核都不覆盖 `EvaluationRecord`。
- 历史详情逐目标提供复核入口，最新完整事件作为详情有效分，AI 原分紧邻保留；损坏事件被隔离告警，排行榜继续明确按 AI 原始评分计算。
- 8 项真实源码单测通过，覆盖原记录字节级不变、连续版本、同毫秒顺序、旧 AI 分精度、否决重算、脱敏、非法输入与篡改隔离；定向 Mock Playwright 通过两轮复核、Bad Case、必填阻断、刷新持久化、移动端、WCAG 和零新增 API 调用。
- 全部测试只使用 Mock，未读取真实密钥、调用真实或付费模型，或自动启动额外 AI 评价。

下一步：生成并人工检查 PR 07D 视觉证据，执行完整本地门禁，再提交功能快照并进入独立干净环境复验。

## 2026-08-30：PR 07D 本地完整验收

- 视觉证据 `docs/evidence/pr-07d/evaluation-human-review.png` 已人工检查；第二版人工分、AI 原分、修改人、Bad Case 状态、只追加边界和两条审计历史清晰可见。
- 本地 `npm run quality` 通过 327 个仓库文件 Secret Scan、零警告 lint、类型检查、36 个测试文件共 170 项真实源码单测、2 项压力测试和 20 个生产路由构建。
- 使用 `CI=1` 启动本工作树专属服务，全量 34 项 Playwright 与 WCAG 全部通过；新增路径真实完成一轮 Mock 跑批和 AI 评价，再进行两轮人工复核与刷新验证。
- 复核前后模型/API 请求计数保持 `1` 次被测模型调用和 `1` 次 Mock Judge 调用；两次复核、重开编辑器与刷新均未新增请求，排行榜始终保留 AI 原始 `4.00` 分。
- REPORT-006 已具备代码、异常边界、真实源码测试、Mock 用户路径和视觉证据，状态为“已实现”；待独立干净环境与 GitHub CI 后再升级“已验证”。

下一步：提交 PR 07D 功能快照，在独立 detached 工作树全新安装依赖并重复 quality 与全量 Playwright。

## 2026-08-30：PR 07D 独立干净环境复验

- 通用人工复核核心、详情 UI、项目持久化、真实源码测试、Mock E2E、视觉证据和文档功能快照提交为 `6811a64`，父提交为已合并 PR #38 的 `main@b881eaf`。
- 在 `/tmp/eval-platform-pr07d-6811a64` 以 detached HEAD 检出精确提交，并使用锁文件全新 `npm ci` 安装 434 个包。
- 干净环境 `npm run quality` 通过 327 文件 Secret Scan、零警告 lint、typecheck、170 项真实源码单测、2 项压力测试和 20 路由生产构建。
- 使用 `CI=1` 启动该工作树专属服务，全量 34 项 Playwright 与 WCAG 全部通过；新增人工复核与既有 Case 筛选、排行榜、校准、Evaluator 和跑批路径共同通过。
- 全部门禁结束后 detached HEAD 仍为 `6811a64` 且 `git status --short` 无输出；临时工作树随后安全移除。
- `npm ci` 仍报告锁文件既有的 6 个 high 级依赖审计项；未执行破坏性 `npm audit fix --force`，继续留给依赖治理专题。

下一步：提交独立环境证据，推送分支并自主创建 PR 07D，等待 GitHub 核心质量与 Playwright/WCAG 两道 CI。

## 2026-08-30：PR 07D 创建与首轮 GitHub CI

- 独立环境证据提交为 `9a25b4d`，分支已推送并通过已登录浏览器自主创建 [PR #39](https://github.com/boyuling-123/AI-API-workspace/pull/39)；GitHub 连接器创建接口仍返回已知的 integration 403，未阻塞浏览器回退路径。
- PR 基线为 `main@b881eaf`、Head 为 `9a25b4d`，包含 2 个提交与 14 个文件；GitHub 确认非草稿且可自动合并。
- workflow run `33303845225` 的 `Lint, test, build, and secret scan` 全部成功，覆盖锁文件安装、327 文件密钥扫描、零警告 lint、类型检查、170 项真实源码单测、2 项压力测试和 20 路由生产构建。
- 同一 workflow run 的 `Playwright user paths and accessibility` 全部成功，全量 34 项用户路径与 WCAG 检查通过；因没有失败，Trace/截图上传步骤按预期跳过。
- REPORT-006 已具备代码、异常边界、真实源码测试、Mock 用户路径、独立干净环境、视觉证据和 GitHub CI Trace，状态升级为“已验证”。
- 全部自动化继续使用 Mock，未读取真实密钥、调用真实或付费模型，或自动启动额外 AI 评价。

下一步：提交首轮 CI 验收回写，等待该最终文档提交自身两道 GitHub CI 通过后，执行远端漂移、Review/线程与可合并状态审计，再安全合并 PR #39。

## 2026-08-30：PR 07D 最终合并与 PR 07E Judge 引用证据

- PR #39 最终文档提交对应 workflow run `33304014790`，核心质量与 Playwright/WCAG 两个 Job 全部成功；合并前确认远端 `main` 无漂移、Head 一致、无 Review 或未解决线程，以普通 fast-forward 合并，SHA 为 `d7a2e68`。
- 从最新基线创建短生命周期分支 `codex/feat-evaluation-evidence`，只领取 REPORT-004，不混入 HTML 报告、Tracing、红队或排行榜人工分口径。
- 新增文字引用与图片观察 Schema。Judge 每个目标 × 维度必须给出 1–3 条证据；服务端核验精确原文、来源、目标和图片序号，并自行计算文字位置，拒绝未知目标、伪造原文、越界图片、重复或缺失证据。
- 标准答案模式强制每个维度同时引用当前目标输出和 expected answer，横向对比禁止伪造 expected answer；输入图片与压缩后的目标输出图片按稳定附件顺序进入原有 Judge 调用，不增加模型请求。
- 即时结果与历史详情新增统一证据展开器，旧记录明确降级；Excel 新增证据列并保留来源与位置。人工复核只影响有效分，不改写 AI 原始证据。
- 定向 Playwright 首次发现即时结果固定列实际遮挡证据按钮，锁定首列与目标列宽度后恢复鼠标/触屏点击；视觉检查又发现历史表把文字压成竖排，改为合理最小宽度和容器横向滚动。
- Axe 首次报告位置标记在浅灰背景上的对比度仅 `2.45:1`，加深到 `slate-600` 后 WCAG AA 通过，未关闭任何规则。

## 2026-08-30：PR 07E 本地完整验收

- 视觉证据 `docs/evidence/pr-07e/evaluation-evidence.png` 已人工检查；输出、维度分、证据数量、输入原文、目标输出、服务端位置和策略结果可在同一历史明细中回查。
- 12 项证据单测覆盖文本位置、标准答案、输入/输出图片附件顺序、客户端组包、未知目标、缺失自身引用、伪造原文、模式冲突、前置零调用阻断、Excel 和旧记录降级。
- 最终文档快照 `npm run quality` 通过 332 文件 Secret Scan、零警告 lint、类型检查、37 个测试文件共 182 项单测、2 项压力测试和 20 个生产路由构建。
- 使用 `CI=1` 启动本工作树专属服务，全量 35 项 Playwright 与 WCAG 全部通过；新路径实际下载并回读 xlsx，刷新后证据仍存在，打开、导出和刷新均不增加模型/API 调用。
- 全部自动化使用 Mock，未读取真实密钥、调用真实或付费模型，或自动启动额外 AI 评价。REPORT-004 状态为“已实现”，待独立干净环境与 GitHub CI 后升级“已验证”。

下一步：提交 PR 07E 功能快照，在独立 detached 工作树全新安装依赖并重复 quality 与全量 Playwright。
