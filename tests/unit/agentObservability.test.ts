import { afterEach, describe, expect, it, vi } from "vitest";
import { trace } from "@opentelemetry/api";
import { serializeAgentExperiment, summarizeAgentExperiment } from "@/lib/agentObservability";
import { runLocalAgentExperiment } from "@/services/runLocalAgentExperiment";

afterEach(() => vi.restoreAllMocks());

describe("local OTel agent experiments (real SDK, simulated decisions)", () => {
  it("records three complete tasks and distinguishes a recovered tool failure", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const provider = trace.getTracerProvider();
    const result = await runLocalAgentExperiment();
    expect(result.spans).toHaveLength(14);
    expect(result).toMatchObject({ source: "local-mock-otel", modelCalls: 0, tokens: null, modelCost: null });
    const summaries = summarizeAgentExperiment(result);
    expect(summaries.map(({ scenario, spanCount, toolCalls, errorSteps, retries, status }) =>
      ({ scenario, spanCount, toolCalls, errorSteps, retries, status }))).toEqual([
      { scenario: "workflow", spanCount: 3, toolCalls: 1, errorSteps: 0, retries: 0, status: "ok" },
      { scenario: "retry", spanCount: 5, toolCalls: 2, errorSteps: 1, retries: 1, status: "ok" },
      { scenario: "collaboration", spanCount: 6, toolCalls: 2, errorSteps: 0, retries: 0, status: "ok" },
    ]);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(trace.getTracerProvider()).toBe(provider);
    for (const span of result.spans) {
      expect(span.traceId).toMatch(/^[a-f0-9]{32}$/);
      expect(span.spanId).toMatch(/^[a-f0-9]{16}$/);
      expect(span.endTimeMs).toBeGreaterThanOrEqual(span.startTimeMs);
      expect(Object.keys(span.attributes).every((key) => key.startsWith("eval."))).toBe(true);
      if (span.parentSpanId) {
        const parent = result.spans.find((item) => item.spanId === span.parentSpanId);
        expect(parent?.traceId).toBe(span.traceId);
        expect(parent!.startTimeMs).toBeLessThanOrEqual(span.startTimeMs);
        expect(parent!.endTimeMs).toBeGreaterThanOrEqual(span.endTimeMs);
      }
    }
  });

  it("keeps concurrent tools under their respective agents and counts root wall time", async () => {
    const result = await runLocalAgentExperiment();
    const root = result.spans.find((span) => span.attributes["eval.scenario"] === "collaboration")!;
    const tools = result.spans.filter((span) => span.traceId === root.traceId && span.kind === "tool");
    expect(new Set(tools.map((span) => span.parentSpanId)).size).toBe(2);
    expect(tools.every((span) => span.parentSpanId !== root.spanId)).toBe(true);
    expect(summarizeAgentExperiment(result)[2].durationMs).toBe(root.endTimeMs - root.startTimeMs);
    root.startTimeMs = 100;
    root.endTimeMs = 200;
    tools.forEach((span) => { span.startTimeMs = 110; span.endTimeMs = 190; });
    expect(summarizeAgentExperiment(result)[2].durationMs).toBe(100);
  });

  it("roundtrips the portable schema and creates fresh IDs for each run", async () => {
    const first = await runLocalAgentExperiment();
    const second = await runLocalAgentExperiment();
    expect(JSON.parse(serializeAgentExperiment(first))).toEqual(JSON.parse(JSON.stringify(first)));
    const firstIds = new Set(first.spans.map((span) => span.traceId));
    expect(second.spans.every((span) => !firstIds.has(span.traceId))).toBe(true);
  });

  it("rejects cancelled runs, including mid-flight, and allows a clean subsequent run", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(runLocalAgentExperiment(controller.signal)).rejects.toThrow("已停止");
    const inFlight = new AbortController();
    const pending = runLocalAgentExperiment(inFlight.signal);
    const assertion = expect(pending).rejects.toThrow("已停止");
    inFlight.abort();
    await assertion;
    expect((await runLocalAgentExperiment()).spans).toHaveLength(14);
  });

  it("does not invent a scenario for unknown experiment metadata", async () => {
    const result = await runLocalAgentExperiment();
    result.spans.find((span) => !span.parentSpanId)!.attributes["eval.scenario"] = "unknown";
    expect(() => summarizeAgentExperiment(result)).toThrow("未知");
  });
});
