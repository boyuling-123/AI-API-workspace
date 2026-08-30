# Judge 校准单 Case API

`POST /api/judge-calibration` 每次只判断一条黄金 Case。接口不会自动批量执行；调用方必须先展示精确调用数并取得用户确认，再自行使用受控并发逐条调用。

## 请求

```json
{
  "item": {
    "caseId": "gold-001",
    "prompt": "用户问题",
    "candidateOutput": "待判断的候选输出",
    "expectedAnswer": "可选标准答案"
  },
  "modelId": "judge-model-id",
  "criteria": "满足事实、格式和业务规则才判定为通过"
}
```

- `item.caseId`、`item.prompt`、`item.candidateOutput`、`modelId`、`criteria` 必填。
- `item.expectedAnswer` 可选。
- 人工 `humanLabel` 和 `reviewerNote` 不属于请求契约。即使调用方额外传入，服务端也会在构造 Judge Prompt 前丢弃。
- Case 文本和判定标准进入 Prompt 前会执行敏感值脱敏。

## 成功响应

```json
{
  "caseId": "gold-001",
  "judgeLabel": "pass",
  "confidence": 0.92,
  "reason": "事实和关键字段与标准答案一致"
}
```

- `judgeLabel` 只可能是 `pass` 或 `fail`。
- `confidence` 为 `0` 到 `1`。
- 一次成功响应等于一次 Judge 调用，不会调用任何被测模型或算法。

## 错误

- `400`：请求 JSON、必填字段、字段类型或长度不合法；此时不会调用 Judge。
- `500`：Judge 调用失败，或模型返回无法解析的 JSON、非法标签、越界置信度、空理由。

批量校准应逐 Case 保留成功与失败结果，只以成功结果计算指标，并把失败数单独展示，禁止静默跳过。
