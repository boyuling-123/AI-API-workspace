"use client";

import { useRef, useState } from "react";
import { Button } from "antd";
import type { AgentObservation } from "@/lib/agentObservability";
import { buildTraceInspector, TRACE_INPUT_ERROR } from "@/lib/agentTraceInspector";
import { computeSelectionScrollTarget } from "@/vendor/langfuse/timelineCalculations";

const statusText = { ok: "成功", error: "异常", unset: "未确定" };
const kindText = { agent: "Agent 步骤", llm: "模拟模型步骤", tool: "工具步骤" };
const rowHeight = 64;

export function TraceInspector({ spans }: { spans: AgentObservation[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  let view: ReturnType<typeof buildTraceInspector>;
  try { view = buildTraceInspector(spans); }
  catch (reason) { return <p role="alert" className="mt-4 text-sm text-red-800">{reason instanceof Error ? reason.message : TRACE_INPUT_ERROR}</p>; }
  const selectedIndex = Math.max(0, view.rows.findIndex((row) => row.span.spanId === selectedId));
  const selected = view.rows[selectedIndex];
  if (!selected) return <p className="mt-4 text-sm text-slate-600">暂无可检查的步骤。</p>;

  function select(index: number) {
    const row = view.rows[index];
    if (!row) return;
    setSelectedId(row.span.spanId);
    const container = scrollRef.current;
    if (container) container.scrollTop = computeSelectionScrollTarget({
      index, rowHeight, scrollTop: container.scrollTop, clientHeight: container.clientHeight, isInitial: false,
    }).top;
  }

  return <section aria-labelledby="step-inspector" className="mt-5 border-t border-slate-200 pt-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 id="step-inspector" className="font-semibold">步骤时间与详情</h3><p className="mt-2 text-xs leading-6 text-slate-600">时间范围 {view.durationMs.toFixed(1)} ms · {view.rows.length} 步。按父子关系展开，同级按开始时间排序。</p></div>
      <div className="flex gap-2">
        <Button aria-label="检查上一步" disabled={selectedIndex === 0} onClick={() => select(selectedIndex - 1)}>上一步</Button>
        <Button aria-label="检查下一步" disabled={selectedIndex === view.rows.length - 1} onClick={() => select(selectedIndex + 1)}>下一步</Button>
      </div>
    </div>
    <p className="mt-2 text-xs leading-6 text-slate-600">时间轴复用 Langfuse 的范围计算与调用树展开源码；包含所有步骤的起止范围，不等于根任务耗时。时间坐标精度为 1 ms，零时长步骤显示为点。</p>
    <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0">
        <div className="mb-2 flex justify-between text-xs text-slate-600"><span>0 ms / 全链起点</span><span>{view.durationMs.toFixed(1)} ms</span></div>
        <div ref={scrollRef} role="region" aria-label="步骤时间列表" tabIndex={0} className="max-h-80 overflow-y-auto rounded-md border border-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-800">
          {view.rows.map((row, index) => <button type="button" key={row.span.spanId} aria-label={`检查步骤：${row.span.name}`} aria-pressed={selected.span.spanId === row.span.spanId} onClick={() => select(index)} className={`block h-16 w-full border-b border-slate-200 px-3 text-left last:border-b-0 focus-visible:relative focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-800 ${selected.span.spanId === row.span.spanId ? "bg-blue-50" : "bg-white hover:bg-slate-50"}`}>
            <span className="flex items-center gap-2 text-xs"><span className="min-w-0 flex-1 truncate font-medium" style={{ paddingLeft: Math.min(row.depth, 6) * 8 }}>{row.span.name}</span><span className={row.span.status === "error" ? "shrink-0 text-red-800" : "shrink-0 text-slate-600"}>{statusText[row.span.status]} · {row.durationMs.toFixed(1)} ms</span></span>
            <span aria-hidden="true" className="relative mt-2 block h-2 overflow-hidden rounded bg-slate-100"><span className={`absolute block h-2 rounded ${row.span.status === "error" ? "bg-red-700" : "bg-blue-700"}`} style={{ left: `${row.leftPercent}%`, width: `${row.widthPercent}%`, minWidth: row.widthPercent === 0 ? 2 : undefined, transform: row.leftPercent === 100 ? "translateX(-100%)" : undefined }} /></span>
          </button>)}
        </div>
      </div>
      <section aria-label="选中步骤详情" className="min-w-0 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm">
        <h4 className="break-words font-semibold">{selected.span.name}</h4>
        <p role="status" aria-label="步骤选择状态" className="mt-2 text-xs text-slate-600">已选中第 {selectedIndex + 1} / {view.rows.length} 步</p>
        <dl className="mt-4 space-y-3">
          {[
            ["类型", kindText[selected.span.kind]], ["状态", statusText[selected.span.status]],
            ["开始偏移", `${selected.offsetMs.toFixed(1)} ms`], ["步骤耗时", `${selected.durationMs.toFixed(1)} ms`],
            ["层级", String(selected.depth)], ["父级", spans.find((span) => span.spanId === selected.span.parentSpanId)?.name ?? "根步骤"],
          ].map(([label, value]) => <div key={label}><dt className="text-xs text-slate-600">{label}</dt><dd className="mt-1 break-words">{value}</dd></div>)}
        </dl>
        {selected.span.status === "error" && <p className="mt-4 text-xs leading-6 text-red-800">这是步骤异常，不代表整个任务失败。请结合后续重试和根任务状态判断。</p>}
      </section>
    </div>
  </section>;
}
