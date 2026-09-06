import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import manifest from "../../third_party/langfuse/manifest.json";
import { calculateTraceDuration, computeSelectionScrollTarget, findEarliestStartTime } from "@/vendor/langfuse/timelineCalculations";
import { flattenTreeOrder } from "@/vendor/langfuse/flattenTreeOrder";
import type { TreeNode } from "@/vendor/langfuse/types";
import { buildTraceInspector, TRACE_DEPTH_LIMIT, TRACE_INPUT_ERROR, TRACE_INSPECTOR_LIMIT } from "@/lib/agentTraceInspector";
import type { AgentObservation } from "@/lib/agentObservability";
import { runLocalAgentExperiment } from "@/services/runLocalAgentExperiment";

const node = (id: string, start = 0, end: number | null = 10, children: TreeNode[] = []): TreeNode => ({
  id, type: "SPAN", startTime: new Date(start), endTime: end === null ? null : new Date(end), children,
});
const span = (id: string, start = 0, end = 10, parentSpanId?: string): AgentObservation => ({
  traceId: "synthetic-trace", spanId: id, name: `合成步骤 ${id}`, kind: "tool", status: "ok", startTimeMs: start, endTimeMs: end, parentSpanId, attributes: {},
});

describe("pinned Langfuse source, not a rewritten copy", () => {
  it("keeps exact upstream source after reversing only declared header and type imports", () => {
    expect(manifest.commit).toBe("7637df1e1aadddbbfd0a45b960ecc97451381ce5");
    for (const file of manifest.files) {
      let source = readFileSync(file.local, "utf8");
      expect(source.startsWith(file.header)).toBe(true);
      source = source.slice(file.header.length);
      for (const [from, to] of file.importReplacements) source = source.replace(to, from);
      expect(createHash("sha256").update(source).digest("hex"), file.local).toBe(file.sha256);
    }
  });

  it("has no runtime imports in the two reused modules", () => {
    for (const file of manifest.files.filter((file) => file.local.endsWith(".ts"))) {
      const imports = readFileSync(file.local, "utf8").split("\n").filter((line) => line.startsWith("import"));
      expect(imports.every((line) => line.startsWith("import type") || line.startsWith("import { type"))).toBe(true);
    }
  });

  it("handles empty trees and includes early descendants and late finishes", () => {
    expect(findEarliestStartTime([])).toBeNull();
    expect(calculateTraceDuration([], new Date(0))).toBe(0);
    const roots = [node("r", 5000, 9000, [node("early", 1000, 2000), node("late", 7000, 12000)])];
    const origin = findEarliestStartTime(roots)!;
    expect(origin.getTime()).toBe(1000);
    expect(calculateTraceDuration(roots, origin)).toBe(11);
  });

  it("keeps upstream offset-aware root latency fallback", () => {
    const root = { ...node("r", 3000, null, [node("c", 0, null)]), latency: 10 };
    expect(calculateTraceDuration([root], findEarliestStartTime([root])!)).toBe(13);
  });

  it("traverses deep trees iteratively for time bounds", () => {
    let root = node("leaf", 0, 2000);
    for (let i = 0; i < 5000; i++) root = node(`r${i}`, 1000, 1500, [root]);
    expect(findEarliestStartTime([root])!.getTime()).toBe(0);
    expect(calculateTraceDuration([root], new Date(0))).toBe(2);
  });

  it("sorts siblings in tree order without sorting original arrays", () => {
    const roots = [node("b", 20, 30), node("a", 0, 10, [node("a2", 5, 9), node("a1", 1, 3)])];
    const before = structuredClone(roots);
    const flat = flattenTreeOrder(roots);
    expect(flat.map((row) => row.node.id)).toEqual(["a", "a1", "a2", "b"]);
    expect(flat.map((row) => row.treeLines.length)).toEqual([0, 1, 1, 0]);
    expect(roots).toEqual(before);
  });

  it("skips only the synthetic TRACE wrapper, not AGENT roots", () => {
    expect(flattenTreeOrder([{ ...node("wrapper", 0, 10, [node("c")]), type: "TRACE" }]).map((row) => row.node.id)).toEqual(["c"]);
    expect(flattenTreeOrder([{ ...node("agent", 0, 10, [node("c")]), type: "AGENT" }]).map((row) => row.node.id)).toEqual(["agent", "c"]);
    expect(flattenTreeOrder([])).toEqual([]);
  });

  it("centers initially, minimally reveals offscreen rows and does not move visible rows", () => {
    const args = { index: 7, rowHeight: 64, scrollTop: 0, clientHeight: 320, isInitial: false };
    expect(computeSelectionScrollTarget(args)).toEqual({ top: 192 });
    expect(computeSelectionScrollTarget({ ...args, isInitial: true })).toEqual({ top: 320 });
    expect(computeSelectionScrollTarget({ ...args, index: 1, scrollTop: 256 })).toEqual({ top: 64 });
    expect(computeSelectionScrollTarget({ ...args, index: 1 })).toEqual({ top: 0 });
  });
});

