# PR 02B 验收证据

## 验收范围

- Playwright 直接驱动真实 Next.js 页面，不复制组件逻辑。
- 覆盖首页布局、测试目标说明、外部接口状态、导入深链和 AI 评价空状态。
- 使用 axe-core 扫描跑批页与接口管理页的 WCAG 2A、2AA、2.1A 和 2.1AA 规则。
- 常规测试只使用本地页面与 Mock 防护，不调用模型、不读取真实 Key、不启动 AI 评价。

## 安全 Mock

`tests/e2e/fixtures.ts` 拦截所有 `/api/**` 请求并记录 URL。当前 6 项测试都属于安全导航路径，任一 API 请求、浏览器控制台错误或页面异常都会让测试失败。

这项约束可防止 CI 因页面副作用意外触发付费模型，同时不会把真实密钥写入测试配置、Trace 或日志。

## 用户路径

| 路径 | 结果 | 验收内容 |
| --- | --- | --- |
| 首页布局 | 通过 | 批量运行控制台位于输入区上方，测试模型/算法说明可见，5 个 Tab 语义正确 |
| 接口创建与管理 | 通过 | 四个不存在的路由只显示“设计中”或“Demo”，不冒充可调用接口 |
| 导入深链 | 通过 | `draft_id` 引用进入批量文本模式，不把数据塞入 URL，不自动评价 |
| AI 评价空状态 | 通过 | 直接进入时引导用户返回跑批历史，不发起裁判调用 |
| 跑批页 WCAG | 通过 | 无 serious 或 critical 级别违规 |
| 接口页 WCAG | 通过 | 无 serious 或 critical 级别违规 |

本地命令：`npm run test:e2e`，结果为 6 项全部通过。

提交 `b9e203c` 后另建独立 `/tmp` 工作树，重新执行全新 `npm ci`、`npm run quality` 与 `npm run test:e2e`，核心门禁和 6 项浏览器测试仍全部通过，证明结果不依赖原工作区的 `node_modules`、`.next` 或测试产物。

## 真实缺陷与修复

- 首轮 Trace 发现 `getByRole` 的 Tab 名称存在模糊匹配，测试改为精确可访问名称。
- 深链页面不一定显示跑批控制台，公共等待条件改为工作区 Tablist。
- 目标卡片原先在 `button` 中嵌套只读 checkbox，产生 label 与 nested-interactive 违规；现改为 `aria-pressed` 切换按钮和纯展示勾选标记。
- 为工作区 Tab、输入模式按钮补齐 ARIA 状态，并提高已覆盖页面文字颜色对比度。

## 失败证据与 CI

Playwright 配置在失败时保留 Trace 与截图，并生成 HTML 报告。GitHub Actions 的独立浏览器 Job 会安装 Chromium、执行 `npm run test:e2e`，失败时上传 `playwright-report/` 和 `test-results/`，保留 7 天。

[PR #11](https://github.com/boyuling-123/AI-API-workspace/pull/11) 的核心质量门禁与 `Playwright user paths and accessibility` 两个 Job 均已通过。DOC-006 因代码、真实用户路径、异常防护、无障碍、干净环境和 CI Trace 齐全，已升级为“已验证”。

## 回滚

回滚本 PR 即可移除 Playwright 配置、E2E、CI 浏览器 Job 和本轮无障碍样式修复。测试产物均在 `.gitignore` 中，不进入产品数据或仓库历史。
