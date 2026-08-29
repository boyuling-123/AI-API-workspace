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
