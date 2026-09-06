# F-STORE-002 实施计划

1. Planner：仅提取 Project 持久化边界，明确 draftDb 和历史归档不在本次抽离范围。
2. Developer：纯类型契约与纯兼容/错误策略独立；旧 db.ts 保持实际 Dexie 行为及兼容导出；默认适配器复用它，组合入口供 useProject 调用。
3. Tester：契约测试针对唯一真实 IndexedDB 适配器和组合入口，fake-indexeddb 仅替代 Node 缺失的浏览器环境，不复制存储实现。用 TypeScript AST 核对真实 Hook/契约的依赖边界。
4. 重新执行 F-STORE-001 的保存/刷新/全旧数据/配额异常/加载异常浏览器路径，保留本轮 Trace，完整 E2E/WCAG 再验。
5. Diff/密钥扫描、真实源码测试/build 通过后提交推送；最终 head CI 和审查状态通过后正常合并。回写规格/证据/台账及下一 Ready。

不安装新生产依赖；复用现有 Dexie 与上一节点新增的 dev-only fake-indexeddb。能力声明是当前适配器的限制说明，不是未实现后端的菜单或演示接口。
