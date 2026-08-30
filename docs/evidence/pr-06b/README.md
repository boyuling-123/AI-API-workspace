# PR 06B 验收证据：人工黄金集管理页

## 视觉证据

- `golden-dataset-versions.png`：展示独立 Judge 校准页、0 次 Judge 调用边界、人工真值草稿和已锁定版本库。

## 自动化路径

- `tests/unit/goldenDataset.test.ts` 直接覆盖真实导入与版本源文件的双语字段映射、非法标签、重复 Case ID、越界分数、严格 JSON 容器、不可变 v1/v2、篡改检测和敏感值脱敏。
- `tests/e2e/golden-dataset.spec.ts` 使用 Mock 覆盖坏文件阻断及手工新增旁路、合法映射预览、v1 发布、基于 v1 修正标签生成 v2、刷新后回看两个锁定版本。
- E2E 拦截全部 `/api/**` 并精确断言调用列表为空，证明导入、编辑、发布和回看不会启动 Judge 或其他模型。
- 页面通过 WCAG 2A/2AA/2.1A/2.1AA 严重与致命问题检查。
- 本地 quality 通过 267 文件密钥扫描、零 lint、typecheck、112 项真实源码单测（含真实 Excel 工作簿解析）、2 项压力测试和 19 路由生产构建；全量 23 项 Playwright 通过。
- 功能提交 `23fdb21` 在独立 detached 工作树全新安装 434 个包后，再次通过 quality 与 23 项 Playwright，结束时 Git 零改动。
- [PR #27](https://github.com/boyuling-123/AI-API-workspace/pull/27) 首轮 workflow run `33293740909` 的核心质量与 Playwright/WCAG 两个 Job 全部通过。

## 安全边界

- 缺字段、非法标签、越界分数和重复 Case ID 都会阻止发布，且不能通过手工新增旁路绕过；平台不会自动跳过或猜测。
- 已发布版本只能读取；修改必须生成新版本，内容和版本元数据均有完整性指纹。
- 黄金集内容进入项目存储前执行敏感值脱敏，测试和视觉验收不读取真实密钥。
