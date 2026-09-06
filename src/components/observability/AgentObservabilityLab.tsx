"use client";

import { useEffect, useRef, useState } from "react";
import { WorkbenchNav } from "@/components/WorkbenchNav";
import { Button, ConfigProvider, Table, Tag, Tree } from "antd";
import zhCN from "antd/locale/zh_CN";
import type { DataNode } from "antd/es/tree";
import { TraceInspector } from "./TraceInspector";
import { serializeAgentExperiment, summarizeAgentExperiment, type AgentExperiment, type AgentObservation, type AgentTraceSummary } from "@/lib/agentObservability";

const statusText = { ok: "成功", error: "异常", unset: "未确定" };

function spanNodes(spans: AgentObservation[], parent?: string): DataNode[] {
  return spans.filter((span) => span.parentSpanId === parent).map((span) => ({
    key: span.spanId,
    title: <span className="inline-flex flex-wrap items-center gap-2 py-1">
      <span>{span.name}</span>
      <span className={span.status === "error" ? "text-red-800" : "text-slate-600"}>
        {statusText[span.status]} · {(span.endTimeMs - span.startTimeMs).toFixed(1)} ms
      </span>
    </span>,
    children: spanNodes(spans, span.spanId),
  }));
}

export function AgentObservabilityLab() {
  const [experiment, setExperiment] = useState<AgentExperiment | null>(null);
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [runningMode, setRunningMode] = useState<"mock" | "langgraph" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);
  const summaries = experiment ? summarizeAgentExperiment(experiment) : [];
  const selected = summaries.find((item) => item.traceId === selectedTraceId);
  const spans = experiment?.spans.filter((span) => span.traceId === selectedTraceId) ?? [];

  async function run(mode: "mock" | "langgraph" = "mock") {
    if (abortRef.current) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setRunningMode(mode);
    setError(null);
    try {
      const result = mode === "langgraph"
        ? await (await import("@/services/runLangGraphExperimentClient")).runLangGraphExperimentClient(controller.signal)
        : await (await import("@/services/runLocalAgentExperiment")).runLocalAgentExperiment(controller.signal);
      if (controller.signal.aborted) throw new Error("CANCELLED");
      setExperiment(result);
      setSelectedTraceId(summarizeAgentExperiment(result)[0]?.traceId ?? null);
    } catch (reason) {
      setError(controller.signal.aborted ? "本地实验已停止，之前完成的结果保留。" : reason instanceof Error ? reason.message : "本地实验失败，请重试。");
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setRunning(false);
      setRunningMode(null);
    }
  }

  function download() {
    if (!experiment) return;
    const url = URL.createObjectURL(new Blob([serializeAgentExperiment(experiment)], { type: "application/json;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = experiment.source === "local-langgraph-mock-otel" ? "agent-observability-langgraph-mock.json" : "agent-observability-local-mock.json";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <ConfigProvider locale={zhCN} theme={{ token: {
    colorPrimary: "#1554ad", colorText: "#172033", colorTextSecondary: "#475569",
    colorLink: "#1554ad", colorLinkHover: "#12458d", colorLinkActive: "#103b78",
    colorSuccess: "#166534", colorError: "#991b1b", borderRadius: 6,
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif', controlHeight: 40,
  } }}>
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <WorkbenchNav active="observability" note="本地实验室 · 无外部调用" />
      <main className="mx-auto max-w-7xl space-y-6 px-5 py-8 sm:px-8">
        <section aria-labelledby="agent-lab-title">
          <p className="mb-2 text-xs font-semibold tracking-wider text-slate-600">OBSERVABILITY / 调用链实验</p>
          <h1 id="agent-lab-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">Agent 观测实验室</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
            先看清过程，再讨论质量。使用真实 OpenTelemetry SDK 记录步骤、耗时、异常与父子关系；可选择模拟流程或真实 LangGraph 调度。
          </p>
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
            本页为 Mock 验证，不是真实模型评测。决策、工具和故障均由本地桩控制；耗时不能用于比较模型能力。Token 和模型成本未测量。
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button type="primary" aria-label="运行 3 组本地实验" aria-busy={runningMode === "mock"} loading={runningMode === "mock"} disabled={running} onClick={() => run()}>运行 3 组本地实验</Button>
            <Button aria-label="运行 LangGraph 实验" aria-busy={runningMode === "langgraph"} loading={runningMode === "langgraph"} disabled={running} onClick={() => run("langgraph")}>运行 LangGraph 实验</Button>
            <Button disabled={!experiment || running} onClick={download}>下载实验 JSON</Button>
            {running && <Button onClick={() => abortRef.current?.abort()}>停止本地实验</Button>}
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-700">LangGraph 1.4.14：真实框架 + 固定 Mock 节点，运行顺序与自动重试 2 组实验。仅访问本机执行接口，不连接 LangSmith 或模型。</p>
          {experiment && <p className="mt-2 text-sm font-medium text-blue-800" aria-label="当前结果来源">
            当前结果：{experiment.source === "local-langgraph-mock-otel" ? "LangGraph 真实调度 / Mock 节点 / 框架回调采集" : "本地模拟流程 / 手动 SDK 埋点"}
          </p>}
          <p className="mt-2 text-xs leading-6 text-slate-600" role="status" aria-label="实验采集状态">
            {running ? "正在本地采集调用链，不调用模型或外部 API…" : error ? "本次采集未完成；如有之前完成的结果，仍保留在下方。" : experiment ? "采集完成。结果仅保留在当前页面，离开前可下载 JSON；未写入项目数据库。" : "选择上方一种实验后开始。不会修改现有项目数据。"}
          </p>
          {error && <p role="alert" aria-label="实验运行错误" className="mt-2 text-sm text-red-800">{error}</p>}
        </section>

        <section aria-label="采集摘要" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            ["调用链", experiment ? summaries.length : "未运行", "每条调用链对应一次完整任务"],
            ["执行步骤", experiment ? experiment.spans.length : "未运行", "包含模拟决策、Agent 和工具"],
            ["异常步骤", experiment ? experiment.spans.filter((span) => span.status === "error").length : "未运行", "工具异常不等于最终任务失败"],
          ].map(([label, value, hint]) => <div key={label} className="rounded-lg border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-600">{label}</p>
            <p className="mt-2 font-mono text-2xl font-semibold">{value}</p>
            <p className="mt-2 text-xs text-slate-600">{hint}</p>
          </div>)}
        </section>

        <section aria-labelledby="experiment-results" className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
          <h2 id="experiment-results" className="mb-1 text-base font-semibold">实验结果</h2>
          <p className="mb-4 text-xs leading-6 text-slate-600">任务状态取根步骤，耗时取任务起止时间，不累加并行步骤。不生成综合排名。</p>
          <Table<AgentTraceSummary> size="small" rowKey="traceId" dataSource={summaries} pagination={false}
            scroll={{ x: 700 }} locale={{ emptyText: "尚无实验数据，请先运行本地实验。" }}
            columns={[
              { title: "执行方式", dataIndex: "name", render: (name: string, row) => <Button type="link" onClick={() => setSelectedTraceId(row.traceId)} aria-label={`查看${name}调用链`}>{name}</Button> },
              { title: "任务状态", dataIndex: "status", render: (status: AgentObservation["status"]) => <Tag>{statusText[status]}</Tag> },
              { title: "耗时 / ms", dataIndex: "durationMs", render: (value: number) => value.toFixed(1) },
              { title: "工具调用", dataIndex: "toolCalls" },
              { title: "异常步骤", dataIndex: "errorSteps" },
              { title: "重试次数", dataIndex: "retries" },
            ]} />
        </section>

        <section aria-labelledby="trace-details" className="min-w-0 rounded-lg border border-slate-200 bg-white p-5">
          <h2 id="trace-details" className="text-base font-semibold">调用链详情{selected ? ` · ${selected.name}` : ""}</h2>
          {selected ? <>
            <p className="my-3 break-all font-mono text-xs text-slate-600">Trace ID: {selected.traceId}</p>
            <TraceInspector key={selectedTraceId} spans={spans} />
            <details className="mt-5 border-t border-slate-200 pt-4 text-sm">
              <summary className="cursor-pointer py-2 font-medium text-blue-800">查看原始步骤树</summary>
              <div className="overflow-x-auto">
                <Tree key={selectedTraceId} treeData={spanNodes(spans)} defaultExpandAll selectable={false} showLine aria-label="Agent 执行步骤" />
              </div>
            </details>
          </> : <p className="mt-3 text-sm text-slate-600">采集完成后，选择一条任务查看执行步骤与异常位置。</p>}
        </section>

        <details className="rounded-lg border border-slate-200 bg-white px-5 py-4 text-sm">
          <summary className="cursor-pointer font-semibold">接入边界与开源来源</summary>
          <div className="mt-3 space-y-2 leading-7 text-slate-600">
            <p>已接入：OpenTelemetry 手动 SDK 埋点、内存导出器，Ant Design 表格/树/按钮及中文语言包。步骤检查器真实复用 Langfuse 时间范围、滚动定位与调用树展开源码（7637df1）；保留 MIT 许可和来源摘要，不是整站 Fork。</p>
            <p>新增：LangGraph 1.4.14 / Core 1.2.9 的 StateGraph 与 retryPolicy 真实运行，回调转 OTel。框架在不继承密钥环境的短时本机子进程中执行，拒绝网络访问；不是运行任意代码的安全沙箱。</p>
            <p>待开发：任意用户 Agent 接入、AgentScope、OTLP 实时接收、历史存储与告警；固定 Mock 节点实验不等同于所有框架兼容或真实模型质量评测。</p>
            <p>我们的改动：统一实验数据契约、任务与步骤分层统计、失败恢复场景、中文交互及真实源码测试。上游库仍保留各自许可，不冒充原创框架。</p>
          </div>
        </details>
      </main>
    </div>
  </ConfigProvider>;
}
