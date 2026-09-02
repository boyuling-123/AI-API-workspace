# PR 08B 验收证据

## 范围

- `POOL-004`：维护并查询资源来源、版本、稳定别名与最近一次明确发起的连通性测试状态。
- 调用配置变化会使旧测试状态失效；只编辑名称、版本、别名或能力等元数据不会误伤状态。
- 本轮不实现后台轮询、实时健康探测、历史表现聚合、资源分层或 Agent 自动选型。

## 自动化证据

- `tests/unit/resourceIdentity.test.ts`：别名解析与规范化、数量/格式/冲突校验、脏导入隔离和调用指纹边界。
- `tests/unit/resourceCatalog.test.ts`：版本、别名、来源、状态、时间与组合查询投影。
- `tests/e2e/resource-identity.spec.ts`：真实页面筛选、编辑、冲突阻断、状态失效与手动恢复、WCAG 和 390px。

自动化只为用户明确点击的连通性测试返回本地 Mock；不读取真实密钥，不调用真实或付费模型，不自动启动评价。

## 视觉证据

- `resource-identity-health.png`：1440px 接口管理页，展示来源/状态筛选、版本、稳定别名与最近测试时间。
- 已人工检查：四张资源卡与原接口管理区层级清楚，无裁切、遮挡或伪实时状态；390px 无页面级横向溢出。

## 本地门禁

- Secret Scan：348 个仓库文件通过。
- Lint：零警告；TypeScript：通过。
- Unit：40 个文件、204 项通过；Stress：2 项通过。
- Production Build：20 个路由通过。
- Playwright/WCAG：全量 38 项通过。

## 后续门禁

- 独立干净环境和 GitHub CI 结果将在对应阶段回写。
