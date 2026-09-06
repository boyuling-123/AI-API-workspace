# N12 文档审计规格与验收

状态：文档及本地文档门禁通过，[PR #54](https://github.com/boyuling-123/AI-API-workspace/pull/54) 已创建，最终CI待完成。分支：`codex/docs-stage-gap-audit`，基线`5e25d1c`。[验收证据](../evidence/pr-stage-gap-audit/README.md)。

## 范围与计划

1. 只读核对用户最新PRD、当前真实类型/流程、旧75矩阵、本夜9增量、真实PR/CI及开源许可边界。
2. 输出[规范化基线](../prd/2026-09/README.md)、[72行差距与后续计划](../product/stage-gap-audit-2026-09-07.md)，另列MCP八工具和Assistant四场景。
3. 校准README启动环境与演示边界；更新文档入口、台账及纪实，不夹带业务代码或数据。
4. 核对相对链接实际存在、需求行ID无遗漏/重复、状态合法、数量可复算。扫描Diff与敏感信息。
5. 自主提交/PR，最终head完整CI通过、无冲突/阻塞意见后正常合并；不伪造自我Approve或独立评审。

## 验收条件

- 旧75状态统计保持42/6/8/15/4；新PRD来源72行与表内72个行ID一一对应章节。
- 8MCP/4Assistant场景缺口单独列出；现有两工具不冒充完成指定八工具。
- 117065索引、55444原始ID、391分片、清单差异与非20GB保证明确；不读取或上传真实正文。
- 明确最新约束优先：暂缓后端、独立维度、普通Prompt版本不同于JudgePrompt、Baseline不同于Evaluator发布。
- 旧能力矩阵业务状态不变；只读审计不是新功能“已验证”。
- 本地前端测试/截图/Trace不适用，因为只改Markdown；最近298/66明确为PR53历史结果。本PR远端CI仍执行全量，并以当前head结果为准。

## 回滚

本PR仅文档，必要时普通revert本PR提交即可恢复入口与报告；没有数据迁移或运行时Schema变更。PR53合并事实不会因回滚本报告而失效，应保留其原PR/CI证据。
