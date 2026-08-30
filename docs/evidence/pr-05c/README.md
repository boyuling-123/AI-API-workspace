# PR 05C 验收证据：Evaluator 版本 Diff 与安全恢复

## 视觉证据

- `version-diff-restore.png`：展示 v1→v3 恢复结果、执行定义一致影响标签、结构化差异、Prompt 文本 Diff 和不可覆盖说明。

## 自动化路径

- `tests/unit/evaluatorVersionDiff.test.ts` 直接覆盖结构字段、Rubric、逐行 Prompt、大文本有界 Diff、影响范围、跨家族/篡改阻断与 v1→v3 不可变恢复。
- `tests/e2e/evaluator-version-diff-restore.spec.ts` 使用 Mock 覆盖 v1/v2 比较、选择 v1 恢复 v3、v1/v2 仍可回看、刷新持久化、零 Judge 调用和 WCAG。
- 本地 quality 通过 254 文件密钥扫描、零 lint、typecheck、101 项真实源码单测、2 项压力测试和 19 路由构建；全量 21 项 Playwright 通过。
- 提交 `41197b2` 在独立 detached 工作树全新安装 434 个包后，重复通过同一组 quality 与 21 项 Playwright，结束时 Git 零改动。

## 安全边界

- Diff 与恢复均为本地确定性操作，不调用模型，不自动启动评价。
- 恢复只追加新版本，不覆盖或删除历史版本、评价记录和跑批结果。
- 损坏版本、跨家族版本、最新版重复恢复与伪造来源对象都被拒绝。
- Prompt 专用试跑、Judge 校准和发布门禁不属于本 PR。
