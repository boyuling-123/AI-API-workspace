# PR 06C 验收证据：Judge 校准契约与指标核心

## 自动化路径

- `judgeCalibration.test.ts` 覆盖准确率、Cohen’s κ、Bad Case 漏判率、误杀率、混淆矩阵、错误样本与空分母。
- `judgeCalibrationService.test.ts` 覆盖白名单输入、人工标签/复核说明隔离、敏感值脱敏、严格标签和置信度解析。
- `judgeCalibrationRoute.test.ts` 覆盖坏 JSON、缺字段零调用、合法单 Case 响应，以及 Judge 坏输出返回 500。
- 本地 quality 通过 275 文件密钥扫描、零 lint、typecheck、123 项真实源码单测、2 项压力测试和 20 路由生产构建；全量既有 23 项 Playwright 通过。

## 安全与费用边界

- API 一次只判断一条 Case，不提供自动批量触发；上层必须在调用前展示精确数量并取得确认。
- 人工标签和复核说明不属于请求结构，服务端白名单重建后才生成 Prompt。
- 自动测试只使用 Mock，未读取真实密钥或调用真实/付费模型。
