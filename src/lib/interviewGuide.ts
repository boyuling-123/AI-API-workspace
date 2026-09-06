export const INTERVIEW_CHAPTERS = [
  {
    id: "positioning", title: "产品定位", duration: "30 秒", label: "产品判断",
    headline: "不是再造一个大平台，而是把评测工作组织清楚。",
    message: "面向需要准备测试集、对比输出和复核结果的产品经理。中文引导降低使用门槛；原始数据留在本机，成熟框架负责各自擅长的部分。",
    steps: ["从平台总览查看数据、跑批、评价与校准的主链路。", "说明先组织和复核已有结果，真实模型调用必须由用户确认。"],
    evidence: "现有项目保存在浏览器 IndexedDB；新增历史归档直接只读连接本机文件。ProjectRepository 已隔离替换接口，但没有迁移存储。",
    boundary: "本机不等于无限容量，也不等于整个部署链路都没有服务。当前仍有本机 Next API，不是 20GB 级执行系统或整站 Langfuse Fork。",
    href: "/?tab=overview", action: "打开平台总览", access: "打开后读取当前浏览器项目，不启动跑批或评价。",
  },
  {
    id: "history", title: "历史规模", duration: "45 秒", label: "本机历史 / 未认证来源",
    headline: "先解释数据是什么，再展示有多少条。",
    message: "用本机已有归档展示真实的数据组织方式：统计来自索引分片核对，表格只读当前页，不把所有正文一次塞进浏览器。",
    steps: ["打开历史归档，核对“索引记录总数”“原始 ID 去重数”和分片数量。", "切换页码或当前分片筛选；解释一条索引记录不一定是一条独立业务用例。", "正文默认不展示；面试演示可只看统计和别名，不必公开业务内容。"],
    evidence: "归档页会显示实际来源标记、核对时间与旧清单偏差；没有配置时显示真实错误，不用演示数替代。可以下载统计摘要 JSON。",
    boundary: "既有历史可能包含模拟或重复记录。索引数不是本次模型调用数，也不是质量成绩；原始 ID 去重也不等于业务用例去重。",
    href: "/history-demo", action: "打开本机归档", access: "点击后将读取已配置归档的索引摘要与首屏分页；不读取正文、不修改原文件。",
  },
  {
    id: "observability", title: "失败定位", duration: "60 秒", label: "真实框架 / Mock 节点",
    headline: "最终任务成功，过程也可能出过错。",
    message: "展示为什么只看一个成功率不够：工具首次失败后恢复，仍然需要保留中间失败的证据，而不是覆盖掉。",
    steps: ["进入 Agent 观测后，手动点击“运行 LangGraph 实验”。", "选择“失败重试”调用链，再选择“库存工具（Mock，第 1 次）”。", "比较根任务成功与中间步骤异常，再查看第 2 次恢复；下载带来源/版本的实验 JSON。"],
    evidence: "固定实验预期为 2 条调用链、7 个步骤；StateGraph 与 retryPolicy 由真实 LangGraph 执行，callbacks 转 OTel，中文检查器复用锁定 Langfuse 纯逻辑。",
    boundary: "节点和故障是固定 Mock，模型调用为 0，Token/成本未测量。耗时不是模型能力排名，也不代表任意 Agent 框架已兼容。",
    href: "/observability", action: "打开 Agent 观测", access: "进入页面不运行实验；只有再次点击运行按钮才执行固定本机实验。结果离开页面前可下载。",
  },
  {
    id: "assistant", title: "助手互联", duration: "45 秒", label: "只读 Action / MCP",
    headline: "让网页和助手使用同一套业务动作。",
    message: "AI 友好不是给每个按钮起一个工具名。先把“查询平台能力”“读取归档统计”封成有边界、可验证的业务动作。",
    steps: ["进入助手工具页，点击“查询平台能力”，查看真实返回的两项只读工具。", "如需展示数据互联，再点击“读取归档统计”；只返回统计，不取业务正文。", "说明网页 API 与 stdio MCP 共用 Action，外部宿主配置方法见工程文档。"],
    evidence: "真实官方 MCP SDK 与客户端协议测试已经通过；不是手写假协议。工具只有空参数白名单，不开放任意文件、删除或脚本。",
    boundary: "当前是可调用工具台，不是完整对话 Assistant，也不能直接管理浏览器中的所有项目。外部宿主可能使用云端模型，需另行确认信任与数据边界。",
    href: "/assistant-tools", action: "打开助手工具", access: "进入页面不调用工具；统计需手动点击，外部 Assistant 不会自动连接。",
  },
  {
    id: "engineering", title: "工程证据", duration: "45 秒", label: "源码 / 验收记录",
    headline: "把“做出来了”，落到能核对的证据上。",
    message: "说明哪些代码来自成熟开源项目、我们做了哪些本地适配，以及如何通过真实源码测试和用户路径保证它可用。",
    steps: ["查看开源复用记录，区分已经接入和仅在设计中的候选。", "打开具体 PR，核对 Spec、Diff、测试截图/Trace、最终 CI 和正常合并记录。", "以真实边界结束：后端存储、完整助手、任意框架接入仍有工作要做。"],
    evidence: "Ant Design 中文组件、Langfuse 两份固定纯逻辑、OpenTelemetry、官方 MCP 与 LangGraph 已有对应证据。DeepEval、promptfoo、AgentScope 等不因被调研就算已接入。",
    boundary: "本仓库 PR 是个人产品工程贡献，不是上游社区已接受的贡献。自动化自检也不是独立人类批准，不把 Mock 测试数字当模型质量。",
    href: "/?tab=overview", action: "回到平台总览", access: "公开证据链接会离开本机页面；导览不会自动连接 GitHub。",
  },
] as const;

