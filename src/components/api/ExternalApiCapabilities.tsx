"use client";

type CapabilityState = "design" | "demo" | "available";

const CAPABILITIES: {
  title: string;
  endpoint: string;
  desc: string;
  status: string;
  state: CapabilityState;
}[] = [
  {
    title: "数据集导入标准化",
    endpoint: "/api/import-dataset",
    desc: "把 Excel / JSON / JSONL / 微调 messages 数据统一成平台可跑的测试集。",
    status: "设计中",
    state: "design",
  },
  {
    title: "目标一键导入",
    endpoint: "/api/import-target",
    desc: "把外部 API 文档或配置解析成平台 TargetConfig，一键加入测试目标。",
    status: "设计中",
    state: "design",
  },
  {
    title: "标准答案 AI 裁判",
    endpoint: "/api/judge-reference",
    desc: "输入 prompt、标准答案、模型输出，返回分数、原因和错误类型。",
    status: "Demo · 无独立接口",
    state: "demo",
  },
  {
    title: "批量运行引擎",
    endpoint: "/api/run-batch",
    desc: "输入测试集和目标列表，统一并发调用多个模型/算法并返回归一化结果。",
    status: "Demo · 无独立接口",
    state: "demo",
  },
  {
    title: "评价维度生成",
    endpoint: "/api/gen-dimensions",
    desc: "按业务场景自动生成可勾选的评价维度，减少手写评测标准成本。",
    status: "已实现接口",
    state: "available",
  },
  {
    title: "评价 Prompt 生成",
    endpoint: "/api/gen-eval-prompt",
    desc: "把评测需求、维度和目标名整理成稳定的裁判模型提示词。",
    status: "已实现接口",
    state: "available",
  },
];

const STATE_STYLES: Record<CapabilityState, string> = {
  design:
    "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  demo: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  available:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
};

export function ExternalApiCapabilities() {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-3.5 dark:border-slate-800">
        <div>
          <h2 className="font-mono text-sm font-semibold text-slate-700 dark:text-slate-200">
            可拆成外部 API 的小能力点
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            只有标记为“已实现接口”的路由可直接调用；“设计中”和 Demo
            仅表示规划或内部能力，不是可用 API。
          </p>
        </div>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
          平台化路线
        </span>
      </div>

      <div className="grid gap-3 p-5 md:grid-cols-2">
        {CAPABILITIES.map((item) => (
          <div
            key={item.title}
            className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-950/40"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {item.title}
              </h3>
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${STATE_STYLES[item.state]}`}
              >
                {item.status}
              </span>
            </div>
            <code className="mt-2 block rounded bg-slate-900 px-2 py-1 font-mono text-[11px] text-slate-100 dark:bg-black">
              {item.state === "available" ? "可调用" : "规划路由"} ·{" "}
              {item.endpoint}
            </code>
            <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
              {item.desc}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