describe("local bounded OTel adapter", () => {
  it("uses the reused tree/time math and preserves fractional duration and source objects", () => {
    const spans = [span("root", 10.25, 30.75), span("early", 5.25, 8.75, "root"), span("late", 20.25, 40.75, "root")];
    const before = structuredClone(spans), view = buildTraceInspector(spans);
    expect(view.durationMs).toBe(35);
    expect(view.rows.map((r) => [r.span.spanId, r.depth, r.offsetMs, r.durationMs])).toEqual([["root", 0, 5, 20.5], ["early", 1, 0, 3.5], ["late", 1, 15, 20.5]]);
    expect(view.rows.every((r) => r.leftPercent + r.widthPercent <= 100.000001)).toBe(true);
    expect(spans).toEqual(before);
  });

  it("keeps empty and zero-duration coordinates finite", () => {
    expect(buildTraceInspector([])).toEqual({ durationMs: 0, rows: [] });
    expect(buildTraceInspector([span("zero", 1, 1)]).rows[0]).toMatchObject({ offsetMs: 0, durationMs: 0, leftPercent: 0, widthPercent: 0 });
  });

  it("rejects mixed traces, duplicate IDs, missing parents, self-links and cycles", () => {
    for (const spans of [
      [span("a"), { ...span("b"), traceId: "other" }], [span("a"), span("a")],
      [span("a", 0, 1, "absent")], [span("a", 0, 1, "a")],
      [span("root"), span("a", 0, 1, "b"), span("b", 0, 1, "a")],
    ]) expect(() => buildTraceInspector(spans)).toThrow(TRACE_INPUT_ERROR);
  });

  it("rejects non-finite, reversed and Date-out-of-range times without echoing data", () => {
    for (const pair of [[NaN, 1], [0, Infinity], [2, 1], [1e20, 1e20]]) {
      expect(() => buildTraceInspector([span("synthetic-private-id", pair[0], pair[1])])).toThrow(TRACE_INPUT_ERROR);
    }
  });

  it("bounds row count before traversal and refuses excessive depth", () => {
    expect(() => buildTraceInspector(Array.from({ length: TRACE_INSPECTOR_LIMIT + 1 }, (_, i) => span(`s${i}`)))).toThrow("1000");
    const deep = Array.from({ length: TRACE_DEPTH_LIMIT + 2 }, (_, i) => span(`s${i}`, 0, 1, i ? `s${i - 1}` : undefined));
    expect(() => buildTraceInspector(deep)).toThrow("128");
    expect(buildTraceInspector(deep.slice(0, -1)).rows).toHaveLength(129);
  });

  it("consumes actual local SDK output without inventing root failure or adding overlapping time", async () => {
    const experiment = await runLocalAgentExperiment();
    for (const root of experiment.spans.filter((s) => !s.parentSpanId)) {
      const view = buildTraceInspector(experiment.spans.filter((s) => s.traceId === root.traceId));
      expect(view.rows[0].span.spanId).toBe(root.spanId);
      expect(view.rows[0].span.status).toBe("ok");
      expect(view.durationMs).toBe(new Date(root.endTimeMs).getTime() - new Date(root.startTimeMs).getTime());
    }
  });
});
