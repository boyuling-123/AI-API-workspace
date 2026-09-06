# F-STORE-002 可替换项目存储契约

## 需求

为未来可迁移的本地工作台保留实现边界，不现在增加数据库。项目状态 Hook 不直接依赖 Dexie 或 db.ts，统一通过 ProjectRepository 读写；默认适配器继续操作同一个 IndexedDB 项目表，复用 F-STORE-001 的保护而不是重写一份。

当前范围仅 Project 项目记录。输入草稿与目标勾选仍在独立 `draftDb.ts`，本机历史归档仍是只读文件来源；本节点不声称全平台存储已经统一，也不提供运行时后端切换、数据搬迁、跨设备同步或大数据流式处理。

## 验收条件

| 编号 | 条件 | 验收证据计划 |
| --- | --- | --- |
| AC1 | ProjectRepository 类型不导入 Dexie/DOM/文件系统；定义项目目录、兼容读取、保存、显式删除及真实能力声明 | 类型检查、真实源码依赖边界测试 |
| AC2 | 唯一默认实现仍是 IndexedDB；数据库/表/Schema 不变，能力声明只说 browser-origin、无同步/迁移/流式 | 真实默认适配器单测 |
| AC3 | useProject 通过组合入口调用契约，保存队列、600ms debounce、临时项目与中文保留提示不变 | 源码边界测试、既有真实用户路径回归 |
| AC4 | 兼容 get 不返回未知记录，目录只读保留并计数；同 ID 未知记录不可覆盖；显式删除只处理指定 ID | 真实 Dexie 契约测试、F-STORE-001 回归 |
| AC5 | 保存错误拒绝向上传递为成功；纯策略错误提示不依赖数据库；读取快照修改不能隐式改库 | 合成数据单测、读写故障浏览器回归 |
| AC6 | lint/typecheck/unit/build/Secret Scan、完整 Playwright/WCAG 及最终 CI；保存/刷新 Trace 可追溯 | 质量门禁、Trace、PR |

接口实现不是安全权限边界。`deleteExplicit` 是底层显式删除语义，未来 UI/API/MCP 必须在领域 Action 层做用户确认与授权，不能因存在此方法就直接开放远程删除。服务端 MCP 不能直接访问浏览器 origin 内的 IndexedDB，需另行设计可确认的连接机制，不能把本契约误当成已有 MCP 后端。

## 交付状态

- 当前状态：已验证，限定 ProjectRepository 代码边界及当前 IndexedDB 适配器；本地门禁和最终 head CI 通过，PR #48 已合并。
- 分支：`codex/refactor-project-repository`，基线 PR #47 合并后的 main；功能提交 `1025f8e`，[PR #48](https://github.com/boyuling-123/AI-API-workspace/pull/48)。
- 代码证据：`src/lib/projectRepository.ts`、`projectStoragePolicy.ts`、`src/services/indexedDbProjectRepository.ts`、`projectRepository.ts`、`db.ts`、`src/hooks/useProject.ts`。
- 测试证据：`tests/unit/projectRepository.test.ts` 新增 8 项，现有 `projectStorage.test.ts` 回归；全量 237 unit / 2 stress / 47 E2E 通过，另采集 4 条成功 Trace 与本轮合成截图。新契约不新增虚构业务页面，见 [完整证据](../../evidence/pr-project-repository/README.md)。
- 回滚：正常 revert 本节点，回到 PR #47 的直接调用方式；不撤销旧项目保留修复、不操作数据库、不改历史。

## 后续 Ready

N5 先审计当前 Skill/MCP/导入 API，再设计 UI/API/MCP 共用业务 Action 的确认、预算和数据范围，明确现成能力与未落地桥接。暂不接入付费 Assistant，不根据未知标准答案自动评分。
