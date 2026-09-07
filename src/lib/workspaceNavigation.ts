export const WORKSPACE_PAGES = [
  { id: "datasets", title: "评测集", group: "开发与评测", description: "准备输入与标准答案。当前使用本地草稿，通用数据集版本管理尚未实现。", tabs: [{ id: "dataset", label: "数据工作区" }] },
  { id: "targets", title: "评测对象", group: "开发与评测", description: "管理被测模型、算法与 Agent 接口；接入后在评测任务中选择使用。", tabs: [{ id: "access", label: "对象与接口" }] },
  { id: "scorers", title: "评估器", group: "开发与评测", description: "用黄金集、人工真值与版本记录校准裁判，确认后再运行评价。", tabs: [{ id: "calibration", label: "黄金集与校准" }] },
  { id: "tasks", title: "评测任务", group: "开发与评测", description: "查看运行记录、创建评测任务，或从已有批次继续评价。", tabs: [{ id: "result", label: "运行记录" }, { id: "run", label: "新建任务" }, { id: "evaluate", label: "执行评价" }] },
  { id: "reports", title: "评测报告", group: "分析与改进", description: "查看历史评价、筛选 Case、人工复核与导出报告。历史评分规则保持可读。", tabs: [{ id: "evalHistory", label: "评价记录" }] },
  { id: "settings", title: "管理中心", group: "工作空间", description: "维护资源角色和外部接入能力。所有未实现的独立接口明确标注状态。", tabs: [{ id: "resources", label: "模型资源" }, { id: "integrations", label: "外部接入" }, { id: "overview", label: "能力状态" }] },
] as const;

export type WorkspaceTab = typeof WORKSPACE_PAGES[number]["tabs"][number]["id"];
export function getWorkspacePage(tab: WorkspaceTab) {
  return WORKSPACE_PAGES.find((page) => page.tabs.some((item) => item.id === tab))!;
}
export function parseWorkspaceTab(search: string): WorkspaceTab {
  const tab = new URLSearchParams(search).get("tab");
  return WORKSPACE_PAGES.flatMap((page) => [...page.tabs]).some((item) => item.id === tab)
    ? tab as WorkspaceTab : "result";
}
export function workspaceHref(search: string, tab: WorkspaceTab): string {
  const params = new URLSearchParams(search);
  params.set("tab", tab);
  return `/?${params.toString()}`;
}
