# F-DATA-001 验收证据

状态：限定只读归档范围已验证，[PR #46](https://github.com/boyuling-123/AI-API-workspace/pull/46) 已合并。最终 head `53f9586` 的 [CI run 34051689031](https://github.com/boyuling-123/AI-API-workspace/actions/runs/34051689031) 两道 Job 全部 success；合并提交 `fe29d91`。不扩大为新任务导入、20GB 执行或真实模型效果验证。

- 单测直接引用 `LocalArchiveReader`、访问边界和真实 Next route；使用临时合成归档，不接触业务文件。
- Playwright 使用 `scripts/createLocalArchiveFixture.mjs` 生成 63 条合成记录，通过实际本地 API 测试 50 条分页、分片筛选、隐私确认、摘要下载和错误恢复。
- 测试服务由 `EVAL_ARCHIVE_CONFIG` 定向至合成夹具，禁止复用来源未知的服务；除只读归档 API 外的请求均阻断，外部图片与模型不调用。
- 视觉证据只允许合成夹具；真实数据、路径和正文不进入仓库。
- 2026-09-07：最终本地 quality 通过 376 文件 Secret Scan、零警告 lint、typecheck、220 项 unit（新增 11 项）、2 项 stress 与 22 路由生产构建。新增页面首屏 JS 312kB，不声称所有资源已极限压缩。
- `CI=1 npm run test:e2e` 全量 43 项通过（1.6 分钟）；新增 3 项在桌面/390px 与确认弹窗执行 WCAG 检查，零违规。外部/模型请求为零。
- `local-history.png` 为 63 条合成夹具的实际页面截图，已人工查看，标题、统计口径、分片范围、按钮和表格无错位。
- 修复过程：Next 主机别名误拒绝通过真实 API E2E 发现；取消按钮补齐稳定中文无障碍名称。未关闭断言、未用 Mock 替代实际读取器。
- 本机授权归档通过真实 API 与浏览器完成只读联调：逐片核对总量，验证首分片第一页与末分片第二页分别返回 50 条与 15 条，默认没有正文或源路径；详细源信息只保存在 Git 忽略目录。不作为模型质量或 20GB 性能证明。
- 中文失败状态补充后重新执行完整 quality 与 43 项 E2E，均通过。功能提交 `2f94428` 的远端 [CI run 34051378800](https://github.com/boyuling-123/AI-API-workspace/actions/runs/34051378800) 两道 Job 全部 success，包含干净依赖安装、真实源码测试、生产构建及 Playwright/WCAG。最终文档提交仍须自身 CI 通过才能合并。
