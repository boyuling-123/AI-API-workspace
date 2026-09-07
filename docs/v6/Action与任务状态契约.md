# Action 与任务状态契约

## 目标

Web、MCP、全局助手和外部 API 只能通过同一 Action Registry 操作平台。Action Handler 负责 Schema 校验、权限边界、版本解析、预检、幂等、审计和结构化错误；调用方只负责展示与确认。

## 请求信封

```json
{
  "action": "run.submit",
  "action_version": "1.0",
  "request_id": "req_...",
  "idempotency_key": "client-stable-key",
  "actor": { "type": "user", "id": "local-user" },
  "dry_run": false,
  "confirmation_token": "confirm_...",
  "payload": {}
}
```

- `request_id` 用于追踪一次调用。
- 有副作用的 Action 必须提供 `idempotency_key`。
- 会产生模型调用、覆盖索引、导入数据或删除草稿的 Action 必须先 `dry_run`，并使用服务端返回的短期 `confirmation_token`。
- Token 绑定规范化 payload、调用方、风险摘要和有效期；任何字段变化后重新确认。

## 响应信封

```json
{
  "ok": true,
  "request_id": "req_...",
  "result": {},
  "warnings": [],
  "audit_event_id": "audit_..."
}
```

```json
{
  "ok": false,
  "request_id": "req_...",
  "error": {
    "code": "CONFIRMATION_REQUIRED",
    "message": "提交前需要确认预计调用量。",
    "field_errors": [],
    "retryable": false,
    "details": {}
  }
}
```

错误响应不得包含 API Key、请求头、完整原始模型响应或用户大数据片段。

## P0 Action 目录

| 分组 | Action | 副作用 | 必须确认 |
| --- | --- | --- | --- |
| Project | `project.create/get/list/archive` | 部分 | 归档 |
| Target | `target.validate/create_version/get_version` | 部分 | 否 |
| Dataset | `dataset.inspect/preview_mapping/validate/create_version/page` | 部分 | 创建版本 |
| Evaluator | `evaluator.validate/create_version/dry_run/get_version` | 部分 | 创建版本、试跑 |
| Run | `run.precheck/create_spec/submit/status/pause/resume/cancel/rerun` | 是 | 提交、恢复、重跑 |
| Result | `result.summary/page/item/evidence/export` | 导出有 | 大规模导出 |
| Storage | `storage.validate/rebuild_index/export_bundle/import_bundle` | 是 | 重建、导入 |

## Run 状态机

```text
draft
  -> pending_confirmation
  -> queued
  -> running
      -> paused -> queued
      -> partially_completed
      -> completed
      -> failed
      -> cancelled
```

允许转换：

| 当前 | 动作 | 下一状态 | 条件 |
| --- | --- | --- | --- |
| `draft` | `create_spec` | `pending_confirmation` | 版本、Schema、调用量预检通过 |
| `pending_confirmation` | `submit` | `queued` | Token 与 RunSpec 指纹匹配 |
| `queued` | Worker 领取 | `running` | 锁与资源配额可用 |
| `running` | `pause` | `paused` | 停止领取新项，保存在途 Attempt 状态 |
| `paused` | `resume` | `queued` | 原 RunSpec 不变，只调度未完成项 |
| `queued/running/paused` | `cancel` | `cancelled` | 保留全部已完成结果 |
| `running` | 汇总 | `partially_completed` | 有成功也有不可恢复失败 |
| `running` | 汇总 | `completed` | 所有 RunItem 达到成功终态 |
| `running` | 汇总 | `failed` | 无有效结果或任务级致命错误 |

终态不可原地恢复。失败项、新目标、新 Case 或新 Evaluator 均创建带血缘的新 Run 或 EvaluationRecord。

## 幂等与并发

1. 相同 Action、规范化 payload、actor 和幂等键返回同一业务结果。
2. 同一 RunItem 同时只能有一个活动 Attempt；Worker 领取使用租约并可超时回收。
3. Event 先追加、投影后更新；进程崩溃后由事件和文件重建状态。
4. 暂停只阻止新调用，不删除已生成数据；恢复只运行剩余矩阵。
5. 取消、超时和网络错误必须区分，自动重试仅适用于白名单错误。

## MCP 与助手映射

P1 的每个 MCP Tool 只做 Action Schema 映射，不再实现业务逻辑。读取动作可直接返回；写动作先返回预览、缺失字段、预计调用量和确认令牌。全局助手必须把令牌和风险摘要展示给用户，禁止自行确认付费评价。

## 结构化错误码

至少覆盖 `VALIDATION_FAILED`、`VERSION_NOT_FOUND`、`VERSION_CONFLICT`、`MAPPING_AMBIGUOUS`、`EXPECTED_FIELD_REQUIRED`、`CONFIRMATION_REQUIRED`、`CONFIRMATION_EXPIRED`、`IDEMPOTENCY_CONFLICT`、`RUN_STATE_CONFLICT`、`PROVIDER_UNAVAILABLE`、`RATE_LIMITED`、`TIMEOUT`、`STORAGE_CORRUPTED` 和 `INTERNAL_ERROR`。
