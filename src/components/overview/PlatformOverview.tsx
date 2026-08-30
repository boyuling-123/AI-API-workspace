"use client";

import { useMemo } from "react";
import type { Project, Task } from "@/types";
import { formatDateTime } from "@/lib/datetime";

export type OverviewDestination =
  | "run"
  | "access"
  | "result"
  | "evaluate"
  | "evalHistory"
  | "calibration";

interface PlatformOverviewProps {
  project: Project;
  onNavigate: (destination: OverviewDestination) => void;
}

type CapabilityStatus = "已验证" | "已实现" | "部分实现" | "Demo" | "设计中";

interface CapabilityGroup {
  id: string;
  index: string;
  title: string;
  summary: string;
  status: CapabilityStatus;
  destination: OverviewDestination;
  action: string;
  features: string[];
  tone: "blue" | "cyan" | "amber" | "emerald" | "slate" | "rose";
  icon: "data" | "plug" | "run" | "judge" | "lab" | "agent";
}

const CAPABILITY_GROUPS: CapabilityGroup[] = [
  {
    id: "data-run",
    index: "01",
    title: "数据准备与跑批",
    summary: "从手动输入、文件导入到可暂停、可恢复的受控批量执行。",
    status: "已验证",
    destination: "run",
    action: "进入跑批工作台",
    features: ["Excel / JSON 导入", "AI 造数据与下载", "暂停、保留与继续", "并发 / QPS / 重试策略"],
    tone: "blue",
    icon: "data",
  },
  {
    id: "targets",
    index: "02",
    title: "模型与算法接入",
    summary: "内置模型、自定义 API 与脚本目标使用同一套可测试配置。",
    status: "已实现",
    destination: "access",
    action: "管理测试目标",
    features: ["内置模型与算法", "API 文档解析", "接入 Agent 实跑修复", "密钥引用而非明文"],
    tone: "cyan",
    icon: "plug",
  },
  {
    id: "history",
    index: "03",
    title: "结果、历史与重跑",
    summary: "保留每次批次快照，并把失败处理变成精确、可解释的重跑计划。",
    status: "已验证",
    destination: "result",
    action: "查看跑批历史",
    features: ["结果横向对比", "失败类型归类", "指定 Case 重跑", "新增目标增量重跑"],
    tone: "slate",
    icon: "run",
  },
  {
    id: "evaluation",
    index: "04",
    title: "AI 评价与 Evaluator",
    summary: "标准答案、Rubrics、权重和一票否决共同组成可版本化的评价定义。",
    status: "已验证",
    destination: "evaluate",
    action: "进入 AI 评价",
    features: ["标准答案 / 横向对比", "结构化 Rubrics", "少量试评与再次试评", "Evaluator 版本与 Diff"],
    tone: "amber",
    icon: "judge",
  },
  {
    id: "calibration",
    index: "05",
    title: "黄金集与 Judge 校准",
    summary: "用人工真值校准 Judge，并在发布前复算指标和完整性证据。",
    status: "已验证",
    destination: "calibration",
    action: "管理校准资产",
    features: ["不可变黄金集版本", "准确率 / κ / 漏判率", "Evaluator 发布门禁", "多 Judge 投票与分歧下钻"],
    tone: "emerald",
    icon: "lab",
  },
  {
    id: "agent",
    index: "06",
    title: "Agent 与外部召唤",
    summary: "外部 Skill 可生成导入包并通过引用深链召唤平台，复杂自治仍在演进。",
    status: "Demo",
    destination: "access",
    action: "查看外部能力",
    features: ["工作区导入 API", "字段映射确认", "仅引用的 Deep Link", "不会自动启动付费评价"],
    tone: "rose",
    icon: "agent",
  },
];

const STATUS_STYLES: Record<CapabilityStatus, string> = {
  已验证: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200",
  已实现: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200",
  部分实现: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
  Demo: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200",
  设计中: "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200",
};