export type InterviewChapterId = typeof INTERVIEW_CHAPTERS[number]["id"];
export const INTERVIEW_EVIDENCE = [
  { title: "开源复用与我们的取舍", href: "https://github.com/boyuling-123/AI-API-workspace/blob/main/docs/product/open-source-reuse.md" },
  { title: "Langfuse 源文件与许可", href: "https://github.com/boyuling-123/AI-API-workspace/blob/main/third_party/langfuse/README.md" },
  { title: "真实 LangGraph 接入 PR #51", href: "https://github.com/boyuling-123/AI-API-workspace/pull/51" },
  { title: "只读 MCP 接入与边界", href: "https://github.com/boyuling-123/AI-API-workspace/blob/main/docs/product/platform-actions-mcp.md" },
  { title: "自动化验收与回滚证据", href: "https://github.com/boyuling-123/AI-API-workspace/blob/main/docs/evidence/pr-langgraph-observability/README.md" },
] as const;

export function resolveInterviewChapter(value: unknown) {
  const index = INTERVIEW_CHAPTERS.findIndex((chapter) => chapter.id === value);
  return { index: index < 0 ? 0 : index, fallback: value !== undefined && index < 0 };
}

export function renderInterviewGuide(): string {
  return [
    "# 中文评测工作台：4 分钟产品演示", "",
    "这是一份讲解手册，不是自动完成记录或模型测评报告。建议时长仅供参考。", "",
    "入口为本机工作台的 `/interview-demo`，以下路由均相对当前工作台地址。导览本身不读数据、不运行实验。", "",
    ...INTERVIEW_CHAPTERS.flatMap((chapter, index) => [
      `## ${index + 1}. ${chapter.title}（建议 ${chapter.duration}）`, "", chapter.headline, "", chapter.message, "",
      `类型：${chapter.label}`, "", ...chapter.steps.map((step, i) => `${i + 1}. ${step}`), "",
      `看什么证据：${chapter.evidence}`, "", `不要夸大：${chapter.boundary}`, "",
      `功能路由：\`${chapter.href}\``, "", `访问提示：${chapter.access}`, "",
    ]),
    "## 公开工程证据", "", ...INTERVIEW_EVIDENCE.map((item) => `- [${item.title}](${item.href})`), "",
    "原始业务数据不随手册下载；没有配置的能力应展示真实缺失，不填演示成功数。", "",
  ].join("\n");
}
