# PR 05B 验收证据：不可变 Evaluator 与 Prompt 版本

## 视觉证据

- `evaluator-versions.png`：同一页面展示已确认策略、手动修改后的 Prompt、已保存 v2、修改人、时间、适用任务和变更说明。

## 自动化路径

- `tests/unit/evaluatorVersion.test.ts` 直接覆盖真实版本域的 v1/v2 追加、深拷贝、草稿指纹、非法家族、定义与元数据篡改、加载和入库脱敏。
- `tests/unit/redactSensitive.test.ts` 验证 `[REDACTED]` 占位符重复脱敏保持幂等。
- `tests/e2e/evaluator-versioning.spec.ts` 使用 Mock 覆盖保存 v1、手动修改 Prompt 另存 v2、切回 v1、刷新后加载 v2、显式启动评价、历史绑定和 WCAG。
- 本地 quality 通过 248 文件密钥扫描、零 lint、typecheck、95 项真实源码单测、2 项压力测试和 19 路由构建；全量 20 项 Playwright 通过。

## 安全边界

- 版本保存、查询、加载和刷新都不会调用模型；只有测试最后显式点击“开始 AI 评价”后产生一次 Mock Judge 请求。
- 新字段保持向后兼容，不提升 Schema 版本，不删除已有项目。
- 未读取真实密钥、未调用真实或付费模型、未自动启动 AI 评价。
- Prompt Diff/恢复、专用试跑和 Judge 校准不属于本 PR。
