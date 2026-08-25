# 测评平台开发任务台账

## 当前执行：PR 01 基线迁移与状态校准

分支：`codex/chore-baseline-sync`

- [x] 从 GitHub 重新克隆远端仓库，保留历史。
- [x] 保留原开发目录，不在原目录初始化 Git。
- [x] 镜像迁移当前源码，排除密钥、依赖、缓存、构建产物和本地 Agent 状态。
- [x] 强化 `.gitignore`。
- [x] 将四个不存在的 API 降级为“设计中”或“Demo”。
- [x] 建立 75 条能力矩阵及六种严格状态。
- [x] 校准 README 和 v5.0 文档入口。
- [x] 执行敏感信息扫描和迁移 Diff 复核。
- [x] 安装干净依赖并完成 typecheck、build 和基础 UI 验收。
- [ ] 提交、推送分支并创建 Pull Request。

## 下一任务：PR 02 真实测试与质量门禁

状态：Ready（PR 01 合并后开始）

- 让任务池测试直接导入真实源文件，删除复制实现测试。
- 建立 lint、typecheck、unit、build 脚本。
- 接入 Playwright E2E、可访问性检查和失败 Trace。
- 建立 GitHub Actions 与 CI Secret Scan。
- 增加统一日志脱敏底线测试。
- 处理 `npm audit` 报告的 9 个高危依赖问题，禁止直接使用破坏性 `--force` 升级。
- 清理本轮记录的 React Hook 与 `<img>` lint 警告。

## 硬门禁

- 未通过适用测试不得 Push 或合并。
- 不得提交真实 Key、`.env.local`、日志、缓存或构建产物。
- 不得自动调用付费模型或启动 AI 评价。
- 每个 PR 必须更新能力矩阵和本台账。
