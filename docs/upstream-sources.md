# v6.0 上游源码与许可清单

## 固定来源

| 来源 | 固定版本 | 许可 | 用途 | 边界 |
| --- | --- | --- | --- | --- |
| [modelscope/evalscope](https://github.com/modelscope/evalscope/tree/c31f0f946c09bc087f856a017637ac157b5459a5) | `c31f0f946c09bc087f856a017637ac157b5459a5` | Apache-2.0 | v6 唯一执行与 Web 基座 | 先保留上游历史并完成业务试跑；本地修改须可追溯 |
| [langfuse/langfuse](https://github.com/langfuse/langfuse/tree/7637df1e1aadddbbfd0a45b960ecc97451381ce5) | `7637df1e1aadddbbfd0a45b960ecc97451381ce5` | 所选核心文件 MIT，详见仓库许可 | 信息架构参考与已登记的少量纯逻辑 | 禁止引入 `ee`、`web/src/ee`、`worker/src/ee`；不得声称整站 Fork |

## 已存在的 Langfuse 受控复用

现有 v5 迁移源已登记 `timelineCalculations.ts`、`flattenTreeOrder.ts` 和经本地适配的 `PageTabs.tsx`。来源、摘要和差异见 [`third_party/langfuse/README.md`](../third_party/langfuse/README.md) 与 [`manifest.json`](../third_party/langfuse/manifest.json)。这些文件只能作为迁移候选，不能自动进入 v6。

## 引入规则

1. 固定仓库、完整提交 SHA、原始路径和许可，不跟随漂移的 `main`。
2. 先记录依赖树和运行边界，再决定 vendoring、package 依赖、适配器或仅参考交互。
3. 保留上游版权与许可，不把本地外围 UI 写成上游原组件。
4. 每个引入 PR 必须包含来源 Diff、真实调用测试、依赖审计和回滚路径。
5. 不导入付费、企业或许可不清晰目录；不通过复制数据库 Schema 拼接多个平台。
6. 上游源码存在只证明候选能力，业务状态以 [`底座能力核验表`](v6/底座能力核验表.md) 为准。
