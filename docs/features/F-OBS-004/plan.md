# F-OBS-004 实施计划

1. Planner：审计两个真实生成器、LangGraph 严格校验器、Langfuse 适配检查器及 importer Skill。业务数据映射确认规则不绕过；本轮仅合成观测格式，无标准答案或评价动作。
2. Developer：增加有界严格文件解析器、可选来源标记和独立中文回读面板。复用既有观测结果/下载/Ant Design 样式，不引入依赖或后端存储。
3. Tester：真实源码往返和攻击性输入、实际浏览器下载/选择/确认/取消/保留旧数据/迟到读取/无网络、390px 与 WCAG，完整 quality 和 E2E。
4. 发布：回写矩阵、夜间台账、开发纪实、证据与下一 Ready；自动 commit/push/PR，最终 head CI 成功、无冲突/未解决意见后正常合并。不自行伪造第二人 Review。
