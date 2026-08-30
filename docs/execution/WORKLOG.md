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
