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