const TONE_STYLES: Record<CapabilityGroup["tone"], { accent: string; panel: string; icon: string }> = {
  blue: { accent: "bg-blue-500", panel: "hover:border-blue-300 dark:hover:border-blue-500/50", icon: "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-200" },
  cyan: { accent: "bg-cyan-500", panel: "hover:border-cyan-300 dark:hover:border-cyan-500/50", icon: "bg-cyan-100 text-cyan-800 dark:bg-cyan-500/15 dark:text-cyan-200" },
  amber: { accent: "bg-amber-500", panel: "hover:border-amber-300 dark:hover:border-amber-500/50", icon: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200" },
  emerald: { accent: "bg-emerald-500", panel: "hover:border-emerald-300 dark:hover:border-emerald-500/50", icon: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200" },
  slate: { accent: "bg-slate-500", panel: "hover:border-slate-400 dark:hover:border-slate-500", icon: "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100" },
  rose: { accent: "bg-rose-500", panel: "hover:border-rose-300 dark:hover:border-rose-500/50", icon: "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-200" },
};

function taskStatusLabel(status: Task["status"]): string {
  const labels: Record<Task["status"], string> = {
    idle: "待运行",
    running: "运行中",
    paused: "已暂停",
    partial: "部分完成",
    done: "已完成",
    error: "失败",
    cancelled: "已取消",
  };
  return labels[status];
}

function CapabilityIcon({ name }: { name: CapabilityGroup["icon"] }) {
  const paths = {
    data: <><path d="M4 7h16M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M8 11h8M8 15h5"/></>,
    plug: <><path d="m8 12 4-4 4 4M12 8v9"/><path d="M5 4h14a2 2 0 0 1 2 2v13H3V6a2 2 0 0 1 2-2Z"/></>,
    run: <><path d="M4 19V5M4 19h16"/><path d="m7 15 4-4 3 2 5-6"/></>,
    judge: <><path d="m12 3 2.5 5.5L20 11l-4 4 .8 6-4.8-2.8L7.2 21 8 15l-4-4 5.5-2.5L12 3Z"/></>,
    lab: <><path d="M9 3h6M10 3v5l-5 9a3 3 0 0 0 2.6 4h8.8a3 3 0 0 0 2.6-4l-5-9V3"/><path d="M8 15h8"/></>,
    agent: <><rect x="4" y="7" width="16" height="12" rx="3"/><path d="M9 12h.01M15 12h.01M9 16h6M12 3v4"/></>,
  };
  return <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export function PlatformOverview({ project, onNavigate }: PlatformOverviewProps) {
  const stats = useMemo(() => {
    const usableTargets = project.targetConfigs.filter(
      (target) => target.preset || target.status === "tested_ok"
    ).length;
    const customTargets = project.targetConfigs.filter((target) => !target.preset).length;
    const completedTasks = project.tasks.filter(
      (task) => task.status === "done" || task.status === "partial"
    ).length;
    return {
      usableTargets,
      customTargets,
      taskCount: project.tasks.length,
      completedTasks,
      evaluationCount: project.evaluations?.length ?? 0,
      evaluatorCount: project.evaluatorVersions?.length ?? 0,
      goldenCount: project.goldenDatasetVersions?.length ?? 0,
      calibrationCount: project.judgeCalibrationRuns?.length ?? 0,
      releaseCount: project.evaluatorReleases?.length ?? 0,
    };
  }, [project]);

  const recentTasks = useMemo(
    () => [...project.tasks].sort((left, right) => right.createTime - left.createTime).slice(0, 4),
    [project.tasks]
  );

  const nextStep = useMemo(() => {
    if (project.tasks.length === 0) {
      return { eyebrow: "建议从这里开始", title: "准备第一批测试数据", detail: "导入 Excel / JSON，或先用 AI 生成少量样本，再选择模型进行批量运行。", action: "开始批量运行", destination: "run" as const };
    }
    if ((project.evaluations?.length ?? 0) === 0) {
      return { eyebrow: "已有跑批结果", title: "选择一个批次进入 AI 评价", detail: "先在跑批历史确认输出，再显式选择评价范围和 Judge；平台不会自动产生评价费用。", action: "选择历史批次", destination: "result" as const };
    }
    if ((project.goldenDatasetVersions?.length ?? 0) === 0) {
      return { eyebrow: "评价链路已建立", title: "发布第一版人工黄金集", detail: "锁定人工真值后，可以校准 Judge 的准确率、κ 和 Bad Case 漏判率。", action: "创建黄金集", destination: "calibration" as const };
    }
    if ((project.judgeCalibrationRuns?.length ?? 0) === 0) {
      return { eyebrow: "黄金集已经就绪", title: "运行一次 Judge 校准", detail: "确认调用数后执行校准，再决定 Evaluator 是否具备发布条件。", action: "开始 Judge 校准", destination: "calibration" as const };
    }
    return { eyebrow: "评测闭环已建立", title: "复核最近结果与版本变化", detail: "继续观察低分样本、评价历史和校准漂移；任何模型调用仍需单独确认。", action: "查看评价历史", destination: "evalHistory" as const };
  }, [project]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
      <section aria-labelledby="platform-overview-title" className="relative overflow-hidden rounded-3xl bg-slate-950 px-5 py-7 text-white shadow-xl sm:px-8 sm:py-9">
        <div aria-hidden="true" className="absolute -right-20 -top-24 h-64 w-64 rounded-full border border-cyan-300/20 bg-cyan-400/10 blur-2xl" />
        <div aria-hidden="true" className="absolute -bottom-28 left-1/3 h-56 w-56 rounded-full border border-amber-300/20 bg-amber-300/10 blur-2xl" />
        <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)] lg:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
              <span>Platform map</span>
              <span aria-hidden="true" className="h-1 w-1 rounded-full bg-cyan-300" />
              <span>本地管理模式</span>
            </div>
            <h2 id="platform-overview-title" className="mt-4 max-w-3xl text-balance text-3xl font-bold leading-tight sm:text-4xl">
              把数据、跑批、<span className="whitespace-nowrap">评价与校准</span>，放回一条清晰链路
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              当前项目数据保存在浏览器本地。平台负责组织模型接入、批量执行、AI 评价和 Judge 治理；任何真实模型调用都由你确认后才启动。
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={() => onNavigate("run")} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200">
                开始批量运行
                <span aria-hidden="true">→</span>
              </button>
              <button type="button" onClick={() => onNavigate("access")} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                接入模型 / 算法
              </button>
            </div>
          </div>
          <aside aria-label="建议下一步" className="rounded-2xl border border-white/15 bg-white/[0.07] p-5 backdrop-blur-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">{nextStep.eyebrow}</p>
            <h3 className="mt-2 text-lg font-bold">{nextStep.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">{nextStep.detail}</p>
            <button type="button" onClick={() => onNavigate(nextStep.destination)} className="mt-4 min-h-11 rounded-lg border border-amber-200/30 px-3 py-2 text-sm font-semibold text-amber-100 transition hover:bg-amber-200/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200">
              {nextStep.action}
            </button>
          </aside>
        </div>
      </section>

      <section aria-label="当前项目资产" className="relative z-10 -mt-1 grid gap-3 py-5 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "可用测试目标", value: stats.usableTargets, detail: `其中 ${stats.customTargets} 个外部接入`, accent: "text-blue-700 dark:text-blue-300" },
          { label: "历史批次", value: stats.taskCount, detail: `${stats.completedTasks} 个已完成 / 部分完成`, accent: "text-slate-800 dark:text-white" },
          { label: "AI 评价记录", value: stats.evaluationCount, detail: `${stats.evaluatorCount} 个 Evaluator 版本`, accent: "text-amber-700 dark:text-amber-300" },
          { label: "校准资产", value: stats.goldenCount + stats.calibrationCount, detail: `${stats.goldenCount} 个黄金集版本 · ${stats.releaseCount} 次发布`, accent: "text-emerald-700 dark:text-emerald-300" },
        ].map((item) => (
          <article key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{item.label}</p>
            <p className={`mt-2 font-mono text-3xl font-bold tabular-nums ${item.accent}`}>{item.value}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{item.detail}</p>
          </article>
        ))}
      </section>

      <section aria-labelledby="capability-map-title" className="mt-3">
        <div>
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-brand-700 dark:text-brand-300">Capability map</p>
            <h3 id="capability-map-title" className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">平台能力地图</h3>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">状态按当前代码与自动化证据标注；Demo 和部分实现不会伪装成正式能力。</p>
          </div>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {CAPABILITY_GROUPS.map((group) => {
            const tone = TONE_STYLES[group.tone];
            return (
              <article key={group.id} className={`group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-card-hover dark:border-slate-800 dark:bg-slate-900 ${tone.panel}`}>
                <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 ${tone.accent}`} />
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tone.icon}`}><CapabilityIcon name={group.icon} /></span>
                    <div className="min-w-0">
                      <p className="font-mono text-[11px] font-semibold tracking-[0.16em] text-slate-500 dark:text-slate-400">FLOW {group.index}</p>
                      <h4 className="mt-0.5 text-lg font-bold text-slate-900 dark:text-white">{group.title}</h4>
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[group.status]}`}>{group.status}</span>
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">{group.summary}</p>
                <ul className="mt-4 grid gap-2 text-xs text-slate-600 sm:grid-cols-2 dark:text-slate-400">
                  {group.features.map((feature) => <li key={feature} className="flex items-start gap-2"><span aria-hidden="true" className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${tone.accent}`} /><span>{feature}</span></li>)}
                </ul>
                <button type="button" onClick={() => onNavigate(group.destination)} className="mt-5 min-h-11 text-sm font-semibold text-brand-700 underline-offset-4 transition hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-600 dark:text-brand-300">
                  {group.action} <span aria-hidden="true">→</span>
                </button>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-3">
            <div><p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Recent runs</p><h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">最近跑批</h3></div>
            <button type="button" onClick={() => onNavigate("result")} className="min-h-11 px-2 text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300">查看全部</button>
          </div>
          {recentTasks.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center dark:border-slate-700"><p className="text-sm font-medium text-slate-700 dark:text-slate-200">还没有历史批次</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">完成一次试跑或批量运行后，这里会显示最近任务。</p></div>
          ) : (
            <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
              {recentTasks.map((task) => <div key={task.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-3 first:pt-0 last:pb-0"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{task.runMode === "batch" ? "批量任务" : "单条试跑"} · {task.inputs.length} 条输入</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{formatDateTime(task.createTime)} · {task.targetIds.length} 个目标</p></div><span className="self-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{taskStatusLabel(task.status)}</span></div>)}
            </div>
          )}
        </div>
        <aside className="rounded-2xl border border-slate-200 bg-[linear-gradient(145deg,#ecfeff_0%,#ffffff_55%,#fffbeb_100%)] p-5 shadow-card dark:border-slate-800 dark:bg-[linear-gradient(145deg,#0f2731_0%,#111827_55%,#2b2110_100%)]">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-cyan-800 dark:text-cyan-200">Storage boundary</p>
          <h3 className="mt-2 text-lg font-bold text-slate-900 dark:text-white">当前是本地管理平台，不是 20GB 数据仓库</h3>
          <p className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-300">项目元数据和中小规模结果保存在 IndexedDB。超大数据集、长期任务、队列和对象存储仍需后端化，本页明确保留这个能力边界。</p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold"><span className="rounded-full bg-white px-2.5 py-1 text-emerald-800 shadow-sm dark:bg-slate-900 dark:text-emerald-200">本地自动保存 · 已实现</span><span className="rounded-full bg-white px-2.5 py-1 text-slate-700 shadow-sm dark:bg-slate-900 dark:text-slate-200">大数据后端化 · 设计中</span></div>
        </aside>
      </section>
    </div>
  );
}
