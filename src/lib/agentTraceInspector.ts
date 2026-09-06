import type { AgentObservation } from "./agentObservability";
import { calculateTraceDuration, findEarliestStartTime } from "../vendor/langfuse/timelineCalculations";
import { flattenTreeOrder } from "../vendor/langfuse/flattenTreeOrder";
import type { TreeNode } from "../vendor/langfuse/types";

export const TRACE_INSPECTOR_LIMIT = 1000;
export const TRACE_DEPTH_LIMIT = 128;
export const TRACE_INPUT_ERROR = "调用链结构或时间无效，未自动修补数据。请检查步骤 ID、父级和起止时间。";

export interface TraceInspectorRow {
  span: AgentObservation;
  depth: number;
  offsetMs: number;
  durationMs: number;
  leftPercent: number;
  widthPercent: number;
}

export function buildTraceInspector(spans: AgentObservation[]): { durationMs: number; rows: TraceInspectorRow[] } {
  if (spans.length > TRACE_INSPECTOR_LIMIT) throw new Error("单条调用链最多展示 1000 个步骤，请先缩小范围。");
  if (!spans.length) return { durationMs: 0, rows: [] };
  const nodes = new Map<string, TreeNode>();
  const originals = new Map<string, AgentObservation>();
  for (const span of spans) {
    if (!span.spanId || nodes.has(span.spanId) || !span.traceId || span.traceId !== spans[0].traceId
      || !Number.isFinite(span.startTimeMs) || !Number.isFinite(span.endTimeMs) || span.endTimeMs < span.startTimeMs
      || !Number.isFinite(new Date(span.startTimeMs).getTime()) || !Number.isFinite(new Date(span.endTimeMs).getTime())) {
      throw new Error(TRACE_INPUT_ERROR);
    }
    nodes.set(span.spanId, {
      id: span.spanId,
      type: span.kind === "agent" ? "AGENT" : span.kind === "llm" ? "GENERATION" : "TOOL",
      startTime: new Date(span.startTimeMs), endTime: new Date(span.endTimeMs), children: [],
    });
    originals.set(span.spanId, span);
  }
  const roots: TreeNode[] = [];
  for (const span of spans) {
    const node = nodes.get(span.spanId)!;
    if (span.parentSpanId !== undefined) {
      const parent = nodes.get(span.parentSpanId);
      if (!parent) throw new Error(TRACE_INPUT_ERROR);
      parent.children.push(node);
    } else roots.push(node);
  }

  // Validate before calling upstream traversal, which assumes an acyclic tree.
  const queue = roots.map((node) => ({ node, depth: 0 }));
  for (let index = 0; index < queue.length; index++) {
    const { node, depth } = queue[index];
    if (depth > TRACE_DEPTH_LIMIT) throw new Error("调用链层级超过 128 层，请先缩小范围。");
    for (const child of node.children) queue.push({ node: child, depth: depth + 1 });
  }
  if (queue.length !== spans.length) throw new Error(TRACE_INPUT_ERROR);

  const origin = findEarliestStartTime(roots)!;
  const durationMs = calculateTraceDuration(roots, origin) * 1000;
  const rows = flattenTreeOrder(roots).map(({ node, treeLines }) => {
    const span = originals.get(node.id)!;
    const offsetMs = node.startTime.getTime() - origin.getTime();
    const coordinateDuration = node.endTime!.getTime() - node.startTime.getTime();
    return {
      span, depth: treeLines.length, offsetMs, durationMs: span.endTimeMs - span.startTimeMs,
      leftPercent: durationMs > 0 ? Math.min(100, Math.max(0, offsetMs / durationMs * 100)) : 0,
      widthPercent: durationMs > 0 ? Math.min(100, Math.max(0, coordinateDuration / durationMs * 100)) : 0,
    };
  });
  return { durationMs, rows };
}
