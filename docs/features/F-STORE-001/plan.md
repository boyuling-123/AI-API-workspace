# F-STORE-001 实施计划

1. 项目表全量只读扫描后分类，替换按 updateTime 索引读取并 bulkDelete 的旧行为，保留兼容项目排序。
2. 保存使用 Dexie 读写事务：同 ID 的不兼容记录拒绝覆盖，兼容项目照常更新。显式 deleteProject 不变。
3. useProject 区分保留数量与保存错误；页面提供中文持久提示；存储错误改为固定安全文案。
4. 用真实 db.ts + Dexie 的内存 IndexedDB 测试读写、不变性及异常，用隔离 Chromium 真实 IndexedDB 测试刷新/保存/提示/异常路径；不接触用户数据库。
5. 本地完整门禁、截图复核、Diff/密钥检查后 commit/push/create PR；最终 head CI 成功且无分支漂移/阻塞审查后正常合并，回写证据。

测试依赖固定为 [fake-indexeddb 6.2.5](https://github.com/dumbmatter/fakeIndexedDB)，Apache-2.0，仅 devDependency，在 Node 中提供内存 IndexedDB，不是运行时存储方案。没有复制 Dexie 或业务实现到测试。现有 npm audit 的 7 项风险（1 low、6 high）不使用强制大版本修复，沿用质量债务专题，最终需复核新增依赖没有引入额外风险。

代码证据计划：`src/services/db.ts`、`src/hooks/useProject.ts`、`src/components/AppShell.tsx`。
测试证据计划：`tests/unit/projectStorage.test.ts`、`tests/e2e/legacy-project-preservation.spec.ts`。
