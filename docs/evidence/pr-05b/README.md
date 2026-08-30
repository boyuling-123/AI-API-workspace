# PR 05B 验收证据：不可变 Evaluator 与 Prompt 版本

## 视觉证据

- `evaluator-versions.png`：同一页面展示已确认策略、手动修改后的 Prompt、已保存 v2、修改人、时间、适用任务和变更说明。

## 自动化路径

- `tests/unit/evaluatorVersion.test.ts` 直接覆盖真实版本域的 v1/v2 追加、深拷贝、草稿指纹、非法家族、定义与元数据篡改、加载和入库脱敏。
- `tests/unit/redactSensitive.test.ts` 验证 `[REDACTED]` 占位符重复脱敏保持幂等。
- `tests/e2e/evaluator-versioning.spec.ts` 使用 Mock 覆盖保存 v1、手动修改 Prompt 另存 v2、切回 v1、刷新后加载 v2、显式启动评价、历史绑定和 WCAG。
- 本地 quality 通过 248 文件密钥扫描、零 lint、typecheck、95 项真实源码单测、2 项压力测试和 19 路由构建；全量 20 项 Playwright 通过。
- 功能提交 `34347aa` 在独立 detached 工作树通过全新 `npm ci`、完整 quality 与最终全量 20 项 Playwright，验收结束后 Git 零改动。
- 独立环境第一次并行 E2E 的既有跑批恢复用例在冷编译时触发 30 秒总超时；该路径单 worker 复跑 9.2 秒通过，随后全量复跑 20/20 通过，失败 Trace 未被忽略。
- [PR #23](https://github.com/boyuling-123/AI-API-workspace/pull/23) workflow run `33287622657` 的核心质量与 Playwright/WCAG 两个 Job 全部通过。

## 安全边界

- 版本保存、查询、加载和刷新都不会调用模型；只有测试最后显式点击“开始 AI 评价”后产生一次 Mock Judge 请求。
- 新字段保持向后兼容，不提升 Schema 版本，不删除已有项目。
- 未读取真实密钥、未调用真实或付费模型、未自动启动 AI 评价。
- `npm ci` 报告锁文件既有的 6 个 high 级依赖审计项；未执行可能造成破坏性升级的 `npm audit fix --force`。
- Prompt Diff/恢复、专用试跑和 Judge 校准不属于本 PR。
