# N13 / P0-A 共享观测声明验收

规格：[F-ACT-001声明修复](../../features/F-ACT-001/claims-correction.md)。基线`4d7d7f9`，分支`codex/fix-observability-capability-claims`。PR与最终CI待完成。

## 代码与范围

- 唯一业务改动在`src/lib/platformActions.ts`：校准已验证的固定LangGraph调度/Mock节点/零模型边界；补文件来源未认证、不能证明现场执行、不会重放。
- 原UI、Action、Next API和stdio MCP自然共享同一返回；没有复制文案到组件或增加工具/权限/参数/依赖/存储。
- 旧75项和本夜9个能力的数量不变。这是准确性修复，不是新增任意框架接入。

## 自动化

- `tests/unit/platformActions.test.ts`补领域语义断言和1项真实API测试：归档未配置也能查能力；工具名/限制不变、无外部fetch、原夹具不变。
- `tests/unit/platformMcp.test.ts`用正式SDK客户端验证2025协商与2026固定协议路径的真实stdio返回；结构化与文本响应一致，未复制服务端协议实现。
- 完整quality通过：299 unit、2 stress、零警告lint、typecheck、24路由build；当时465文件SecretScan通过。
- 专项`platform-tools.spec.ts`四条全部无重试通过（19.2秒）：正常只读统计、异常恢复、键盘/手机/API限制、新声明/结构化JSON一致与刷新零自动调用。新增路径覆盖390px与WCAG零违规，其他路径继续覆盖375px。
- 全量67 E2E无重试通过（2.3分钟）；最终467文件SecretScan与`git diff --check`通过。原目录四项用户草稿不变，代码/文档Diff已复核。
- 截图`claims.png`已视觉检查，完整显示两工具、真实LangGraph限定说明、来源未认证和暂未开放项；只含工具元数据，不含业务正文。
- 本轮所有模型路径为Mock；浏览器Guard阻断平台工具以外的API和外部站点，不自动执行观测实验。
- 文档相对链接112处通过，旧75行内容与基线一致；3002预览已恢复，实际Computer Use只点击“查询平台能力”后核对两条新声明，没有读取归档或运行实验。

## 本机成功Trace

四份成功Trace仅留Git忽略目录`local-data/capability-claims-e2e`，以下SHA用于本机核对，不上传归档或原始路径。

| 用例 | SHA-256 |
|---|---|
| 正常查询与归档摘要 | `be7770bebaa2ba6c28de6065e3e76ca63320ef7eb8ce013a3858dfbb7ddcbda7` |
| 新声明与文件来源边界 | `536f6fe8484179146d58e8f1a0184e804275c2d33cc906fd3f8c69492fb0c096` |
| 键盘、手机、API限制 | `da540e937fa3d43d9654a54d7da4dce24b67843396e9fcd198a36e34f0e80baf` |
| 故障、清除旧结果、恢复 | `c9187d39fb6c8c9a8b9e8683b4f02e687a0e3ba82e50988102dd18c6dd986a9b` |

截图227250字节，SHA-256 `64b770f7ea0ed516f83bb55b134075a291b6b3ae8a130e7cbc1f96d3dfb5480d`。

## 回滚与审查

普通revert，无数据/Schema迁移。按Developer Helper适配做串行Planner/Developer/Tester自检，不冒充独立Approve；最终head完整CI及head/base/Review核对后才正常合并。
