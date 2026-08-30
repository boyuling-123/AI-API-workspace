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
- `criteria` 最多 100,000 字符，可承载已确认的完整 Evaluator Prompt 与结构化维度；超限时在模型调用前返回 `400`。

## Evaluator 变更重跑

页面可把不可变 Evaluator 版本转换为 `criteria`，并在本地比较 Judge、维度、Prompt 和自定义标准是否变化。版本切换只生成重跑计划，不调用本接口；用户确认精确调用数后才逐 Case 请求。每次重跑会追加独立历史并关联基线，旧结果不会覆盖。

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

## 多 Judge 客户端编排

多 Judge 校准继续复用本单 Case API，不新增会在服务端隐式扩散调用的批量路由。客户端先冻结 `2-5` 个唯一 Judge 与仲裁策略，再按 `黄金 Case 数 × Judge 数` 建立独立请求矩阵；用户确认前调用数为 0。

- 全部请求共用一个 `1-5` 的全局并发池，不会为每个 Judge 分别放大并发。
- 每个请求仍只包含单个 Case、单个 `modelId` 和已确认标准；人工标签、复核说明和其他 Judge 的投票不会发送给模型。
- 每个 Judge 的原始标签、置信度、理由或错误均独立保存，并分别复算准确率、Cohen's κ、漏判率、误杀率和混淆矩阵。
- `majority_conservative` 使用多数票，平票固定判为 `fail`；`unanimous_pass` 只有全票 `pass` 才通过。策略是运行与发布快照的一部分。
- 任一 Judge 缺失或失败时，该 Case 标记为错误，不允许使用剩余票数静默仲裁；其他 Case 继续执行并保留结果。
- Active 发布前会从原始投票重新计算逐 Case 仲裁、每 Judge 指标、最终指标和分歧数；任一快照不一致都会阻断发布。

当前 PR 仅提供可复用的领域与客户端核心，页面选择、费用确认和分歧下钻将在后续短 PR 接入；在此之前能力状态为“部分实现”。
