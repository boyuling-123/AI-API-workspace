# F-OBS-001 实施方案

1. 固定 OpenTelemetry API 1.9.1 与 sdk-trace-base 2.11.0（Apache-2.0），使用显式 parent context、私有 Provider 与内存 Exporter；不注册全局 Provider。
2. 定义 AgentExperiment / AgentObservation，保留 schemaVersion、source、instrumentation 版本；只导出固定 eval 属性，不包含进程/资源元数据。
3. 用 Ant Design 6.6.2（MIT）的 Table、Tree、Button、Tag、ConfigProvider 与中文语言包，接独立 `/observability` 页面。实验 SDK 按按钮动态加载，不注入旧首页业务。
4. 自有代码负责中文解释、任务/步骤双口径、重试/并发场景、取消与 JSON 导出；不复制框架企业目录。
5. 单测直接运行真实 SDK 服务和统计模块；Playwright 阻断外部访问，验证列表、详情、导出、刷新和窄屏，执行 axe 扫描。

## 界面规格

白色工具台，浅灰背景；主文字 #172033、辅助 #475569、主操作 #1554ad；圆角 6px，控件高 40px，中文系统字体。H1 24/30px，H2 16px。优先表格与树展示实际证据，不添加排行榜和大面积装饰。

## 回滚

回滚本 PR 的提交即可去掉独立入口、路由、模块和依赖；未改数据库 Schema，不需要数据迁移或清理。原项目和原始数据不受影响。
