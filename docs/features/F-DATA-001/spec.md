# F-DATA-001 本地历史归档演示

## 需求与范围

将已在本机完成的历史记录连接到中文工作台，供产品经理演示“查看统计 → 定位分片 → 分类筛选 → 查看单条索引正文 → 下载摘要”。只读连接不是导入新的测试任务，不推断标准答案，也不重新评价。

沿用 Next.js 本地服务，不新增数据库或存储迁移。契约与读取器独立，便于后续替换来源；本节点不承诺 20GB 任务执行能力或通用文件导入。

## 验收条件

| 编号 | 条件 | 证据计划 |
| --- | --- | --- |
| AC1 | 只解析固定包装内的 JSON，绝不执行归档 JS；拒绝路径穿越、符号链接、畸形/超量分片 | 真实读取器单测 |
| AC2 | 顺序读取全部分片核对数量；类别、总数和原始 ID 去重数分别展示；不将记录数说成模型调用数 | 源码单测、真实归档只读核对 |
| AC3 | 每页最多 50 条；类别筛选仅作用当前分片，换分片重置页码，空结果有提示 | 单测、真实 API Playwright |
| AC4 | 默认不返回正文、模型原名、源路径或图片链接；查看正文须明确确认，文本脱敏、截断且不执行 HTML | 单测、隐私用户路径 |
| AC5 | API 限制回环主机、同源和专用请求头；不提供任意路径读取、不记录原始异常；源文件变化阻断混用 | 路由单测、浏览器拒绝路径 |
| AC6 | 页面区分历史未认证来源、测试夹具和新实验；导出只含统计摘要与口径，无真实记录 | 下载回读、无外部请求断言 |
| AC7 | 中文一级/二级标题、桌面与 390px、WCAG、截图证据；完整质量门禁及远端 CI | Playwright、截图、CI |

读取边界：最多 1,000 个分片，每片最多 300 行及 1MiB，索引总量不超过 256MiB。首次核对只保留计数、分片摘要和原始 ID 集合，不把全量正文留在服务器内存或浏览器中。原文件需保持不变；变更后重启本地预览重新核对。

“正文脱敏”只覆盖已有通用密钥规则，不代表所有个人信息或业务机密都已清除。模型别名用于默认隐藏，不是不可逆匿名化。证据哈希只显示索引引用，本节点不读取对应证据文件。

## 开发流程

Developer Helper 适配角色：Planner 固定以上边界 → Developer 实现契约/只读服务/中文页面 → Tester 用合成夹具测真实源文件与 API → 修复 → 本地门禁 → 小分支 PR → 远端 CI/审查 → 正常合并。无付费模型调用，无伪造独立审查。

- 分支：`codex/feat-local-history-demo`。
- 当前状态：已验证，限定只读归档范围的本地完整验收与最终 head CI 通过，PR #46 已合并；不包括未开发的范围。
- 代码：`src/lib/localArchive.ts`、`src/server/localArchiveReader.ts`、`src/server/localArchiveAccess.ts`、`src/app/api/local-archive/route.ts`、`src/components/archive/LocalArchiveDemo.tsx`。
- 测试：`tests/unit/localArchive.test.ts`（11 项）、`tests/e2e/local-archive.spec.ts`（3 项）；全量 220 unit、2 stress、43 E2E 通过，截图及最终 CI 见 [证据](../../evidence/pr-local-history-demo/README.md)。[PR #46](https://github.com/boyuling-123/AI-API-workspace/pull/46) 已合并。
