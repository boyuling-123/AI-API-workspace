# PR 06D 验收证据：确认式 Judge 校准工作区

## 视觉证据

- `judge-calibration-results.png`：展示调用边界、准确率、Cohen’s κ、Bad Case 漏判率、混淆矩阵和分歧/失败样本。

## 自动化路径

- `judgeCalibrationClient.test.ts` 直接覆盖真实运行编排、白名单请求、部分失败、结构错误和确定性指标。
- `judge-calibration.spec.ts` 使用 Mock 覆盖发布黄金集、打开与取消确认保持零调用、确认后精确调用、部分失败、指标展示、分歧下钻和刷新持久化。
- 同一 E2E 文件覆盖 100 Case 高费用门禁：输入 99 时保持禁用，输入 100 后才允许确认，取消后仍为 0 调用。
- E2E 检查所有请求均不含 `humanLabel` 或 `reviewerNote`，且被测模型/算法调用为 0。
- 确认弹窗和完整校准区均执行 WCAG 严重与致命问题检查。
- 本地 quality 通过 281 文件密钥扫描、零 lint、typecheck、125 项真实源码单测、2 项压力测试和 20 路由生产构建；全量 25 项 Playwright 通过。
- 功能提交 `fa2fd3a` 在独立 detached 工作树全新安装 434 个包后，再次通过 quality 与 25 项 Playwright，结束时 Git 零改动。

## 安全与费用边界

- 页面加载、切换黄金集、切换历史、打开或取消确认均不调用 Judge。
- 大于等于 100 次 Judge 调用时必须输入精确调用数，才允许最终确认。
- 失败 Case 独立保留并计数，不进入准确率、κ 或漏判率分母。
