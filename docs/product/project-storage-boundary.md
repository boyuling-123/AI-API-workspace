# 项目存储边界与可迁移路线

## 当前实际结构

| 层 | 源码 | 责任 |
| --- | --- | --- |
| 页面状态 | `src/hooks/useProject.ts` | 编辑状态、600ms debounce、有序保存、失败提示；不选择数据库 |
| 组合入口 | `src/services/projectRepository.ts` | 为页面绑定唯一真实默认实现，未来更换实现只改此入口及契约测试 |
| 纯契约 | `src/lib/projectRepository.ts` | readCatalog / getCompatible / save / deleteExplicit 和能力限制 |
| 默认适配器 | `src/services/indexedDbProjectRepository.ts` | 复用已有 Dexie 读写，只返回兼容项目，显式声明当前能力 |
| 实际项目表 | `src/services/db.ts` | 同一个 eval-platform / projects；只读分类与事务内旧记录写保护 |
| 纯策略 | `src/lib/projectStoragePolicy.ts` | 顶层兼容性、冲突类型与固定安全错误文案，不依赖存储驱动 |

这里实现的是可替换的**代码边界**，不是已经完成“数据库迁移产品”。没有存储切换菜单、空的后端实现、自动迁移或新的运行依赖。前端依赖契约，默认实现仍是 IndexedDB。

## 不能混为一谈的三类数据

- Project 项目记录：本次契约覆盖；当前浏览器 origin 范围，不能被服务端 MCP 直接读取。
- 输入草稿和目标选择：仍由独立 `draftDb.ts` 管理，不在 Project JSON 导出中，本次没有抽离或迁移。
- 历史归档：`/history-demo` 通过本机白名单配置只读、分页访问既有文件，独立于浏览器项目表；不会自动变成待评测任务。

默认能力声明：`driver=indexeddb`、`scope=browser-origin`、`entity=project`，`crossDeviceSync` / `automaticMigration` / `streaming` 均为 false。保留未知记录不是备份，不保证浏览器清理后可恢复；Project 目录仍返回完整项目，不能用该接口声称 20GB 流式支持。

## 后续接入条件

1. 新适配器实现同一契约，必须通过兼容读取、排序、未知记录不变、同 ID 保护、明确失败及显式删除测试，不能复制实现来制造覆盖率。
2. 数据迁移必须有单独方案：范围、格式/版本、预览、备份、确认、校验与回滚。不能通过替换默认绑定自动搬迁用户数据。
3. UI/API/MCP 在领域 Action 层共用业务校验、用户确认和预算；Repository 不是授权系统，不能把底层 deleteExplicit 直接暴露给 Agent。
4. 若要统一整个工作台，还须分别处理 draftDb 与归档接口。当前只验证项目表边界，不宣称所有操作都已有 MCP 工具。

## 面试说明

可以演示保存、刷新和不兼容数据保护，再说明如何通过契约替换底层实现；同时明确目前没有跨设备同步/流式大数据存储。这样展示的是真实架构取舍与数据安全意识，不把未开发能力当作已交付。

规格：[F-STORE-002](../features/F-STORE-002/spec.md)。验收：[真实测试与 Trace](../evidence/pr-project-repository/README.md)。
